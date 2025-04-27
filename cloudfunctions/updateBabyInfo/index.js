// 云函数入口文件
const cloud = require('wx-server-sdk')

// 初始化云环境，必须在使用云能力前调用
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// 在 init 之后获取数据库和命令对象
const db = cloud.database()
const usersCollection = db.collection('users') // 假设用户信息存在 'users' 集合
const familiesCollection = db.collection('families') // 新增：需要操作 families 集合
const _ = db.command

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID // 获取当前用户的 openid

  if (!openid) {
    return { success: false, message: '无法获取用户信息' }
  }

  // 1. 获取用户信息 (包括 familyId 和 _id)
  let userFamilyId = null;
  let userId = null;
  try {
    const userRes = await usersCollection.where({ _openid: openid }).limit(1).get();
    if (userRes.data && userRes.data.length > 0) {
      const userData = userRes.data[0];
      userId = userData._id; // 获取用户的文档 ID
      if (userData.familyId) {
        userFamilyId = userData.familyId;
      }
      console.log(`[updateBabyInfo] User found: id=${userId}, familyId=${userFamilyId}`);
    } else {
      // 理论上用户应该存在（login会创建），如果不存在则报错
      console.error('[updateBabyInfo] User record not found for openid:', openid);
      return { success: false, message: '未找到用户记录，请重新登录' };
    }
  } catch (err) {
    console.error('[updateBabyInfo] Error fetching user data:', err);
    return { success: false, message: '获取用户信息失败' };
  }
  
  // 2. (可选但推荐) 权限检查：确保只有管理员能修改
  // try {
  //   const familyRes = await familiesCollection.doc(userFamilyId).field({ managerId: true }).get();
  //   if (!familyRes.data || familyRes.data.managerId !== openid) {
  //       console.warn(`权限不足：用户 ${openid} 尝试修改家庭 ${userFamilyId} 的信息，但管理员是 ${familyRes.data?.managerId}`);
  //       return { success: false, message: '只有家庭管理员才能修改宝宝信息' };
  //   }
  // } catch (permErr) {
  //    console.error('检查家庭管理员权限时出错:', permErr);
  //    return { success: false, message: '检查权限失败' };
  // }

  // 3. 从 event 中获取前端传递的 babyInfo 对象
  const babyInfo = event.babyInfo
  if (!babyInfo || !babyInfo.nickName || !babyInfo.birthDate || !babyInfo.avatarUrl) {
    console.warn('[updateBabyInfo] Received incomplete babyInfo:', babyInfo);
    // 也可以决定是否强制要求所有字段存在
    // return { success: false, message: '提交的宝宝信息不完整' }
  }
  // 基本校验通过
  console.log(`准备更新家庭 ${userFamilyId} 的 babyInfo 为:`, babyInfo);

  // 4. 根据是否有 familyId 决定更新哪个集合
  if (userFamilyId) {
    // --- 用户已加入家庭：更新 families 集合 --- 
    console.log(`[updateBabyInfo] User has family (${userFamilyId}), updating family's babyInfo...`);
    
    try {
      const updateResult = await familiesCollection.doc(userFamilyId).update({
        data: {
          babyInfo: _.set(babyInfo), 
          updateTime: db.serverDate()
        }
      });
      console.log('[updateBabyInfo] Family babyInfo updated result:', updateResult);
      if (updateResult.stats.updated === 1) {
        return { success: true, message: '家庭共享信息更新成功' };
      } else {
        console.error('[updateBabyInfo] Update family failed, stats:', updateResult.stats);
        return { success: false, message: '更新家庭信息失败' };
      }
    } catch (e) {
      console.error('[updateBabyInfo] Error updating family baby info:', e);
      return { success: false, message: '更新家庭信息数据库操作失败', error: e.message || e };
    }

  } else {
    // --- 用户未加入家庭：更新 users 集合中自己的 babyInfo --- 
    console.log(`[updateBabyInfo] User has no family, updating user's own babyInfo (userId: ${userId})...`);
    try {
      const updateResult = await usersCollection.doc(userId).update({ // 使用 userId 更新
        data: {
          babyInfo: _.set(babyInfo), // 更新个人 babyInfo
          // updateTime: db.serverDate() // 可选: 记录个人信息更新时间
        }
      });
      console.log('[updateBabyInfo] User babyInfo updated result:', updateResult);
      if (updateResult.stats.updated === 1) {
        return { success: true, message: '宝宝信息保存成功' }; // 提示信息不同
      } else {
        console.error('[updateBabyInfo] Update user failed, stats:', updateResult.stats);
        return { success: false, message: '保存用户信息失败' };
      }
    } catch (e) {
      console.error('[updateBabyInfo] Error updating user baby info:', e);
      return { success: false, message: '保存用户信息数据库操作失败', error: e.message || e };
    }
  }
}