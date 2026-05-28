#include "global.h"

#include "led_blinky.h"
#include "neo_blinky.h"
#include "sensor_data.h"
#include "temp_humi_monitor.h"
 #include "tinyml.h"
#include "coreiot.h"

// include task
#include "task_check_info.h"
#include "task_toogle_boot.h"
#include "task_wifi.h"
#include "task_webserver.h"
#include "task_core_iot.h"

namespace
{
  constexpr uint32_t TEMP_HUMI_TASK_STACK_SIZE = 6144;
}

void setup()
{
  Serial.begin(115200);
  check_info_File(0);

  if (!initSensorQueues())
  {
    Serial.println("Failed to create sensor queues");
  }

  xTaskCreate(led_blinky, "Task LED Blink", 2048, NULL, 2, NULL);
  xTaskCreate(neo_blinky, "Task NEO Blink", 2048, NULL, 2, NULL);
  xTaskCreate(temp_humi_monitor, "Task TEMP HUMI Monitor", TEMP_HUMI_TASK_STACK_SIZE, NULL, 2, NULL);
  //xTaskCreate(main_server_task, "Task Main Server" ,8192  ,NULL  ,2 , NULL);
   xTaskCreate( tiny_ml_task, "Tiny ML Task" , 4096  ,NULL  ,2 , NULL);
  xTaskCreate(coreiot_task, "CoreIOT Task" , 4096  ,NULL  ,2 , NULL);
  // xTaskCreate(Task_Toogle_BOOT, "Task_Toogle_BOOT", 4096, NULL, 2, NULL);
}

void loop()
{
  if (check_info_File(1)){
    Wifi_reconnect();
    //CORE_IOT_reconnect();
  }
  Webserver_reconnect();
}
