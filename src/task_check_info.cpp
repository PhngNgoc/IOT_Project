#include "task_check_info.h"

void Load_info_File()
{
  File file = LittleFS.open("/info.dat", "r");
  if (!file)
  {
    return;
  }
  DynamicJsonDocument doc(4096);
  DeserializationError error = deserializeJson(doc, file);
  if (error)
  {
    Serial.print(F("deserializeJson() failed: "));
  }
  else
  {
    WIFI_SSID = strdup(doc["WIFI_SSID"]);
    WIFI_PASS = strdup(doc["WIFI_PASS"]);
    CORE_IOT_TOKEN = doc["CORE_IOT_TOKEN"].as<String>();
    CORE_IOT_SENSOR_TOKEN = doc["CORE_IOT_SENSOR_TOKEN"].as<String>();
    CORE_IOT_RELAY_TOKEN = doc["CORE_IOT_RELAY_TOKEN"].as<String>();
    CORE_IOT_SERVO_TOKEN = doc["CORE_IOT_SERVO_TOKEN"].as<String>();
    if (CORE_IOT_SENSOR_TOKEN.isEmpty() && !CORE_IOT_TOKEN.isEmpty())
    {
      CORE_IOT_SENSOR_TOKEN = CORE_IOT_TOKEN;
    }
    if (!CORE_IOT_SENSOR_TOKEN.isEmpty())
    {
      CORE_IOT_TOKEN = CORE_IOT_SENSOR_TOKEN;
    }
    CORE_IOT_SERVER = strdup(doc["CORE_IOT_SERVER"]);
    CORE_IOT_PORT = strdup(doc["CORE_IOT_PORT"]);
    if (doc.containsKey("CORE_IOT_RELAY_GPIO"))
    {
      CORE_IOT_RELAY_GPIO = doc["CORE_IOT_RELAY_GPIO"].as<String>();
    }
    if (doc.containsKey("CORE_IOT_RELAY_GET_METHOD"))
    {
      CORE_IOT_RELAY_GET_METHOD = doc["CORE_IOT_RELAY_GET_METHOD"].as<String>();
    }
    if (doc.containsKey("CORE_IOT_RELAY_SET_METHOD"))
    {
      CORE_IOT_RELAY_SET_METHOD = doc["CORE_IOT_RELAY_SET_METHOD"].as<String>();
    }
    if (doc.containsKey("CORE_IOT_RELAY_STATE"))
    {
      CORE_IOT_RELAY_STATE = doc["CORE_IOT_RELAY_STATE"].as<bool>();
    }
    if (doc.containsKey("CORE_IOT_SERVO_GPIO"))
    {
      CORE_IOT_SERVO_GPIO = doc["CORE_IOT_SERVO_GPIO"].as<String>();
    }
    if (doc.containsKey("CORE_IOT_SERVO_ANGLE"))
    {
      CORE_IOT_SERVO_ANGLE = doc["CORE_IOT_SERVO_ANGLE"].as<int>();
    }
  }
  file.close();
}

void Delete_info_File()
{
  if (LittleFS.exists("/info.dat"))
  {
    LittleFS.remove("/info.dat");
  }
  ESP.restart();
}

void Save_info_File(String wifi_ssid,
                    String wifi_pass,
                    String CORE_IOT_TOKEN,
                    String CORE_IOT_SERVER,
                    String CORE_IOT_PORT,
                    bool restart_device,
                    String relay_gpio,
                    String relay_get_method,
                    String relay_set_method,
                    String sensor_token,
                    String relay_token,
                    String servo_token)
{
  Serial.println(wifi_ssid);
  Serial.println(wifi_pass);

  if (!CORE_IOT_TOKEN.isEmpty() && CORE_IOT_SENSOR_TOKEN.isEmpty())
  {
    CORE_IOT_SENSOR_TOKEN = CORE_IOT_TOKEN;
  }
  if (!sensor_token.isEmpty())
  {
    CORE_IOT_SENSOR_TOKEN = sensor_token;
  }
  if (!relay_token.isEmpty())
  {
    CORE_IOT_RELAY_TOKEN = relay_token;
  }
  if (!servo_token.isEmpty())
  {
    CORE_IOT_SERVO_TOKEN = servo_token;
  }
  if (!CORE_IOT_SENSOR_TOKEN.isEmpty())
  {
    CORE_IOT_TOKEN = CORE_IOT_SENSOR_TOKEN;
  }

  if (!relay_gpio.isEmpty())
  {
    CORE_IOT_RELAY_GPIO = relay_gpio;
  }
  if (!relay_get_method.isEmpty())
  {
    CORE_IOT_RELAY_GET_METHOD = relay_get_method;
  }
  if (!relay_set_method.isEmpty())
  {
    CORE_IOT_RELAY_SET_METHOD = relay_set_method;
  }

  DynamicJsonDocument doc(4096);
  doc["WIFI_SSID"] = wifi_ssid;
  doc["WIFI_PASS"] = wifi_pass;
  doc["CORE_IOT_TOKEN"] = CORE_IOT_TOKEN;
  doc["CORE_IOT_SENSOR_TOKEN"] = CORE_IOT_SENSOR_TOKEN;
  doc["CORE_IOT_RELAY_TOKEN"] = CORE_IOT_RELAY_TOKEN;
  doc["CORE_IOT_SERVO_TOKEN"] = CORE_IOT_SERVO_TOKEN;
  doc["CORE_IOT_SERVER"] = CORE_IOT_SERVER;
  doc["CORE_IOT_PORT"] = CORE_IOT_PORT;
  doc["CORE_IOT_RELAY_GPIO"] = CORE_IOT_RELAY_GPIO;
  doc["CORE_IOT_RELAY_GET_METHOD"] = CORE_IOT_RELAY_GET_METHOD;
  doc["CORE_IOT_RELAY_SET_METHOD"] = CORE_IOT_RELAY_SET_METHOD;
  doc["CORE_IOT_RELAY_STATE"] = CORE_IOT_RELAY_STATE;
  doc["CORE_IOT_SERVO_GPIO"] = CORE_IOT_SERVO_GPIO;
  doc["CORE_IOT_SERVO_ANGLE"] = CORE_IOT_SERVO_ANGLE;

  File configFile = LittleFS.open("/info.dat", "w");
  if (configFile)
  {
    serializeJson(doc, configFile);
    configFile.close();
  }
  else
  {
    Serial.println("Unable to save the configuration.");
  }
  if (restart_device)
  {
    ESP.restart();
  }
};

bool check_info_File(bool check)
{
  if (!check)
  {
    if (!LittleFS.begin(true))
    {
      Serial.println("❌ Lỗi khởi động LittleFS!");
      return false;
    }
    Load_info_File();
    startAP();
  }
  
  if (WIFI_SSID.isEmpty())
  {
    return false;
  }
  return true;
}
