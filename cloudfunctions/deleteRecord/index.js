// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }); // 使用当前云环境

const db = cloud.database(); // 获取数据库引用

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  
  console.log('执行 deleteRecord 云函数, 参数:', event, '用户:', openid);

  // 1. 参数校验
  if (!openid) {
    console.error('删除失败: 无法获取用户OpenID');
    return { success: false, message: '无法获取用户信息' };
  }
  if (!event.recordId) {
    console.error('删除失败: 未提供 recordId');
    return { success: false, message: '缺少记录ID参数' };
  }

  const collectionName = event.collection || 'abnormal_records';
  const customRecordId = event.recordId; // 使用清晰的变量名

  console.log(`操作集合: ${collectionName}, 目标 recordId: ${customRecordId}`);

  try {
    // 2. 查询文档：必须通过自定义的 recordId 字段查找
    console.log(`步骤1: 查询 recordId = "${customRecordId}" 的文档`);
    const queryResult = await db.collection(collectionName)
      .where({
        recordId: customRecordId
      })
      .limit(1) // 确保只查一条
      .get();

    console.log('查询结果:', queryResult);

    if (!queryResult.data || queryResult.data.length === 0) {
      console.warn(`未找到 recordId 为 "${customRecordId}" 的记录`);
      return { 
        success: false, 
        message: '记录不存在或已被删除',
        recordId: customRecordId
      };
    }

    const recordToDelete = queryResult.data[0];
    const databaseId = recordToDelete._id; // 获取数据库的 _id

    console.log(`找到文档: _id=${databaseId}, recordId=${recordToDelete.recordId}, 所有者=${recordToDelete._openid}`);

    // 3. 权限验证
    // 除非是强制删除模式 (来自后台清理)，否则验证 openid
    const isForceDelete = event.force === true;
    if (!isForceDelete && recordToDelete._openid !== openid) {
      console.error(`权限错误: 用户 ${openid} 尝试删除属于 ${recordToDelete._openid} 的记录`);
      return { success: false, message: '无权删除此记录' };
    }

    // 4. 执行删除：必须使用数据库的 _id
    console.log(`步骤2: 删除 _id = "${databaseId}" 的文档`);
    const deleteResult = await db.collection(collectionName).doc(databaseId).remove();

    console.log('删除操作结果:', deleteResult);

    if (deleteResult.stats && deleteResult.stats.removed > 0) {
      console.log('删除成功');
      return { success: true, message: '记录删除成功', affected: deleteResult.stats.removed };
    } else {
      console.error('删除失败: remove 操作未成功', deleteResult);
      return { success: false, message: '删除记录失败', result: deleteResult };
    }

  } catch (e) {
    console.error(`删除过程中发生错误 (recordId: ${customRecordId}):`, e);
    return { 
      success: false, 
      message: e.message || '删除记录时发生未知错误',
      error: {
        code: e.code || e.errCode,
        message: e.message,
        stack: e.stack
      }
    };
  }
}; 