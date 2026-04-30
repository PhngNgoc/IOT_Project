#include "task_webserver.h"
#include "global.h"
#include "task_check_info.h"
#include "task_wifi.h"
#include <WiFi.h>

AsyncWebServer server(80);
AsyncWebSocket ws("/ws");

bool webserver_isrunning = false;

namespace
{
    bool wifi_scan_requested = false;
    bool wifi_scan_running = false;
    String wifi_scan_result = "{\"page\":\"wifi_scan\",\"status\":\"idle\",\"count\":0,\"networks\":[]}";

    String sensorPayload()
    {
        StaticJsonDocument<128> doc;
        doc["page"] = "sensor";
        doc["temperature"] = glob_temperature;
        doc["humidity"] = glob_humidity;

        String payload;
        serializeJson(doc, payload);
        return payload;
    }

    void addWifiNetworks(JsonArray networks, int networkCount)
    {
        const int limit = min(networkCount, 20);
        for (int i = 0; i < limit; i++)
        {
            JsonObject network = networks.createNestedObject();
            network["ssid"] = WiFi.SSID(i);
            network["rssi"] = WiFi.RSSI(i);
            network["channel"] = WiFi.channel(i);
            network["secure"] = WiFi.encryptionType(i) != WIFI_AUTH_OPEN;
        }
    }

    String emptyWifiScanPayload(const char *status)
    {
        DynamicJsonDocument doc(256);
        doc["page"] = "wifi_scan";
        doc["status"] = status;
        doc["count"] = 0;
        doc.createNestedArray("networks");

        String payload;
        serializeJson(doc, payload);
        return payload;
    }

    void wifiScanTask(void *pvParameters)
    {
        Serial.println("Starting Wi-Fi scan...");
        WiFi.mode(WIFI_AP_STA);
        vTaskDelay(200 / portTICK_PERIOD_MS);

        WiFi.scanDelete();
        const int networkCount = WiFi.scanNetworks(false, true);
        DynamicJsonDocument doc(4096);
        doc["page"] = "wifi_scan";
        JsonArray networks = doc.createNestedArray("networks");

        if (networkCount < 0)
        {
            doc["status"] = "failed";
            doc["count"] = 0;
        }
        else
        {
            doc["status"] = "complete";
            doc["count"] = networkCount;
            addWifiNetworks(networks, networkCount);
        }

        String payload;
        serializeJson(doc, payload);
        wifi_scan_result = payload;
        wifi_scan_running = false;
        WiFi.scanDelete();
        Serial.printf("Wi-Fi scan finished: %d network(s)\n", networkCount);
        ws.cleanupClients();
        ws.textAll(wifi_scan_result);
        vTaskDelete(NULL);
    }

    String wifiScanStartPayload()
    {
        if (wifi_scan_running)
        {
            return emptyWifiScanPayload("scanning");
        }

        wifi_scan_running = true;
        wifi_scan_requested = true;
        wifi_scan_result = emptyWifiScanPayload("scanning");
        Serial.println("Wi-Fi scan requested");

        return wifi_scan_result;
    }

    String wifiScanResultsPayload()
    {
        return wifi_scan_running ? emptyWifiScanPayload("scanning") : wifi_scan_result;
    }

    void processWifiScanRequest()
    {
        if (!wifi_scan_requested)
        {
            return;
        }

        wifi_scan_requested = false;
        BaseType_t created = xTaskCreate(
            wifiScanTask,
            "WiFi Scan",
            8192,
            NULL,
            1,
            NULL);

        if (created != pdPASS)
        {
            wifi_scan_running = false;
            wifi_scan_result = emptyWifiScanPayload("failed");
            Serial.println("Failed to create Wi-Fi scan task");
        }
    }

    void addNoCacheHeaders(AsyncWebServerResponse *response)
    {
        response->addHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
        response->addHeader("Pragma", "no-cache");
        response->addHeader("Expires", "0");
    }
}

void Webserver_sendata(String data)
{
    ws.cleanupClients();

    if (ws.count() > 0)
    {
        ws.textAll(data); // Gửi đến tất cả client đang kết nối
        Serial.println("📤 Đã gửi dữ liệu qua WebSocket: " + data);
    }
    else
    {
        Serial.println("⚠️ Không có client WebSocket nào đang kết nối!");
    }
}

void onEvent(AsyncWebSocket *server, AsyncWebSocketClient *client, AwsEventType type, void *arg, uint8_t *data, size_t len)
{
    if (type == WS_EVT_CONNECT)
    {
        Serial.printf("WebSocket client #%u connected from %s\n", client->id(), client->remoteIP().toString().c_str());
        client->text(sensorPayload());
        client->text(wifi_scan_result);
    }
    else if (type == WS_EVT_DISCONNECT)
    {
        Serial.printf("WebSocket client #%u disconnected\n", client->id());
    }
    else if (type == WS_EVT_DATA)
    {
        AwsFrameInfo *info = (AwsFrameInfo *)arg;

        if (info->opcode == WS_TEXT)
        {
            String message;
            message += String((char *)data).substring(0, len);
            // parseJson(message, true);
            handleWebSocketMessage(message);
        }
    }
}

