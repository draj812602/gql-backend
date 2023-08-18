/* eslint-disable camelcase */
/* eslint-disable max-len */
const {pubsub} = require('../localServices/updateLivedata');
const {addDevice, deleteDevice, assignTemplate, blockOrUnblockDevice, sendC2DMessage, reGenerateSaSToken} = require('../Mutations/device_mutation');
const {getUser, getSubscriptionJwtToken} = require('../Queries/user_query');
const {addTemplate, addOrUpdateCapability, deleteTemplate, publishTemplate, deleteCapability, addComponent, deleteComponent} = require('../Mutations/template_mutation');
const {getTemplate, getTemplateNames, getCapabilities, getTemplatedPublishedStatus, getComponents} = require('../Queries/template_query');
const {getDevice, getDeviceConnectionInfo, getdeviceById, getDeviceRawData, getDeviceCommand,getDeviceCommandWidgets,getCapabilityhistory} = require('../Queries/device_query');
const {createDashboard, editDashboardName, deleteDashboardName, createWidget, deleteWidget, getSensorDataOnTimeInterval, editWidget, getWidgetMutation} = require('../Mutations/dashboard_mutation');
const {getDashboardName, getWidgetDetails, getWidget, getDeviceCapability} = require('../Queries/dashboard_query');
const {GraphQLJSONObject, GraphQLJSON} = require('graphql-type-json');

const resolvers = {
  JSON: GraphQLJSON,
  JSONObject: GraphQLJSONObject,
  Query: {
    getUser: (_, args, {pool, request, user_id}) => getUser(_, args, {pool, request, user_id}),
    getSubscriptionJwtToken: (_, args, {pool, request, user_id}) => getSubscriptionJwtToken(_, args, {pool, request, user_id}),
    getTemplate: (_, args, {pool, request, user_id}) => getTemplate(_, args, {pool, request, user_id}),
    getTemplateNames: (_, args, {pool, request, user_id}) => getTemplateNames(_, args, {pool, request, user_id}),
    getCapabilities: (_, args, {pool, request, user_id}) => getCapabilities(_, args, {pool, request, user_id}),
    getComponents: (_, args, {pool, request, user_id}) => getComponents(_, args, {pool, request, user_id}),
    getDevice: (_, args, {pool, request, user_id}) => getDevice(_, args, {pool, request, user_id}),
    getDeviceConnectionInfo: (_, args, {pool, request, user_id}) => getDeviceConnectionInfo(_, args, {pool, request, user_id}),
    getdeviceById: (_, args, {pool, request, user_id}) => getdeviceById(_, args, {pool, request, user_id}),
    getTemplatedPublishedStatus: (_, args, {pool, request, user_id}) => getTemplatedPublishedStatus(_, args, {pool, request, user_id}),
    getDeviceRawData: (_, args, {pool, request, user_id}) => getDeviceRawData(_, args, {pool, request, user_id}),
    getDashboardName: (_, args, {pool, request, user_id}) => getDashboardName(_, args, {pool, request, user_id}),
    getWidget: (_, args, {pool, request, user_id}) => getWidget(_, args, {pool, request, user_id}),
    getDeviceCapability: (_, args, {pool, request, user_id}) => getDeviceCapability(_, args, {pool, request, user_id}),
    getDeviceCommand: (_, args, {pool, request, user_id}) => getDeviceCommand(_, args, {pool, request, user_id}),
    getWidgetDetails: (_, args, {pool, request, user_id}) => getWidgetDetails(_, args, {pool, request, user_id}),
    getDeviceCommandWidgets: (_, args, {pool, request, user_id}) => getDeviceCommandWidgets(_, args, {pool, request, user_id}),
    getCapabilityhistory: (_, args, {pool, request, user_id}) => getCapabilityhistory(_, args, {pool, request, user_id}),
  },

  Mutation: {
    addDevice: (_, args, {pool, request, user_id}) => addDevice(_, args, {pool, request, user_id}),
    deleteDevice: (_, args, {pool, request, user_id}) => deleteDevice(_, args, {pool, request, user_id}),
    blockOrUnblockDevice: (_, args, {pool, request, user_id}) => blockOrUnblockDevice(_, args, {pool, request, user_id}),
    deleteTemplate: (_, args, {pool, request, user_id}) => deleteTemplate(_, args, {pool, request, user_id}),
    addComponent: (_, args, {pool, request, user_id}) => addComponent(_, args, {pool, request, user_id}),
    addTemplate: (_, args, {pool, request, user_id}) => addTemplate(_, args, {pool, request, user_id}),

    addOrUpdateCapability: (_, args, {pool, request, user_id}) => addOrUpdateCapability(_, args, {pool, request, user_id}),
    assignTemplate: (_, args, {pool, request, user_id}) => assignTemplate(_, args, {pool, request, user_id}),
    publishTemplate: (_, args, {pool, request, user_id}) => publishTemplate(_, args, {pool, request, user_id}),
    deleteCapability: (_, args, {pool, request, user_id}) => deleteCapability(_, args, {pool, request, user_id}),
    createDashboard: (_, args, {pool, request, user_id}) => createDashboard(_, args, {pool, request, user_id}),
    editDashboardName: (_, args, {pool, request, user_id}) => editDashboardName(_, args, {pool, request, user_id}),
    deleteDashboardName: (_, args, {pool, request, user_id}) => deleteDashboardName(_, args, {pool, request, user_id}),
    sendC2DMessage: (_, args, {pool, request, user_id}) => sendC2DMessage(_, args, {pool, request, user_id}),
    createWidget: (_, args, {pool, request, user_id}) => createWidget(_, args, {pool, request, user_id}),
    deleteWidget: (_, args, {pool, request, user_id}) => deleteWidget(_, args, {pool, request, user_id}),
    getSensorDataOnTimeInterval: (_, args, {pool, request, user_id}) => getSensorDataOnTimeInterval(_, args, {pool, request, user_id}),
    editWidget: (_, args, {pool, request, user_id}) => editWidget(_, args, {pool, request, user_id}),
    reGenerateSaSToken: (_, args, {pool, request, user_id}) => reGenerateSaSToken(_, args, {pool, request, user_id}),
    getWidgetMutation: (_, args, {pool, request, user_id}) => getWidgetMutation(_, args, {pool, request, user_id}),
    deleteComponent: (_, args, {pool, request, user_id}) => deleteComponent(_, args, {pool, request, user_id}),

  },
  Subscription: {
    // UserReg:{
    //     subscribe:(_, __, {pubsub})=>pubsub.asyncIterator("USER_REG")
    // },
    UpdateRawData: {
      subscribe: (_, args, { })=> {
        try {
          const {topic} = (args.topic);
          console.log(topic);
          return pubsub.asyncIterator(`"${topic}"`);
        } catch (error) {
          return error;
        }
      },
    },
    UpdateDeviceConnectionStatus: {
      subscribe: (_, args, { })=> {
        try {
          const {topic} = (args.topic);
          console.log(topic);
          return pubsub.asyncIterator(`"${topic}"`);
        } catch (error) {
          return error;
        }
      },
    },
    UpdateLiveDataOnWidget: {
      subscribe: (_, args, { })=> {
        try {
          const {topic} = (args.topic);
          console.log(topic);
          return pubsub.asyncIterator(`"${topic}"`);
        } catch (error) {
          return error;
        }
      },
    },

  },

};

module.exports = resolvers;


