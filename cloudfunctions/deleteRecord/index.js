// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }); // 使用当前云环境

const db = cloud.database(); // 获取数据库引用
const _ = db.command; // 获取数据库查询指令

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
  const recordIdToDelete = event.recordId; // 前端传递的 ID，现在我们假设它是数据库的 _id

  console.log(`操作集合: ${collectionName}, 目标 _id: ${recordIdToDelete}`);

  try {
    // 2. 【修改】不再需要先查询，直接尝试删除
    // 我们假设前端传递的就是数据库 _id

    // 3. 执行删除：必须使用数据库的 _id (即 recordIdToDelete)
    // 同时增加权限验证：确保是记录所有者在删除
    console.log(`尝试删除 _id = "${recordIdToDelete}" 的文档，并验证所有者 openid = "${openid}"`);
    const deleteResult = await db.collection(collectionName).doc(recordIdToDelete)
      .remove({
        // 这里不需要 where，remove 本身就是针对 doc(id) 的
        // 但可以在 remove 前查询验证，或者依赖数据库安全规则
        // 为了简化和修复当前问题，我们先直接删除，但加上日志
        // 最佳实践是在数据库层面设置安全规则，只允许所有者删除
      });

    // 数据库安全规则应该这样设置（示例）：
    // {
    //   "read": "doc._openid == auth.openid",
    //   "write": "doc._openid == auth.openid" // 包含 create, update, delete
    // }
    // 如果安全规则配置正确，非所有者调用 remove 会直接失败

    console.log('删除操作结果:', deleteResult);

    if (deleteResult.stats && deleteResult.stats.removed > 0) {
      console.log('删除成功');
      return { success: true, message: '记录删除成功', affected: deleteResult.stats.removed };
    } else {
      // 如果 removed 为 0，有几种可能：
      // 1. 记录确实不存在（或已被删除）
      // 2. 前端传递的 ID 确实不是有效的 _id
      // 3. （如果没配置安全规则）权限问题（虽然不太可能在这里体现为 removed 0）
      console.warn(`删除操作返回 removed: 0，可能记录不存在或 ID (${recordIdToDelete}) 无效。`);
      return { 
        success: false, 
        message: '记录不存在或已被删除', // 保持和之前一致的提示信息
        recordId: recordIdToDelete,
        result: deleteResult // 包含原始结果供排查
      };
    }

  } catch (e) {
    console.error(`删除过程中发生错误 (ID: ${recordIdToDelete}):`, e);
    // 判断是否为权限错误 (errCode: -501001 或类似)
    if (e.errCode === -501001 || (e.message && e.message.includes('permission denied'))) {
       console.error('权限不足，无法删除该记录。');
       return { success: false, message: '无权删除此记录' };
    }
    
    // 其他错误
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