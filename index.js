/* eslint-disable linebreak-style */
/* eslint-disable camelcase */
/* eslint-disable max-len */
/* eslint-disable linebreak-style */

const express = require('express'); /* Node.js framework to build web app and APIs */
const http = require('http'); /** It allows nodejs to transfer data over http protocol */
const passport = require('passport');/** Express compatible authentication middleware for Nodejs */
const {execute, subscribe} = require('graphql');
const {SubscriptionServer} =require('subscriptions-transport-ws');
const {makeExecutableSchema} = require('@graphql-tools/schema');/** Brigs typedef and resolvers into a single schema */
const {ApolloServer} = require('apollo-server-express');
const cors = require('cors');
const BearerStrategy = require('passport-azure-ad').BearerStrategy;
const {pool} = require('./src/utils/pgsql_db_conn');
const b2cconfig = require('./src/utils/b2cconfig');
const typeDefs= require('./src/SchemaType/typeDefs');
// const {deviceRawDataSchema} = require('./src/utils/dynamicTypeDef')
// console.log(typeDefs)

const resolvers = require('./src/Resolver/resolvers');
const {verifyJwtToken} = require('./src/utils/verifySubJwtToken');
const {addUser} = require('./src/utils/addUser');
const {consumerClient}=require('./src/cloudServices/readDeviceToCloudMessage');
const {eventsFromIoTHub} = require('./src/localServices/updateLivedata');
const {AuthenticationError} = require('apollo-server-express');

require('dotenv').config();

const {PubSub} = require('graphql-subscriptions');
const pubsub = new PubSub();

(async function() {
  pool.connect((err, clt, done)=>{
    if (err) {
      console.log(err.message);
    } else {
      console.log('DB connected');
    }
  });

  consumerClient.subscribe({
    processEvents: async (messages) => {
      if (messages.length > 0) {
        for (const message of messages) {
          console.log(message);
          await eventsFromIoTHub(message);
        }
      }
    },
    processError: (_err) => {
      console.log(_err.message);
    },
  });

  const app = express();
  const PORT = 8080;
  app.use(cors());

  // ! B2C Authentication using Passport
  const bearerStrategy = new BearerStrategy(b2cconfig, function(token, done) {
    done(null, {}, token);
  });

  app.use(express.urlencoded({extended: true}));
  app.use('/graphql', express.json());
  app.use(passport.initialize());
  passport.use(bearerStrategy);
  app.use(passport.authenticate('oauth-bearer', {session: false}));
  const schema = makeExecutableSchema({
    typeDefs,
    resolvers,
  });

  // Http server
  const apolloServer = new ApolloServer({
    typeDefs,
    resolvers,
    // context for the mutation
    context: async (req)=>{
      const request = req.req;
      const token = request.headers.authorization;
      const user_id = await addUser(pool, token); /** Add user record into DB for the first time login & return user id. If user already exisit then just return Used id */
      console.log(user_id);
      if (user_id == null || user_id == undefined) {
        throw new AuthenticationError('Unautherized User');
      } else {
        return {pool, request, user_id, pubsub}; /** If user is valid user then allow access to APIs */
      }
    },

  });
  const httpServer = http.createServer(app);

  /** Subscription server */
  SubscriptionServer.create({
    schema,
    execute,
    subscribe,
    async onConnect(connection, webSocket) {
      console.log('Subscription server Connected', connection);
      const {authToken} = connection;
      verifyJwtToken(authToken);
      return {pubsub};
    },
    async onDisconnect(webSocket) {
      console.log('Subscription server disconnected');
    },
  }, {
    server: httpServer,
    path: apolloServer.graphqlPath,
  });

  await apolloServer.start();
  apolloServer.applyMiddleware({app});
  httpServer.listen(PORT, () => {
    console.log(`🚀 Server ready at http://localhost:${PORT}${apolloServer.graphqlPath}`);
    console.log(`🚀 Subscriptions ready at ws://localhost:${PORT}${apolloServer.graphqlPath}`);
  });
})();

