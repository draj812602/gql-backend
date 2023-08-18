const {templateObjforUI} = require('../localServices/templateObj');
const {templateTableColmns} = require('../localServices/UiTableColumns');
const {timeStampToDateTime} = require('../utils/convertTimeStamp');
const addTemplate=async (_, args, {pool, request, user_id, pubsub})=>{
  try {
    const {templateName} = args;
    let templateTable = {
      'column': [],
      'data': [],
    };
    const created_at = new Date();
    const updated_at = new Date();

    const createTempQuery = {
      text: 'INSERT INTO public."DeviceTemplate"(user_id,template_name,created_at,updated_at) values($1,$2,$3,$4) RETURNING*',
      values: [user_id, templateName, created_at, updated_at],
    };
    const createTempRes = await pool.query(createTempQuery);
    console.log(createTempRes);

    if (createTempRes.rows.length === 1) {
      const templateRow = createTempRes.rows[0];
      const templateArray = [];
      templateArray.push(await templateObjforUI(templateRow));

      console.log(templateArray);
      templateTable = {
        'column': templateTableColmns,
        'data': templateArray,
      };
      return templateTable;
    }
  } catch (error) {
    console.log(error.message);
    throw new Error(error.message);
  }
};


const addOrUpdateCapability = async (_, args, {pool, request, user_id, pubsub}) =>{
  try {
    const CapabilityOutPut = {};
    const CapabilityOutRows = [];
    CapabilityOutPut.capabilities=[];
    const {template_id, component_id, capabilities} = args.input;
    const c_u_at = new Date();
      // check is template already published.
      // If already published then don't change previously published timestamp value
      // just change changes_pending_status value 
     
      const getTempletRecords = {
        text:'SELECT is_published FROM public."DeviceTemplate" WHERE template_id=$1',
        values:[template_id]
      }
      const {is_published} = (await pool.query(getTempletRecords)).rows[0]
      console.log(is_published)
      if(is_published === 'yes'){
      // update templates changes_pending_status as 'Has pending changes'
      const queryString = `UPDATE public."DeviceTemplate" SET changes_pending_status='Has Pending Changes' WHERE template_id=${template_id}`
      await pool.query(queryString);
      }
    
    const componentInfo = (await pool.query(`SELECT component_name FROM public."TemplateComponent" WHERE component_id=${component_id}`)).rows[0];

    for (const capability of capabilities) {
      const capObj ={};
      const {component_cap_id, capability_display_name, capability_name, capability_type, capability_data_type} = capability;
      let addOrUpdateCapQueyRes ={};
      if (component_cap_id === null || component_cap_id === '') {
        const checkDuplicateRecords = await pool.query(`SELECT capability_name FROM public."ComponentCapability" WHERE component_id=${component_id}`)
        if(checkDuplicateRecords.rows.length > 0){
          for(const cap of checkDuplicateRecords.rows){
            const capName = cap.capability_name
            if(capability_name === capName){
              throw new Error('Capabilities name can not be same ');
            }
          }
        }
        const addCapQuery = {
          text: 'INSERT INTO public."ComponentCapability"(capability_display_name,capability_name,capability_type,capability_data_type,created_at,updated_at,component_id) values($1,$2,$3,$4,$5,$6,$7) RETURNING*',
          values: [capability_display_name, capability_name, capability_type, capability_data_type, c_u_at, c_u_at, component_id],
        };
        addOrUpdateCapQueyRes = (await pool.query(addCapQuery)).rows[0];
      } else {
        //Insert updated capability as new record only if it is not exists and preserve previous one untill updated capability is published
        //save cap id for which capability info is updated , once new record is published mark old record as unpublished
       
        const capabilityId = parseInt(component_cap_id);
        const addCapQuery = {
          text: 'INSERT INTO public."ComponentCapability"(capability_display_name,capability_name,capability_type,capability_data_type,created_at,updated_at,component_id,updated_cap_id) SELECT $1,$2,$3,$4,$5,$6,$7,$8 WHERE $1 NOT IN (SELECT capability_display_name from public."ComponentCapability" where component_id=$7) or $2 NOT IN (SELECT capability_name from public."ComponentCapability" where component_id=$7) RETURNING*',
          values: [capability_display_name, capability_name, capability_type, capability_data_type, c_u_at, c_u_at, component_id,capabilityId],
        };
         console.log(addCapQuery)
          const rr=await pool.query(addCapQuery);
          if(rr.rowCount === 1){   // updated record to UI 
            addOrUpdateCapQueyRes = rr.rows[0]
          }else{ // remaining records from UI to UI
            const getNotUpdatedRows = {
              text:'SELECT * FROM public."ComponentCapability" WHERE component_cap_id=$1',
              values:[capabilityId]
            }
            addOrUpdateCapQueyRes = (await pool.query(getNotUpdatedRows)).rows[0]
          }
       }
      capObj.component_cap_id = addOrUpdateCapQueyRes.component_cap_id;
      capObj.capability_display_name = addOrUpdateCapQueyRes.capability_display_name;
      capObj.capability_name = addOrUpdateCapQueyRes.capability_name;
      capObj.capability_type = addOrUpdateCapQueyRes.capability_type;
      capObj.capability_data_type = addOrUpdateCapQueyRes.capability_data_type;
      CapabilityOutRows.push(capObj);
    }
    CapabilityOutPut.component_id = component_id;
    CapabilityOutPut.component_name = componentInfo.component_name;
    CapabilityOutPut.template_id = template_id;
    CapabilityOutPut.capabilities = CapabilityOutRows;
    console.log(CapabilityOutPut);
    return CapabilityOutPut;
  } catch (error) {
    console.log(error.message);
    if (error.message === 'duplicate key value violates unique constraint "uq_template_cap"') {
      throw new Error('Capabilities name can not be same ');
    }
    throw new Error(error.message);
  }
};


