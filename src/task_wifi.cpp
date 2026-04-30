#include "task_wifi.h"

namespace
{
    constexpr unsigned long WIFI_CONNECT_TIMEOUT_MS = 20000;
    constexpr unsigned long WIFI_RETRY_INTERVAL_MS = 30000;

    bool ap_started = false;
    bool connect_requested = false;
    unsigned long last_sta_attempt_ms = 0;

    String wifiStatusPayload(const char *status)
    {
        StaticJsonDocument<192> doc;
        doc["page"] = "wifi";
        doc["status"] = status;
        doc["ssid"] = WIFI_SSID;
        doc["ap_ip"] = WiFi.softAPIP().toString();
        if ((strcmp(status, "connected") == 0 || strcmp(status, "already_connected") == 0) &&
            WiFi.status() == WL_CONNECTED)
        {
            doc["sta_ip"] = WiFi.localIP().toString();
        }

        String payload;
        serializeJson(doc, payload);
        return payload;
    }

    void printWifiFailure()
    {
        Serial.print("STA connection failed. WiFi.status() = ");
        Serial.println(static_cast<int>(WiFi.status()));
        WiFi.printDiag(Serial);
    }

    void sendWifiStatus(const char *status)
    {
        String payload = wifiStatusPayload(status);
        Webserver_sendata(payload);
    }
}

String Wifi_status_payload(const char *status)
{
    return wifiStatusPayload(status);
}

bool Wifi_is_connected_to(String ssid, String password)
{
    return WiFi.status() == WL_CONNECTED &&
           WiFi.SSID() == ssid &&
           WIFI_PASS == password;
}

void startAP()
{
    if (ap_started)
    {
        if (WiFi.getMode() != WIFI_AP_STA)
        {
            WiFi.mode(WIFI_AP_STA);
        }
        return;
    }

    WiFi.persistent(false);
    WiFi.setSleep(false);
    WiFi.mode(WIFI_AP_STA);

    if (!WiFi.softAP(String(SSID_AP), String(PASS_AP)))
    {
        Serial.println("Failed to start AP.");
        return;
    }

    Serial.print("AP local web: http://");
    Serial.println(WiFi.softAPIP());
    sendWifiStatus("ap_active");
    isWifiConnected = false;
    ap_started = true;
}

static bool startSTA()
{
    if (WIFI_SSID.isEmpty())
    {
        sendWifiStatus("missing_ssid");
        return false;
    }

    WiFi.mode(WIFI_AP_STA);
    WiFi.setSleep(false);
    sendWifiStatus("connecting");
    WiFi.disconnect(false, false);
    vTaskDelay(200 / portTICK_PERIOD_MS);

    Serial.print("Connecting STA to SSID: ");
    Serial.println(WIFI_SSID);

    if (WIFI_PASS.isEmpty())
    {
        WiFi.begin(WIFI_SSID.c_str());
    }
    else
    {
        WiFi.begin(WIFI_SSID.c_str(), WIFI_PASS.c_str());
    }

    const unsigned long started_at = millis();
    while (WiFi.status() != WL_CONNECTED &&
           millis() - started_at < WIFI_CONNECT_TIMEOUT_MS)
    {
        vTaskDelay(250 / portTICK_PERIOD_MS);
    }

    if (WiFi.status() != WL_CONNECTED)
    {
        printWifiFailure();
        Serial.println("AP mode is still active.");
        Serial.print("AP local web: http://");
        Serial.println(WiFi.softAPIP());
        WiFi.disconnect();
        isWifiConnected = false;
        sendWifiStatus("failed");
        return false;
    }

    Serial.print("STA IP: ");
    Serial.println(WiFi.localIP());

    isWifiConnected = true;
    sendWifiStatus("connected");
    //Give a semaphore here
    xSemaphoreGive(xBinarySemaphoreInternet);
    return true;
}

void Wifi_request_connect()
{
    connect_requested = true;
}

bool Wifi_reconnect()
{
    const wl_status_t status = WiFi.status();
    if (connect_requested)
    {
        connect_requested = false;
        isWifiConnected = false;
        startAP();
        last_sta_attempt_ms = millis();
        startSTA();
        return WiFi.status() == WL_CONNECTED;
    }

    if (status == WL_CONNECTED)
    {
        isWifiConnected = true;
        return true;
    }

    isWifiConnected = false;
    startAP();

    const unsigned long now = millis();
    if (now - last_sta_attempt_ms < WIFI_RETRY_INTERVAL_MS)
    {
        return false;
    }

    last_sta_attempt_ms = now;
    startSTA();
    return false;
}
