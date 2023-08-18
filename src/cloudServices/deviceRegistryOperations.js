const ProvisioningServiceClient = require('azure-iot-provisioning-service').ProvisioningServiceClient;
const iothub = require('azure-iothub');
const {serializeUser} = require('passport/lib');

// Delete device from Registartion records of DPS
const deleteDeviceRegistry = async (deviceId) => {
  try {
    const dpsServiceConnString = process.env.DPS_CONNECTION_STRING;
    const serviceClient =
      ProvisioningServiceClient.fromConnectionString(dpsServiceConnString);
    const deleteDeviceRes = await deleteIoTHubRegistry(deviceId);
    if (deleteDeviceRes === 'true') {
      return await new Promise((resolve, reject) => {
        serviceClient.deleteDeviceRegistrationState(deviceId, async (error) => {
          if (error) reject(error);
          else resolve('true');
        });
      });
    } else {
      return deleteDeviceRes;
    }
  } catch (error) {
    console.log(error);
    return error;
  }
};

// Delete Device from IoTHub Registry
const deleteIoTHubRegistry = async (device_id) => {
  try {
    const iotHubConnString = process.env.IOT_HUB_CONN_STRING;
    const registry = iothub.Registry.fromConnectionString(iotHubConnString);
    return await new Promise((resolve, reject) => {
      const deviceRemoveArray = [
        {
          deviceId: device_id,
        },
      ];
      // console.log(deviceRemoveArray);
      // registry.list(async(error,devices,res)=>{
      //   console.log(error)
      //   console.log(devices)
      //   console.log(res)
      // })
      registry.removeDevices(deviceRemoveArray, true, async (error) => {
        // console.log("iot hub reg error",error);
        if (!error) resolve('true');
        else reject(error);
      });
    });
  } catch (error) {
    // console.log(error);
    return error;
  }
};

const disableOrEnableDeviceRegistry=async (device_id, ui_status) => {
  try {
    const iotHubConnString = process.env.IOT_HUB_CONN_STRING;
    const registry = iothub.Registry.fromConnectionString(iotHubConnString);
    return await new Promise((resolve, reject) => {
      registry.get(device_id, async (err, deviceInfo, res)=>{
        // console.log(err)
        console.log(deviceInfo, ui_status);
        // update value from UI
        deviceInfo.status=ui_status;
        registry.update(deviceInfo, async (err, updatedInfo, res)=>{
          console.log('updatedInfo=', updatedInfo);
          if (updatedInfo.status == 'disabled') {
            resolve(true);
          } else if (updatedInfo.status == 'enabled') {
            resolve(false);
          }
        });
      });
    });
  } catch (error) {
    console.log(error);
    return error;
  }
};

module.exports = {deleteDeviceRegistry, disableOrEnableDeviceRegistry};
