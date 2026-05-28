#include "sensor_data.h"

QueueHandle_t xQueueTemperature = NULL;
QueueHandle_t xQueueHumidity = NULL;

bool initSensorQueues()
{
    if (xQueueTemperature == NULL)
    {
        xQueueTemperature = xQueueCreate(SENSOR_VALUE_QUEUE_LENGTH, sizeof(float));
    }

    if (xQueueHumidity == NULL)
    {
        xQueueHumidity = xQueueCreate(SENSOR_VALUE_QUEUE_LENGTH, sizeof(float));
    }

    return xQueueTemperature != NULL && xQueueHumidity != NULL;
}

bool setSensorValues(float temperature, float humidity)
{
    if (!initSensorQueues())
    {
        return false;
    }

    const BaseType_t temperatureSent = xQueueOverwrite(xQueueTemperature, &temperature);
    const BaseType_t humiditySent = xQueueOverwrite(xQueueHumidity, &humidity);

    return temperatureSent == pdPASS && humiditySent == pdPASS;
}

bool getSensorValues(float &temperature, float &humidity)
{
    if (!initSensorQueues())
    {
        return false;
    }

    const BaseType_t temperatureRead = xQueuePeek(xQueueTemperature, &temperature, 0);
    const BaseType_t humidityRead = xQueuePeek(xQueueHumidity, &humidity, 0);

    if (temperatureRead != pdTRUE)
    {
        temperature = 0;
    }

    if (humidityRead != pdTRUE)
    {
        humidity = 0;
    }

    return temperatureRead == pdTRUE && humidityRead == pdTRUE;
}
