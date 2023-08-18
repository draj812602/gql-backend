const {
  computeDerivedSymmetricKey,
} = require('../utils/computeDerivedSymmetricKey');
const {regDevice} = require('../cloudServices/registerDevice');
const {deviceTableColumns} = require('../localServices/UiTableColumns');
const {deleteDeviceRegistry, disableOrEnableDeviceRegistry} = require('../cloudServices/deviceRegistryOperations');
const {sendCloudToDeviceMsg} = require('../cloudServices/serviceC2DMessaging');
const {getDeviceRawData} = require('../Queries/device_query');
const {timeStampToDateTime} = require('../utils/convertTimeStamp');
const {generateSasToken} = require('../utils/generateSaSToken');


const addDevice = async (_, args, {pool, request, user_id, pubsub}) => {
  try {
    const {device_name, device_identifier, assigned_template} = args.input;
    let deviceTable={
      column: [],
      data: [],
    };
    const registrationId = device_identifier;
    // Generate Device symmetric key or Derived Key from group enrollment key or master key
    const derivedSymmetricKey = await computeDerivedSymmetricKey(
        registrationId,
    );
    // Register device on IoT hub with derived symmetric key
    const regDeviceRes = await regDevice(registrationId, derivedSymmetricKey);
    console.log(regDeviceRes);
    if (regDeviceRes.error) {
      return new Error(regDeviceRes);
    } else {
      // Once device registered on IoT hub through DPS successfully , add device info and its connection info into DB
      const isDeviceExistQuery = {
        text: 'SELECT * from public."Device" WHERE device_identifier=$1',
        values: [device_identifier],
      };
      const isDeviceExistQueryRes = await pool.query(isDeviceExistQuery);
      let db_device_id = null;
      if (isDeviceExistQueryRes.rows.length == 0) {
        // Add device into Device tabel
        const created_at = new Date();
        const updated_at = new Date();
        const addDeviceQuery = {
          text: 'INSERT INTO public."Device"(user_id,device_name,device_identifier,assigned_template,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6) RETURNING*',
          values: [
            user_id,
            device_name,
            device_identifier,
            assigned_template,
            created_at,
            updated_at,
          ],
        };
        const addDeviceQueryRes = await pool.query(addDeviceQuery);
        db_device_id = addDeviceQueryRes.rows[0].device_id;
      } else {
        db_device_id = isDeviceExistQueryRes.rows[0].device_id;
      }
      let templateId =null;
      if (assigned_template != 'unassigned') {
        // here fetch template id and device id based on template name and insert new record into "DeviceToTemplate" table
        const templateIdQuery = await pool.query(
            `select template_id from public."DeviceTemplate" where template_name='${assigned_template}'`,
        );
        templateId = templateIdQuery.rows[0].template_id;

        const addDeviceTemplateRecord = {
          text: `INSERT INTO public."DeviceToTemplate"(template_id,device_id) VALUES($1,$2)`,
          values: [templateId, db_device_id],
        };
        await pool.query(addDeviceTemplateRecord);
      }
      // update device status as "Registered" at Device table
      const updateDeviceQuery = {
        text: 'UPDATE public."Device" SET device_status=$1 , updated_at=$2 WHERE device_identifier=$3 RETURNING*',
        values: ['Registered', new Date(), device_identifier],
      };
      const deviceDataRes = (await pool.query(updateDeviceQuery)).rows[0];
      deviceDataRes.device_template = deviceDataRes.assigned_template;
      deviceDataRes.template_id = templateId;
      console.log(deviceDataRes);
      const {
        deviceConnectionString,
        symmetricKey,
        mqttBrokerAddress,
        mqttUserName,
        mqttPassword,
        deviceId,
        token_expiry,
      } = regDeviceRes;
      // add device connection info to RegDeviceInfo table
      const c_u_at = new Date();
      const checkduplicateDeviceIdRes = await pool.query(
          `select device_id from public."RegisteredDeviceInfo" where device_id=${db_device_id}`,
      );
      console.log(checkduplicateDeviceIdRes);
      if (checkduplicateDeviceIdRes.rowCount === 0) {
        const regDeviceInfoQuery = {
          text: 'INSERT INTO public."RegisteredDeviceInfo"(device_id,connection_string,symmetric_key,mqtt_broker_address,mqtt_user_name,mqtt_password,created_at,updated_at,mqtt_pass_expires_on) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
          values: [
            db_device_id,
            deviceConnectionString,
            symmetricKey,
            mqttBrokerAddress,
            mqttUserName,
            mqttPassword,
            c_u_at,
            c_u_at,
            token_expiry,
          ],
        };
        await pool.query(regDeviceInfoQuery);
      }

      deviceTable = {
        column: deviceTableColumns,
        data: new Array(deviceDataRes),
      };
      console.log(deviceTable);
      return deviceTable;
    }
  } catch (error) {
    console.log(error);
    throw new Error(error.message);
  }
};

