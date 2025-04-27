// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }); // 使用当前云环境

const db = cloud.database(); // 获取数据库引用
const _ = db.command; // 获取查询指令

// 云函数入口函数
exports.main = async (event, context) => {
  console.log('Executing getRecords cloud function. Event:', event);
  
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  
  if (!openid) {
    return { success: false, message: '无法获取用户信息', data: [] }; // 失败时返回空数组
  }

  // 新增：获取用户的 familyId
  let userFamilyId = null;
  try {
    const userRes = await db.collection('users').where({ _openid: openid }).limit(1).get();
    if (userRes.data && userRes.data.length > 0 && userRes.data[0].familyId) {
      userFamilyId = userRes.data[0].familyId;
      console.log(`[getRecords] User familyId found: ${userFamilyId}`);
    } else {
      console.warn('[getRecords] User does not have a familyId or user record not found.');
      // 用户没有家庭，直接返回成功和空列表
      return {
        success: true, 
        message: '用户未加入家庭', 
        data: [] 
      };
    }
  } catch (err) {
    console.error('[getRecords] Error fetching user familyId:', err);
    return { success: false, message: '获取家庭信息失败', data: [] };
  }
  // 结束新增

  const collectionName = event.collectionName || 'abnormal_records';
  const targetCollection = db.collection(collectionName);
  console.log(`Querying collection: ${collectionName} for familyId: ${userFamilyId}`);

  try {
    // 【修改】构建基础查询条件：家庭 familyId
    let baseQuery = { familyId: userFamilyId };

    // --- 针对 abnormal_records 添加过滤条件 (使用 familyId) --- 
    if (collectionName === 'abnormal_records') {
        console.log('[getRecords] Applying additional filters for abnormal_records');
        baseQuery = _.and([
            baseQuery, // 包含 familyId
            { recordId: _.exists(true) }, 
            { dateTime: _.exists(true) }  
        ]);
    }
    // --- 结束添加过滤条件 ---

    // 查询数据库
    const query = targetCollection.where(baseQuery)
                                .orderBy('timestamp', 'desc'); // 排序
    
    // 应用分页（如果需要）
    // if (event.skip) {
    //   query = query.skip(event.skip);
    // }
    // if (event.limit) {
    //   query = query.limit(event.limit);
    // }
    
    const queryResult = await query.get();

    console.log('[getRecords] Initial records fetched:', queryResult.data.length);

    // --- 在云函数内部进行更精确的过滤 (针对 abnormal_records，逻辑保持不变) ---
    let finalData = queryResult.data;
    if (collectionName === 'abnormal_records') {
        finalData = queryResult.data.filter(record => {
            const isValid = 
                record && 
                typeof record === 'object' &&
                record._id && 
                record.recordId &&
                typeof record.dateTime === 'string' && 
                ((
                  (Array.isArray(record.types) && record.types.length > 0) || 
                  record.isOtherType === true
                ));
             if (!isValid) {
                 console.log('[getRecords] Filtering out invalid abnormal record in cloud function:', record._id, record.recordId);
             }
             return isValid;
        });
        console.log('[getRecords] Abnormal records after cloud function filtering:', finalData.length);
    }
    // --- 结束精确过滤 ---
    
    return {
      success: true,
      message: '记录获取成功',
      data: finalData
    };

  } catch (e) {
    console.error('[getRecords] Error fetching records:', e);
    return {
      success: false,
      message: '记录获取失败',
      error: e.message, // 返回错误消息
      data: [] // 失败时也返回空数组
    };
  }
};
