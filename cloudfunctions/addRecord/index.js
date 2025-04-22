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
    // 生成一个唯一的 recordId (可以使用时间戳+随机数，或更健壮的唯一ID生成方式)
    const recordId = Date.now().toString() + Math.random().toString(36).substring(2, 8);
    const dataToSave = {
      ...recordData,
      _openid: openid,     // 添加用户 OpenID
      createTime: serverDate, // 添加服务器时间
      timestamp: serverDate,  // 使用服务器时间作为 timestamp
      recordId: recordId     // 添加生成的 recordId
    };
    
    // --- 提取日期部分用于 recordDate_local ---
    if (recordData.dateTime && typeof recordData.dateTime === 'string') {
      const datePart = recordData.dateTime.split(' ')[0];
      console.log('[addRecord] Extracted datePart:', datePart, 'from dateTime:', recordData.dateTime); // 记录提取的日期部分
      if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
        dataToSave.recordDate_local = datePart;
        console.log('[addRecord] Added recordDate_local from dateTime:', dataToSave.recordDate_local);
      } else {
        console.warn('[addRecord] Failed to extract valid date from dateTime:', recordData.dateTime);
      }
    } else if (recordData.date && typeof recordData.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(recordData.date)) {
       dataToSave.recordDate_local = recordData.date;
       console.log('[addRecord] Added recordDate_local from date field:', dataToSave.recordDate_local);
    } else {
       console.warn('[addRecord] Cannot determine recordDate_local. Missing or invalid dateTime/date field in recordData:', recordData);
    }
    // ------------------------------------
    
    console.log('[addRecord] Final data to save:', JSON.stringify(dataToSave)); // 记录最终保存的数据
    
    const addResult = await collection.add({
      data: dataToSave
    });

    console.log('[addRecord] Record added successfully:', addResult); // 记录成功结果

    return {
      success: true,
      message: '记录添加成功',
      recordId: addResult._id
    };

  } catch (e) {
    console.error(`[addRecord] Error adding record to ${collectionName}:`, e); // 记录错误
    console.error('[addRecord] Error details:', { collectionName, recordData, error: e }); // 记录导致错误的上下文
    return {
      success: false,
      message: '记录添加失败',
      error: e
    };
  }
};