const deleteDevice = async (_, args, {pool, request, user_id, pubsub}) => {
  try {
    const {device_id} = args;

    const deviceIdQueryRes = await pool.query(
        `SELECT device_identifier FROM public."Device" where device_id=${device_id}`,
    );
    console.log(deviceIdQueryRes);
    const device_identifier = deviceIdQueryRes.rows[0].device_identifier;
    // Delete device from DPS registartion records and IoT hub
    const deviceDeleteRes = await deleteDeviceRegistry(device_identifier);
    console.log(deviceDeleteRes);
    if (deviceDeleteRes === 'true') {
      // then delete from DB
      const deleteDbDeviceRes = await pool.query(
          `delete from public."Device" where device_id=${device_id}`,
      );
      console.log(deleteDbDeviceRes);
      if (deleteDbDeviceRes.rowCount === 1) {
        return `Device deleted successfully`;
      }
    } else {
      throw new Error(`Device not deleted succefully :${deviceDeleteRes}`);
    }
  } catch (error) {
    console.log(error);
    throw new Error(error.message);
  }
};

const assignTemplate=async (_, args, {pool, request, user_id, pubsub}) => {
  try {
    const {device_id, template_id} = args;
    const c_u_at = new Date();
    const addDeviceToTemplateQuery = {
      text: `insert into public."DeviceToTemplate"(template_id,device_id,created_at,updated_at) values($1,$2,$3,$4)`,
      values: [template_id, device_id, c_u_at, c_u_at],
    };
    await pool.query(addDeviceToTemplateQuery);
    const templateCapabilities = await pool.query(`
      select row_to_json(capObj)
        from(select a.template_id,a.template_name,
           (select jsonb_agg(component)
              from(select b.component_id,b.component_name,
                (select jsonb_agg(capability)
                 from(select * 
                      from public."ComponentCapability" c
                      where b.component_id = c.component_id
                    )as capability
			        )as capabilities
			      from public."TemplateComponent" b
			      where a.template_id=b.template_id
          )as component
				)as components
           from public."DeviceTemplate" a
           where a.template_id='${template_id}' 
      )as capObj`);

    const CapabilityOutPut = templateCapabilities.rows[0].row_to_json;
    console.log(CapabilityOutPut);
    for(const compObj of CapabilityOutPut.components){
    const component_id = compObj.component_id
    const component_name= compObj.component_name
    if (compObj.capabilities !=null) {
      for (const capObj of compObj.capabilities) {
        const {capability_type}= capObj;
        if (capability_type === 'command') {
          const {component_cap_id, capability_data_type, capability_name,capability_display_name} = capObj;
          const widgetTitle = component_name+'/'+capability_display_name
          const firstLetterCap_capability_name = capability_name.charAt(0).toUpperCase()+capability_name.slice(1)
          const directMethodName = component_name.concat('',firstLetterCap_capability_name)
          const createCommandWidget={
            text: 'INSERT INTO public."DeviceCommandWidget"(device_id,component_id,component_cap_id,widget_title,direct_method_name,command_data_type) VALUES($1,$2,$3,$4,$5,$6)',
            values: [device_id, component_id,component_cap_id,widgetTitle,directMethodName, capability_data_type]
          };
          await pool.query(createCommandWidget);
          // update device table has_command column
          await pool.query(`UPDATE public."Device" SET has_command=true WHERE device_id=${device_id}`);
        }
      }
    }
    }
    const templateName = CapabilityOutPut.template_name;
    await pool.query(`UPDATE public."Device" SET assigned_template='${templateName}' WHERE device_id=${device_id}`);
    // check are there any raw data for this device at rawData table
    const checkRawDataExistance = {
      text: 'SELECT * FROM public."DeviceRawData" WHERE device_id=$1',
      values: [device_id],
    };
    // If device has got rawdata , then converted unmodeled data to modeled data as per assigned template capabilities and update the raw data at DB
    const checkRawDataExistanceRes = await pool.query(checkRawDataExistance);
    console.log(checkRawDataExistanceRes.rows.length);
    console.log(checkRawDataExistanceRes.rows);
    if (checkRawDataExistanceRes.rows.length > 0) {
      for (const rawDataRow of checkRawDataExistanceRes.rows) {
        const row = rawDataRow;
        if (row.message_type === 'Telemetry') {
          const unmodeled_data = row.unmodeled_data; // fetch unmodeled data from DB rawData
          let modeled_data = row.modeled_data; // fetch modeled data from DB rawData if it has data
          if (modeled_data === null) {
            modeled_data = [];
          } // otherwise initialize it with empty array
          const data_sub_obj = row.data_sub_obj;
          console.log(unmodeled_data);
          console.log(modeled_data);
          for (const mData of unmodeled_data) {
            for (const key in mData) {
              const capName = key; // fetch key--capability name
              const capValue = mData[key]; // and value--capability value from unmodeled data
              const dataObj = `{"${capName}":"${capValue}"}`; // form a json object
              // console.log(dataObj)
              for (const capObj of CapabilityOutPut.capabilities) {
                if ((capObj.capability_name).toUpperCase() === capName.toUpperCase()) {
                  // compare cap name of template with rawdata unmodeled object cap name if both matches then
                  modeled_data.push(dataObj); // add data to modeled array
                  delete unmodeled_data[0][key]; // remove that data from unmodeled array
                  delete data_sub_obj._unmodeledData[key];
                  data_sub_obj[`${key}`] = capValue;
                  break;
                }
              }
              const updateQString = {
                text: 'UPDATE public."DeviceRawData" SET unmodeled_data=$1,modeled_data=$2,data_sub_obj=$3 WHERE device_id=$4 and message_type=$5',
                values: [unmodeled_data, modeled_data, data_sub_obj, device_id, 'Telemetry'],
              };
              await pool.query(updateQString);
            }
          }
        }
      }
    }
    args = {device_id: device_id};
    const deviceRawData = await getDeviceRawData(_, args, {pool, request, user_id, pubsub});
    console.log(deviceRawData);
    return deviceRawData;
  } catch (error) {
    console.log(error);
    if (error.message === 'duplicate key value violates unique constraint "uq_template_to_device"') {
      throw new Error('Same template already assigned to this device');
    }
    throw new Error(error.message);
  }
};

