const deviceTableColumns =new Array( {
  'dataField': 'device_name',
  'text': 'Device Name',
  'sort': true,
},
{
  'dataField': 'device_identifier',
  'text': 'Device Id',
  'sort': true,
},
{
  'dataField': 'device_status',
  'text': 'Device Status',
  'sort': false,
}, {
  'dataField': 'device_template',
  'text': 'Device Template',
  'sort': false,
});

const templateTableColmns = new Array( {
  'dataField': 'template_name',
  'text': 'Template Name',
  'sort': true,
},
{
  'dataField': 'creation_date',
  'text': 'Creation Date',
  'sort': true,
},
{
  'dataField': 'status',
  'text': 'Status',
  'sort': false,
}, {
  'dataField': 'published_status',
  'text': 'Published Status',
  'sort': false,
});

module.exports = {deviceTableColumns, templateTableColmns};


