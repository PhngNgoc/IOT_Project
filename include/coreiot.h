#ifndef __COREIOT_H__
#define __COREIOT_H__

#include <Arduino.h>
#include <WiFi.h>
#include "global.h"
#include "sensor_data.h"
#include <PubSubClient.h>
#include <ArduinoJson.h>


void coreiot_task(void *pvParameters);
void CoreIOT_requestReconnect();
bool CoreIOT_publishSensorData(float temperature, float humidity);
void CoreIOT_publishRelayState();
void CoreIOT_publishRelayState(int gpio, bool relayOn);
void CoreIOT_publishServoState(int gpio, int angle);

#endif
