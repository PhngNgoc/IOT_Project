#ifndef __SENSOR_DATA_H__
#define __SENSOR_DATA_H__

#include <Arduino.h>
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"

constexpr UBaseType_t SENSOR_VALUE_QUEUE_LENGTH = 1;

extern QueueHandle_t xQueueTemperature;
extern QueueHandle_t xQueueHumidity;

bool initSensorQueues();
bool setSensorValues(float temperature, float humidity);
bool getSensorValues(float &temperature, float &humidity);

#endif