void connnectWSV()
{
    ws.onEvent(onEvent);
    server.addHandler(&ws);

    server.on("/", HTTP_GET, [](AsyncWebServerRequest *request)
              {
                  AsyncWebServerResponse *response = request->beginResponse(LittleFS, "/index.html", "text/html");
                  addNoCacheHeaders(response);
                  request->send(response);
              });
    server.on("/app.js", HTTP_GET, [](AsyncWebServerRequest *request)
              {
                  AsyncWebServerResponse *response = request->beginResponse(LittleFS, "/app.js", "application/javascript");
                  addNoCacheHeaders(response);
                  request->send(response);
              });
    server.on("/sensors", HTTP_GET, [](AsyncWebServerRequest *request)
              {
                  AsyncWebServerResponse *response = request->beginResponse(200, "application/json", sensorPayload());
                  addNoCacheHeaders(response);
                  request->send(response);
              });
    server.on("/wifi/scan", HTTP_GET, [](AsyncWebServerRequest *request)
              {
                  AsyncWebServerResponse *response = request->beginResponse(200, "application/json", wifiScanStartPayload());
                  addNoCacheHeaders(response);
                  request->send(response);
              });
    server.on("/wifi/scan/results", HTTP_GET, [](AsyncWebServerRequest *request)
              {
                  AsyncWebServerResponse *response = request->beginResponse(200, "application/json", wifiScanResultsPayload());
                  addNoCacheHeaders(response);
                  request->send(response);
              });
    server.on("/wifi/connect", HTTP_GET, [](AsyncWebServerRequest *request)
              {
                  if (!request->hasParam("ssid"))
                  {
                      request->send(400, "application/json", "{\"page\":\"wifi_connect\",\"status\":\"missing_ssid\"}");
                      return;
                  }

                  String requested_ssid = request->getParam("ssid")->value();
                  String requested_pass = request->hasParam("password") ? request->getParam("password")->value() : "";

                  if (Wifi_is_connected_to(requested_ssid, requested_pass))
                  {
                      AsyncWebServerResponse *response = request->beginResponse(200, "application/json", Wifi_status_payload("already_connected"));
                      addNoCacheHeaders(response);
                      request->send(response);
                      return;
                  }

                  WIFI_SSID = requested_ssid;
                  WIFI_PASS = requested_pass;

                  Save_info_File(WIFI_SSID, WIFI_PASS, CORE_IOT_TOKEN, CORE_IOT_SERVER, CORE_IOT_PORT, false);
                  Wifi_request_connect();

                  AsyncWebServerResponse *response = request->beginResponse(200, "application/json", "{\"page\":\"wifi_connect\",\"status\":\"connecting\"}");
                  addNoCacheHeaders(response);
                  request->send(response);
              });
    server.on("/device/config", HTTP_GET, [](AsyncWebServerRequest *request)
              {
                  CORE_IOT_TOKEN = request->hasParam("token") ? request->getParam("token")->value() : CORE_IOT_TOKEN;
                  CORE_IOT_SERVER = request->hasParam("server") ? request->getParam("server")->value() : CORE_IOT_SERVER;
                  CORE_IOT_PORT = request->hasParam("port") ? request->getParam("port")->value() : CORE_IOT_PORT;

                  Save_info_File(WIFI_SSID, WIFI_PASS, CORE_IOT_TOKEN, CORE_IOT_SERVER, CORE_IOT_PORT, false);

                  AsyncWebServerResponse *response = request->beginResponse(200, "application/json", "{\"page\":\"device_config\",\"status\":\"saved\"}");
                  addNoCacheHeaders(response);
                  request->send(response);
              });
    server.on("/favicon.ico", HTTP_GET, [](AsyncWebServerRequest *request)
              {
                  request->send(204);
              });
    server.on("/script.js", HTTP_GET, [](AsyncWebServerRequest *request)
              {
                  AsyncWebServerResponse *response = request->beginResponse(LittleFS, "/app.js", "application/javascript");
                  addNoCacheHeaders(response);
                  request->send(response);
              });
    server.on("/styles.css", HTTP_GET, [](AsyncWebServerRequest *request)
              {
                  AsyncWebServerResponse *response = request->beginResponse(LittleFS, "/styles.css", "text/css");
                  addNoCacheHeaders(response);
                  request->send(response);
              });

    AsyncStaticWebHandler &staticHandler = server.serveStatic("/", LittleFS, "/");
    staticHandler.setDefaultFile("index.html");
    staticHandler.setCacheControl("no-store, no-cache, must-revalidate, max-age=0");

    server.begin();
    ElegantOTA.begin(&server);
    Serial.print("Web server ready at: http://");
    Serial.println(WiFi.softAPIP());
    webserver_isrunning = true;
}

void Webserver_stop()
{
    ws.closeAll();
    server.end();
    webserver_isrunning = false;
}

void Webserver_reconnect()
{
    if (!webserver_isrunning)
    {
        connnectWSV();
    }
    processWifiScanRequest();
    ElegantOTA.loop();
}
