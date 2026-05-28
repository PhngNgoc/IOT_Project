#ifndef __GLOBAL_H__
#define __GLOBAL_H__

#include <Arduino.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/semphr.h"

extern String WIFI_SSID;
extern String WIFI_PASS;
extern String CORE_IOT_TOKEN;
extern String CORE_IOT_SENSOR_TOKEN;
extern String CORE_IOT_RELAY_TOKEN;
extern String CORE_IOT_SERVO_TOKEN;
extern String CORE_IOT_SERVER;
extern String CORE_IOT_PORT;
extern String CORE_IOT_RELAY_GPIO;
extern String CORE_IOT_RELAY_GET_METHOD;
extern String CORE_IOT_RELAY_SET_METHOD;
extern bool CORE_IOT_RELAY_STATE;
extern String CORE_IOT_SERVO_GPIO;
extern int CORE_IOT_SERVO_ANGLE;

extern String wifi_ssid;
extern String wifi_password;

extern String ssid;
extern String password;

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
