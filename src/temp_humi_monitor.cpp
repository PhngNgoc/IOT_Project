#include "temp_humi_monitor.h"
DHT20 dht20;
LiquidCrystal_I2C lcd(33,16,2);


void temp_humi_monitor(void *pvParameters){

    Wire.begin(11, 12);
    Serial.begin(115200);
    dht20.begin();

    while (1){
        /* code */
        
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
            //return;
        }
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

        //Update global variables for temperature and humidity
        glob_temperature = data.temperature;
        glob_humidity = data.humidity;

        // Print the results
        
        Serial.print("Humidity: ");
        Serial.print(data.humidity);
        Serial.print("%  Temperature: ");
        Serial.print(data.temperature);
        Serial.println("°C");
        
        vTaskDelay(5000);
    }
    
}