const blockOrUnblockDevice = async (_, args, {pool, request, user_id, pubsub}) => {
  try {
    const {device_id, status} = args;
    const deviceIdQueryRes = await pool.query(
        `SELECT device_identifier FROM public."Device" where user_id=${user_id} and device_id=${device_id}`,
    );
    console.log(deviceIdQueryRes);
    if (deviceIdQueryRes.rows.length > 0) {
      const device_identifier = deviceIdQueryRes.rows[0].device_identifier;
      const resultForUI= await disableOrEnableDeviceRegistry(device_identifier, status);
      console.log(resultForUI);
      // update Device block status on DB
      await pool.query(`UPDATE public."Device" set device_block_status=${resultForUI} where device_id=${device_id}`);
      return resultForUI;
    }
  } catch (error) {
    console.log(error);
    throw new Error(error.message);
  }
};

/* const sendC2DMessage =async (_, args, {pool, request, user_id, pubsub}) => {
  try {
    const {template_cap_id, c2d_message_id, device_id, message} = args.input;
    const {capability_display_name} = (await pool.query(`SELECT capability_display_name FROM public."ComponentCapability" WHERE template_cap_id=${template_cap_id}`)).rows[0];
    const deviceIdentifierRes= await pool.query(`SELECT device_identifier FROM public."Device" WHERE device_id=${device_id}`);
    const {device_identifier} = deviceIdentifierRes.rows[0];
    const c2dMsgObj = {
      target_device: device_identifier,
      ack: 'full',
      messageString: message,
      messageId: 'MessageID-'+parseInt(Math.random()*100),
      expiryTimeUtc: Date.now() + 60000, // one minute from now
    };
    console.log(c2dMsgObj);
    const resFromCloud = await sendingC2DMessage(c2dMsgObj);
    let feedBackMsg = null;
    let feedback_received_time = null;
    if (typeof resFromCloud !== 'object') {
      feedBackMsg = resFromCloud;
    } else {
      feedBackMsg = resFromCloud.feedbackCode;
      feedback_received_time = resFromCloud.feedbackReceivedTime;
    }
    const returnObj = {
      template_cap_id: template_cap_id,
      capability_display_name: capability_display_name,
      c2d_message_id: c2d_message_id,
      device_id: device_id,
      message: message,
      feedback_message: feedBackMsg,
      feedback_received_time: feedback_received_time,
    };
    // const checkCapabilityRecord = await pool.query(`SELECT * FROM public."C2DMessage" WHERE capability_id=${capability_id} `)
    let c2dMsgIntoDB = null;
    // if(checkCapabilityRecord.rows.length > 0){
    c2dMsgIntoDB = {
      text: 'UPDATE public."C2DMessage" SET  message=$1 , feedback_message=$2,message_id=$3,updated_at=$4,feedback_received_time=$5 WHERE c2d_msg_id=$6',
      values: [message, feedBackMsg, c2dMsgObj.messageId, new Date(), feedback_received_time, c2d_message_id],
    };
    /* }else{
     c2dMsgIntoDB = {
       text:'INSERT INTO public."C2DMessage"(dashboard_id,widget_id,capability_id,message,feedback_message,message_id,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
       values:[dashboard_id,widget_id,capability_id,message,resFromCloud,c2dMsgObj.messageId,new Date(),new Date()]
     }
    }*/
    /*await pool.query(c2dMsgIntoDB);
    return returnObj;
  } catch (error) {
    console.log(error);
    throw new Error(error.message);
  }
}; */

