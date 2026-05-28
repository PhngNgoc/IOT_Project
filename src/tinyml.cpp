#include "tinyml.h"
#include "task_webserver.h"
#include <ArduinoJson.h>

// Globals, for the convenience of one-shot setup.
namespace
{
    tflite::ErrorReporter *error_reporter = nullptr;
    const tflite::Model *model = nullptr;
    tflite::MicroInterpreter *interpreter = nullptr;
    TfLiteTensor *input = nullptr;
    TfLiteTensor *output = nullptr;
    constexpr int kTensorArenaSize = 8 * 1024; // Adjust size based on your model
    uint8_t tensor_arena[kTensorArenaSize];
} // namespace

void setupTinyML()
{
    Serial.println("TensorFlow Lite Init....");
    static tflite::MicroErrorReporter micro_error_reporter;
    error_reporter = &micro_error_reporter;

    model = tflite::GetModel(dht_anomaly_model_tflite); 
    if (model->version() != TFLITE_SCHEMA_VERSION)
    {
        error_reporter->Report("Model provided is schema version %d, not equal to supported version %d.",
                               model->version(), TFLITE_SCHEMA_VERSION);
        return;
    }

    static tflite::AllOpsResolver resolver;
    static tflite::MicroInterpreter static_interpreter(
        model, resolver, tensor_arena, kTensorArenaSize, error_reporter);
    interpreter = &static_interpreter;

    TfLiteStatus allocate_status = interpreter->AllocateTensors();
    if (allocate_status != kTfLiteOk)
    {
        error_reporter->Report("AllocateTensors() failed");
        return;
    }

    input = interpreter->input(0);
    output = interpreter->output(0);

    Serial.println("TensorFlow Lite Micro initialized on ESP32.");
}

void tiny_ml_task(void *pvParameters)
{

    setupTinyML();

    if (!interpreter || !input || !output)
    {
        Serial.println("TinyML setup failed; stopping TinyML task.");
        vTaskDelete(NULL);
        return;
    }

    while (1)
    {

        float temperature = 0;
        float humidity = 0;
        getSensorValues(temperature, humidity);

        input->data.f[0] = temperature;
        input->data.f[1] = humidity;

        // Run inference
        TfLiteStatus invoke_status = interpreter->Invoke();
        if (invoke_status != kTfLiteOk)
        {
            error_reporter->Report("Invoke failed");
            return;
        }

        // Get and process output
        float result = output->data.f[0];
        Serial.print("Inference result: ");
        Serial.println(result);

        StaticJsonDocument<192> doc;
        doc["page"] = "tinyml";
        doc["temperature"] = temperature;
        doc["humidity"] = humidity;
        doc["result"] = result;
        doc["is_anomaly"] = result > 0.5;

        String payload;
        serializeJson(doc, payload);
        Webserver_sendTinyML(payload);

        vTaskDelay(5000);
    }
}
