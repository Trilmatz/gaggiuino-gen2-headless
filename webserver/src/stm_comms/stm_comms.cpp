#include "stm_comms.h"
#include "../task_config.h"
#include "../server/websocket/websocket.h"
#include "../log/log.h"

namespace {
  McuComms mcuComms;
  SemaphoreHandle_t mcucLock = xSemaphoreCreateRecursiveMutex();
}

void stmCommsTask(void* params);
void stmCommsInit(HardwareSerial& serial) {
  serial.setRxBufferSize(1024); 
  serial.setTxBufferSize(1024);
  #if defined(RX1) && defined(TX1)
    serial.begin(115200, SERIAL_8N1, RX1, TX1);
  #else
    serial.begin(115200, SERIAL_8N1, 16, 17); // Fallback hardcoded
  #endif

  // mcuComms.setDebugPort(&Serial);
  mcuComms.begin(serial);

  // Set callbacks
  mcuComms.setShotSnapshotCallback(onShotSnapshotReceived);
  mcuComms.setSensorStateSnapshotCallback(onSensorStateSnapshotReceived);
  mcuComms.setProfileReceivedCallback(onProfileReceived);
  mcuComms.setRemoteScalesTareCommandCallback(onScalesTareReceived);

  xTaskCreateUniversal(stmCommsTask, "stmComms", configMINIMAL_STACK_SIZE + 2400, NULL, PRIORITY_STM_COMMS, NULL, CORE_STM_COMMS);
}

void stmCommsTask(void* params) {
  for (;;) {
    stmCommsReadData();
    vTaskDelay(10 / portTICK_PERIOD_MS);
  }
}

void stmCommsReadData() {
  if (xSemaphoreTakeRecursive(mcucLock, portMAX_DELAY) == pdFALSE) return;
  mcuComms.readDataAndTick();
  xSemaphoreGiveRecursive(mcucLock);
}

void stmCommsSendWeight(float weight) {
  if (xSemaphoreTakeRecursive(mcucLock, portMAX_DELAY) == pdFALSE) return;
  mcuComms.sendRemoteScalesWeight(weight);
  xSemaphoreGiveRecursive(mcucLock);
}

void stmCommsSendScaleDisconnected() {
  if (xSemaphoreTakeRecursive(mcucLock, portMAX_DELAY) == pdFALSE) return;
  mcuComms.sendRemoteScalesDisconnected();
  xSemaphoreGiveRecursive(mcucLock);
}

void stmCommsSendProfile(Profile& profile) {
  if (xSemaphoreTakeRecursive(mcucLock, portMAX_DELAY) == pdFALSE) return;
  mcuComms.sendProfile(profile);
  xSemaphoreGiveRecursive(mcucLock);
}

void stmCommsRequestActiveProfile() {
  if (xSemaphoreTakeRecursive(mcucLock, portMAX_DELAY) == pdFALSE) return;
  mcuComms.requestActiveProfile();
  xSemaphoreGiveRecursive(mcucLock);
}

void onProfileReceived(Profile& profile) {
  LOG_INFO("<< STM32 Profile Received! Phases: %u", profile.phaseCount());
  wsSendProfile(profile);
}