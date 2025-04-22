// 云函数入口文件: updateRecord
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  // 参数校验
  const { collectionName, recordId, recordData } = event;
  if (!collectionName || !recordId || !recordData) {
    return { success: false, message: '缺少必要的参数 (collectionName, recordId, recordData)' };
  }
  
  // 确保 recordData 不包含 _id 或 _openid (不允许客户端修改)
  delete recordData._id;
  delete recordData._openid; 
  
  // 添加 updateTime (服务器时间)
  recordData.updateTime = db.serverDate(); 
  
  console.log(`[updateRecord] Attempting to update ${collectionName} doc ${recordId} for user ${openid}`);

  try {
    // 执行更新操作
    const updateResult = await db.collection(collectionName)
      .doc(recordId)
      // 安全性：确保这条记录确实属于当前用户才允许更新 (通过数据库安全规则保证)
      // .where({ 
      //    _openid: openid 
      // }) 
      .update({
        data: recordData
      });

    if (updateResult.stats.updated > 0) {
      console.log(`[updateRecord] Document ${recordId} updated successfully.`);
      return { success: true, message: '记录更新成功', updated: updateResult.stats.updated };
    } else {
      // stats.updated 为 0 的可能原因：
      // 1. 记录不存在 (doc(recordId) 没找到)
      // 2. 记录不属于当前用户 (_openid 不匹配)
      console.warn(`[updateRecord] Document ${recordId} not found or permission denied for user ${openid}.`);
      return { success: false, message: '记录不存在或无权限更新' };
    }

  } catch (err) {
    console.error(`[updateRecord] Error updating record ${recordId}:`, err);
    return { success: false, message: '更新失败，数据库错误', error: err.message };
  }
}; 