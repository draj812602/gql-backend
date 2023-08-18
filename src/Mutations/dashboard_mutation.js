const {getDataOnTimeInterval} = require('../utils/getDataOnTimeInterval');

const createDashboard = async (_, args, {pool, request, user_id, pubsub}) => {
  const {dashboard_name} = args;
  try {
    const dashboardName = {};
    const qstr = {
      text: 'select COUNT(*) as total_dashboards from public."Dashboard" where user_id=$1 ',
      values: [user_id],
    };
    const {total_dashboards} = (await pool.query(qstr)).rows[0];
    if (total_dashboards < 5) {
      const c_u_date = new Date();
      const createDashboardQuery = {
        text: 'INSERT INTO public."Dashboard"(user_id,dashboard_name,created_at,updated_at) VALUES($1,$2,$3,$4) RETURNING*',
        values: [user_id, dashboard_name, c_u_date, c_u_date],
      };
      const createDashboardQueryRes = (await pool.query(createDashboardQuery)).rows[0];
      dashboardName.dashboard_id = createDashboardQueryRes.dashboard_id;
      dashboardName.dashboard_name = createDashboardQueryRes.dashboard_name;
      return dashboardName;
    } else {
      return new Error('Sorry!! You cannot create more than 5 Dashboards');
    }
  } catch (error) {
    console.log(error.message);
    if (error.message == 'duplicate key value violates unique constraint "uq_dashboard_name"') {
      throw new Error(`Dashboard with name ${dashboard_name} is Exists, please use different name`);
    }
  }
};

const editDashboardName=async (_, args, {pool, request, user_id, pubsub}) => {
  const {dashboard_id, dashboard_name} = args;
  try {
    const dashboardName = {};

    const query1 = {
      text: 'update public."Dashboard" set dashboard_name=$1 where dashboard_id=$2 and user_id=$3 RETURNING*',
      values: [dashboard_name, dashboard_id, user_id],
    };
    console.log(query1);
    const editDashBoardRes = await pool.query(query1);
    console.log(editDashBoardRes);
    if (editDashBoardRes.rowCount === 1) {
      const editDashboardQueryRes = editDashBoardRes.rows[0];
      dashboardName.dashboard_id = editDashboardQueryRes.dashboard_id;
      dashboardName.dashboard_name = editDashboardQueryRes.dashboard_name;
      return dashboardName;
    }
  } catch (error) {
    console.log(error.message);
    if (error.message == 'duplicate key value violates unique constraint "uq_dashboard_name"') {
      throw new Error(`Dashboard with name ${dashboard_name} is Exists, please use different name`);
    }
  }
};

const deleteDashboardName=async (_, args, {pool, request, user_id, pubsub}) => {
  try {
    const {dashboard_id} = args;
    const dahboardDeleteQuery = {
      text: 'DELETE FROM public."Dashboard" WHERE user_id=$1 and dashboard_id=$2',
      values: [user_id, dashboard_id],
    };
    const dahboardDeleteRes = await pool.query(dahboardDeleteQuery);
    if (dahboardDeleteRes.rowCount === 1) {
      return dashboard_id;
    }
  } catch (error) {
    throw new Error(error.message);
  }
};

