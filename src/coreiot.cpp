#include "coreiot.h"
#include "task_handler.h"
#include "task_webserver.h"

// ----------- CONFIGURE THESE! -----------
const char* coreIOT_Server = "10.235.76.226";  
const char* coreIOT_Token = "g7drm1amhd3dchr379xu";   // Device Access Token
const int   mqttPort = 1883;
// ----------------------------------------

constexpr char MQTT_TELEMETRY_TOPIC[] = "v1/devices/me/telemetry";
constexpr uint32_t SENSOR_TELEMETRY_INTERVAL_MS = 10000;
constexpr uint32_t DEVICE_STATE_INTERVAL_MS = 10000;
constexpr uint32_t MQTT_RECONNECT_INTERVAL_MS = 5000;

WiFiClient sensorEspClient;
WiFiClient relayEspClient;
WiFiClient servoEspClient;
PubSubClient sensorClient(sensorEspClient);
PubSubClient relayClient(relayEspClient);
PubSubClient servoClient(servoEspClient);

namespace
{
  uint16_t mqttPortFromConfig()
  {
    const int configuredPort = CORE_IOT_PORT.toInt();
    return configuredPort > 0 ? static_cast<uint16_t>(configuredPort) : mqttPort;
  }

  bool hasSensorConfig()
  {
    return !CORE_IOT_SERVER.isEmpty() && !CORE_IOT_SENSOR_TOKEN.isEmpty();
  }

  bool hasRelayConfig()
  {
    return !CORE_IOT_SERVER.isEmpty() && !CORE_IOT_RELAY_TOKEN.isEmpty();
  }

  bool hasServoConfig()
  {
    return !CORE_IOT_SERVER.isEmpty() && !CORE_IOT_SERVO_TOKEN.isEmpty();
  }

  int configuredRelayGpio()
  {
    const int gpio = CORE_IOT_RELAY_GPIO.toInt();
    return gpio >= 0 ? gpio : -1;
  }

  int configuredServoGpio()
  {
    const int gpio = CORE_IOT_SERVO_GPIO.toInt();
    return gpio >= 0 ? gpio : -1;
  }

  bool methodEquals(const char *method, const String &configuredMethod)
  {
    return configuredMethod.length() > 0 && strcmp(method, configuredMethod.c_str()) == 0;
  }

  String rpcResponseTopic(const char *requestTopic)
  {
    const String topicString(requestTopic);
    const int requestIdStart = topicString.lastIndexOf('/');
    if (requestIdStart < 0)
    {
      return "";
    }

    return "v1/devices/me/rpc/response/" + topicString.substring(requestIdStart + 1);
  }

  bool readRelayState(JsonVariant value, bool &relayOn)
  {
    if (value.is<bool>())
    {
      relayOn = value.as<bool>();
      return true;
    }

    if (value.is<int>())
    {
      relayOn = value.as<int>() != 0;
      return true;
    }

    if (value.is<const char *>())
    {
      const String status = value.as<String>();
      if (status.equalsIgnoreCase("ON") || status.equalsIgnoreCase("TRUE") || status == "1")
      {
        relayOn = true;
        return true;
      }

      if (status.equalsIgnoreCase("OFF") || status.equalsIgnoreCase("FALSE") || status == "0")
      {
        relayOn = false;
        return true;
      }
    }

    return false;
  }

  bool readServoAngle(JsonVariant value, int &angle)
  {
    if (value.is<int>())
    {
      angle = constrain(value.as<int>(), 0, 180);
      return true;
    }

    if (value.is<float>() || value.is<double>())
    {
      angle = constrain(static_cast<int>(round(value.as<float>())), 0, 180);
      return true;
    }

    if (value.is<const char *>())
    {
      const String angleText = value.as<String>();
      if (angleText.length() == 0)
      {
        return false;
      }

      angle = constrain(angleText.toInt(), 0, 180);
      return true;
    }

    return false;
  }

  bool readGpioFromMethod(const char *method, int &gpio)
  {
    const String methodName(method);
    int digitStart = methodName.length();

    while (digitStart > 0 && isDigit(methodName[digitStart - 1]))
    {
      digitStart--;
    }

    if (digitStart == methodName.length())
    {
      return false;
    }

    gpio = methodName.substring(digitStart).toInt();
    return true;
  }

