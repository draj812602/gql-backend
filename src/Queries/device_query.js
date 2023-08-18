
const {deviceTableColumns} = require('../localServices/UiTableColumns');
const {timeStampToDateTime} = require('../utils/convertTimeStamp');
const getDevice = async (_, args, {pool, request, user_id, pubsub}) => {
  try {
    const deviceTable = {
      column: deviceTableColumns,
      data: [],
    };
    const getDeviceRes = await pool.query(
        `SELECT row_to_json(devices)
             FROM ( SELECT * 
                    FROM public."Device"
                    WHERE user_id=${user_id}
                    ORDER BY public."Device".device_id DESC
                  )As devices`,
    );
    const allDevices = [];
    console.log(getDeviceRes);
    if (getDeviceRes.rows.length > 0) {
      console.log(getDeviceRes.rows);
      for (const deviceRow of getDeviceRes.rows) {
        const row = deviceRow.row_to_json;
        const template_name = row.assigned_template;
        let templateId = null;
        if (template_name !== 'unassigned') {
          const templateIdQuery = await pool.query(
              `select template_id from public."DeviceTemplate" where template_name='${row.assigned_template}'`,
          );
          templateId = templateIdQuery.rows[0].template_id;
        }
        row.device_template = row.assigned_template;
        row.template_id = templateId;

        allDevices.push(row);
      }
      deviceTable.data = allDevices;

      console.log(deviceTable);

      return deviceTable;
    }

    return deviceTable;
  } catch (error) {
    throw new Error(error.message);
  }
};

const getDeviceConnectionInfo = async (
    _,
    args,
    {pool, request, user_id, pubsub},
) => {
  try {
    const {device_id} = args;
    const deviceConnInfoRes = await pool.query(
        `SELECT * FROM public."RegisteredDeviceInfo" WHERE device_id=${device_id}`,
    );
    // console.log(deviceConnInfoRes)
    const deviceConnInfo = deviceConnInfoRes.rows[0];
    const currentDate = new Date();
    // const currentTime = currentDate.setDate(currentDate.getDate())
    console.log(deviceConnInfo.mqtt_pass_expires_on);
    const dbExpiryTime = deviceConnInfo.mqtt_pass_expires_on;
    const sasTokenExpiryTime = dbExpiryTime; // new Date(parseInt(dbExpiryTime))
    console.log(sasTokenExpiryTime, currentDate);
    console.log(currentDate >= sasTokenExpiryTime);
    let is_mqtt_pass_expired = false;
    if (currentDate >= sasTokenExpiryTime) {
      is_mqtt_pass_expired = true;
    }
    deviceConnInfo.mqtt_pass_expiry_time = await timeStampToDateTime(
        sasTokenExpiryTime,
    );
    deviceConnInfo.is_mqtt_pass_expired = is_mqtt_pass_expired;
    return deviceConnInfo;
  } catch (error) {
    throw new Error(error.message);
  }
};
const getdeviceById = async (_, args, {pool, request, user_id, pubsub}) => {
  try {
    const {device_id} = args;
    const deviceInfoQueryRes = await pool.query(
        `SELECT * FROM public."Device" WHERE user_id=${user_id} and device_id=${device_id}`,
    );
    const deviceInfo = deviceInfoQueryRes.rows[0];
    console.log(deviceInfoQueryRes);
    const deviceTempName = deviceInfo.assigned_template;
    deviceInfo.template_id = null;
    deviceInfo.template_name = 'unassigned';
    if (deviceTempName !== 'unassigned') {
      const templateIdQueryRes =
        await pool.query(`select a.template_id ,b.template_name
                       from public."DeviceToTemplate" a ,public."DeviceTemplate" b
                       where a.template_id=b.template_id and a.device_id=${device_id}
                       `);
      deviceInfo.template_id = templateIdQueryRes.rows[0].template_id;
      deviceInfo.template_name = templateIdQueryRes.rows[0].template_name;
    }
    return deviceInfo;
  } catch (error) {
    throw new Error(error.message);
  }
};

