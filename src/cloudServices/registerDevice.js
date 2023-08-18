
const {generateSasToken} = require('../utils/generateSaSToken');
const ProvisioningTransport = require('azure-iot-provisioning-device-mqtt').Mqtt;
const SymmetricKeySecurityClient = require('azure-iot-security-symmetric-key').SymmetricKeySecurityClient;
const ProvisioningDeviceClient = require('azure-iot-provisioning-device').ProvisioningDeviceClient;

const regDevice = async (registrationId, derivedSymmetricKey) =>{
  const provisioningHost =process.env.PROVISIONING_HOST;
  const idScope = process.env.DPS_ID_SCOPE;

  const provisioningSecurityClient = new SymmetricKeySecurityClient(registrationId, derivedSymmetricKey);
  const provisioningClient = ProvisioningDeviceClient.create(provisioningHost, idScope, new ProvisioningTransport(), provisioningSecurityClient);
  return await new Promise((resolve, reject) => {
    provisioningClient.register(async (err, result)=>{
      if (err) {
        console.log('error registering device: ' + err);
        reject({'error': err.message});
      } else {
        console.log('registration succeeded');
        console.log('assigned hub=' + result.assignedHub);
        console.log('deviceId=' + result.deviceId);
        console.log('payload=' + JSON.stringify(result.payload));
        console.log(result.status);

        const deviceCconnectionString = 'HostName=' + result.assignedHub + ';DeviceId=' + result.deviceId + ';SharedAccessKey=' + derivedSymmetricKey;
        const mqttBrokerAddress = result.assignedHub;
        const mqttUserName = result.assignedHub +'/'+ result.deviceId +'/'+'?api-version=2018-06-30';
        const {token_expiry, token} = (await generateSasToken( result.assignedHub, derivedSymmetricKey));
        const devRegRes = {
          'deviceConnectionString': deviceCconnectionString,
          'symmetricKey': derivedSymmetricKey,
          'mqttBrokerAddress': mqttBrokerAddress,
          'mqttUserName': mqttUserName,
          'mqttPassword': token,
          'token_expiry': token_expiry,
          'deviceId': result.deviceId,
        };
        resolve(devRegRes);
      }
    });
  });
};

/* const generateSasToken = async(iotHubHost, derivedSymmetricKey) =>{
    let policyName = null
    let expiresInDays = 365 // 365 days = 525600 minutes
    let currentDate = new Date();
    let expiresInMilliSec = currentDate.setDate(currentDate.getDate()+expiresInDays)
    let signingKey = derivedSymmetricKey
    let resourceUri = iotHubHost
    resourceUri = encodeURIComponent(resourceUri);
    //Set expiration in seconds
    var expires = expiresInMilliSec //(new Date().getTime()/100) + expiresInMins * 60;
    console.log(expires)
    //expires = Math.ceil(expires);
    var toSign = resourceUri + '\n' + expires;
    // Use crypto
    var hmac = crypto.createHmac('sha256', Buffer.from(signingKey, 'base64'));
    hmac.update(toSign);
    var base64UriEncoded = encodeURIComponent(hmac.digest('base64'));

    // Construct authorization string
    var token = "SharedAccessSignature sr=" + resourceUri + "&sig="
    + base64UriEncoded + "&se=" + expires;
    if (policyName) token += "&skn="+policyName;
    const expiryTimeForDb = new Date(parseInt(expires))
    console.log("expiry time=",expiryTimeForDb)
    return {token:token,token_expiry:expiryTimeForDb};
}; */

module.exports = {regDevice};
