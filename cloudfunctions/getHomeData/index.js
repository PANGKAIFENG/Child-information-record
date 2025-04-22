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
    // --- 1. 获取今日统计 (使用组合索引) ---
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    const todayDateStr = `${year}-${month}-${day}`;

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

    // --- 2. 获取最近记录 (使用组合索引) ---
    const MAX_RECENT_RECORDS = 5; // 与前端保持一致或按需调整
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
          try {
            // 调用迁移过来的格式化函数
            const formattedTime = formatRecordTime(record.createTime || record.timestamp); // 尝试用 timestamp 作为备用
            const formattedDetail = formatRecordDetail(recordTypeInfo.type, record);
            
            let createTimestamp = 0;
            if (record.createTime) {
              if (record.createTime instanceof Date) {
                  createTimestamp = record.createTime.getTime();
              } else if (typeof record.createTime === 'string') {
                  createTimestamp = new Date(record.createTime).getTime();
              } else if (typeof record.createTime === 'number') {
                  createTimestamp = record.createTime;
              } else if (record.createTime.$date) {
                  createTimestamp = new Date(record.createTime.$date).getTime();
              }
            } else if (record.timestamp) {
              createTimestamp = record.timestamp;
            }

            // 如果解析后仍然无效，则置为0
            if (isNaN(createTimestamp)) {
                createTimestamp = 0;
            }
            
            allRecentRecords.push({
              _id: record._id,
              type: recordTypeInfo.type,
              createTime: createTimestamp, // 存储时间戳用于排序
              time: formattedTime, // 存储格式化后的时间字符串
              detail: formattedDetail // 存储格式化后的详情字符串
            });
          } catch (formatError) {
             console.error(`[getHomeData] Error formatting recent record:`, formatError, record);
          }
        });
      });


    // 在云端排序 (根据原始时间戳)
    allRecentRecords.sort((a, b) => {
      return b.createTime - a.createTime; // 直接比较时间戳
    });


    const recentRecords = allRecentRecords.slice(0, MAX_RECENT_RECORDS);
    console.log(`[getHomeData] Processed recentRecords:`, recentRecords.length);


    // --- 3. 返回结果 --- 
    return {
      success: true,
      todayStats: todayStats,
      recentRecords: recentRecords.map(r => ({
        _id: r._id,
        type: r.type,
        time: r.time, // 返回格式化好的时间
        detail: r.detail // 返回格式化好的详情
      })) // 只返回前端需要的数据
    };

  } catch (error) {
    console.error('[getHomeData] Error executing function:', error);
    return {
      success: false,
      message: '获取首页数据失败',
      error: error.message, // 返回错误消息
      todayStats: {},
      recentRecords: []
    };
  }
}; 