  bool readRelayCommand(const char *method, JsonVariant params, int &gpio, bool &relayOn)
  {
    gpio = configuredRelayGpio();
    bool hasGpio = gpio >= 0;
    if (!hasGpio)
    {
      hasGpio = readGpioFromMethod(method, gpio);
    }

    if (params.is<JsonObject>())
    {
      JsonObject command = params.as<JsonObject>();
      if (command.containsKey("gpio"))
      {
        gpio = command["gpio"].as<int>();
        hasGpio = true;
      }

      if (command.containsKey("status"))
      {
        return hasGpio && readRelayState(command["status"], relayOn);
      }

      if (command.containsKey("state"))
      {
        return hasGpio && readRelayState(command["state"], relayOn);
      }

      if (command.containsKey("value"))
      {
        return hasGpio && readRelayState(command["value"], relayOn);
      }

      return false;
    }

    return hasGpio && readRelayState(params, relayOn);
  }

  bool readServoCommand(const char *method, JsonVariant params, int &gpio, int &angle)
  {
    gpio = configuredServoGpio();
    bool hasGpio = gpio >= 0;
    if (!hasGpio)
    {
      hasGpio = readGpioFromMethod(method, gpio);
    }

    if (params.is<JsonObject>())
    {
      JsonObject command = params.as<JsonObject>();
      if (command.containsKey("gpio"))
      {
        gpio = command["gpio"].as<int>();
        hasGpio = true;
      }

      if (command.containsKey("angle"))
      {
        return hasGpio && readServoAngle(command["angle"], angle);
      }

      if (command.containsKey("value"))
      {
        return hasGpio && readServoAngle(command["value"], angle);
      }

      return false;
    }

    return hasGpio && readServoAngle(params, angle);
  }

  void publishRelayRpcResponse(PubSubClient &mqttClient, const char *requestTopic, bool success, int gpio, bool relayOn, const char *errorMessage = nullptr)
  {
    const String responseTopic = rpcResponseTopic(requestTopic);
    if (responseTopic.isEmpty())
    {
      return;
    }

    StaticJsonDocument<160> response;
    response["success"] = success;
    if (success)
    {
      response["gpio"] = gpio;
      response["status"] = relayOn ? "ON" : "OFF";
    }
    else
    {
      response["error"] = errorMessage ? errorMessage : "Invalid relay command";
    }

    String payload;
    serializeJson(response, payload);
    mqttClient.publish(responseTopic.c_str(), payload.c_str());
  }

  void publishServoRpcResponse(PubSubClient &mqttClient, const char *requestTopic, bool success, int gpio, int angle, const char *errorMessage = nullptr)
  {
    const String responseTopic = rpcResponseTopic(requestTopic);
    if (responseTopic.isEmpty())
    {
      return;
    }

    StaticJsonDocument<160> response;
    response["success"] = success;
    if (success)
    {
      response["gpio"] = gpio;
      response["angle"] = angle;
    }
    else
    {
      response["error"] = errorMessage ? errorMessage : "Invalid servo command";
    }

    String payload;
    serializeJson(response, payload);
    mqttClient.publish(responseTopic.c_str(), payload.c_str());
  }

  void publishRpcValueResponse(PubSubClient &mqttClient, const char *requestTopic, const char *value)
  {
    const String responseTopic = rpcResponseTopic(requestTopic);
    if (responseTopic.isEmpty())
    {
      return;
    }

    mqttClient.publish(responseTopic.c_str(), value);
  }

  void publishRelayState(int gpio, bool relayOn)
  {
    if (!relayClient.connected())
    {
      return;
    }

    StaticJsonDocument<96> state;
    const String key = "relay_" + String(gpio);
    state[key.c_str()] = relayOn;
    state["relay_state"] = relayOn ? "ON" : "OFF";

    String payload;
    serializeJson(state, payload);
    relayClient.publish(MQTT_TELEMETRY_TOPIC, payload.c_str());
  }

