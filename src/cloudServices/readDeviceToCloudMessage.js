const {EventHubConsumerClient} = require('@azure/event-hubs');
require('dotenv').config();

const connectionString = process.env.EVENT_HUB_COMPATIBILITY_CONNECTION_STRING;
const consumerGroup = process.env.CONSUMER_GROUP;
console.log(connectionString, consumerGroup);
const consumerClient = new EventHubConsumerClient(consumerGroup, connectionString);

module.exports = {consumerClient};
