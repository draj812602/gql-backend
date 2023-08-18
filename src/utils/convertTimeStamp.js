const timeStampToDateTime = async (timeStamp) =>{
  try {
    const dateTime = new Date(timeStamp).toLocaleString('en-GB',
        {hour12: false},
        {hour: '2-digit', minute: '2-digit', second: '2-digit'},
    );
    return dateTime;
  } catch (error) {
    return error;
  }
};

module.exports = {timeStampToDateTime};