  void publishServoState(int gpio, int angle)
  {
    if (!servoClient.connected())
    {
      return;
    }

    StaticJsonDocument<96> state;
    const String key = "servo_" + String(gpio);
    state[key.c_str()] = angle;
    state["servo_angle"] = angle;

    String payload;
    serializeJson(state, payload);
    servoClient.publish(MQTT_TELEMETRY_TOPIC, payload.c_str());
  }

  bool connectMqttClient(PubSubClient &mqttClient, const String &token, const char *clientPrefix, bool subscribeRpc)
  {
    if (WiFi.status() != WL_CONNECTED)
    {
      return false;
    }

    if (CORE_IOT_SERVER.isEmpty() || token.isEmpty())
    {
      return false;
    }

    Serial.print("Attempting MQTT connection for ");
    Serial.print(clientPrefix);
    Serial.print(" to ");
    Serial.print(CORE_IOT_SERVER);
    Serial.print(":");
    Serial.print(mqttPortFromConfig());
    Serial.print("...");

    mqttClient.setServer(CORE_IOT_SERVER.c_str(), mqttPortFromConfig());

    String clientId = clientPrefix;
    clientId += "-";
    clientId += String(random(0xffff), HEX);

    if (!mqttClient.connect(clientId.c_str(), token.c_str(), NULL))
    {
      Serial.print("failed, rc=");
      Serial.println(mqttClient.state());
      return false;
    }

    Serial.println("connected!");

    if (subscribeRpc)
    {
      mqttClient.subscribe("v1/devices/me/rpc/request/+");
      Serial.print(clientPrefix);
      Serial.println(" subscribed to v1/devices/me/rpc/request/+");
    }

    return true;
  }

  void notifyWebRelayState(int gpio, bool relayOn)
  {
    StaticJsonDocument<128> update;
    update["page"] = "device";
    JsonObject value = update.createNestedObject("value");
    value["gpio"] = gpio;
    value["status"] = relayOn ? "ON" : "OFF";

    String payload;
    serializeJson(update, payload);
    Webserver_sendata(payload);
  }

  void notifyWebServoState(int gpio, int angle)
  {
    StaticJsonDocument<128> update;
    update["page"] = "device";
    JsonObject value = update.createNestedObject("value");
    value["type"] = "servo";
    value["gpio"] = gpio;
    value["angle"] = angle;

    String payload;
    serializeJson(update, payload);
    Webserver_sendata(payload);
  }
}

void relayCallback(char* topic, byte* payload, unsigned int length) {
  Serial.print("Message arrived [");
  Serial.print(topic);
  Serial.println("] ");

  // Allocate a temporary buffer for the message
  char message[length + 1];
  memcpy(message, payload, length);
  message[length] = '\0';
  Serial.print("Payload: ");
  Serial.println(message);

  // Parse JSON
  StaticJsonDocument<256> doc;
  DeserializationError error = deserializeJson(doc, message);

  if (error) {
    Serial.print("deserializeJson() failed: ");
    Serial.println(error.c_str());
    return;
  }

  const char* method = doc["method"] | "";
  JsonVariant params = doc["params"];

  if (methodEquals(method, CORE_IOT_RELAY_GET_METHOD) ||
      strcmp(method, "getValueFan") == 0 ||
      strcmp(method, "getRelay") == 0 ||
      strcmp(method, "getRelayState") == 0) {
    publishRpcValueResponse(relayClient, topic, CORE_IOT_RELAY_STATE ? "true" : "false");
    Serial.printf("CoreIoT relay state request: %s\n", CORE_IOT_RELAY_STATE ? "ON" : "OFF");
  } else if (methodEquals(method, CORE_IOT_RELAY_SET_METHOD) ||
      strcmp(method, "setValueFan") == 0 ||
      strcmp(method, "setRelay") == 0 ||
      strcmp(method, "setRelayState") == 0 ||
      strcmp(method, "setRelaySwitchValue") == 0 ||
      strcmp(method, "setStateLED") == 0 ||
      String(method).startsWith("setRelay")) {
    int gpio = -1;
    bool relayOn = false;

    if (!readRelayCommand(method, params, gpio, relayOn)) {
      Serial.println("Invalid relay RPC. Use params like {\"gpio\":25,\"status\":\"ON\"}");
      publishRelayRpcResponse(relayClient, topic, false, gpio, relayOn);
      return;
    }

    if (!setRelayState(gpio, relayOn)) {
      publishRelayRpcResponse(relayClient, topic, false, gpio, relayOn, "Invalid GPIO");
      return;
    }

    publishRelayState(gpio, relayOn);
    notifyWebRelayState(gpio, relayOn);
    publishRpcValueResponse(relayClient, topic, relayOn ? "true" : "false");
    Serial.printf("CoreIoT relay command: GPIO %d -> %s\n", gpio, relayOn ? "ON" : "OFF");
  } else {
    Serial.print("Unknown method: ");
    Serial.println(method);
    publishRelayRpcResponse(relayClient, topic, false, -1, false, "Unknown relay RPC method");
  }
}