const deleteTemplate= async (_, args, {pool, request, user_id, pubsub})=>{
  try {
    const {template_id} = args;
    const templateNameRes = await pool.query(`select template_name from public."DeviceTemplate" where template_id=${template_id} `);
    const templateName = templateNameRes.rows[0].template_name;
    const checkIstemplateHasDevicesRes= await pool.query(`SELECT device_id FROM public."DeviceToTemplate" WHERE template_id=${template_id}`);
    if (checkIstemplateHasDevicesRes.rows.length>0) {
      throw new Error(`Cannot delete template '${templateName}' with devices attached. Please delete devices first`);
    } else {
      const templateDeleteQueryRes= await pool.query(`delete from public."DeviceTemplate" where template_id=${template_id}`);
      if (templateDeleteQueryRes.rowCount === 1) {
        return `Template '${templateName}' deleted successfully`;
      }
    }
  } catch (error) {
    throw new Error(error.message);
  }
};

const publishTemplate= async (_, args, {pool, request, user_id, pubsub})=>{
  try {
    const {template_id} = args;
    // fetch componets and its capabilities of a template
    const templateRecordQuery =`
            select row_to_json(capObj)
            from(select a.template_id,a.template_name,
                        (select jsonb_agg(component)
                        from(select b.component_id,b.component_name,
                                     (select jsonb_agg(capability)
                                      from(select * 
                                           from public."ComponentCapability" c
                                           where b.component_id = c.component_id
                                           )as capability
                                    )as capabilities
                            from public."TemplateComponent" b
                            where a.template_id=b.template_id
                            )as component
                        )as components
                 from public."DeviceTemplate" a
                 where a.template_id=${template_id} 
                )as capObj`;
    const templateRecordRes = await pool.query(templateRecordQuery);
    //console.log(templateRecordRes.rows[0].row_to_json);
    const templateCompCapRes = templateRecordRes.rows[0].row_to_json;
    let publishFalg = true;
    // check is component has got capabilities or not
    // if yes then only allow to publish otherwise cannot publish it
    for (const templateCompCapObj of templateCompCapRes.components) {
      if (templateCompCapObj.capabilities === null) {
        publishFalg = false;
        throw new Error(`Template cannot be published as there are no capabilities for '${templateCompCapObj.component_name}'`);
      }else{
        //**1. delete the record which is inserted as new record after editing its info.*/ 
        let updatedCapIds=[]
        let capIds =[]
        for(const capability of templateCompCapObj.capabilities){
          console.log(capability)
          if(capability.updated_cap_id !== 0){
            updatedCapIds.push(capability.updated_cap_id)
            capIds.push(capability.component_cap_id)
          }
        }
        console.log(updatedCapIds)
        for(let i=0;i<updatedCapIds.length;i++){
          const upatedCapId = updatedCapIds[i]
          for(const capability of templateCompCapObj.capabilities){
            console.log(capability.component_cap_id,upatedCapId)
            if(capability.component_cap_id === upatedCapId){
              const rr= await pool.query(
                `DELETE FROM public."ComponentCapability" WHERE component_cap_id='${upatedCapId}'`)
              //update dashboard widget capability id if any widgets exists with this cap
              await pool.query(`UPDATE public."DashboardWidget" SET component_cap_id='${capIds[i]}' WHERE component_cap_id = '${upatedCapId}' `)
              //update command widget
              await pool.query(`UPDATE public."DeviceCommandWidget" SET component_cap_id='${capIds[i]}' WHERE component_cap_id ='${upatedCapId}'`)
              console.log(rr)
            }
        }
      }
      //**end 1. */
      //**2. create command widget for newly added command type capabilities*/
      for(const capability of templateCompCapObj.capabilities){
            if(capability.capability_type === 'command' && capability.cap_published_flag === 0){
              //fetch device id for which this template is assigned 
              const template_id = templateCompCapRes.template_id
              const deviceIds = (await pool.query(`Select device_id from public."DeviceToTemplate" where template_id='${template_id}'`)).rows
              console.log("deviceIds=",deviceIds)
                const {component_cap_id, capability_data_type,capability_display_name,capability_name} = capability;
                const {component_name,component_id} = templateCompCapObj
                const widgetTitle = component_name+'/'+capability_display_name
                const firstLetterCap_capability_name = capability_name.charAt(0).toUpperCase()+capability_name.slice(1)
                const directMethodName = component_name.concat('',firstLetterCap_capability_name)
                //Create widget for all devices which comes under this template and ignore if already created at the time of template assignment
                for(let i=0;i<deviceIds.length;i++){ 
                const createCommandWidget={
                  text: 'INSERT INTO public."DeviceCommandWidget"(device_id,component_id,component_cap_id,widget_title,direct_method_name,command_data_type) SELECT $1,$2,$3,$4,$5,$6 WHERE $3 NOT IN (SELECT component_cap_id FROM public."DeviceCommandWidget" WHERE device_id=$1) ',
                  values: [deviceIds[i].device_id, component_id,component_cap_id,widgetTitle,directMethodName, capability_data_type]
                };
                await pool.query(createCommandWidget);
                // update device table has_command column
                await pool.query(`UPDATE public."Device" SET has_command=true WHERE device_id=${deviceIds[i].device_id}`);
                  }
                }
      }
      /**end 2. */
      
    }
  }
    if (publishFalg === true) {
      let updateDeviceTemplateQuery
      let published_date 
      
      updateDeviceTemplateQuery = {
        text: 'UPDATE public."DeviceTemplate" set is_published=$1,published_time=$2, changes_pending_status=$3 where user_id=$4 and template_id=$5 RETURNING*',
        values: ['yes', new Date(), 'No Pending Changes',user_id, template_id],
      };
      
   
      const updateDeviceTemplateRes=await pool.query(updateDeviceTemplateQuery);
      //update component and capability flag as published
      const updateCompCapFlag = `UPDATE public."TemplateComponent" SET  comp_published_flag=1 FROM  public."TemplateComponent" as a1, public."ComponentCapability" as b1 WHERE a1.component_id=b1.component_id and a1.template_id=${template_id}; UPDATE public."ComponentCapability" SET  cap_published_flag=1 FROM  public."TemplateComponent" as a2, public."ComponentCapability" as b2 WHERE a2.component_id=b2.component_id and a2.template_id=${template_id}`
       
      //console.log(updateCompCapFlag)
      await pool.query(updateCompCapFlag)
      published_date = await timeStampToDateTime(new Date());
      // console.log(updateDeviceTemplateRes)
      let templatePublishedData ={};
      if (updateDeviceTemplateRes.rows.length ===1 ) {
        templatePublishedData = {
          template_id: template_id,
          status: updateDeviceTemplateRes.rows[0].changes_pending_status,
          published_status: published_date,
        };
      }
      // } else {
      //   templatePublishedData = {
      //     template_id: template_id,
      //     status: 'Has Pending Changes',
      //     published_status: 'Never published',
      //   };
      // }

      return templatePublishedData;
    }
  } catch (error) {
    throw new Error(error.message);
  }
};