const createWidget =async (_, args, {pool, request, user_id, pubsub}) => {
  try {
    const widgetOutData={};
    const widgets=[];
    const widgetObj={};
    const {dashboard_id, widget_name, widget_title, device_id, component_id, component_cap_id} = args.input;
    // #2 for beta release: Restrict 10 Widgets per dashboard
    const qstr = {
      text: 'select COUNT(*) as total_widgets from public."DashboardWidget" where dashboard_id=$1',
      values: [dashboard_id],
    };
    const {total_widgets} = (await pool.query(qstr)).rows[0];
    if (total_widgets < 10) {
      const c_u_at = new Date();
      const addWidgetQuery = {
        text: 'INSERT INTO public."DashboardWidget"(dashboard_id,widget_name,widget_title,device_id,created_at,updated_at,component_id,component_cap_id) values($1,$2,$3,$4,$5,$6,$7,$8) RETURNING*',
        values: [dashboard_id, widget_name, widget_title, device_id, c_u_at, c_u_at, component_id, component_cap_id],
      };
      const addWidgetQueryRes = await pool.query(addWidgetQuery);
      const widgetId = addWidgetQueryRes.rows[0].widget_id;
      const timeInterval = addWidgetQueryRes.rows[0].data_time_interval;
      /* if(widget_name === 'Message' || widget_name==='Switch'){
               const addC2DMessageQuery = {
                 text:'INSERT INTO public."C2DMessage"(widget_id,message) VALUES($1,$2) RETURNING*',
                 values:[widgetId,message]
               }
               const addC2DMessageQueryRes = await pool.query(addC2DMessageQuery)

          }*/
      const getCapName = await pool.query(`SELECT a.component_name,b.capability_name,b.capability_display_name FROM public."TemplateComponent" a, public."ComponentCapability" b WHERE a.component_id=b.component_id and a.component_id=${component_id} and component_cap_id=${component_cap_id}`);
      console.log(getCapName);
      const {component_name, capability_name, capability_display_name} = getCapName.rows[0];
      const israwDataExists = await pool.query(`SELECT timestamp,modeled_data FROM public."DeviceRawData" WHERE device_id=${device_id} `);
      // console.log(israwDataExists)
      const telemetry =[];

      if (israwDataExists.rows.length > 0) {
        const modeledData = israwDataExists.rows;
        console.log(modeledData);
        for (const data of modeledData) {
          const telemetryObj = {};
          if (data.modeled_data !== null) {
            console.log(data.modeled_data);
            const mdataObj = data.modeled_data[0];
            for (key in mdataObj) {
              const dataCapName = key;
              const dataCapValue = mdataObj[key];
              console.log(dataCapName, dataCapValue);
              if (dataCapName.toUpperCase() === capability_name.toUpperCase()) {
                telemetryObj.sensorName = capability_display_name;
                telemetryObj.sensorValue = dataCapValue;
                telemetryObj.timestamp = data.timestamp;
                telemetry.push(telemetryObj);
              }
            }
            // telemetryObj.sensorValue =
          }
        }
      }
      widgetOutData.dashboard_id = dashboard_id;
      widgetObj.widget_id = widgetId;
      widgetObj.widget_name = widget_name;
      widgetObj.widget_title = widget_title;
      widgetObj.device_id = device_id;
      widgetObj.component_name = component_name;
      widgetObj.component_id = component_id;
      widgetObj.component_cap_id = component_cap_id;
      widgetObj.capability_display_name=capability_display_name;
      widgetObj.data_time_interval = timeInterval;
      widgetObj.telemetry = telemetry;
      widgets.push(widgetObj);
      widgetOutData.widgets =widgets;
      return widgetOutData;
    } else {
      return new Error('Sorry!! You cannot create more than 10 widgets');
    }
  } catch (error) {
    throw new Error(error.message);
  }
};

const deleteWidget = async (_, args, {pool, request, user_id, pubsub}) => {
  try {
    const {widget_id} = args;
    const deleteWidgetQuery = {
      text: 'DELETE FROM public."DashboardWidget" WHERE widget_id=$1',
      values: [widget_id],
    };
    const deleteWidgetQueryRes = await pool.query(deleteWidgetQuery);
    if (deleteWidgetQueryRes.rowCount === 1) {
      return widget_id;
    }
  } catch (error) {
    throw new Error(error.message);
  }
};