void servoCallback(char* topic, byte* payload, unsigned int length) {
  Serial.print("Message arrived [");
  Serial.print(topic);
  Serial.println("] ");

  char message[length + 1];
  memcpy(message, payload, length);
  message[length] = '\0';
  Serial.print("Payload: ");
  Serial.println(message);

  StaticJsonDocument<256> doc;
  DeserializationError error = deserializeJson(doc, message);

  if (error) {
    Serial.print("deserializeJson() failed: ");
    Serial.println(error.c_str());
    return;
  }

  const char* method = doc["method"] | "";
  JsonVariant params = doc["params"];

  if (strcmp(method, "getServo") == 0 ||
      strcmp(method, "getServoAngle") == 0 ||
      strcmp(method, "getAngle") == 0 ||
      strcmp(method, "getValueServo") == 0) {
    char angleText[8];
    snprintf(angleText, sizeof(angleText), "%d", CORE_IOT_SERVO_ANGLE);
    publishRpcValueResponse(servoClient, topic, angleText);
    Serial.printf("CoreIoT servo angle request: %d\n", CORE_IOT_SERVO_ANGLE);
  } else if (strcmp(method, "setServo") == 0 ||
      strcmp(method, "setServoAngle") == 0 ||
      strcmp(method, "setAngle") == 0 ||
      strcmp(method, "setValueServo") == 0 ||
      String(method).startsWith("setServo")) {
    int gpio = -1;
    int angle = 90;

    if (!readServoCommand(method, params, gpio, angle)) {
      Serial.println("Invalid servo RPC. Use params like {\"gpio\":26,\"angle\":90}");
      publishServoRpcResponse(servoClient, topic, false, gpio, angle);
      return;
    }

    if (!setServoAngle(gpio, angle)) {
      publishServoRpcResponse(servoClient, topic, false, gpio, angle, "Invalid GPIO");
      return;
    }

    if (String(gpio) == CORE_IOT_SERVO_GPIO) {
      CORE_IOT_SERVO_ANGLE = angle;
    }
    publishServoState(gpio, angle);
    notifyWebServoState(gpio, angle);

    char angleText[8];
    snprintf(angleText, sizeof(angleText), "%d", angle);
    publishRpcValueResponse(servoClient, topic, angleText);
    Serial.printf("CoreIoT servo command: GPIO %d -> %d\n", gpio, angle);
  } else {
    Serial.print("Unknown method: ");
    Serial.println(method);
    publishServoRpcResponse(servoClient, topic, false, -1, CORE_IOT_SERVO_ANGLE, "Unknown servo RPC method");
  }
}


void setup_coreiot(){

  //Serial.print("Connecting to WiFi...");
  //WiFi.begin(wifi_ssid, wifi_password);
  //while (WiFi.status() != WL_CONNECTED) {
  
  // while (isWifiConnected == false) {
  //   delay(500);
  //   Serial.print(".");
  // }

  while(1){
    if (xSemaphoreTake(xBinarySemaphoreInternet, portMAX_DELAY)) {
      break;
    }
    delay(500);
    Serial.print(".");
  }


  Serial.println(" Connected!");

  sensorClient.setServer(CORE_IOT_SERVER.c_str(), mqttPortFromConfig());
  relayClient.setServer(CORE_IOT_SERVER.c_str(), mqttPortFromConfig());
  servoClient.setServer(CORE_IOT_SERVER.c_str(), mqttPortFromConfig());
  relayClient.setCallback(relayCallback);
  servoClient.setCallback(servoCallback);

}

