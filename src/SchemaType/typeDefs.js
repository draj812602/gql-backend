/* eslint-disable no-tabs */
const {gql} = require('apollo-server-express');

const typeDefs = gql`
scalar JSON
scalar JSONObject
type Query{
    getUser:User
    getSubscriptionJwtToken:String
    getTemplate:templateTable
    getDevice:deviceTable
    getTemplateNames:[templateTableData]
    getComponents(template_id:Int):[Component]
    getCapabilities(component_id:Int):CapabilityOutPut
    getDeviceConnectionInfo(device_id:Int):DeviceConnInfo
    getdeviceById(device_id:Int):DeviceInfo
    getTemplatedPublishedStatus(template_id:Int):Boolean
    getDeviceRawData(device_id:Int):rawDataTable
    getDashboardName:[dashboardName]
    getDeviceCapability:[deviceCapability]
    getWidget(dashboard_id:Int):widgetOutData
    getDeviceCommand(device_id:Int):deviceCommand
    getWidgetDetails(dashboard_id:Int,widget_id:Int):widgetDetails
    getDeviceCommandWidgets(device_id:Int):[DeviceCommandWidgetDetails]
    getCapabilityhistory(command_widget_id:Int):capabilityHistory

}

type Mutation{
    getWidgetMutation(dashboard_id:Int):widgetOutData
    addDevice(input:Device):deviceTable
    deleteDevice(device_id:Int):String
    blockOrUnblockDevice(device_id:Int,status:String):Boolean
    addTemplate(templateName:String):templateTable
    deleteTemplate(template_id:Int):String
    addComponent(template_id:Int,component_name:String):Component
    deleteComponent(template_id:Int,component_id:Int):Int
    addOrUpdateCapability(input:CapabilityInput):CapabilityOutPut
    assignTemplate(device_id:Int,template_id:Int):rawDataTable
    publishTemplate(template_id:Int):templatePublishedData
    deleteCapability(template_id:Int,component_id:Int,component_cap_id:Int):Int
    createDashboard(dashboard_name:String):Dashboard
    editDashboardName(dashboard_id:Int!,dashboard_name:String!):Dashboard
    deleteDashboardName(dashboard_id:Int):Int
    createWidget(input:widgetInData):widgetOutData
    deleteWidget(widget_id:Int):Int
    sendC2DMessage(input:c2dMsgInput):capabilityResponse
    getSensorDataOnTimeInterval(input:chartInfoIn):chartInfoOut
    editWidget(input:chartInfoIn):dashboardWidgets
    reGenerateSaSToken(device_id:Int):DeviceConnInfo
}

type Subscription{
    UserReg:User!
    UpdateRawData(topic:topic):rawDataTable
    UpdateDeviceConnectionStatus(topic:topic):deviceConnectionRecord
    UpdateLiveDataOnWidget(topic:topic):liveDataForWidgets
}

type Component{
    template_id:Int
    component_id:Int
    component_name:String
}

type widgetDetails{
    dashboard_id:Int
    widget_id:Int
    widget_title:String
    device_id:Int
    device_name:String
    device_identifier:String
    component_id:Int
    component_name:String 
    component_cap_id:Int
    capability_display_name:String
}

input chartInfoIn{
    widget_id:Int
    widget_name:String
    widget_title:String
	device_id:Int
    component_id:Int
	component_cap_id:Int
	data_time_interval:String
}
type chartInfoOut{
        widget_id:Int
        widget_title:String
		device_id:String
        component_id:Int
        component_cap_id:Int
		data_time_interval:String
		telemetry:[sensorData]
}
type liveDataForWidgets{
        dashboard_id:Int
		widget_id:Int
		device_id:Int
		#capability_name:String'
        component_id:Int
		component_cap_id:Int
		data_time_interval:String
		telemetry:[sensorData]
	}
	
input widgetInData{
    dashboard_id:Int
    widget_name:String
    widget_title:String
    device_id:Int
    component_id:Int,
    component_cap_id:Int
    #message:String
}
type deviceCommand{
    device_id:Int
    commands:[devCommands]
}
type devCommands{
    c2d_message_id:Int
    widget_name:String
    widget_title:String
    template_cap_id:Int
    capability_data_type:String
    message:String
    feedback_message:String
}
type widgetOutData{
    dashboard_id:Int
    widgets:[dashboardWidgets]
}
type dashboardWidgets{
    widget_id:Int
    widget_name:String
    widget_title:String
    device_id:Int
    component_id:Int
    component_name:String
    component_cap_id:Int
    capability_display_name:String
    data_time_interval:String
    #message:String
    #feedback_message:String
    telemetry:[sensorData]
}
type DeviceCommandWidgetDetails{
    command_widget_id:Int
    widget_title:String
    widget_name:String
    device_id:Int
    component_id:Int
    component_cap_id:Int
    command_data_type:String
    responsepayload:JSONObject
}
type capabilityHistory{
    command_widget_id:Int
    device_id:Int
    component_id:Int
    component_cap_id:Int
    history:[capHistory]
}
type capHistory{
    c2d_msg_id:Int
    request_payload:String
    request_time:String
    response_payload:String
    response_time:String
    response_code:Int
    response_type:String
}
type capabilityResponse{
    command_widget_id:Int
    device_id:Int
    component_id:Int
    component_cap_id:Int,
    response:[capResponse]
}
type capResponse{
    c2d_msg_id:Int
    request_payload:String
    request_time:String
    response_payload:String
    response_time:String
    response_code:Int
    response_type:String
}
type sensorData{
    sensorName:String
    sensorValue:String
    timestamp:String
}
type deviceCapability{
    device_id:Int
    device_identifier:String
    device_name:String
    components:[devComponents]
}
type devComponents{
    component_id:Int
    component_name:String
    capabilities:[CapabilityOutRows]
}
type dashboardName{
    dashboard_id:Int
    dashboard_name:String
}
input c2dMsgInput{
    command_widget_id:Int
    request_payload:String 
	}

type Dashboard{
		dashboard_id:Int,
		dashboard_name:String
	}
type deviceConnectionRecord{
    user_id:Int
    device_id:Int
    device_identifier:String
    device_conn_status:Boolean
    device_status:String
    timestamp:String
}
type DeviceConnInfo{
  device_id:Int
 connection_string:String
 mqtt_broker_address:String
 mqtt_user_name:String
 mqtt_password:String
 mqtt_pass_expiry_time:String
 is_mqtt_pass_expired:Boolean
}

type templatePublishedData{
    template_id:Int
    status:String
    published_status:String
}
input CapabilityInput{
    template_id:Int
    component_id:Int
    capabilities:[CapabilityInRows]
}

input CapabilityInRows{
    component_cap_id:String
    capability_display_name:String
    capability_name:String
    capability_type:String
    capability_data_type:String
}
type CapabilityOutPut{
    #template_id:Int
    component_id:Int
    component_name:String
    capabilities:[CapabilityOutRows]
}
type CapabilityOutRows{
    component_cap_id:Int
    capability_display_name:String 
    capability_name:String
    capability_type:String
    capability_data_type:String
}
type templateTable{
    column:[columnData]
    data:[templateTableData]
}
type templateTableData{
    template_id:Int
    template_name:String
    creation_date:String
    status:String
    published_status:String
}

type User{
    user_id:Int
    user_name:String
    user_email:String
    user_country:String
    account_type:String
}
type deviceTable{
    column:[columnData]
    data:[deviceTableData]
}
type deviceTableData{
    device_id:Int
    device_identifier:String
    device_name:String
    device_status:String
    template_id:Int
    device_template:String
}
input Device{
    device_name:String
    device_identifier:String
    assigned_template:String
}
type DeviceInfo{
    device_name:String
    device_identifier:String
    device_status:String
    device_conn_status:Boolean
    template_id:Int
    template_name:String
    device_block_status:String
    has_command:Boolean
}

input topic{
    topic:String
}
type rawDataTable{
    device_id:Int    
    columns:[columnData]
    data:JSON
}
type tableColumn{
    device_id:Int
    columnData:[columnData]
}
type columnData{
    dataField:String
    text:String
    sort:Boolean
}

type rawDataTableData{
    raw_data_id:Int
    device_id:Int
    timestamp: String
    message_type: String
    modeled_data: JSON 
    data_sub_obj:JSONObject
    unmodeled_data:JSON 
}`;
module.exports = typeDefs;