const getSensorDataOnTimeInterval = async (_, args, {pool, request, user_id, pubsub}) =>{
  try {
    const {widget_id, device_id, component_id, component_cap_id, data_time_interval} = args.input;
    const widgetInfo = args.input;
    const {component_name, capability_name, capability_display_name} = (await pool.query(`SELECT a.component_name,b.capability_name,b.capability_display_name FROM public."TemplateComponent" a,public."ComponentCapability" b WHERE a.component_id=${component_id} and b.component_cap_id=${component_cap_id} and a.component_id=b.component_id`)).rows[0];


    const timeFormat = {M: 'minute', H: 'hour', D: 'day', W: 'week', O: 'month', Y: 'year'};
    const intervalFormat = data_time_interval[(data_time_interval.length) - 1];
    const interval = timeFormat[`${intervalFormat}`];
    const intervalNum = (data_time_interval.length) - 1;
    // update timeinterval for that widget
    const timeIntervalUpdate = `${intervalNum} ${interval}`;
    await pool.query(`UPDATE public."DashboardWidget" SET data_time_interval='${data_time_interval}' WHERE widget_id=${widget_id}`);
    //fetch device rawdata with respect to input component name
    const rawDataFromDbQuery = {
      text: `SELECT unnest(modeled_data)->$1 as "sensorRawData", timestamp FROM public."DeviceRawData" WHERE "device_id" = $2 and (TO_TIMESTAMP( timestamp,\'DD/MM/YYYY HH24:MI:SS\')) between (NOW() - interval \'${intervalNum} ${interval}\') and NOW() `,
      values: [component_name, device_id],
    };
    // console.log(rawDataFromDbQuery)
    const rawDataFromDbQueryRes = await pool.query(rawDataFromDbQuery);
    // console.log(rawDataFromDbQueryRes)
    const widgetSensorData = [];
    if (rawDataFromDbQueryRes.rows.length > 0) {
      //console.log(rawDataFromDbQueryRes.rows)
      for (const data of rawDataFromDbQueryRes.rows) {
        //console.log("data.sensorRawData :",data.sensorRawData )
        if (data.sensorRawData != null) {
           const rawDataObj = data.sensorRawData
          for(const key in rawDataObj){
               const DataCapName = key
               const capValue = rawDataObj[key]
               //check is data related to widget capability of the component
               if(DataCapName.toUpperCase() === capability_name.toUpperCase()){
                data.sensorName = capability_display_name;
                data.sensorValue = capValue;
                widgetSensorData.push(data);
               }
          }
        }
      }
      console.log(widgetSensorData);
    }
    widgetInfo.telemetry = widgetSensorData;
    return widgetInfo;
    // const widgetInfo
  } catch (error) {
    throw new Error(error);
  }
};

const editWidget = async (_, args, {pool, request, user_id, pubsub}) =>{
  try {
    const {widget_id, widget_name, widget_title, device_id, component_id, component_cap_id, data_time_interval} = args.input;
    const editWidgetQuery ={
      text: 'UPDATE public."DashboardWidget" SET widget_title=$1,device_id=$2,component_id=$3,component_cap_id=$4,data_time_interval=$5 WHERE widget_id=$6',
      values: [widget_title, device_id, component_id, component_cap_id, data_time_interval, widget_id],
    };
    const editWidgetQueryRes = await pool.query(editWidgetQuery);
    if (editWidgetQueryRes.rowCount === 1) {
      const {component_name, capability_name, capability_display_name} = (await pool.query(`SELECT a.component_name,b.capability_name,b.capability_display_name FROM public."TemplateComponent" a,public."ComponentCapability" b WHERE a.component_id=${component_id} and b.component_cap_id=${component_cap_id} and a.component_id=b.component_id`)).rows[0];
      const telemetry = [];
      const widgetData = {};
      widgetData.widget_id = widget_id;
      widgetData.widget_name = widget_name;
      widgetData.widget_title = widget_title;
      widgetData.device_id = device_id;
      widgetData.component_id = component_id;
      widgetData.component_name = component_name;
      widgetData.component_cap_id = component_cap_id;
      widgetData.data_time_interval = data_time_interval;
      const rawData = await getDataOnTimeInterval(data_time_interval, device_id, pool);
      if (rawData !== null || rawData != []) {
        for (const data of rawData) {
          const modeledData = data.modeled_data;
          if (modeledData !== null) {
            for (let i = 0; i < modeledData.length; i++) {
              // console.log(data.modeled_data)
              const mdataObj = data.modeled_data[i];
              // console.log(mdataObj)
              for (const key in mdataObj) {
                const telemetryObj = {};
                const dataCapName = key;
                const dataCapValue = mdataObj[key];
                // console.log(dataCapName,dataCapValue, widget.capability_display_name)
                if (dataCapName.toUpperCase() === capability_name.toUpperCase()) {
                  telemetryObj.sensorName = capability_display_name;
                  telemetryObj.sensorValue = dataCapValue;
                  telemetryObj.timestamp = data.timestamp;
                  telemetry.push(telemetryObj);
                }
              }
            }
          }
        }
      }
      widgetData.telemetry = telemetry;
      console.log(widgetData);
      return widgetData;
    }
  } catch (error) {
    throw new Error(error);
  }
};

