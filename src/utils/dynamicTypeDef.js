const {GraphQLObjectType, GraphQLString, GraphQLSchema} = require('graphql');
const {gql} = require('apollo-server-express');

const deviceRawDataType = new GraphQLObjectType({
  name: 'deviceRawData',
  fields: ()=>({
    temperature: {type: GraphQLString},
    humidity: {type: GraphQLString},
  }),

});
const deviceRawDataSchema = new GraphQLSchema({
  deviceRawData: deviceRawDataType,
});
console.log(deviceRawDataSchema);
module.exports = {deviceRawDataSchema};

// const RootQuery = new GraphQLObjectType({
//     name: 'RootQueryType',
//     fields: {
//         status: {
//             type: GraphQLString,
//             resolve(parent, args){
//                 return "Welcome to GraphQL"
//             }
//         }
//     }
// });

// const TestSchema = new GraphQLSchema({
//     query: RootQuery
// });
// console.log('TestSchema',TestSchema)
// module.exports = {TestSchema}