const deleteCapability = async (_, args, {pool, request, user_id, pubsub})=>{
  try {
    const {template_id, component_id, component_cap_id} = args;

    const isTemplatePublishedQuery = {
      text: 'SELECT is_published FROM public."DeviceTemplate" WHERE template_id=$1',
      values: [template_id],
    };
    const {is_published} = (await pool.query(isTemplatePublishedQuery)).rows[0];
    if ( is_published === 'yes') {
      // const getNumOfCapsQuery = {
      //     text:'SELECT COUNT(*) as num_of_capabilities FROM public."ComponentCapability" WHERE template_id=$1',
      //     values:[template_id]
      // }
      // const getNumOfCapsRes = await pool.query(getNumOfCapsQuery)
      // const {num_of_capabilities} = getNumOfCapsRes.rows[0]
      // console.log("num_of_capabilities",num_of_capabilities)
      // if(num_of_capabilities == 0){

      //     await pool.query(`UPDATE public."DeviceTemplate" SET is_published='No' , published_time='Never Published' WHERE template_id=${template_id}`)
      throw new Error('Cannot delete Capability of published template');
    }
    const deleteCapRes = await pool.query(`DELETE FROM public."ComponentCapability" WHERE component_id=${component_id} and component_cap_id=${component_cap_id}`);
    console.log(deleteCapRes.rowCount);
    if (deleteCapRes.rowCount === 1) {
      return component_cap_id;
    }
  } catch (error) {
    throw new Error(error.message);
  }
};

