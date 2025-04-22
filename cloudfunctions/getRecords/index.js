// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }); // 使用当前云环境

const db = cloud.database(); // 获取数据库引用
const _ = db.command; // 获取查询指令

// 云函数入口函数
exports.main = async (event, context) => {
  console.log('Executing getRecords cloud function. Event:', event);
  
  // 获取调用用户的openid
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  
  // 确定要查询的集合名称，优先从 event 获取，默认为 abnormal_records
  const collectionName = event.collectionName || 'abnormal_records';
  const targetCollection = db.collection(collectionName);
  console.log(`Current user openid: ${openid}, target collection: ${collectionName}`);

  try {
    // 构建基础查询条件：用户 openid
    let baseQuery = { _openid: openid };

    // --- 添加基础有效性过滤条件 --- 
    // （注意：where 条件对类型检查有限，主要确保字段存在）
    if (collectionName === 'abnormal_records') {
        baseQuery = _.and([
            baseQuery, // 包含 openid
            { recordId: _.exists(true) }, // 确保 recordId 存在
            { dateTime: _.exists(true) }  // 确保 dateTime 存在
            // 无法直接在 where 中检查 dateTime 是否为字符串，或 types 数组长度
        ]);
    }
    // --- 结束添加过滤条件 ---

    // 查询数据库
    const queryResult = await targetCollection
      .where(baseQuery)
      .orderBy('timestamp', 'desc') // 按时间戳降序排列
      // .skip(event.skip || 0) // 分页逻辑（如果需要）
      // .limit(event.limit || 100) // 限制数量（根据需要调整，避免一次获取过多）
      .get();

    console.log('Initial records fetched:', queryResult.data.length);

    // --- 在云函数内部进行更精确的过滤 (针对 abnormal_records) ---
    let finalData = queryResult.data;
    if (collectionName === 'abnormal_records') {
        finalData = queryResult.data.filter(record => {
            const isValid = 
                record && 
                typeof record === 'object' &&
                record._id && 
                record.recordId &&
                typeof record.dateTime === 'string' && 
                // 类型检查 - 至少有一个类型或标记为"其它"
                (
                  (Array.isArray(record.types) && record.types.length > 0) || 
                  record.isOtherType === true
                );
             if (!isValid) {
                 console.log('[getRecords] Filtering out invalid record in cloud function:', record._id, record.recordId);
             }
             return isValid;
        });
        console.log('Records after cloud function filtering:', finalData.length);
    }
    // --- 结束精确过滤 ---
    
    // 注意：排序已在数据库层面完成 (orderBy timestamp desc)

    // 返回成功结果和最终处理后的数据列表
    return {
      success: true,
      message: '记录获取成功',
      data: finalData // 返回过滤后的数据数组
    };

  } catch (e) {
    console.error('Error fetching records:', e);
    // 返回失败结果
    return {
      success: false,
      message: '记录获取失败',
      error: e.message // 返回错误消息
    };
  }
};