const getWidgetMutation = async (_, args, {pool, request, user_id, pubsub})=>{
  try {
    const {dashboard_id} = args;

    const getAllWidgetsOfDahbaord = await pool.query(
        `SELECT row_to_json(widgets)
          FROM ( SELECT jsonb_agg(nested_section)
                 FROM ( select a.widget_id,a.widget_name,a.widget_title,a.device_id,a.template_cap_id,a.data_time_interval,
                  (SELECT jsonb_agg(capObj)
                    FROM(select tt.capability_name,tt.capability_display_name
                      from public."ComponentCapability" tt
                      where tt.template_cap_id=a.template_cap_id
                      )as capObj
                      )capabilities
                       from public."DashboardWidget" a
                       where dashboard_id=${dashboard_id}
                       order by a.widget_id ASC
                       )as nested_section
                )as widgets`,
    );

    // console.log(getAllWidgetsOfDahbaord.rows[0].row_to_json)
    const dashboardWidgets ={};
    dashboardWidgets.dashboard_id=dashboard_id;
    const allWidgets = [];
    if (getAllWidgetsOfDahbaord.rows.length > 0) {
      const widgetObjs = getAllWidgetsOfDahbaord.rows[0].row_to_json.jsonb_agg;
      if (widgetObjs !== null) {
        for (const widget of widgetObjs) {
          const capObj = widget.capabilities[0];
          const telemetry = [];
          const capability_name = capObj.capability_name;
          const capability_display_name = capObj.capability_display_name;
          const timeInterval = widget.data_time_interval;
          const device_id = widget.device_id;
          console.log(timeInterval);
          const rawData = await getDataOnTimeInterval(timeInterval, device_id, pool);
          console.log('rawData', rawData);
          if (rawData !== null || rawData != []) {
            for (const data of rawData) {
              const modeledData = data.modeled_data;
              if (modeledData !== null) {
                for (let i = 0; i < modeledData.length; i++) {
                  // console.log(data.modeled_data)
                  const mdataObj = data.modeled_data[i];
                  // console.log(mdataObj)
                  for (const key in mdataObj) {
                    const telemetryObj = {};
                    const dataCapName = key;
                    const dataCapValue = mdataObj[key];
                    // console.log(dataCapName,dataCapValue, widget.capability_display_name)
                    if (dataCapName.toUpperCase() === capability_name.toUpperCase()) {
                      telemetryObj.sensorName = capability_display_name;
                      telemetryObj.sensorValue = dataCapValue;
                      telemetryObj.timestamp = data.timestamp;
                      telemetry.push(telemetryObj);
                    }
                  }
                }
              }
            }
          }

          widget.telemetry = telemetry;
          console.log(widget);
          allWidgets.push(widget);
        }
      }
    }
    dashboardWidgets.widgets = allWidgets;
    console.log(dashboardWidgets);
    return dashboardWidgets;
  } catch (error) {
    throw new Error(error.message);
  }
};
module.exports={createDashboard, editDashboardName, deleteDashboardName, createWidget, deleteWidget, getSensorDataOnTimeInterval, editWidget, getWidgetMutation};
