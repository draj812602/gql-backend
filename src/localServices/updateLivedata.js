/* eslint-disable no-array-constructor */
/* eslint-disable no-tabs */
/* eslint-disable guard-for-in */
/* eslint-disable camelcase */
/* eslint-disable max-len */
const {pool} =require('../utils/pgsql_db_conn');
const {PubSub} = require('graphql-subscriptions');
const pubsub = new PubSub();
const {timeStampToDateTime} = require('../utils/convertTimeStamp');
const eventsFromIoTHub=async (message)=>{
  // 'deviceConnectionStateEvents' or 'Telemetry'
  console.log(message);
  const messageSource = (JSON.stringify(message.systemProperties['iothub-message-source'])).replace(/"/g, '');
  const device_Id = JSON.stringify(message.systemProperties['iothub-connection-device-id']);
  const device_Identifier = device_Id.replace(/"/g, '');
  const epoch_time = message.systemProperties['iothub-enqueuedtime'];
  /** Save epoch time in the form of timestamp */
  const data_recorded_at = new Date(epoch_time);
  console.log('data_recorded_at=', data_recorded_at);
  if (messageSource == 'deviceConnectionStateEvents') {
    console.log('Device connectivity state Event');
    const deviceConnStatus=(JSON.stringify(message.properties['opType'])).replace(/"/g, '');
    const datetime = await timeStampToDateTime(data_recorded_at);
    await saveDeviceConnData(device_Identifier, data_recorded_at, datetime, deviceConnStatus);
    await updateDeviceConnStatus(device_Identifier, deviceConnStatus, datetime);
  } else if (messageSource == 'Telemetry') {
    console.log('Telemetry Event');
    console.log(message.body);
    const deviceData = message.body;
    const modeled_datetime = await timeStampToDateTime(data_recorded_at);
    await saveDeviceRawData(device_Identifier, deviceData, data_recorded_at, modeled_datetime, messageSource);
    // await updateRawdata(device_Identifier , message,data_recorded_at)
  }
  //
  // await eventSubscriber(message)
};

const saveDeviceConnData = async (device_Identifier, data_recorded_at, datetime, deviceConnStatus) =>{
  try {
    const querystring = `SELECT device_id FROM public."Device" WHERE device_identifier = '${device_Identifier}'`;
    console.log(querystring);
    const getDeviceIdFromDB = await pool.query(querystring);
    const {device_id} = getDeviceIdFromDB.rows[0];
    const RawJsonObj ={};
    RawJsonObj._eventType = deviceConnStatus;
    RawJsonObj._timeStamp = data_recorded_at;
    let addUpdateDataRecordToDBQuery =null;
    // const checkDataExistance = await pool.query(`Select * from public."DeviceRawData" where device_id=${device_id}`)
    //    if(checkDataExistance.rows.length >0){
    //     addUpdateDataRecordToDBQuery= {
    //         text:'UPDATE public."DeviceRawData" SET timestamp=$1,message_type=$2,data_sub_obj=$3 WHERE device_id=$4',
    //         values:[datetime,deviceConnStatus,RawJsonObj,device_id]
    //        }
    //    }else{

    addUpdateDataRecordToDBQuery= {
      text: 'INSERT INTO public."DeviceRawData"(device_id,timestamp,message_type,data_sub_obj) values($1,$2,$3,$4)',
      values: [device_id, datetime, deviceConnStatus, RawJsonObj],
    };
    // }
    console.log(addUpdateDataRecordToDBQuery);
    const addUpdateDataRecordToDBRes=await pool.query(addUpdateDataRecordToDBQuery);
    console.log(addUpdateDataRecordToDBRes);
  } catch (error) {
    console.log(error);
    return error;
  }
};


const saveDeviceRawData=async (device_Identifier, deviceData, data_recorded_at, datetime, messageSource)=>{
  try {
    /** Fetch record matching with input device name */
    const getDeviceTemplateQuery = {
      text: 'SELECT * FROM public."Device" WHERE device_identifier=$1',
      values: [device_Identifier],
    };
    let assigned_template = null;
    const getDeviceTemplateRes = await pool.query(getDeviceTemplateQuery);
    if (getDeviceTemplateRes.rows.length == 1) {
      assigned_template= getDeviceTemplateRes.rows[0].assigned_template;
      console.log('assigned_template:', assigned_template);
      const RawJsonObj ={};
      RawJsonObj._eventType = messageSource;
      RawJsonObj._timeStamp = data_recorded_at;
      RawJsonObj._unmodeledData ={};
      const {device_id} = getDeviceTemplateRes.rows[0];
      if (assigned_template == 'unassigned') { // If device is not assigned to any template
        for (const key in deviceData) {
          component_name = key;
          component_value = deviceData[key];
          RawJsonObj._unmodeledData[`${component_name}`] = component_value; // it is object with capabilitiy
        }
        console.log(RawJsonObj);
        const addDataRecordToDBQuery= {
          text: 'INSERT INTO public."DeviceRawData"(device_id,timestamp,unmodeled_data,message_type,data_sub_obj) values($1,$2,$3,$4,$5)',
          values: [device_id, datetime, new Array(deviceData), messageSource, RawJsonObj],
        };
        console.log(addDataRecordToDBQuery);
      } else {
        const tempCapabilities = await pool.query(`
                SELECT row_to_json(temp_details)
                FROM ( SELECT a.template_id,(SELECT jsonb_agg(components)
                                                FROM ( SELECT b.component_name,
													  (select jsonb_agg(capability)
														from(select	c.capability_name,c.component_cap_id
                                                              FROM public."ComponentCapability" as c
                                                              WHERE b.component_id=c.component_id 
															 )as capability
													   )as capabilities
												 from public."TemplateComponent" b
											     where a.template_id=b.template_id
                                                )as components
                                            )as compcapability
                        FROM public."DeviceToTemplate" as a
                        WHERE a.device_id=${device_id}
                    )as temp_details
                `);
        // console.log(tempCapabilities.rows[0].row_to_json)
        const capabilitiesFromTemplate = (tempCapabilities.rows[0].row_to_json).compcapability;
        // console.log("cap from component",capabilitiesFromTemplate)
        const capabilitiesFromDevice = deviceData;
        console.log("cap from device",capabilitiesFromDevice)
        const modeledData = [];
        let capabilityIds = []
        for (let i=0; i<capabilitiesFromTemplate.length; i++) {
          console.log(i);
          const tempCompName = capabilitiesFromTemplate[i].component_name;
          const tempCapabilities = capabilitiesFromTemplate[i].capabilities;
          for (const key in capabilitiesFromDevice) {
            const deviceCompName = key;
            const deviceCapabilities = capabilitiesFromDevice[key];
            console.log('deviceCapabilities:', deviceCapabilities);
            if (tempCompName.toUpperCase() === deviceCompName.toUpperCase()) {
              if(tempCapabilities !== null){
              for (const tempCap of tempCapabilities) {
                const tempCapName = tempCap.capability_name;
                capabilityIds.push(tempCap.component_cap_id)
                for (const devCap in deviceCapabilities) {
                  const devCapName = devCap;
                  const devCapValue = deviceCapabilities[devCap];
                  const singleCompObj = `{"${deviceCompName}":{"${devCapName}":"${devCapValue}"}}`;
                  if (tempCapName.toUpperCase() === devCapName.toUpperCase()) {
                    delete deviceCapabilities[devCap];
                    delete capabilitiesFromDevice[key];
                    RawJsonObj[`${deviceCompName}`] = `{"${devCapName}":"${devCapValue}"}`;
                    modeledData.push(singleCompObj);
                    console.log(modeledData);
                    await updateLiveDataOnWidgets(device_id, datetime, devCapValue, devCapName, deviceCompName);
                  }
                }
              }
            }
            }
          }
        }


        const capFromDevice = [];
        for (const capObj in capabilitiesFromDevice) {
          const cpabilities = capabilitiesFromDevice[capObj];
          const compName = capObj;
          for (const cap in cpabilities) {
            const obj =`{"${compName}":{"${cap}":"${cpabilities[cap]}"}}`;
            capFromDevice.push(obj);
          }
        }
        console.log(capFromDevice);
        const unmodeledData = capFromDevice;
        RawJsonObj._unmodeledData = capFromDevice;
        console.log('unmodeledData', JSON.stringify(capFromDevice));
        // console.log("RawJsonObj",JSON.stringify(RawJsonObj))
        // console.log("modeledData",JSON.stringify(modeledData))

        const addDataRecordToDBQuery= {
          text: 'INSERT INTO public."DeviceRawData"(device_id,timestamp,unmodeled_data,message_type,modeled_data,data_sub_obj,capability_ids) values($1,$2,$3,$4,$5,$6,$7)',
          values: [device_id, datetime, unmodeledData, messageSource, modeledData, RawJsonObj,capabilityIds],
        };
        console.log(addDataRecordToDBQuery);
        await pool.query(addDataRecordToDBQuery)
      }
    }
  } catch (error) {
    console.log(error);
  }
};


const updateLiveDataOnWidgets = async (device_id, datetime, capability_value, capability_name, component_name)=>{
  try {
    console.log('live data', device_id);
    // get USER emailId
    // const userEmailQuery = {
    //     text:'SELECT a.user_email FROM public."UserDetails" a, public."Device" b WHERE b.user_id=a.user_id and b.device_id=$1',
    //     vlaues:[device_id]
    // }
    // console.log(userEmailQuery)
    const {user_email} = (await pool.query(`SELECT a.user_email FROM public."UserDetails" a, public."Device" b WHERE b.user_id=a.user_id and b.device_id=${device_id}`)).rows[0];
    console.log(user_email);
    // check is there any widget for this device
    const getdeviceWidgetsQuery = {
      text: 'SELECT a.dashboard_id,a.widget_id,a.component_id,a.component_cap_id,a.data_time_interval,b.capability_name,b.capability_display_name,c.component_name FROM public."DashboardWidget" as a , public."ComponentCapability" as b , public."TemplateComponent" as c WHERE a.device_id=$1 and a.component_id=c.component_id and a.component_cap_id = b.component_cap_id',
      values: [device_id],
    };
    const getdeviceWidgetsQueryRes = await pool.query(getdeviceWidgetsQuery);
    console.log(getdeviceWidgetsQueryRes.rows);
    const liveDataForWidget = {};

    if (getdeviceWidgetsQueryRes.rows.length > 0) {
      for (const widget of getdeviceWidgetsQueryRes.rows ) {
        const telemetry = [];
        const telemetryObj = {};
        if (component_name === widget.component_name && capability_name === widget.capability_name) {
          telemetryObj.sensorValue = capability_value;
          telemetryObj.timestamp = datetime;
          telemetryObj.sensorName = widget.capability_display_name;
          telemetry.push(telemetryObj);
          liveDataForWidget.dashboard_id = widget.dashboard_id;
          liveDataForWidget.widget_id = widget.widget_id;
          liveDataForWidget.device_id = device_id;
          liveDataForWidget.component_id = widget.component_id;
          liveDataForWidget.component_cap_id = widget.component_cap_id;
          // liveDataForWidget.capability_name = capability_name
          liveDataForWidget.data_time_interval = widget.data_time_interval;
          liveDataForWidget.telemetry = telemetry;
          console.log('live', liveDataForWidget);
        }
      }
      pubsub.publish(`"UPDATE_LIVE_DATA/${user_email}"`, {UpdateLiveDataOnWidget: liveDataForWidget});
    }
  } catch (error) {
    throw new Error(error);
  }
};
const updateRawdata = async (device_Identifier, message, data_recorded_at) =>{
  try {
    const datetime = await timeStampToDateTime(data_recorded_at);
    /** Fetch record matching with input device name */
    const getDeviceTemplateQuery = {
      text: 'SELECT * FROM public."Device" WHERE device_identifier=$1',
      values: [device_Identifier],
    };
    let assigned_to_template = null;
    const getDeviceTemplateRes = await pool.query(getDeviceTemplateQuery);

    if (getDeviceTemplateRes.rows.length == 1) {
      assigned_to_template= getDeviceTemplateRes.rows[0].assigned_to_template;
      console.log(assigned_to_template);
      const columnData = new Array( {
        'dataField': 'Timestamp',
        'text': 'Timestamp',
        'sort': true,
      },
      {
        'dataField': 'Message_Type',
        'text': 'Message type',
        'sort': true,
      },
      {
        'dataField': 'Unmodeled_Data',
        'text': 'Unmodeled data',
        'sort': false,
      });
      const tableData = new Array();
      const tableDataObj = {};
      tableDataObj.Timestamp = datetime;
      tableDataObj.Message_Type = 'Telemetry';
      const deviceRawData = {};
      deviceRawData._eventType='Telemetry'; // static value
      deviceRawData._timeStamp = data_recorded_at;

      if (assigned_to_template == false) { // If device is not assigned to any template
        deviceRawData._unmodeledData = JASON.stringify(message.body); // field type is string at typeDef
        tableDataObj.Unmodeled_Data = JASON.stringify(message.body); // field type is string at typeDef
        tableDataObj.RawJsonObj = deviceRawData;
        console.log('columnData:', columnData);
        tableData.push(tableDataObj);
        console.log('tableDataObj:', tableDataObj);
      } else if (assigned_to_template == true) { // if device is assigned to template ,then fetch template capabilities and compare with device components
        const db_device_id = getDeviceTemplateRes.rows[0].device_id;
        const tempCapabilities = await pool.query(`
            SELECT row_to_json(temp_details)
            FROM ( SELECT a.template_id,(SELECT jsonb_agg(capname)
                                            FROM ( SELECT c.capability_name
                                                FROM public."TemplateComponent" b,public."ComponentCapability" as c
                                                WHERE a.template_id=b.template_id and b.component_id=c.component_id 
                                            )as capname
                                        )as temp_capability
                    FROM public."DeviceToTemplate" as a
                    WHERE a.device_id=${db_device_id}
                )as temp_details
            `);
        console.log(tempCapabilities.rows[0].row_to_json);
        const capabilitiesFromTemplate = (tempCapabilities.rows[0].row_to_json).temp_capability;
        console.log(capabilitiesFromTemplate);
        const capabilitiesFromDevice = message.body;
        const modeledData = {};

        for (let i=0; i<capabilitiesFromTemplate.length; i++) {
          const tempCapName = capabilitiesFromTemplate[i].capability_name;
          for (const key in capabilitiesFromDevice) {
            const deviceCapName = key;
            const deviceCapValue = capabilitiesFromDevice[key];
            if (tempCapName.toUpperCase() === deviceCapName.toUpperCase()) {
              delete capabilitiesFromDevice[key];
              const columnDataObj ={};

              modeledData[`${deviceCapName}`] = deviceCapValue;
              tableDataObj.Modeled_RawData=JSON.stringify(modeledData);
              columnDataObj.dataField = deviceCapName;
              columnDataObj.text = deviceCapName;
              // const keyVal = "sort"
              columnDataObj.sort =false;
              columnData.push(columnDataObj);

              tableDataObj[`${deviceCapName}`] = deviceCapValue;
              deviceRawData[`${deviceCapName}`] = deviceCapValue;
              tableDataObj.RawJsonObj = deviceRawData;
              // deviceRawData.modeledData = modeledData
              // deviceRawData._unmodeledData =capabilitiesFromDevice
              // tableDataObj.Unmodeled_Data = capabilitiesFromDevice
              break;
            }
          }
        }

        console.log('.....................................................');
        // for(let j=0 ; j<tableData.length ; j++){
        tableDataObj.Unmodeled_Data = JSON.stringify(capabilitiesFromDevice);
        tableData.push(tableDataObj);
        deviceRawData._unmodeledData = JSON.stringify(capabilitiesFromDevice);
        tableData.RawJsonObj = deviceRawData;
        // }
        console.log('RawData=', JSON.stringify(tableData));
      }
      const user_id = getDeviceTemplateRes.rows[0].user_id;
      const rawDataTable= {
        'user_id': user_id,
        'device_identifier': device_Identifier,
        'columns': columnData,
        'data': tableData,
      };
      const userEmailQuery = await pool.query(`SELECT user_email FROM public."UserDetails" WHERE user_id=${user_id}`);
      const userEmailRes = userEmailQuery.rows[0].user_email;
      pubsub.publish(`"UPDATE_RAW_DATA/${userEmailRes}"`, {UpdateRawData: rawDataTable});
      // console.log(JSON.stringify(rawDataTable))
      // return rawDataTable
    }
  } catch (error) {
    return error;
  }
};


const updateDeviceConnStatus =async (device_Identifier, deviceConnStatus, data_recorded_at)=>{
  try {
    // fetch user id and device id
    const deviceInfoFromDBQuery = {
      text: 'SELECT user_id,device_id FROM public."Device" WHERE device_identifier=$1',
      values: [device_Identifier],
    };
    const {user_id} = (await pool.query(deviceInfoFromDBQuery)).rows[0];

    const userEmailQuery = await pool.query(`SELECT user_email FROM public."UserDetails" WHERE user_id=${user_id}`);
    const userEmailRes = userEmailQuery.rows[0].user_email;
    let connStatus;
    let device_status = null;
    // update device_conn_status
    if (deviceConnStatus === 'deviceConnected') {
      connStatus = true;
      device_status = 'Provisioned';
      await pool.query(`UPDATE public."Device" SET device_status='${device_status}' WHERE device_identifier='${device_Identifier}'`);
    } else if (deviceConnStatus === 'deviceDisconnected') {
      connStatus = false;
      device_status = 'Registered';
      await pool.query(`UPDATE public."Device" SET device_status='${device_status}' WHERE device_identifier='${device_Identifier}'`);
    }
    const deviceInfoUpdateQuery = `UPDATE public."Device" SET device_conn_status=${connStatus} WHERE device_identifier='${device_Identifier}' RETURNING*`;
    console.log(deviceInfoUpdateQuery);
    const deviceInfoUpdateRes = await pool.query(deviceInfoUpdateQuery);
    const res = deviceInfoUpdateRes.rows[0];
    const deviceConnectionRecord = {
      'user_id': user_id,
      'device_id': res.device_id,
      'device_identifier': res.device_identifier,
      'device_conn_status': res.device_conn_status,
      'device_status': device_status,
      'timestamp': data_recorded_at,
    };
    console.log(deviceConnectionRecord);
    pubsub.publish(`"UPDATE_DEVICE_CONNECTION_STATUS/${userEmailRes}"`, {UpdateDeviceConnectionStatus: deviceConnectionRecord});
  } catch (error) {
    return error;
  }
};

module.exports = {updateRawdata, eventsFromIoTHub, updateDeviceConnStatus, pubsub};
