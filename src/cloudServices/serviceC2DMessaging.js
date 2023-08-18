const {timeStampToDateTime} = require('../utils/convertTimeStamp');
const Client = require('azure-iothub').Client;
const Message = require('azure-iot-common').Message;

/* const sendingC2DMessage = async (c2dMsgObj)=>{
  const iotHubConnString = process.env.IOT_HUB_CONN_STRING;
  const client = Client.fromConnectionString(iotHubConnString);
  return await new Promise((resolve, reject) => {
    client.open(function(err) {
      if (err) {
        console.error('Could not connect: ' + err.message);
        resolve(err.message);
      } else {
        console.log('Service client connected at', Date());
        client.getFeedbackReceiver(async (err, receiver)=>{
          console.log(err);
          receiver.on('message', async (msg)=> {
            console.log('Feedback received time ', Date());
            console.log('Feedback message:');
            console.log(msg.getData().toString('utf-8'));
            const feedbackCode = JSON.parse(msg.getData().toString('utf-8'));
            console.log(feedbackCode);
            const feedback_received_time = await timeStampToDateTime(new Date());
            const feedbackObj = {
              feedbackReceivedTime: feedback_received_time,
              feedbackCode: feedbackCode[0].statusCode,
            };
            resolve(feedbackObj);
          });
        });
        const message = new Message(c2dMsgObj.messageString);
        message.ack = c2dMsgObj.ack;
        message.messageId = c2dMsgObj.messageId;
        message.expiryTimeUtc=c2dMsgObj.expiryTimeUtc;// one minute from now
        console.log('Sending message: ' + JSON.stringify(message));
        client.send(c2dMsgObj.target_device, message, printResultFor('send'));
      }
    });
  });
};

const printResultFor=(op) =>{
  return function printResult(err, res) {
    if (err) console.log(op + ' error: ' + err.toString());
    if (res) console.log(op + ' status: ' + res.constructor.name);
  };
};

const receiveFeedback=async (err, receiver)=>{
  // return await new Promise((resolve, reject) => {
  receiver.on('message', function(msg) {
    console.log(chalk.blue('Feedback received time ', Date()));
    console.log('Feedback message:');
    console.log(msg.getData().toString('utf-8'));
    resolve('feedback:', msg.getData().toString('utf-8'));
  });
// })
}; */

const sendCloudToDeviceMsg = async(obj) =>{
  const iotHubConnString = process.env.IOT_HUB_CONN_STRING;
  const serviceClient = Client.fromConnectionString(iotHubConnString);
  const targetDevice = obj.device_identifier
  const methodParams = {
    methodName: obj.direct_method_name,
    payload: obj.request_payload,
    responseTimeoutInSeconds: obj.response_timeout,
    connectTimeoutInSeconds: obj.connection_timeout
  }
  return await new Promise((resolve, reject) => {
    serviceClient.invokeDeviceMethod(targetDevice, methodParams, function (err, result) {
      if (err) {
        console.error('Failed to invoke method \'' + methodParams.methodName + '\': ' + err)
        const statusCode = err.response.statusCode
        console.log('error=', err.response)
        const responseTime = new Date()
        const res = { code: statusCode, msg: err,responseTime:responseTime }
        resolve(res)
      } else {
        console.log(JSON.stringify(result))
        console.log(JSON.stringify(result, null, 2))
        const statusCode = result.status
        const responseTime = new Date()
        const res = { code: statusCode, msg: result,responseTime:responseTime }
        resolve(res)
      }
    })
  })

}
module.exports = {sendCloudToDeviceMsg};
