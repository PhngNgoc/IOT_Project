#ifndef __GLOBAL_H__
#define __GLOBAL_H__

#include <Arduino.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/semphr.h"

typedef struct {
    float temperature;
    float humidity;
} SensorData;

extern float glob_temperature;
extern float glob_humidity;

extern String WIFI_SSID;
extern String WIFI_PASS;
extern String CORE_IOT_TOKEN;
extern String CORE_IOT_SERVER;
extern String CORE_IOT_PORT;

extern boolean isWifiConnected;
extern SemaphoreHandle_t xBinarySemaphoreInternet;

// Temperature
extern SemaphoreHandle_t semTempNormal;
extern SemaphoreHandle_t semTempWarn;
extern SemaphoreHandle_t semTempCrit;

// Humidity
extern SemaphoreHandle_t semHumiLow;
extern SemaphoreHandle_t semHumiNormal;
extern SemaphoreHandle_t semHumiHigh;
#endif