const jwt = require('jsonwebtoken');
require('dotenv').config();

const verifyJwtToken= (authoToken) => {
  if (authoToken) {
    try {
      const user = jwt.verify(authoToken, process.env.JWT_SECRET);
      console.log('verify=', user);
      console.log('Valid JWT Token, Authentication is successful!');
      return user;
    } catch (error) {
      throw new Error('Invalid JWT token');
    }
  }
};

module.exports = {verifyJwtToken};
