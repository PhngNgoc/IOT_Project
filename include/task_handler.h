
#ifndef __TASK_HANDLER_H__
#define __TASK_HANDLER_H__

#include <ArduinoJson.h>
#include <task_check_info.h>

extern void handleWebSocketMessage(String message);
bool setRelayState(int gpio, bool isOn);
bool setServoAngle(int gpio, int angle);
#endif
