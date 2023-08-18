
const jwtDecode = require('jwt-decode');
const getB2CUserInfo = async (token, pool) => {
  try {
    let res = {
      user_id: null,
      email: null,
      b2cTokenExp: null,
    };
    const token_decoded = jwtDecode(token);
    const user_email = token_decoded.emails[0];
    const b2cTokenExp = token_decoded.exp;
    const query1 = {
      text: 'select user_id from public."UserDetails" WHERE user_email=$1',
      values: [user_email],
    };
    let user_id;

    const userid = await pool.query(query1);
    if (userid.rows.length > 0) {
      userid.rows.map((data) => {
        user_id = data.user_id;
      });
      res = {user_id: user_id, email: user_email, b2cTokenExp: b2cTokenExp};
      return res;
      // return user_id;
    } else {
      return res;
    }
  } catch (err) {
    return err;
  }
};

module.exports = {getB2CUserInfo};
