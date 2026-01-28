#include "ble_scales.h"
#include "../log/log.h"
#include "Arduino.h"

// DUMMY IMPLEMENTATION TO FIX COMPILATION
// This disables Bluetooth scales support because 'scales/acaia.h' is missing.

void bleScalesInit() {
  LOG_INFO("BLE Scales support is disabled (Library missing).");
}

void bleScalesMaintainConnection() {
  // Do nothing
}

void bleScalesTare() {
  LOG_INFO("BLE Tare command received but ignored.");
}

// Keep the linker happy if it looks for this task function
void bleScalesTask(void* params) {
  vTaskDelete(NULL);
}