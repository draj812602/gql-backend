const getDataOnTimeInterval = async (timeInterval, device_id, pool) =>{
  try {
    const timeFormat = {M: 'minute', H: 'hour', D: 'day', W: 'week', O: 'month', Y: 'year'};
    const intervalFormat = timeInterval[(timeInterval.length) - 1];
    const interval = timeFormat[`${intervalFormat}`];
    const intervalNum = (timeInterval.length) - 1;
    const rawDataFromDbQuery = {
      text: `SELECT modeled_data, timestamp FROM public."DeviceRawData" WHERE "device_id" = $1 and (TO_TIMESTAMP( timestamp,\'DD/MM/YYYY HH24:MI:SS\')) between (NOW() - interval \'${intervalNum} ${interval}\') and NOW() `,
      values: [device_id],
    };
    console.log(rawDataFromDbQuery);
    const rawData = (await pool.query(rawDataFromDbQuery)).rows;
    console.log(rawData);
    return rawData;
  } catch (error) {
    throw new Error(error.message);
  }
};

module.exports = {getDataOnTimeInterval};
