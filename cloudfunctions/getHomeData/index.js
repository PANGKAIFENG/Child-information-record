// 云函数入口文件：getHomeData
const cloud = require('wx-server-sdk');

// 初始化 cloud
cloud.init({
  // API 调用都保持和云函数当前所在环境一致
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

// --- 格式化工具函数 (从 home.js 迁移) ---
/**
 * 格式化记录显示时间
 */
function formatRecordTime(date) {
  // 调试信息
  console.log('[formatRecordTime] Input date:', date, typeof date);
  
  if (!date) {
    return '--:--'; // 无数据返回占位符
  }
  
  let dateObj;
  try {
    // 如果是 Date 对象
    if (date instanceof Date) {
      dateObj = date;
    } 
    // 如果是字符串，尝试解析
    else if (typeof date === 'string') {
      dateObj = new Date(date);
    } 
    // 如果是数字（时间戳），转换成日期
    else if (typeof date === 'number') {
      dateObj = new Date(date);
    } 
    // 如果是云数据库日期类型，可能有 $date 属性
    else if (date.$date) {
      dateObj = new Date(date.$date);
    }
    
    // 验证是否是有效日期
    if (isNaN(dateObj.getTime())) {
      console.warn('[formatRecordTime] Invalid date', date);
      return '--:--';
    }
    
    const hours = dateObj.getHours().toString().padStart(2, '0');
    const minutes = dateObj.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  } catch (err) {
    console.error('[formatRecordTime] Error parsing date:', err, date);
    return '--:--';
  }
}

/**
 * 格式化记录显示详情
 */
function formatRecordDetail(type, record) {
  // 添加调试信息
  console.log('[formatRecordDetail] Processing record type:', type, 'Record:', record);
  
  // --- 根据实际保存的字段进行处理 --- 
  switch (type) {
    case 'feeding':
      // 喂养记录使用 feedingType, amount 字段
      if (record.feedingType === '母乳') {
        // 始终显示毫升，没有amount时显示0ml
        return `${record.feedingType} ${record.amount || '0'}ml`;
      }
      if (record.feedingType === '奶粉') {
        return `${record.feedingType} ${record.amount || '0'}ml`;
      }
      // 如果没有匹配的类型，返回通用消息
      return record.feedingType || '喂养记录';
      
    case 'sleep':
      // 睡眠记录有 duration 字段
      return `睡眠 ${record.duration || '0'}小时`; // 没有时长也显示0
      
    case 'excretion':
      // 排泄记录处理
      let detail = record.excretionType || '排泄';
      if(record.properties && record.properties.length > 0) {
        detail += ` (${record.properties.join(',')})`;
      }
      return detail;
      
    case 'supplement':
      // 补剂记录处理
      return `${record.supplementName || '补剂'} ${record.dosage || ''}`;
      
    case 'abnormal':
      // 异常记录处理
      return record.symptom || record.remark || '异常记录';
      
    default:
      return '记录';
  }
}
// -----------------------------------

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  if (!openid) {
    return { success: false, message: '无法获取用户信息', todayStats: {}, recentRecords: [], babyInfo: null };
  }
  console.log(`[getHomeData] Received request for openid: ${openid}`);

  // --- 新增：获取用户的 familyId --- 
  let userFamilyId = null;
  let userDoc = null;
  try {
    const userRes = await db.collection('users').where({ _openid: openid }).limit(1).get();
    if (userRes.data && userRes.data.length > 0) {
        userDoc = userRes.data[0];
        if (userDoc.familyId) {
           userFamilyId = userDoc.familyId;
           console.log('[getHomeData] User familyId found:', userFamilyId);
        } else {
           console.warn('[getHomeData] User does not have a familyId.');
           // 用户没有家庭，返回空数据和提示，或根据需要处理
           return {
             success: true, // 函数本身执行成功，但没有家庭数据
             message: '用户未加入家庭',
             todayStats: { feedingCount: '-', totalMilk: '-', sleepHours: '-', excretionCount: '-' },
             recentRecords: [],
             babyInfo: null // 没有家庭就没有共享宝宝信息
           };
        }
    } else {
        console.error('[getHomeData] User record not found for openid:', openid);
        return { success: false, message: '未找到用户记录', todayStats: {}, recentRecords: [], babyInfo: null };
    }
  } catch (err) {
    console.error('[getHomeData] Error fetching user familyId:', err);
    return { success: false, message: '获取用户信息失败', todayStats: {}, recentRecords: [], babyInfo: null };
  }
  // --- 结束新增 ---
  
  try {
    // --- 新增：获取共享的 babyInfo --- 
    let sharedBabyInfo = null;
    try {
        const familyRes = await db.collection('families').doc(userFamilyId).get();
        if (familyRes.data && familyRes.data.babyInfo) {
            sharedBabyInfo = familyRes.data.babyInfo;
            console.log('[getHomeData] Found shared babyInfo from family:', sharedBabyInfo);
            // 可以补充计算年龄的逻辑，如果前端需要
            // if (sharedBabyInfo.birthDate) { ... calculate age ... }
        } else {
            console.warn('[getHomeData] Family document or babyInfo not found for familyId:', userFamilyId);
            // 家庭信息或宝宝信息缺失，可以返回默认值或 null
        }
    } catch (famErr) {
        console.error('[getHomeData] Error fetching family babyInfo:', famErr);
        // 获取家庭信息失败
    }
    // --- 结束新增 ---

    // --- 1. 获取今日统计 (修改查询条件为 familyId) ---
    const now = new Date(); 
    const timezoneOffsetHours = 8; 
    const userTime = new Date(now.getTime() + timezoneOffsetHours * 60 * 60 * 1000);
    const year = userTime.getUTCFullYear();
    const month = (userTime.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = userTime.getUTCDate().toString().padStart(2, '0');
    const todayDateStr = `${year}-${month}-${day}`;
    console.log(`[getHomeData] Querying stats for familyId: ${userFamilyId}, date: ${todayDateStr}`); 

    const statsPromises = [
      // 查询今日喂养记录
      db.collection('feeding_records')
        .where({ familyId: userFamilyId, recordDate_local: todayDateStr }) // 改为 familyId
        .get(),
      // 查询今日睡眠记录
      db.collection('sleep_records')
        .where({ familyId: userFamilyId, recordDate_local: todayDateStr }) // 改为 familyId
        .get(),
      // 查询今日排泄记录
      db.collection('excretion_records')
        .where({ familyId: userFamilyId, recordDate_local: todayDateStr }) // 改为 familyId
        .get()
    ];

    const statsResults = await Promise.all(statsPromises);
    const feedingResult = statsResults[0].data;
    const sleepResult = statsResults[1].data;
    const excretionResult = statsResults[2].data;
    console.log('[getHomeData] Stats query results (family):', { feeding: feedingResult.length, sleep: sleepResult.length, excretion: excretionResult.length });

    // 在云端计算今日统计
    const feedingCount = feedingResult.length;
    let totalMilk = 0;
    feedingResult.forEach(record => {
        if (record.feedingType === '奶粉' && record.amount && !isNaN(parseFloat(record.amount))) {
          totalMilk += parseFloat(record.amount);
        } else if (record.feedingType === '母乳') {
          if (record.amount && !isNaN(parseFloat(record.amount))) {
            totalMilk += parseFloat(record.amount);
          } 
          // else if (record.duration && !isNaN(parseFloat(record.duration))) {
          //   // 母乳不再根据时长估算奶量
          //   // totalMilk += parseFloat(record.duration) * 10; 
          // }
        }
    });

    let totalSleepHours = 0;
     sleepResult.forEach(record => {
        if (record.duration && !isNaN(parseFloat(record.duration))) {
          totalSleepHours += parseFloat(record.duration);
        }
      });
    totalSleepHours = Math.round(totalSleepHours * 10) / 10;

    const excretionCount = excretionResult.length;

    const todayStats = {
      feedingCount: feedingCount,
      totalMilk: totalMilk,
      sleepHours: totalSleepHours,
      excretionCount: excretionCount
    };
    console.log(`[getHomeData] Calculated todayStats (family):`, todayStats);

    // --- 2. 获取最近记录 (修改查询条件为 familyId) ---
    const MAX_RECENT_RECORDS = 5;
    const recordTypes = [
      { collection: 'feeding_records', type: 'feeding' },
      { collection: 'sleep_records', type: 'sleep' },
      { collection: 'excretion_records', type: 'excretion' },
      { collection: 'supplement_records', type: 'supplement' }
      // 异常记录是否也属于家庭共享？如果需要，也加入这里
      // { collection: 'abnormal_records', type: 'abnormal' }
    ];

    const recentPromises = recordTypes.map(rt =>
      db.collection(rt.collection)
        .where({ familyId: userFamilyId }) // 改为 familyId
        .orderBy('createTime', 'desc') 
        .limit(MAX_RECENT_RECORDS)
        .get()
    );

    const recentResults = await Promise.all(recentPromises);

    let allRecentRecords = [];
     recentResults.forEach((res, index) => {
        const recordTypeInfo = recordTypes[index];
        res.data.forEach(record => {
          console.log('[getHomeData] Processing recent record raw data:', JSON.stringify(record)); // 记录原始数据
          try {
            // --- 修改：根据类型确定用于显示的时间源 ---
            let timeSourceForDisplay;
            let timeSourceFieldForDisplay = 'none';
            if (recordTypeInfo.type === 'sleep') {
              // 【修正】睡眠记录应优先使用 startTime 显示
              timeSourceForDisplay = record.startTime || record.createTime || record.timestamp;
              timeSourceFieldForDisplay = record.startTime ? 'startTime' : (record.createTime ? 'createTime' : (record.timestamp ? 'timestamp' : 'none'));
              console.log(`[getHomeData] Sleep record ${record._id}: Using '${timeSourceFieldForDisplay}' for display time.`);
            } else {
              // 其他记录优先使用 dateTime 显示 (保持不变)
              timeSourceForDisplay = record.dateTime || record.createTime || record.timestamp;
              timeSourceFieldForDisplay = record.dateTime ? 'dateTime' : (record.createTime ? 'createTime' : (record.timestamp ? 'timestamp' : 'none'));
            }
            // console.log(`[getHomeData] Formatting display time for record ${record._id} using source: ${timeSourceFieldForDisplay}, value:`, timeSourceForDisplay); // 日志可以简化或移除
            const formattedTime = formatRecordTime(timeSourceForDisplay);
            // --- 结束修改 ---
            
            const formattedDetail = formatRecordDetail(recordTypeInfo.type, record);
            
            // --- 获取用于排序的时间戳 - 【修改】优先使用 createTime --- 
            let sortTimestamp = 0; 
            let sourceFieldForSort = 'none';

            // 优先尝试从 createTime 获取 (更可靠)
            if (record.createTime) {
               if (record.createTime instanceof Date) {
                  sortTimestamp = record.createTime.getTime();
                  sourceFieldForSort = 'createTime (Date)';
               } else if (typeof record.createTime === 'number') { // 可能是数字时间戳
                  sortTimestamp = record.createTime;
                  sourceFieldForSort = 'createTime (number)';
               } else if (record.createTime.$date) { // 云数据库日期对象
                  try {
                     sortTimestamp = new Date(record.createTime.$date).getTime();
                     sourceFieldForSort = 'createTime ($date)';
                  } catch (parseErr) {
                      console.warn(`[getHomeData] Error parsing createTime.$date for record ${record._id}:`, parseErr);
                  }
               } else {
                   console.warn(`[getHomeData] Unknown createTime format for record ${record._id}:`, record.createTime);
               }
            }

            // 如果 createTime 无效或缺失，尝试 dateTime (作为次选)
            if (isNaN(sortTimestamp) || sortTimestamp === 0) {
                if (record.dateTime) { 
                  try {
                    // 尝试解析 YYYY-MM-DD HH:MM 格式
                    sortTimestamp = new Date(record.dateTime.replace(/-/g, '/')).getTime(); 
                    sourceFieldForSort = 'dateTime';
                    if (isNaN(sortTimestamp)) { // 如果解析失败，重置为0
                        console.warn(`[getHomeData] Failed to parse dateTime '${record.dateTime}' for record ${record._id}.`);
                        sortTimestamp = 0;
                    }
                  } catch (parseErr) { 
                      console.warn(`[getHomeData] Error parsing dateTime '${record.dateTime}' for record ${record._id}:`, parseErr);
                      sortTimestamp = 0; 
                  }
                }
            }

            // 最后尝试 timestamp (通常也是服务器时间)
            if (isNaN(sortTimestamp) || sortTimestamp === 0) {
              if (record.timestamp && typeof record.timestamp === 'number') { 
                  sortTimestamp = record.timestamp;
                  sourceFieldForSort = 'timestamp';
              }
            }
            
            // 最终检查
            if (isNaN(sortTimestamp)) {
                console.error(`[getHomeData] CRITICAL: Could not get ANY valid sort timestamp for record:`, record._id);
                sortTimestamp = 0; // 确保 sortTimestamp 是数字
            }
            // console.log(`[getHomeData] Calculated sortTimestamp for record ${record._id}: ${sortTimestamp} from source: ${sourceFieldForSort}`); // 日志可以简化
            // ----------------------------------------
            
            allRecentRecords.push({
              _id: record._id,
              type: recordTypeInfo.type,
              sortTimestamp: sortTimestamp, // 使用计算出的排序时间戳
              time: formattedTime, 
              detail: formattedDetail
            });
          } catch (formatError) {
             console.error(`[getHomeData] Error formatting recent record:`, formatError, record);
          }
        });
      });

    // 在云端排序 - 【修改】只按 sortTimestamp (即 createTime) 排序
    allRecentRecords.sort((a, b) => b.sortTimestamp - a.sortTimestamp);

    const recentRecords = allRecentRecords.slice(0, MAX_RECENT_RECORDS);
    console.log(`[getHomeData] Final recentRecords (family, count: ${recentRecords.length}):`, JSON.stringify(recentRecords)); 

    // --- 3. 返回结果 (加入 babyInfo) ---
    return {
      success: true,
      message: '首页数据获取成功',
      babyInfo: sharedBabyInfo, // 返回从 family 获取的 babyInfo
      todayStats: todayStats,
      recentRecords: recentRecords
    };

  } catch (error) {
    console.error('[getHomeData] Error executing main logic:', error);
    return {
      success: false,
      message: '获取首页数据失败',
      error: error.message,
      babyInfo: null, // 出错也返回 null
      todayStats: {},
      recentRecords: []
    };
  }
}; 