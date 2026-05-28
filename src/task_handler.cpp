#include <task_handler.h>
#include "task_webserver.h"
#include "coreiot.h"
#include <ESP32Servo.h>

namespace
{
    constexpr int MAX_SERVO_COUNT = 8;
    Servo servoSlots[MAX_SERVO_COUNT];
    int servoGpios[MAX_SERVO_COUNT] = {-1, -1, -1, -1, -1, -1, -1, -1};
    bool servoTimersAllocated = false;

    void allocateServoTimers()
    {
        if (servoTimersAllocated)
        {
            return;
        }

        ESP32PWM::allocateTimer(0);
        ESP32PWM::allocateTimer(1);
        ESP32PWM::allocateTimer(2);
        ESP32PWM::allocateTimer(3);
        servoTimersAllocated = true;
    }

    int findServoSlot(int gpio)
    {
        for (int i = 0; i < MAX_SERVO_COUNT; i++)
        {
            if (servoGpios[i] == gpio)
            {
                return i;
            }
        }

        return -1;
    }

    int getServoSlot(int gpio)
    {
        int slot = findServoSlot(gpio);
        if (slot >= 0)
        {
            return slot;
        }

        for (int i = 0; i < MAX_SERVO_COUNT; i++)
        {
            if (servoGpios[i] < 0)
            {
                servoGpios[i] = gpio;
                servoSlots[i].setPeriodHertz(50);
                servoSlots[i].attach(gpio, 500, 2400);
                return i;
            }
        }

        return -1;
    }

    void saveCoreIotDevicePins()
    {
        Save_info_File(WIFI_SSID,
                       WIFI_PASS,
                       CORE_IOT_TOKEN,
                       CORE_IOT_SERVER,
                       CORE_IOT_PORT,
                       false,
                       CORE_IOT_RELAY_GPIO,
                       CORE_IOT_RELAY_GET_METHOD,
                       CORE_IOT_RELAY_SET_METHOD,
                       CORE_IOT_SENSOR_TOKEN,
                       CORE_IOT_RELAY_TOKEN,
                       CORE_IOT_SERVO_TOKEN);
    }
}

bool setRelayState(int gpio, bool isOn)
{
    if (gpio < 0 || gpio > 39)
    {
        Serial.printf("Invalid GPIO for relay: %d\n", gpio);
        return false;
    }

    const String selectedGpio(gpio);
    const bool gpioChanged = selectedGpio != CORE_IOT_RELAY_GPIO;
    CORE_IOT_RELAY_GPIO = selectedGpio;
    CORE_IOT_RELAY_STATE = isOn;
    if (gpioChanged)
    {
        saveCoreIotDevicePins();
    }

    pinMode(gpio, OUTPUT);
    digitalWrite(gpio, isOn ? HIGH : LOW);
    Serial.printf("GPIO %d %s\n", gpio, isOn ? "ON" : "OFF");
    return true;
}

bool setServoAngle(int gpio, int angle)
{
    if (gpio < 0 || gpio > 39)
    {
        Serial.printf("Invalid GPIO for servo: %d\n", gpio);
        return false;
    }

    allocateServoTimers();
    const int slot = getServoSlot(gpio);
    if (slot < 0)
    {
        Serial.println("No available servo slot");
        return false;
    }

    const String selectedGpio(gpio);
    const bool gpioChanged = selectedGpio != CORE_IOT_SERVO_GPIO;
    const int clampedAngle = constrain(angle, 0, 180);
    CORE_IOT_SERVO_GPIO = selectedGpio;
    CORE_IOT_SERVO_ANGLE = clampedAngle;
    if (gpioChanged)
    {
        saveCoreIotDevicePins();
    }

    servoSlots[slot].write(clampedAngle);
    Serial.printf("Servo GPIO %d angle %d\n", gpio, clampedAngle);
    return true;
}

