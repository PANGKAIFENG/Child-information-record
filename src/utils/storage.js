// src/utils/storage.js

// Get all records from cloud database
export async function getAllRecords(options = {}) {
  const recordTypes = [
    { collection: 'feeding_records', type: 'feeding' },
    { collection: 'sleep_records', type: 'sleep' },
    { collection: 'excretion_records', type: 'excretion' },
    { collection: 'supplement_records', type: 'supplement' },
    { collection: 'abnormal_records', type: 'abnormal' }
  ];

  const openid = wx.getStorageSync('openid');
  if (!openid) {
    console.warn('OpenID not found in storage, cannot fetch records from cloud');
    return [];
  }

  // 默认每个集合最多获取100条记录，可通过options.limit覆盖
  const limit = options.limit || 100;
  
  console.log(`[getAllRecords] Fetching data with OpenID: ${openid}, limit: ${limit}`);
  
  try {
    const db = wx.cloud.database();
    const promiseArray = recordTypes.map(item => 
      db.collection(item.collection)
        .where({ _openid: openid })
        .orderBy('createTime', 'desc')  // 按创建时间降序
        .limit(limit)  // 限制返回数量
        .get()
        .then(res => {
          console.log(`[getAllRecords] Fetched ${res.data.length} records from ${item.collection}`);
          // Add recordType to each record
          return res.data.map(record => ({ 
            ...record, 
            recordType: item.type,
            // 确保每条记录有有效的date字段
            date: record.recordDate_local || record.date || formatDate(new Date(record.createTime))
          }));
        })
        .catch(err => {
          console.error(`[getAllRecords] Error fetching ${item.type} records:`, err);
          return [];
        })
    );

    const results = await Promise.all(promiseArray);
    const allRecords = [].concat(...results);
    
    console.log(`[getAllRecords] Total records fetched: ${allRecords.length}`);
    return allRecords;
  } catch (e) {
    console.error('[getAllRecords] Failed to get records from cloud:', e);
    return [];
  }
}

// 辅助函数：格式化日期为YYYY-MM-DD
function formatDate(date) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
} 