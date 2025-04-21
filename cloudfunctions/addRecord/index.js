// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }); // 使用当前云环境

const db = cloud.database(); // 获取数据库引用

// 云函数入口函数
exports.main = async (event, context) => {
  // 获取用户 OpenID
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  
  console.log('Received data in addRecord cloud function:', event, 'OpenID:', openid); // 打印接收到的数据，方便调试

  if (!openid) {
    console.error('Error: Failed to get OpenID');
    return { 
      success: false, 
      message: '无法获取用户信息' 
    };
  }

  // 确定要使用的集合名称
  let collectionName = 'abnormal_records'; // 默认集合
  if (event.collectionName) {
    collectionName = event.collectionName; // 如果前端指定了集合名称，则使用指定的
    console.log(`Using specified collection: ${collectionName}`);
  } else if (event.recordType) {
    // 根据记录类型确定集合名称
    collectionName = `${event.recordType}_records`;
    console.log(`Using collection based on recordType: ${collectionName}`);
  }

  // 获取记录数据
  let recordData;
  if (event.recordData) {
    recordData = event.recordData; // 新格式：使用recordData字段
  } else {
    recordData = event; // 兼容旧格式：直接使用整个event对象作为记录数据
  }

  if (!recordData) {
    console.error('Error: recordData is missing in event');
    return {
      success: false,
      message: '缺少记录数据',
      error: 'recordData is undefined or null'
    };
  }

  // 获取集合引用
  const collection = db.collection(collectionName);
  console.log(`Adding record to collection: ${collectionName}`);

  try {
    // 准备要保存的数据，添加服务器时间和 OpenID
    const serverDate = db.serverDate();
    const dataToSave = {
      ...recordData,
      _openid: openid,     // 添加用户 OpenID
      createTime: serverDate  // 添加服务器时间
    };
    
    // 确保记录中有 recordDate_local 字段
    if (!dataToSave.recordDate_local && dataToSave.date) {
      dataToSave.recordDate_local = dataToSave.date;
      console.log('Added recordDate_local from date field:', dataToSave.recordDate_local);
    }
    
    console.log('Final data to save:', dataToSave);
    
    // 向指定集合中添加一条记录
    const addResult = await collection.add({
      data: dataToSave
    });

    console.log('Record added successfully:', addResult);

    // 返回成功结果，包含新记录的 _id
    return {
      success: true,
      message: '记录添加成功',
      recordId: addResult._id // 返回数据库自动生成的文档 ID
    };

  } catch (e) {
    console.error(`Error adding record to ${collectionName}:`, e);
    // 返回失败结果
    return {
      success: false,
      message: '记录添加失败',
      error: e
    };
  }
};