const getDeviceRawData = async (
    _,
    args,
    {pool, request, user_id, pubsub},
) => {
  try {
    const {device_id} = args;
    const getDeviceCapabilitiesRes = await pool.query(`
      SELECT row_to_json(temp_details)
                FROM ( SELECT a.template_id,(SELECT jsonb_agg(components)
                                                FROM ( SELECT b.component_name,
													  (select jsonb_agg(capability)
														from(select	c.component_cap_id,c.capability_name
                                                              FROM public."ComponentCapability" as c
                                                              WHERE b.component_id=c.component_id and c.cap_published_flag=1
															 )as capability
													   )as capabilities
												 from public."TemplateComponent" b
											     where a.template_id=b.template_id and b.comp_published_flag=1
                                                )as components
                                            )as compcapability
                        FROM public."DeviceToTemplate" as a
                        WHERE a.device_id=${device_id}
                    )as temp_details
      `);
    console.log(getDeviceCapabilitiesRes.rows);
    const columnData = new Array(
        {
          dataField: 'timestamp',
          text: 'Timestamp',
          sort: true,
        },
        {
          dataField: 'message_type',
          text: 'Message type',
          sort: true,
        },
    );
    if (getDeviceCapabilitiesRes.rows.length > 0) {
      const deviceCapabilities = getDeviceCapabilitiesRes.rows;
      if(deviceCapabilities[0].row_to_json.compcapability != null){
      for (const capObj of deviceCapabilities[0].row_to_json.compcapability) {
        console.log(capObj);
        const compName = capObj.component_name;
        const capabilities = capObj.capabilities;
        console.log('capabilities', capabilities);
        if (capabilities != null) {
          for (const cap of capabilities) {
            const columnDataObj = {};
            console.log('cap=', cap);
            columnDataObj.dataField = compName + '/' + cap.capability_name;
            columnDataObj.text = compName + '/' + cap.capability_name;
            columnDataObj.sort = false;
            columnData.push(columnDataObj);
          }
        }
      }
    }
    }
    const getDeviceRawDataRes = await pool.query(
        `SELECT row_to_json(device_raw_data)
        FROM ( SELECT * 
               FROM public."DeviceRawData"
               WHERE device_id=${device_id}
               ORDER BY public."DeviceRawData".device_id DESC
             )As device_raw_data`,
    );

    // console.log(getDeviceRawDataRes)
    // console.log(getDeviceRawDataRes.rows)
    const tableData = [];
    const rawDataTable = {};

    // console.log(getDeviceRes)
    if (getDeviceRawDataRes.rows.length > 0) {
      console.log(getDeviceRawDataRes.rows);
      for (const deviceDataRow of getDeviceRawDataRes.rows) {
        const tableDataObj = {};
        const row = deviceDataRow.row_to_json;
        tableDataObj.raw_data_id = row.raw_data_id;
        tableDataObj.timestamp = row.timestamp;
        tableDataObj.message_type = row.message_type;
        console.log('row.data_sub_obj=', row.data_sub_obj);
        if (JSON.stringify(row.data_sub_obj._unmodeledData) === '[]') {
          row.data_sub_obj._unmodeledData = '';
        }
        tableDataObj.RawJsonObj = row.data_sub_obj;
        if (row.modeled_data !== null) {
          const modeledCompCaps = row.modeled_data;
          console.log('modeledCompCaps', modeledCompCaps);
          // deviceData.modeled_data = row.modeled_data
          for (const cap of modeledCompCaps) {
            console.log('cap:', cap);
            for (const key in cap) {
              const dataCompName = key;
              const dataCapas = cap[key];
              for (const key1 in dataCapas) {
                // let columnDataObj ={}
                const deviceCapName = key1;
                const deviceCapValue = dataCapas[key1];
                tableDataObj[`${dataCompName}/${deviceCapName}`] =
                  deviceCapValue;
              }
            }
          }
        }
        if (JSON.stringify(row.unmodeled_data) === '[]') {
          tableDataObj.unmodeled_data = '';
        } else {
          tableDataObj.unmodeled_data = JSON.stringify(row.unmodeled_data);
        }
        tableData.push(tableDataObj);
      }
    }
    columnData.push({
      dataField: 'unmodeled_data',
      text: 'Unmodeled data',
      sort: false,
    });
    rawDataTable.device_id = device_id;
    rawDataTable.columns = columnData;
    rawDataTable.data = tableData;
    console.log(rawDataTable);
    return rawDataTable;
  } catch (error) {
    throw new Error(error.message);
  }
};

