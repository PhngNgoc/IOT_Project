#ifndef __TASK_WIFI_H__
#define __TASK_WIFI_H__

#include <WiFi.h>
#include "global.h"
#include <task_webserver.h>

extern bool Wifi_reconnect();
extern void startAP();
extern void Wifi_request_connect();
extern String Wifi_status_payload(const char *status);
extern bool Wifi_is_connected_to(String ssid, String password);

#endif
