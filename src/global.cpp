#include "global.h"

String WIFI_SSID;
String WIFI_PASS;
String CORE_IOT_TOKEN;
String CORE_IOT_SENSOR_TOKEN;
String CORE_IOT_RELAY_TOKEN;
String CORE_IOT_SERVO_TOKEN;
String CORE_IOT_SERVER;
String CORE_IOT_PORT;
String CORE_IOT_RELAY_GPIO = "25";
String CORE_IOT_RELAY_GET_METHOD = "getValueFan";
String CORE_IOT_RELAY_SET_METHOD = "setValueFan";
bool CORE_IOT_RELAY_STATE = false;
String CORE_IOT_SERVO_GPIO = "26";
int CORE_IOT_SERVO_ANGLE = 90;

String ssid = "ESP32-YOUR NETWORK HERE!!!";
String password = "12345678";
String wifi_ssid = "abcde";
String wifi_password = "123456789";
boolean isWifiConnected = false;
SemaphoreHandle_t xBinarySemaphoreInternet = xSemaphoreCreateBinary();

SemaphoreHandle_t semTempNormal = xSemaphoreCreateBinary();;
SemaphoreHandle_t semTempWarn = xSemaphoreCreateBinary();
SemaphoreHandle_t semTempCrit = xSemaphoreCreateBinary();

SemaphoreHandle_t semHumiLow = xSemaphoreCreateBinary();
SemaphoreHandle_t semHumiNormal = xSemaphoreCreateBinary();
SemaphoreHandle_t semHumiHigh = xSemaphoreCreateBinary();
