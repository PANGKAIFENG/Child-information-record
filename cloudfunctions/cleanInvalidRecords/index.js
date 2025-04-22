// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }); // 使用当前云环境

const db = cloud.database(); // 获取数据库引用

// 云函数入口函数
exports.main = async (event, context) => {
  // 获取用户 OpenID
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  
  console.log('Executing cleanInvalidRecords cloud function. OPENID:', openid);

  // 安全检查：检查是否有权限执行清理操作
  if (!openid) {
    console.error('Error: Failed to get OpenID');
    return { 
      success: false, 
      message: '无法获取用户信息' 
    };
  }

  // 要清理的集合列表(目前只处理异常记录)
  const collectionToClean = 'abnormal_records';
  
  try {
    // 步骤1: 获取所有记录
    console.log(`正在查询集合: ${collectionToClean}`);
    const allRecordsRes = await db.collection(collectionToClean).where({
      _openid: openid // 只清理当前用户的记录
    }).get();
    
    const allRecords = allRecordsRes.data || [];
    console.log(`查询到${allRecords.length}条记录`);
    
    if (allRecords.length === 0) {
      return {
        success: true,
        message: '无记录需要清理',
        cleaned: 0,
        total: 0
      };
    }
    
    // 步骤2: 过滤出无效记录
    const invalidRecords = allRecords.filter(record => {
      return !record || 
             !record._id || 
             !record.dateTime || 
             ((!record.types || record.types.length === 0) && !record.isOtherType);
    });
    
    console.log(`发现${invalidRecords.length}条无效记录需要清理`);
    
    if (invalidRecords.length === 0) {
      return {
        success: true,
        message: '所有记录都是有效的',
        cleaned: 0,
        total: allRecords.length
      };
    }
    
    // 步骤3: 删除无效记录
    let cleanedCount = 0;
    const failedIds = [];
    
    for (const record of invalidRecords) {
      try {
        if (record && record._id) {
          console.log(`正在删除记录: ${record._id}`);
          await db.collection(collectionToClean).doc(record._id).remove();
          cleanedCount++;
        }
      } catch (err) {
        console.error(`删除记录${record?._id}时出错:`, err);
        if (record && record._id) {
          failedIds.push(record._id);
        }
      }
    }
    
    // 返回清理结果
    return {
      success: true,
      message: `成功清理了${cleanedCount}条无效记录`,
      cleaned: cleanedCount,
      total: allRecords.length,
      failed: failedIds.length > 0 ? failedIds : null
    };
    
  } catch (err) {
    console.error('清理无效记录时发生错误:', err);
    return {
      success: false,
      message: '清理无效记录失败',
      error: err
    };
  }
}; 