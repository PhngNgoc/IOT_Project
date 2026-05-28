#include "temp_humi_monitor.h"
#include "task_webserver.h"

DHT20 dht20;
LiquidCrystal_I2C lcd(33, 16, 2);

namespace
{
    constexpr uint8_t I2C_SDA_PIN = 11;
    constexpr uint8_t I2C_SCL_PIN = 12;
}

void temp_humi_monitor(void *pvParameters)
{
    Serial.begin(115200);
    dht20.begin(I2C_SDA_PIN, I2C_SCL_PIN);

    lcd.begin(I2C_SDA_PIN, I2C_SCL_PIN);
    lcd.backlight();
    lcd.setCursor(0, 0);
    lcd.print("Khoi tao LCD...");

    while (1)
    {
        dht20.read();

        float temperature = dht20.getTemperature();
        float humidity = dht20.getHumidity();

        if (isnan(temperature) || isnan(humidity))
        {
            Serial.println("Failed to read from DHT sensor!");
            temperature = -1;
            humidity = -1;

            lcd.clear();
            lcd.setCursor(0, 0);
            lcd.print("Loi cam bien!");
        }
        else
        {
            if (temperature < 25.0)
            {
                xSemaphoreGive(semTempNormal);
            }
            else if (temperature <= 30.0)
            {
                xSemaphoreGive(semTempWarn);
            }
            else
            {
                xSemaphoreGive(semTempCrit);
            }

            if (humidity < 40.0)
            {
                xSemaphoreGive(semHumiLow);
            }
            else if (humidity <= 70.0)
            {
                xSemaphoreGive(semHumiNormal);
            }
            else
            {
                xSemaphoreGive(semHumiHigh);
            }

            lcd.clear();
            lcd.setCursor(0, 0);
            lcd.print("Temp: ");
            lcd.print(temperature, 1);
            lcd.print(" C");

            lcd.setCursor(0, 1);
            lcd.print("Humi: ");
            lcd.print(humidity, 1);
            lcd.print(" %");
        }

        if (!setSensorValues(temperature, humidity))
        {
            Serial.println("Failed to write sensor values to queues");
        }

        StaticJsonDocument<128> doc;
        doc["page"] = "sensor";
        doc["temperature"] = temperature;
        doc["humidity"] = humidity;

        String payload;
        serializeJson(doc, payload);
        Webserver_sendata(payload);

        Serial.print("Do am: ");
        Serial.print(humidity, 2);
        Serial.print("% | Nhiet do: ");
        Serial.print(temperature, 2);
        Serial.println(" C");

        vTaskDelay(pdMS_TO_TICKS(5000));
    }
}