const sendC2DMessage = async (_, args, {pool, request, user_id, pubsub}) =>{
  try {
    const {command_widget_id, request_payload} = args.input;
    const requestTime = new Date()
    let c2dMessageRes = {
      command_widget_id:null,
    device_id:null,
    component_id:null,
    component_cap_id:null,
    response:[]
    }
    let addC2DResInDBQuery 
    const widgetDetails = (await pool.query(
      `SELECT a.*,b.device_identifier 
      FROM public."DeviceCommandWidget" a ,public."Device" b
      WHERE a.command_widget_id=${command_widget_id} and a.device_id=b.device_id`)).rows[0]
    console.log(widgetDetails)
    widgetDetails.request_payload = request_payload
    //const {direct_method_name,connection_timeout,response_timeout,device_identifier} = widgetDetails
    const res = await sendCloudToDeviceMsg(widgetDetails)
    let response_payload =null
    const response_code = res.code
    let response_type = null
    console.log("result=",res,res.code)
    if (res.code === 200) {
          console.log(res.msg)
          console.log(res.msg.payload)
          response_payload = res.msg.payload
          response_type = 'success'

    } else if(res.code === 404){
      response_payload = 'The operation failed because the requested device is not online'
      response_type = 'connection_time_out'
     
    } else if(res.code === 504){
      response_payload = 'Timed out waiting for the response from device'
      response_type = 'response_time_out'
    } else{
      response_payload = res.msg
      response_type = 'error'
    }
    addC2DResInDBQuery = {
      text:'INSERT INTO public."C2DMessage"(command_widget_id,request_payload,request_time,response_payload,response_time,response_code,response_type) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING*',
      values:[command_widget_id,request_payload,requestTime,response_payload,res.responseTime,response_code,response_type]
    }
    const addC2DResInDBRes = await pool.query(addC2DResInDBQuery)
    const {c2d_msg_id,request_time,response_time} = addC2DResInDBRes.rows[0]
    let response = {}

    c2dMessageRes.command_widget_id = command_widget_id
    c2dMessageRes.device_id = widgetDetails.device_id
    c2dMessageRes.component_id = widgetDetails.component_id
    c2dMessageRes.component_cap_id = widgetDetails.component_cap_id
    response.c2d_msg_id = c2d_msg_id
    response.request_payload = request_payload
    response.request_time = await timeStampToDateTime(request_time)
    response.response_payload = response_payload
    response.response_time = await timeStampToDateTime(response_time)
    response.response_code = response_code
    response.response_type = response_type
    c2dMessageRes.response.push(response)
    return c2dMessageRes
  }catch (error) {
      console.log(error);
      throw new Error(error.message);
    }
  };

const reGenerateSaSToken =async (_, args, {pool, request, user_id, pubsub}) =>{
  try {
    const {device_id} = args;
    const deviceConnInfoQueryRes = await pool.query(`SELECT symmetric_key,mqtt_broker_address FROM public."RegisteredDeviceInfo" WHERE device_id=${device_id}`);
    console.log(deviceConnInfoQueryRes);
    let deviceNewTokenInfo ={};
    if (deviceConnInfoQueryRes.rows.length > 0) {
      const {symmetric_key, mqtt_broker_address} = deviceConnInfoQueryRes.rows[0];
      const assignedHub = mqtt_broker_address;
      const derivedSymmetricKey = symmetric_key;
      const {token_expiry, token} = await generateSasToken(assignedHub, derivedSymmetricKey);
      // update regenearted token and its expiry time on DB
      const updateDeviceInfoQuery = {
        text: 'UPDATE public."RegisteredDeviceInfo" SET mqtt_password=$1,mqtt_pass_expires_on=$2 WHERE device_id=$3',
        values: [token, token_expiry, device_id],
      };
      await pool.query(updateDeviceInfoQuery);
      const expiryDateTime = await timeStampToDateTime(token_expiry);
      deviceNewTokenInfo ={
        device_id: device_id,
        mqtt_password: token,
        mqtt_pass_expiry_time: expiryDateTime,
        is_mqtt_pass_expired: false,
      };
    }
    return deviceNewTokenInfo;
  } catch (error) {
    console.log(error);
    throw new Error(error.message);
  }
};



module.exports = {addDevice, deleteDevice, assignTemplate, blockOrUnblockDevice, sendC2DMessage, reGenerateSaSToken};
