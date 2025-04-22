// src/utils/storage.js

// Get all records from cloud database within a specified date range
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

  // 从 options 获取日期范围，如果没有则不限制 (或者可以设默认值，例如最近一个月？)
  const { startDate, endDate } = options;
  // 注意: 如果 startDate 或 endDate 未提供，则不会添加日期范围查询
  
  console.log(`[getAllRecords] Fetching data with OpenID: ${openid}, StartDate: ${startDate || 'N/A'}, EndDate: ${endDate || 'N/A'}`);
  
  try {
    const db = wx.cloud.database();
    const _ = db.command; // 获取查询指令

    const promiseArray = recordTypes.map(item => {
      let query = db.collection(item.collection).where({ _openid: openid });

      // 添加日期范围查询条件 (优先使用 recordDate_local)
      if (startDate && endDate) {
        query = query.where({
          recordDate_local: _.gte(startDate).and(_.lte(endDate))
        });
      } else if (startDate) {
         query = query.where({ recordDate_local: _.gte(startDate) });
      } else if (endDate) {
         query = query.where({ recordDate_local: _.lte(endDate) });
      }

      // 如果需要，仍然可以添加排序，但这会增加查询开销
      // query = query.orderBy('createTime', 'desc');

      return query.get()
        .then(res => {
          console.log(`[getAllRecords] Fetched ${res.data.length} records from ${item.collection}`);
          // 确保 date 字段存在
          return res.data.map(record => ({
            ...record,
            recordType: item.type,
            date: record.recordDate_local || record.date || formatDate(new Date(record.createTime))
          }));
        })
        .catch(err => {
          console.error(`[getAllRecords] Error fetching ${item.type} records:`, err);
          return []; // 返回空数组以继续 Promise.all
        });
    });

    const results = await Promise.all(promiseArray);
    const allRecords = [].concat(...results);
    
    // 如果获取后还需要排序 (比如统一按时间)
    allRecords.sort((a, b) => (b.timestamp || b.createTime?.getTime?.() || 0) - (a.timestamp || a.createTime?.getTime?.() || 0));

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