const addComponent = async (_, args, {pool, request, user_id, pubsub})=>{
  try {
    const {template_id, component_name} = args;
    console.log(template_id, component_name)
      // update templates changes_pending_status as 'Has pending changes'
          const updateQ = {
            text: 'UPDATE public."DeviceTemplate" SET changes_pending_status=$1 WHERE template_id=$2',
            values: ['Has Pending Changes', template_id]
          };
        await pool.query(updateQ);
      //}

    const addComponentQuery = {
      text: 'INSERT INTO public."TemplateComponent"(template_id,component_name) VALUES($1,$2) RETURNING*',
      values: [template_id, component_name]
    };
    const addComponentRes = await pool.query(addComponentQuery);
    console.log(addComponentRes)
    return addComponentRes.rows[0];
  } catch (error) {
        return error
  }
};

const deleteComponent = async (_, args, {pool, request, user_id, pubsub})=>{
  try {
    const {template_id, component_id} = args;
    // console.log(template_id,component_id)
    const deleteComponentQuery = {
      text: 'DELETE FROM public."TemplateComponent" WHERE component_id=$1 and template_id=$2 ',
      values: [component_id, template_id],
    };
    const deleteComponentRes = await pool.query(deleteComponentQuery);
    // console.log(deleteComponentRes)
    if (deleteComponentRes.rowCount === 1) {
      return component_id;
    }
  } catch (error) {
    return error
  }
};

module.exports = {addTemplate, addOrUpdateCapability, deleteTemplate, publishTemplate, deleteCapability, addComponent, deleteComponent};
