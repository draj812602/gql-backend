const envPath = require('dotenv');
envPath.config();

const clientID = process.env.CLIENT_ID; // Application (client) ID of your API's application registration
const b2cDomainHost =process.env.B2C_DOMAIN_HOST;
const tenantId = process.env.TENANT_ID; // Alternatively, you can use your Directory (tenant) ID (a GUID)
const policyName = process.env.POLICY_NAME;

const b2cconfig = {
  identityMetadata: 'https://' +b2cDomainHost +'/' +tenantId +'/' +policyName +'/v2.0/.well-known/openid-configuration/',
  clientID: clientID,
  policyName: policyName,
  isB2C: true,
  validateIssuer: false,
  loggingLevel: 'info',
  loggingNoPII: false,
  passReqToCallback: false,
};

module.exports = b2cconfig;
