// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

const db = cloud.database()
const _ = db.command
const usersCollection = db.collection('users')
const familiesCollection = db.collection('families')
const invitesCollection = db.collection('invites')

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  
  console.log('加入家庭，用户openid:', openid)
  
  if (!openid) {
    return { success: false, message: '无法获取用户信息' }
  }

  const { inviteCode, needDeleteData } = event
  
  if (!inviteCode) {
    return { success: false, message: '缺少邀请码参数' }
  }

  try {
    // === 修改逻辑顺序 ===

    // 1. 验证邀请码 (提前)
    const now = new Date()
    const inviteResult = await invitesCollection.where({
      code: inviteCode,
      expireTime: _.gt(now)
    }).get()
    
    if (!inviteResult.data || inviteResult.data.length === 0) {
      return { success: false, message: '邀请码无效或已过期' }
    }
    const inviteData = inviteResult.data[0]
    const familyId = inviteData.familyId

    // 2. 获取目标家庭信息 (提前)
    const familyResult = await familiesCollection.doc(familyId).get()
    if (!familyResult.data) {
      return { success: false, message: '目标家庭不存在' }
    }
    const familyData = familyResult.data

    // 3. 查询或创建用户信息
    let userResult = await usersCollection.where({ _openid: openid }).get()
    let userData, userId
    if (!userResult.data || userResult.data.length === 0) {
      // 创建用户记录
      const newUserData = { _openid: openid, createTime: db.serverDate(), lastLoginTime: db.serverDate() }
      const addResult = await usersCollection.add({ data: newUserData })
      userData = { _id: addResult._id, ...newUserData }
      userId = addResult._id
      console.log('新用户已创建, id:', userId);
    } else {
      userData = userResult.data[0]
      userId = userData._id
      console.log('用户信息已找到, id:', userId);
    }

    // 4. 处理数据删除（如果需要）
    if (needDeleteData) {
      console.log('需要删除旧数据, 调用 deleteUserData...');
      try {
        const deleteResult = await cloud.callFunction({
          name: 'deleteUserData',
          data: { openid: openid }
        })
        console.log('deleteUserData 返回结果:', deleteResult);
        if (!deleteResult.result || !deleteResult.result.success) {
           console.error('deleteUserData 函数执行失败:', deleteResult.result);
           return { success: false, message: deleteResult.result?.message || '删除旧用户数据时出错' };
        }
        console.log('deleteUserData 成功。');
        
        // 【重要】删除成功后，重新获取最新的用户信息
        console.log('重新获取用户信息以确认 familyId 已清除...');
        userResult = await usersCollection.where({ _openid: openid }).get();
        if (!userResult.data || userResult.data.length === 0) {
            // 理论上不应该发生，因为前面已经确认或创建了用户
            console.error('CRITICAL: User record disappeared after deleteUserData!');
            return { success: false, message: '用户状态异常，请重试' };
        }
        userData = userResult.data[0]; // 更新 userData
        console.log('最新的用户信息:', userData);

      } catch (deleteErr) {
        console.error('调用 deleteUserData 云函数本身失败:', deleteErr)
        return { success: false, message: '调用删除数据服务时出错，无法加入家庭' }
      }
    }

    // 5. 检查用户是否仍属于某个家庭 (在删除逻辑之后检查)
    if (userData.familyId) {
      console.warn(`用户 ${openid} 在尝试加入家庭 ${familyId} 时，仍然有关联的 familyId: ${userData.familyId}`);
      return {
        success: false,
        // message: '您已经在一个家庭中，请先退出当前家庭' // 旧消息
        message: '未能清除旧家庭关系，请稍后重试或联系管理员' // 更准确的消息
      }
    }

    // 6. 获取用户基本信息 (用于成员列表)
    const babyInfo = userData.babyInfo || null
    let userName = '家庭成员' // 默认名称
    if (babyInfo && babyInfo.nickName && babyInfo.nickName !== '小可爱') { // 避免用默认昵称
      userName = babyInfo.nickName + '的家长'
    } else if (userData.nickName) { // 尝试用用户的微信昵称 (如果 users 表存了)
        userName = userData.nickName;
    }
    let userAvatar = babyInfo ? babyInfo.avatarUrl : '';
    if (!userAvatar && userData.avatarUrl) { // 尝试用微信头像
        userAvatar = userData.avatarUrl;
    }

    // 7. 更新家庭成员列表
    console.log(`准备将用户 ${openid} (${userName}) 添加到家庭 ${familyId} 成员列表...`);
    const newMember = {
      openid: openid,
      nickName: userName,
      avatarUrl: userAvatar,
      role: 'member',
      joinTime: db.serverDate()
    }
    const updateFamilyResult = await familiesCollection.doc(familyId).update({
      data: {
        members: _.push(newMember)
      }
    })
    console.log('更新家庭成员列表结果:', updateFamilyResult);
    if(updateFamilyResult.stats.updated !== 1) {
        console.error('未能成功更新家庭成员列表', updateFamilyResult.stats);
        // 可以考虑回滚或只报失败
        return { success: false, message: '更新家庭信息失败，请重试' };
    }

    // 8. 更新用户的 familyId 字段
    console.log(`准备更新用户 ${openid} 的 familyId 为 ${familyId}...`);
    const updateUserResult = await usersCollection.doc(userId).update({
      data: {
        familyId: familyId,
        role: 'member' // 也可以在这里设置角色
        // lastJoinFamilyTime: db.serverDate() // 可选：记录加入时间
      }
    })
    console.log('更新用户 familyId 结果:', updateUserResult);
     if(updateUserResult.stats.updated !== 1) {
        console.error('未能成功更新用户 familyId', updateUserResult.stats);
        // 【重要】需要考虑回滚：如果更新用户失败，是否应该把刚添加的家庭成员移除？
        // 简单处理：直接返回失败
        return { success: false, message: '更新用户信息失败，请重试' };
    }
    
    console.log('用户成功加入家庭，家庭ID:', familyId)
    return {
      success: true,
      message: '成功加入家庭',
      familyId: familyId
    }
    
  } catch (err) {
    console.error('加入家庭过程中发生意外错误:', err)
    return {
      success: false,
      message: '加入家庭失败，请稍后重试',
      error: err.message || err
    }
  }
} 