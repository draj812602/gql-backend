const crypto = require('crypto');

const computeDerivedSymmetricKey= async (devRegId) =>{
  const masterKey = process.env.GROUP_ENROLL_MASTER_KEY;
  return crypto.createHmac('SHA256', Buffer.from(masterKey, 'base64'))
      .update(devRegId, 'utf8')
      .digest('base64');
};

module.exports = {computeDerivedSymmetricKey};
