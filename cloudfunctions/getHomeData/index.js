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
  // 获取调用用户的 openid
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  if (!openid) {
    return {
      success: false,
      message: '无法获取用户信息',
      todayStats: {},
      recentRecords: []
    };
  }

  console.log(`[getHomeData] Received request for openid: ${openid}`);

  try {
    // --- 1. 获取今日统计 (使用用户时区，假设为 UTC+8) ---
    const now = new Date(); // 当前 UTC 时间
    const timezoneOffsetHours = 8; // 假设用户时区为 UTC+8
    // 计算用户时区的当前时间
    const userTime = new Date(now.getTime() + timezoneOffsetHours * 60 * 60 * 1000);

    // 从调整后的时间获取 UTC 年月日 (因为 Date 对象内部是 UTC)
    const year = userTime.getUTCFullYear();
    const month = (userTime.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = userTime.getUTCDate().toString().padStart(2, '0');
    const todayDateStr = `${year}-${month}-${day}`;
    console.log(`[getHomeData] Current UTC time: ${now.toISOString()}, Adjusted User Time (UTC+${timezoneOffsetHours}): ${userTime.toISOString()}, Querying stats for date: ${todayDateStr}`); // 记录查询日期及计算过程

    const statsPromises = [
      // 查询今日喂养记录
      db.collection('feeding_records')
        .where({ _openid: openid, recordDate_local: todayDateStr })
        .get(),
      // 查询今日睡眠记录
      db.collection('sleep_records')
        .where({ _openid: openid, recordDate_local: todayDateStr })
        .get(),
      // 查询今日排泄记录
      db.collection('excretion_records')
        .where({ _openid: openid, recordDate_local: todayDateStr })
        .get()
    ];

    const statsResults = await Promise.all(statsPromises);
    const feedingResult = statsResults[0].data;
    const sleepResult = statsResults[1].data;
    const excretionResult = statsResults[2].data;
    console.log('[getHomeData] Stats query results:', { feeding: feedingResult.length, sleep: sleepResult.length, excretion: excretionResult.length }); // 记录查询结果数量

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
    console.log(`[getHomeData] Calculated todayStats:`, todayStats);

    // --- 2. 获取最近记录 ---
    const MAX_RECENT_RECORDS = 5;
    const recordTypes = [
      { collection: 'feeding_records', type: 'feeding' },
      { collection: 'sleep_records', type: 'sleep' },
      { collection: 'excretion_records', type: 'excretion' },
      { collection: 'supplement_records', type: 'supplement' }
    ];

    const recentPromises = recordTypes.map(rt =>
      db.collection(rt.collection)
        .where({ _openid: openid })
        .orderBy('createTime', 'desc') // 使用 _openid+createTime 索引
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
            // 记录格式化时间使用的来源
            const timeSourceValue = record.dateTime || record.createTime || record.timestamp;
            const timeSourceField = record.dateTime ? 'dateTime' : (record.createTime ? 'createTime' : (record.timestamp ? 'timestamp' : 'none'));
            console.log(`[getHomeData] Formatting time for record ${record._id} using source: ${timeSourceField}, value:`, timeSourceValue);
            const formattedTime = formatRecordTime(timeSourceValue);
            
            const formattedDetail = formatRecordDetail(recordTypeInfo.type, record);
            
            // --- 获取用于排序的时间戳 - 优先使用 dateTime ---
            let sortTimestamp = 0; 
            let sourceField = 'none';
            if (record.dateTime) {
              try {
                // 尝试将 dateTime (YYYY-MM-DD HH:mm) 转换为时间戳
                sortTimestamp = new Date(record.dateTime.replace(/-/g, '/')).getTime(); // 兼容 iOS
                sourceField = 'dateTime';
              } catch (parseErr) {
                 console.warn(`[getHomeData] Failed to parse dateTime for sorting: ${record.dateTime}`, parseErr);
              }
            }
            // 如果 dateTime 无效或不存在，尝试 createTime
            if (isNaN(sortTimestamp) || sortTimestamp === 0) {
              if (record.createTime) {
                 if (record.createTime instanceof Date) {
                    sortTimestamp = record.createTime.getTime();
                    sourceField = 'createTime (Date)';
                 } else if (typeof record.createTime === 'number') {
                    sortTimestamp = record.createTime;
                    sourceField = 'createTime (number)';
                 } else if (record.createTime.$date) {
                    sortTimestamp = new Date(record.createTime.$date).getTime();
                    sourceField = 'createTime ($date)';
                 }
              }
            }
            // 如果 createTime 也无效，尝试 timestamp
             if (isNaN(sortTimestamp) || sortTimestamp === 0) {
               if (record.timestamp && typeof record.timestamp === 'number') {
                  sortTimestamp = record.timestamp;
                  sourceField = 'timestamp';
               }
            }
            // 最终检查
            if (isNaN(sortTimestamp)) {
                console.warn(`[getHomeData] Could not get valid timestamp for record:`, record._id, `Source field tried: ${sourceField}`);
                sortTimestamp = 0; // 无法获取有效时间戳，排序时放在最后
            }
            console.log(`[getHomeData] Calculated sortTimestamp for record ${record._id}: ${sortTimestamp} from source: ${sourceField}`); // 记录计算出的排序时间戳和来源
            // ----------------------------------------
            
            allRecentRecords.push({
              _id: record._id,
              type: recordTypeInfo.type,
              sortTimestamp: sortTimestamp,
              time: formattedTime,
              detail: formattedDetail
            });
          } catch (formatError) {
             console.error(`[getHomeData] Error formatting recent record:`, formatError, record);
          }
        });
      });

    allRecentRecords.sort((a, b) => b.sortTimestamp - a.sortTimestamp);
    const recentRecords = allRecentRecords.slice(0, MAX_RECENT_RECORDS);
    console.log(`[getHomeData] Final recentRecords to send (count: ${recentRecords.length}):`, JSON.stringify(recentRecords)); // 记录最终发送的数据

    // --- 3. 返回结果 ---
    return {
      success: true,
      message: '首页数据获取成功',
      todayStats: todayStats,
      recentRecords: recentRecords
    };

  } catch (error) {
    console.error('[getHomeData] Error executing function:', error);
    console.error('[getHomeData] Error details:', { error: error }); // 记录 catch 到的错误详情
    return {
      success: false,
      message: '获取首页数据失败',
      error: error.message,
      todayStats: {},
      recentRecords: []
    };
  }
}; 