/* eslint-disable max-len */
/* eslint-disable camelcase */
const {getB2CUserInfo} = require('../utils/b2cUserInfo');
const jwt = require('jsonwebtoken');


const getUser = async (_, args, {pool, request, user_id, pubsub}) => {
  try {
    const get_user_details = await pool.query(`
                SELECT row_to_json(user_details)
                   FROM (
                      SELECT * 
                      from public."UserDetails"
                      where user_id=${user_id}
                    )As user_details`);
    if (get_user_details.rows.length > 0) {
      const userDetails = get_user_details.rows[0].row_to_json;
      console.log(userDetails);
      return userDetails;
    } else {
      return {};
    }
  } catch (err) {
    throw new Error(error.message);
  }
};

const getSubscriptionJwtToken = async (_, args, {pool, request}) => {
  const token = request.headers.authorization;
  const {user_id, email, b2cTokenExp} = (await getB2CUserInfo(token, pool));
  console.log('b2cTokenExp=', b2cTokenExp);
  const jwtToken = jwt.sign({user_id, email}, process.env.JWT_SECRET, {expiresIn: b2cTokenExp});
  return jwtToken;
};

module.exports = {getUser, getSubscriptionJwtToken};
