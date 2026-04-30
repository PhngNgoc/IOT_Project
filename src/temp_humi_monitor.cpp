#include "temp_humi_monitor.h"
#include "task_webserver.h"

DHT20 dht20;
// Màn hình LCD được khai báo ở địa chỉ 33 (0x21), 16 cột, 2 hàng
LiquidCrystal_I2C lcd(33,16,2); 

namespace
{
    constexpr uint8_t I2C_SDA_PIN = 11;
    constexpr uint8_t I2C_SCL_PIN = 12;
}

void temp_humi_monitor(void *pvParameters){
    Serial.begin(115200);
    dht20.begin(I2C_SDA_PIN, I2C_SCL_PIN);

    // --- THÊM PHẦN KHỞI TẠO LCD Ở ĐÂY ---
    lcd.begin(I2C_SDA_PIN, I2C_SCL_PIN); // Khởi tạo màn hình
    lcd.backlight();  // Bật đèn nền
    lcd.setCursor(0, 0);
    lcd.print("Khoi tao LCD...");
    // ------------------------------------

    while (1){
        dht20.read();
        SensorData data;
        // Reading temperature in Celsius
        data.temperature = dht20.getTemperature();
        // Reading humidity
        data.humidity = dht20.getHumidity();
        
        // Check if any reads failed and exit early
        if (isnan(data.temperature) || isnan(data.humidity)) {
            Serial.println("Failed to read from DHT sensor!");
            data.temperature = data.humidity =  -1;
            
            // --- IN BÁO LỖI LÊN LCD ---
            lcd.clear();
            lcd.setCursor(0, 0);
            lcd.print("Loi cam bien!");
            // --------------------------
        } else {
            // Give semaphore for Temperature thresholds
            if (data.temperature < 25.0) {
                xSemaphoreGive(semTempNormal);
            } else if (data.temperature <= 30.0) {
                xSemaphoreGive(semTempWarn);
            } else {
                xSemaphoreGive(semTempCrit);
            }
            
            // Give semaphore for Humidity thresholds
            if (data.humidity < 40.0) {
                xSemaphoreGive(semHumiLow);
            } else if (data.humidity <= 70.0) {
                xSemaphoreGive(semHumiNormal);
            } else {
                xSemaphoreGive(semHumiHigh);
            }

            // --- IN NHIỆT ĐỘ, ĐỘ ẨM LÊN LCD ---
            lcd.clear();                 // Xóa màn hình cũ
            
            // Hàng 1: Nhiệt độ
            lcd.setCursor(0, 0);         // Cột 0, hàng 0
            lcd.print("Temp: ");
            lcd.print(data.temperature, 1); // In 1 số thập phân
            lcd.print(" C");

            // Hàng 2: Độ ẩm
            lcd.setCursor(0, 1);         // Cột 0, hàng 1
            lcd.print("Humi: ");
            lcd.print(data.humidity, 1); // In 1 số thập phân
            lcd.print(" %");
            // ----------------------------------
        }

        // Cập nhật biến toàn cục
        glob_temperature = data.temperature;
        glob_humidity = data.humidity;

        StaticJsonDocument<128> doc;
        doc["page"] = "sensor";
        doc["temperature"] = data.temperature;
        doc["humidity"] = data.humidity;
        String payload;
        serializeJson(doc, payload);
        Webserver_sendata(payload);

        // Print the results
        Serial.print("Do am: ");
        Serial.print(data.humidity, 2);
        Serial.print("% | Nhiet do: ");
        Serial.print(data.temperature, 2);
        Serial.println(" C");
        
        vTaskDelay(pdMS_TO_TICKS(5000));
    }
}
