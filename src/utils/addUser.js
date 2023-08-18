const jwtDecode = require('jwt-decode');
const addUser = async (pool, token) => {
  try {
    // let {token}=args;
    // console.log(request.headers)
    const token_decoded = jwtDecode(token);
    // console.log(token_decoded);
    const user_name = token_decoded.name;
    const email = token_decoded.emails[0];
    const country = 'India'; // token_decoded.country
    const created_at = new Date();
    const updated_at = new Date();
    const query1 = {
      text: 'SELECT * from public."UserDetails" where user_email=$1',
      values: [email],
    };
    // console.log(query1);
    const res1 = await pool.query(query1);
    let userId = null;
    if (res1.rows.length <= 0) {
      const query = {
        text: 'INSERT INTO public."UserDetails"(user_name,user_email,user_country,created_at,updated_at) VALUES ($1, $2, $3,$4,$5) RETURNING*',
        values: [user_name, email, country, created_at, updated_at],
      };

      const res2 = await pool.query(query);
      userId = res2.rows[0].user_id;

      // pubsub.publish('USER_REG',{UserReg:res})
      return userId;
    } else {
      userId = res1.rows[0].user_id;
      return userId;
    }
  } catch (err) {
    console.log(err);
    return err;
  }
};

module.exports = {addUser};