const getDeviceCommand = async (_, args, {pool, request, pubsub},
) => {
  try {
    const {device_id} = args;
    const commandsQueryRes = await pool.query(`
     select row_to_json(devcommands)
       from(select jsonb_agg(commandwidgets)
              from( select *
                   from public."C2DMessage" 
                   where device_id=${device_id}
                   )as commandwidgets
            )devcommands
      `);
    const commands = [];
    console.log(commandsQueryRes);
    if (commandsQueryRes.rows.length > 0) {
      const dbRes = commandsQueryRes.rows[0].row_to_json.jsonb_agg;
      console.log(dbRes);
      if (dbRes != null) {
        for (const obj of dbRes) {
          const command = {};
          command.c2d_message_id = obj.c2d_msg_id;
          command.widget_name = obj.widget_name;
          command.widget_title = obj.widget_title;
          command.template_cap_id = obj.template_cap_id;
          command.capability_data_type = obj.capability_data_type;
          // command.message = obj.message
          // command.feedback_message = obj.feedback_message
          commands.push(command);
        }
      }
    }
    const deviceCommands = {device_id: device_id, commands: commands};
    return deviceCommands;
  } catch (error) {
    throw new Error(error.message);
  }
};
const getDeviceCommandWidgets =async (_, args, {pool, request, user_id, pubsub}) =>{
  try {
    const {device_id} = args;
    const getCommandWidgets = await pool.query(`select row_to_json(commandWidgets)
    from(select a.device_id,a.device_identifier,
       (select jsonb_agg(widget)
          from(select b.*,
		   (select row_to_json(responsePayload)
			    from ( select c.response_payload 
					    from public."C2DMessage" c 
			            where b.command_widget_id = c.command_widget_id and c.c2d_msg_id = (select max(c2d_msg_id) from public."C2DMessage")
			         )as responsePayload
			  )as responsePayload
        from public."DeviceCommandWidget" b
        where a.device_id=b.device_id 
      )as widget
    )as widgets
       from public."Device" a
       where a.device_id=${device_id}
  )as commandWidgets`)
  const widgets = getCommandWidgets.rows[0].row_to_json.widgets
  //console.log(widgets.length , widgets[0])
 
  if(widgets != null){
   return widgets
  }else{
    return []
  }
  }catch (error) {
    console.log(error);
    throw new Error(error.message);
  }
};

const getCapabilityhistory =async (_, args, {pool, request, user_id, pubsub}) =>{
  try {
    const {command_widget_id} = args;
    const capabilityC2DMesgs = await pool.query(`select row_to_json(commandWidgets)
    from(select a.command_widget_id,a.device_id,a.component_id,a.component_cap_id,
       (select jsonb_agg(c2dmsg)
          from(select *
                  from public."C2DMessage" b
                  where a.command_widget_id = b.command_widget_id
      )as c2dmsg
    )as history
       from public."DeviceCommandWidget" a
       where a.command_widget_id='${command_widget_id}' 
  )as commandWidgets`)

  const historyMsgs = capabilityC2DMesgs.rows[0].row_to_json
  console.log(historyMsgs)
  if(historyMsgs !== null){
     if(historyMsgs.history === null){
      historyMsgs.history = []
     }else{
      let newHistory = []
      for(const msgObj of historyMsgs.history){
        const requetTime = await timeStampToDateTime(msgObj.request_time)
        msgObj.request_time = requetTime
        const resposeTime = await timeStampToDateTime(msgObj.response_time)
        msgObj.response_time = resposeTime
        newHistory.push(msgObj)
      }
       historyMsgs.history = newHistory
     }
     return historyMsgs
  }

  }catch (error) {
    console.log(error);
    throw new Error(error.message);
  }
};
module.exports = {
  getDevice,
  getDeviceConnectionInfo,
  getdeviceById,
  getDeviceRawData,
  getDeviceCommand,
  getDeviceCommandWidgets,
  getCapabilityhistory
};
