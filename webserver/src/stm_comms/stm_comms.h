#ifndef STM_COMMS_H
#define STM_COMMS_H

#include "mcu_comms.h"

void stmCommsInit(HardwareSerial& serial);
void stmCommsReadData();
void stmCommsSendWeight(float weight);
void stmCommsSendScaleDisconnected();
void stmCommsSendProfile(Profile& profile);
void stmCommsRequestActiveProfile();

// To be defined elsewhere
void onSensorStateSnapshotReceived(SensorStateSnapshot& snapshot);
void onShotSnapshotReceived(ShotSnapshot& snapshot);
void onProfileReceived(Profile& profile);
void onScalesTareReceived();

#endif
