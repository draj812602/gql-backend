const crypto = require('crypto');

const generateSasToken = async (iotHubHost, derivedSymmetricKey) =>{
  const policyName = null;
  const expiresInDays = 365; // 365 days = 525600 minutes
  const currentDate = new Date();
  const expiresInMilliSec = currentDate.setDate(currentDate.getDate()+expiresInDays);
  const signingKey = derivedSymmetricKey;
  let resourceUri = iotHubHost;
  resourceUri = encodeURIComponent(resourceUri);
  // Set expiration in seconds
  const expires = expiresInMilliSec; // (new Date().getTime()/100) + expiresInMins * 60;
  console.log(expires);
  // expires = Math.ceil(expires);
  const toSign = resourceUri + '\n' + expires;
  // Use crypto
  const hmac = crypto.createHmac('sha256', Buffer.from(signingKey, 'base64'));
  hmac.update(toSign);
  const base64UriEncoded = encodeURIComponent(hmac.digest('base64'));

  // Construct authorization string
  let token = 'SharedAccessSignature sr=' + resourceUri + '&sig=' +
    base64UriEncoded + '&se=' + expires;
  if (policyName) token += '&skn='+policyName;
  const expiryTimeForDb = new Date(parseInt(expires));
  console.log('expiry time=', expiryTimeForDb);
  return {token: token, token_expiry: expiryTimeForDb};
};

module.exports = {generateSasToken};
