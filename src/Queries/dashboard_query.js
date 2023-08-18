/* eslint-disable camelcase */
const {getDataOnTimeInterval} = require('../utils/getDataOnTimeInterval');
const getDashboardName = async (_, args, {pool, request, user_id, pubsub})=>{
  try {
    const getDashboardNameRes = await pool.query(`
         SELECT row_to_json(dashboards)
           FROM(SELECT dashboard_id,dashboard_name
                FROM public."Dashboard"
                WHERE user_id=${user_id}
                ORDER BY public."Dashboard".dashboard_id DESC
                )as dashboards `);
    const userAllDashboards = [];
    if (getDashboardNameRes.rows.length > 0) {
      // console.log(getDashboardNameRes)
      for (const obj of getDashboardNameRes.rows) {
        userAllDashboards.push(obj.row_to_json);
      }
    }
    return userAllDashboards;
  } catch (error) {
    throw new Error(error.message);
  }
};

const getWidget = async (_, args, {pool, request, user_id, pubsub})=>{
  try {
    const {dashboard_id} = args;

    const getAllWidgetsOfDahbaord = await pool.query(
        `SELECT row_to_json(widgets)
            FROM ( SELECT jsonb_agg(nested_section)
                   FROM ( select a.widget_id,a.widget_name,a.widget_title,a.device_id,a.component_id,a.component_cap_id,a.data_time_interval,
                    (SELECT row_to_json(compObj)
                     FROM(select cc.component_id,cc.component_name 
                          from public."TemplateComponent" cc
                          where cc.component_id = a.component_id and  cc.comp_published_flag=1)as compObj)components,
                    (SELECT row_to_json(capObj)
                      FROM(select tt.component_cap_id,tt.capability_name,tt.capability_display_name
                        from public."ComponentCapability" tt
                        where tt.component_cap_id=a.component_cap_id and tt.cap_published_flag=1
                        )as capObj
                        )capabilities
                         from public."DashboardWidget" a
                         where dashboard_id='${dashboard_id}'
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
          const capObj = widget.capabilities;
          const compObj = widget.components;
          const telemetry = [];
          console.log(capObj, compObj);
          const component_name = compObj.component_name;
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
              console.log(modeledData);
              if (modeledData !== null) {
                for (let i = 0; i < modeledData.length; i++) {
                  const mdataObj = data.modeled_data[i]; // fetch data as component_name/cap_name :pending
                  // console.log(mdataObj)
                  for (const key in mdataObj) {
                    const dataComponentName = key;
                    const capabilities = mdataObj[key];
                    if (dataComponentName.toUpperCase() === component_name.toUpperCase()) {
                      for (const cap in capabilities) {
                        const telemetryObj = {};
                        const dataCapName = cap;
                        const dataCapValue = capabilities[cap];
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
            }
          }
          widget.component_id = compObj.component_id;
          widget.component_name = compObj.component_name;
          widget.component_cap_id = capObj.component_cap_id;
          widget.capability_display_name = capability_display_name;
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

const getWidgetDetails = async (_, args, {pool, request, user_id, pubsub})=>{
  try {
    const {widget_id} = args;
    const widgetDetaisQueryRes = await pool.query(
        ` select a.widget_id,a.widget_name,a.widget_title,a.device_id,a.component_cap_id,
                 b.device_identifier,b.device_name,c.component_id,c.component_name,d.capability_display_name
        from public."DashboardWidget" a ,public."Device" b, public."TemplateComponent" c,public."ComponentCapability" d
        where a.widget_id=${widget_id} and 
              a.device_id=b.device_id and 
              a.component_id=c.component_id and 
              a.component_cap_id = d.component_cap_id and 
              c.comp_published_flag=1 and 
              d.cap_published_flag=1
              
        `,
    );
    const widgetDetails = {};
    if (widgetDetaisQueryRes.rows.length > 0) {
      // console.log(widgetDetaisQueryRes)
      const res = widgetDetaisQueryRes.rows[0];
      widgetDetails.widget_id = widget_id;
      widgetDetails.widget_name = res.widget_name;
      widgetDetails.widget_title = res.widget_title;
      widgetDetails.device_id = res.device_id;
      widgetDetails.component_cap_id = res.component_cap_id;
      widgetDetails.device_name = res.device_name;
      widgetDetails.device_identifier = res.device_identifier;
      widgetDetails.component_id = res.component_id;
      widgetDetails.component_name = res.component_name;
      widgetDetails.capability_display_name = res.capability_display_name;
    }
    return widgetDetails;
  } catch (error) {
    throw new Error(error.message);
  }
};

const getDeviceCapability = async (_, args, {pool, request, user_id, pubsub})=>{
  try {
    const deviceCapRes = await pool.query(
        `select row_to_json(devcapObj)
                from(select jsonb_agg(devices)
                   from(select a.device_id,a.device_identifier,a.device_name,
						(select jsonb_agg(component)
							  from(select c.component_id,c.component_name,
								   (select jsonb_agg(capability)
								      from(select * 
										    from public."ComponentCapability" d
										    where d.component_id = c.component_id and d.cap_published_flag=1
										  )as capability
								   )as capabilities
								   from public."DeviceTemplate" b ,public."TemplateComponent" c
								   where b.template_id=c.template_id and c.comp_published_flag=1 and b.is_published='yes' and 
								         b.template_id=(select dt.template_id 
                                                          from public."DeviceToTemplate" dt
                                                           where a.device_id=dt.device_id)  
								  )as component
						 )as components
							
                        from public."Device" a
                        where a.user_id='${user_id}'
                        )as devices
                       )as devcapObj`,
    );
    console.log(deviceCapRes.rows[0].row_to_json.jsonb_agg);
    const dev = [];
    const dbRes = deviceCapRes.rows[0].row_to_json.jsonb_agg;
    // console.log(deviceCapRes.rows.length,dbRes)
    // console.log(deviceCapRes.rows.length > 0 , dbRes != null)
    if (deviceCapRes.rows.length > 0 && dbRes != null) {
      for (const device of dbRes) { // devices array
        const devObj={};
        devObj.device_id = device.device_id;
        devObj.device_identifier = device.device_identifier;
        devObj.device_name = device.device_name;
        if (device.components == null) {
          devObj.components = [];
        } else {
          const devComponents = [];
          for (const comp of device.components) { // components array
            const compObj ={};
            compObj.component_id = comp.component_id;
            compObj.component_name = comp.component_name;
            if (comp.capabilities == null) {
              compObj.capabilities = [];
            } else {
              const compCapabilities = [];
              for (const cap of comp.capabilities) { // capabilities array
                const capObj = {};
                capObj.component_cap_id = cap.component_cap_id;
                capObj.capability_display_name = cap.capability_display_name;
                capObj.capability_name = cap.capability_name;
                compCapabilities.push(capObj);
              }
              compObj.capabilities = compCapabilities;
            }
            devComponents.push(compObj);
          }
          devObj.components = devComponents;
        }
        dev.push(devObj);
      }
    }
    return dev;
  } catch (error) {
    throw new Error(error.message);
  }
};

module.exports = {getDashboardName, getWidget, getWidgetDetails, getDeviceCapability};
