#include <task_handler.h>

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
        if (!value.containsKey("gpio") || !value.containsKey("status"))
        {
            Serial.println("⚠️ JSON thiếu thông tin gpio hoặc status");
            return;
        }

        int gpio = value["gpio"];
        String status = value["status"].as<String>();

        Serial.printf("⚙️ Điều khiển GPIO %d → %s\n", gpio, status.c_str());
        pinMode(gpio, OUTPUT);
        if (status.equalsIgnoreCase("ON"))
        {
            digitalWrite(gpio, HIGH);
            Serial.printf("🔆 GPIO %d ON\n", gpio);
        }
        else if (status.equalsIgnoreCase("OFF"))
        {
            digitalWrite(gpio, LOW);
            Serial.printf("💤 GPIO %d OFF\n", gpio);
        }
    }
    else if (doc["page"] == "setting")
    {
        String new_wifi_ssid = value["ssid"].as<String>();
        String new_wifi_pass = value["password"].as<String>();
        String new_core_iot_token = value["token"].as<String>();
        String new_core_iot_server = value["server"].as<String>();
        String new_core_iot_port = value["port"].as<String>();

        Serial.println("📥 Nhận cấu hình từ WebSocket:");
        Serial.println("SSID: " + new_wifi_ssid);
        Serial.println("PASS: " + new_wifi_pass);
        Serial.println("TOKEN: " + new_core_iot_token);
        Serial.println("SERVER: " + new_core_iot_server);
        Serial.println("PORT: " + new_core_iot_port);

        // 👉 Gọi hàm lưu cấu hình
        WIFI_SSID = new_wifi_ssid;
        WIFI_PASS = new_wifi_pass;
        CORE_IOT_TOKEN = new_core_iot_token;
        CORE_IOT_SERVER = new_core_iot_server;
        CORE_IOT_PORT = new_core_iot_port;

        Save_info_File(WIFI_SSID, WIFI_PASS, CORE_IOT_TOKEN, CORE_IOT_SERVER, CORE_IOT_PORT, false);
        Wifi_request_connect();

        // Phản hồi lại client (tùy chọn)
        String msg = "{\"status\":\"connecting\",\"page\":\"setting_saved\"}";
        ws.textAll(msg);
    }
}