void CoreIOT_requestReconnect()
{
  if (sensorClient.connected())
  {
    sensorClient.disconnect();
  }
  if (relayClient.connected())
  {
    relayClient.disconnect();
  }
  if (servoClient.connected())
  {
    servoClient.disconnect();
  }
  sensorClient.setServer(CORE_IOT_SERVER.c_str(), mqttPortFromConfig());
  relayClient.setServer(CORE_IOT_SERVER.c_str(), mqttPortFromConfig());
  servoClient.setServer(CORE_IOT_SERVER.c_str(), mqttPortFromConfig());
}

bool CoreIOT_publishSensorData(float temperature, float humidity)
{
  if (!sensorClient.connected())
  {
    Serial.println("Sensor MQTT client is not connected; telemetry was not published.");
    return false;
  }

  StaticJsonDocument<128> telemetry;
  telemetry["temperature"] = temperature;
  telemetry["humidity"] = humidity;

  String payload;
  serializeJson(telemetry, payload);

  const bool published = sensorClient.publish(MQTT_TELEMETRY_TOPIC, payload.c_str());
  Serial.print(published ? "Published sensor payload: " : "Failed to publish sensor payload: ");
  Serial.println(payload);

  return published;
}

void CoreIOT_publishRelayState()
{
  publishRelayState(CORE_IOT_RELAY_GPIO.toInt(), CORE_IOT_RELAY_STATE);
}

void CoreIOT_publishRelayState(int gpio, bool relayOn)
{
  publishRelayState(gpio, relayOn);
}

void CoreIOT_publishServoState(int gpio, int angle)
{
  publishServoState(gpio, constrain(angle, 0, 180));
}

void coreiot_task(void *pvParameters){

    setup_coreiot();
    uint32_t lastTelemetryMs = 0;
    uint32_t lastRelayTelemetryMs = 0;
    uint32_t lastReconnectMs = 0;

    while(1){

        const uint32_t now = millis();
        if (now - lastReconnectMs >= MQTT_RECONNECT_INTERVAL_MS)
        {
            lastReconnectMs = now;

            if (hasSensorConfig() && !sensorClient.connected())
            {
                connectMqttClient(sensorClient, CORE_IOT_SENSOR_TOKEN, "ESP32Sensor", false);
            }
            if (hasRelayConfig() && !relayClient.connected())
            {
                connectMqttClient(relayClient, CORE_IOT_RELAY_TOKEN, "ESP32Relay", true);
            }
            if (hasServoConfig() && !servoClient.connected())
            {
                connectMqttClient(servoClient, CORE_IOT_SERVO_TOKEN, "ESP32Servo", true);
            }
        }

        if (sensorClient.connected())
        {
            sensorClient.loop();
        }
        if (relayClient.connected())
        {
            relayClient.loop();
        }
        if (servoClient.connected())
        {
            servoClient.loop();
        }

        if (sensorClient.connected() && now - lastTelemetryMs >= SENSOR_TELEMETRY_INTERVAL_MS)
        {
            lastTelemetryMs = now;

            float temperature = 0;
            float humidity = 0;
            getSensorValues(temperature, humidity);

            CoreIOT_publishSensorData(temperature, humidity);
        }

        if ((relayClient.connected() || servoClient.connected()) && now - lastRelayTelemetryMs >= DEVICE_STATE_INTERVAL_MS)
        {
            lastRelayTelemetryMs = now;
            if (relayClient.connected())
            {
                publishRelayState(CORE_IOT_RELAY_GPIO.toInt(), CORE_IOT_RELAY_STATE);
                Serial.printf("Published relay state: GPIO %s -> %s\n",
                              CORE_IOT_RELAY_GPIO.c_str(),
                              CORE_IOT_RELAY_STATE ? "ON" : "OFF");
            }
            if (servoClient.connected())
            {
                publishServoState(CORE_IOT_SERVO_GPIO.toInt(), CORE_IOT_SERVO_ANGLE);
                Serial.printf("Published servo angle: GPIO %s -> %d\n",
                              CORE_IOT_SERVO_GPIO.c_str(),
                              CORE_IOT_SERVO_ANGLE);
            }
        }

        vTaskDelay(100 / portTICK_PERIOD_MS);
    }
}
