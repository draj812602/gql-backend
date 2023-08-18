const {timeStampToDateTime} = require('../utils/convertTimeStamp');

const templateObjforUI = async (dbObj) => {
  const tempRes = {};
  const creation_date = await timeStampToDateTime(dbObj.created_at);
  tempRes.user_id = dbObj.user_id;
  tempRes.template_id = dbObj.template_id;
  tempRes.template_name = dbObj.template_name;
  tempRes.creation_date = creation_date;
  tempRes.status = dbObj.changes_pending_status
  // if (dbObj.is_published === 'No') {
  //   tempRes.status = 'Has pending changes';
  // } else {
  //   tempRes.status = 'No pending Changes';
  // }
  tempRes.published_status = dbObj.published_time;
  return tempRes;
};

module.exports={templateObjforUI};
