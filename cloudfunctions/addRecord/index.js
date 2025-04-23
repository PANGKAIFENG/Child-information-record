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
    
    // --- 新增：特殊处理时间字段类型 ---
    // 检查是否为睡眠记录，并尝试转换 startTime 和 dateTime 为 Date 对象
    if (collectionName === 'sleep_records') {
      console.log('[addRecord] Processing sleep record time fields...');
      // 1. 处理 startTime
      if (recordData.date && typeof recordData.date === 'string' && 
          recordData.startTime && typeof recordData.startTime === 'string') {
        try {
          // 尝试拼接日期和时间，并创建 Date 对象 (确保兼容 iOS，使用 / 或 T)
          const startTimeString = `${recordData.date.replace(/-/g, '/')} ${recordData.startTime}`;
          const startTimeObject = new Date(startTimeString);
          if (!isNaN(startTimeObject.getTime())) {
            dataToSave.startTime = startTimeObject; // 使用 Date 对象覆盖原始字符串
            console.log('[addRecord] Converted startTime to Date object:', dataToSave.startTime);
          } else {
            console.warn(`[addRecord] Failed to parse startTime string: ${startTimeString}`);
          }
        } catch (e) {
          console.error('[addRecord] Error converting startTime to Date:', e, recordData);
        }
      } else {
          console.warn('[addRecord] Missing or invalid date/startTime fields for sleep record:', recordData.date, recordData.startTime);
      }

      // 2. 处理 dateTime (如果存在)
      if (recordData.dateTime && typeof recordData.dateTime === 'string') {
         try {
           // 尝试直接解析 dateTime 字符串 (确保兼容 iOS)
           const dateTimeString = recordData.dateTime.replace(/-/g, '/');
           const dateTimeObject = new Date(dateTimeString);
           if (!isNaN(dateTimeObject.getTime())) {
             dataToSave.dateTime = dateTimeObject; // 使用 Date 对象覆盖原始字符串
             console.log('[addRecord] Converted dateTime to Date object:', dataToSave.dateTime);
           } else {
             console.warn(`[addRecord] Failed to parse dateTime string: ${dateTimeString}`);
           }
         } catch (e) {
           console.error('[addRecord] Error converting dateTime to Date:', e, recordData);
         }
      } else {
           // 如果睡眠记录没有提供 dateTime，可以考虑用转换后的 startTime 填充，
           // 或者保持 undefined，取决于后续逻辑是否需要 dateTime
           if(dataToSave.startTime instanceof Date) {
              // dataToSave.dateTime = dataToSave.startTime;
              // console.log('[addRecord] Set dateTime from converted startTime.');
           } else {
              console.warn('[addRecord] Missing dateTime field for sleep record and startTime conversion failed or missing.', recordData.dateTime);
           }
      }
    } 
    // (未来可以添加对其他记录类型时间字段的处理)
    // --- 结束新增处理 ---
    
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