void handleWebSocketMessage(String message)
{
    Serial.println(message);
    StaticJsonDocument<256> doc;

    DeserializationError error = deserializeJson(doc, message);
    if (error)
    {
        Serial.println("❌ Lỗi parse JSON!");
        return;
    }
    JsonObject value = doc["value"];
    if (doc["page"] == "device")
    {
        if (value.containsKey("angle"))
        {
            if (!value.containsKey("gpio"))
            {
                Serial.println("Servo JSON missing gpio");
                return;
            }

            int gpio = value["gpio"];
            int angle = constrain(value["angle"].as<int>(), 0, 180);
            if (setServoAngle(gpio, angle))
            {
                CoreIOT_publishServoState(gpio, angle);
            }
            return;
        }

        if (!value.containsKey("gpio") || !value.containsKey("status"))
        {
            Serial.println("⚠️ JSON thiếu thông tin gpio hoặc status");
            return;
        }

        int gpio = value["gpio"];
        String status = value["status"].as<String>();

        Serial.printf("⚙️ Điều khiển GPIO %d → %s\n", gpio, status.c_str());
        if (status.equalsIgnoreCase("ON"))
        {
            setRelayState(gpio, true);
            CoreIOT_publishRelayState(gpio, true);
            Serial.printf("🔆 GPIO %d ON\n", gpio);
        }
        else if (status.equalsIgnoreCase("OFF"))
        {
            setRelayState(gpio, false);
            CoreIOT_publishRelayState(gpio, false);
            Serial.printf("💤 GPIO %d OFF\n", gpio);
        }
    }
    else if (doc["page"] == "setting")
    {
        String new_wifi_ssid = value["ssid"].as<String>();
        String new_wifi_pass = value["password"].as<String>();
        String new_core_iot_sensor_token = value.containsKey("sensor_token") ? value["sensor_token"].as<String>() : value["token"].as<String>();
        String new_core_iot_relay_token = value.containsKey("relay_token") ? value["relay_token"].as<String>() : CORE_IOT_RELAY_TOKEN;
        String new_core_iot_servo_token = value.containsKey("servo_token") ? value["servo_token"].as<String>() : CORE_IOT_SERVO_TOKEN;
        String new_core_iot_server = value["server"].as<String>();
        String new_core_iot_port = value["port"].as<String>();

        Serial.println("Received configuration from WebSocket:");
        Serial.println("SSID: " + new_wifi_ssid);
        Serial.println("PASS: " + new_wifi_pass);
        Serial.println("SENSOR TOKEN: " + new_core_iot_sensor_token);
        Serial.println("RELAY TOKEN: " + new_core_iot_relay_token);
        Serial.println("SERVO TOKEN: " + new_core_iot_servo_token);
        Serial.println("SERVER: " + new_core_iot_server);
        Serial.println("PORT: " + new_core_iot_port);

        WIFI_SSID = new_wifi_ssid;
        WIFI_PASS = new_wifi_pass;
        CORE_IOT_SENSOR_TOKEN = new_core_iot_sensor_token;
        CORE_IOT_RELAY_TOKEN = new_core_iot_relay_token;
        CORE_IOT_SERVO_TOKEN = new_core_iot_servo_token;
        CORE_IOT_TOKEN = CORE_IOT_SENSOR_TOKEN;
        CORE_IOT_SERVER = new_core_iot_server;
        CORE_IOT_PORT = new_core_iot_port;

        Save_info_File(WIFI_SSID,
                       WIFI_PASS,
                       CORE_IOT_TOKEN,
                       CORE_IOT_SERVER,
                       CORE_IOT_PORT,
                       false,
                       CORE_IOT_RELAY_GPIO,
                       CORE_IOT_RELAY_GET_METHOD,
                       CORE_IOT_RELAY_SET_METHOD,
                       CORE_IOT_SENSOR_TOKEN,
                       CORE_IOT_RELAY_TOKEN,
                       CORE_IOT_SERVO_TOKEN);
        CoreIOT_requestReconnect();
        Wifi_request_connect();

        // Phản hồi lại client (tùy chọn)
        String msg = "{\"status\":\"connecting\",\"page\":\"setting_saved\"}";
        ws.textAll(msg);
    }
}
