#include "led_blinky.h"

void led_blinky(void *pvParameters){
  pinMode(LED_GPIO, OUTPUT);
  int delay_time = 1000;
  while(1) {          
    if (xSemaphoreTake(semTempNormal, 0) == pdTRUE) {
      delay_time = 4000; 
    } 
    else if (xSemaphoreTake(semTempWarn, 0) == pdTRUE) {
      delay_time = 2000;  
    } 
    else if (xSemaphoreTake(semTempCrit, 0) == pdTRUE) {
      delay_time = 500;  
    }
    digitalWrite(LED_GPIO, HIGH);  // turn the LED ON
    vTaskDelay(pdMS_TO_TICKS(delay_time));
    digitalWrite(LED_GPIO, LOW);  // turn the LED OFF
    vTaskDelay(pdMS_TO_TICKS(delay_time));
  }
}