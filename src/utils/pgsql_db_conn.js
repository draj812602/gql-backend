const {Pool} = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.USER,
  host: process.env.HOST,
  database: process.env.DATABASE,
  password: process.env.PASSWORD,
  port: process.env.DB_PORT,
  // ssl: {rejectUnauthorized: true},
  // keepAlive: true,
  // idleTimeoutMillis: 0,
  // connectionTimeoutMillis: 0
});

module.exports = {pool};
