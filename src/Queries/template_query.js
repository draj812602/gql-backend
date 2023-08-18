const {templateObjforUI} = require('../localServices/templateObj');
const {templateTableColmns} = require('../localServices/UiTableColumns');
const getTemplate = async (_, args, {pool, request, user_id, pubsub}) => {
  try {
    const templateTable = {
      column: templateTableColmns,
      data: [],
    };
    const getTemplateRes = await pool.query(
        `SELECT row_to_json(templates)
                FROM ( SELECT * 
                       FROM public."DeviceTemplate"
                       WHERE user_id=${user_id}
                       ORDER BY template_id DESC
                     )As templates`,
    );
    const allTemplates = [];
    if (getTemplateRes.rows.length > 0) {
      console.log(getTemplateRes.rows);
      for (const templateRow of getTemplateRes.rows) {
        const row = templateRow.row_to_json;
        const templateObj = await templateObjforUI(row);
        allTemplates.push(templateObj);
      }
      console.log(allTemplates);
      templateTable.data = allTemplates;

      return templateTable;
    }

    return templateTable;
  } catch (error) {
    throw new Error(error.message);
  }
};

const getTemplateNames = async (_, args, {pool, request, user_id, pubsub}) => {
  try {
    const getTemplateRes = await pool.query(
        `SELECT row_to_json(templates) 
                 FROM ( SELECT template_id ,template_name
                        FROM public."DeviceTemplate" 
                        WHERE user_id=${user_id} and is_published='yes'
                        ORDER BY template_id DESC
                      )As templates`,
    );
    const allTemplates = [];
    if (getTemplateRes.rows.length > 0) {
      console.log(getTemplateRes.rows);
      for (const templateRow of getTemplateRes.rows) {
        const row = templateRow.row_to_json;
        allTemplates.push(row);
      }
    }
    return allTemplates;
  } catch (error) {
    throw new Error(error.message);
  }
};

const getCapabilities = async (_, args, {pool, request, user_id, pubsub}) => {
  try {
    const CapabilityOutPut ={
      component_id: null,
      component_name: null,
      capabilities: [],
    };

    const {component_id} = args;
    const getCapabilityRes = await pool.query(
        `select row_to_json(capObj)
        from(select a.component_id,a.component_name,
             (select jsonb_agg(capability)
              from (select * 
                    from public."ComponentCapability" b 
                    where b.component_id=a.component_id and component_cap_id not in (select updated_cap_id from public."ComponentCapability" where component_id=a.component_id)
                    order by b.component_cap_id DESC
                   )as capability
              )as capabilities
             from public."TemplateComponent" a
             where a.component_id='${component_id}'
            )as capObj`,
    );
    // console.log(getCapabilityRes)
    if (getCapabilityRes.rows.length!=0) {
      const DBRes = getCapabilityRes.rows[0].row_to_json;
      CapabilityOutPut.component_id = component_id;
      CapabilityOutPut.component_name=DBRes.component_name;
      if (DBRes.capabilities === null) {
        CapabilityOutPut.capabilities= [];
      } else {
        // console.log("before splice=",DBRes.capabilities)
        // const capArray = DBRes.capabilities
        // for(const capability of capArray){
        //   if(capability.component_cap_id === capability.updated_cap_id){
        //      const jsonObj = {'component_cap_id':capability.component_cap_id}
        //      DBRes.capabilities.splice(DBRes.capabilities.indexOf(jsonObj),1)
        //   }
        // }
        // console.log("after splice=",DBRes.capabilities)

        CapabilityOutPut.capabilities=DBRes.capabilities;
      }
    }
    return CapabilityOutPut;
  } catch (error) {
    throw new Error(error.message);
  }
};

const getTemplatedPublishedStatus = async (_, args, {pool, request, user_id, pubsub}) => {
  try {
    const {template_id} = args;
    const templatePublishedStatusRes = await pool.query(`SELECT is_published,changes_pending_status FROM public."DeviceTemplate" WHERE template_id=${template_id}`);
    const {is_published,changes_pending_status} = templatePublishedStatusRes.rows[0];
    console.log(is_published,changes_pending_status)
    let is_published_for_ui =false;
    if (is_published === 'yes'){
      if(changes_pending_status === 'No Pending Changes' ) {
      is_published_for_ui = true;
    } else if(changes_pending_status === 'Has Pending Changes'){
      is_published_for_ui = false
    }
  } 
console.log(is_published_for_ui)
    return is_published_for_ui;
  } catch (error) {
    throw new Error(error.message);
  }
};

const getComponents = async (_, args, {pool, request, user_id, pubsub}) => {
  try {
    const {template_id} = args;
    const componentsQuery = {
      text: 'SELECT * FROM public."TemplateComponent" WHERE template_id=$1 order by component_id DESC',
      values: [template_id],
    };
    const componentsQueryRes = await pool.query(componentsQuery);
    console.log(componentsQueryRes);
    return componentsQueryRes.rows;
    // if(componentsQueryRes.rows.length>0){

    // }
  } catch (error) {
    throw new Error(error.message);
  }
};
module.exports = {getTemplate, getTemplateNames, getCapabilities, getTemplatedPublishedStatus, getComponents};
