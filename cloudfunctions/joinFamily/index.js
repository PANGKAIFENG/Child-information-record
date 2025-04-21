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
    return {
      success: false,
      message: '无法获取用户信息'
    }
  }

  // 获取请求参数
  const { inviteCode, needDeleteData } = event
  
  if (!inviteCode) {
    return {
      success: false,
      message: '缺少邀请码参数'
    }
  }

  try {
    // 1. 查询用户信息
    const userResult = await usersCollection.where({
      _openid: openid
    }).get()
    
    let userData
    let userId
    
    if (!userResult.data || userResult.data.length === 0) {
      console.log('未找到用户记录，可能是首次登录')
      // 如果用户不存在，创建用户记录
      const newUserData = {
        _openid: openid,
        createTime: db.serverDate(),
        lastLoginTime: db.serverDate()
      }
      
      const addResult = await usersCollection.add({
        data: newUserData
      })
      
      userData = {
        _id: addResult._id,
        ...newUserData
      }
      userId = addResult._id
    } else {
      userData = userResult.data[0]
      userId = userData._id
    }
    
    // 2. 检查用户是否已有家庭
    if (userData.familyId) {
      return {
        success: false,
        message: '您已经在一个家庭中，请先退出当前家庭'
      }
    }
    
    // 3. 验证邀请码
    const now = new Date()
    const inviteResult = await invitesCollection.where({
      code: inviteCode,
      expireTime: _.gt(now)
    }).get()
    
    if (!inviteResult.data || inviteResult.data.length === 0) {
      return {
        success: false,
        message: '邀请码无效或已过期'
      }
    }
    
    const inviteData = inviteResult.data[0]
    const familyId = inviteData.familyId
    
    // 4. 获取家庭信息
    const familyResult = await familiesCollection.doc(familyId).get()
    
    if (!familyResult.data) {
      return {
        success: false,
        message: '家庭不存在'
      }
    }
    
    const familyData = familyResult.data
    
    // 5. 如果需要删除数据，执行删除操作
    if (needDeleteData) {
      // 这里实现数据删除逻辑
      // 例如：删除用户关联的所有记录（喂养、睡眠、排泄等）
      // 由于涉及多个集合，可能需要一个专门的云函数来处理
      
      // 调用删除用户数据的云函数
      try {
        const deleteResult = await cloud.callFunction({
          name: 'deleteUserData',
          data: { openid: openid }
        })
        
        console.log('删除用户数据结果:', deleteResult)
      } catch (deleteErr) {
        console.error('删除用户数据失败:', deleteErr)
        return {
          success: false,
          message: '删除用户数据失败，无法加入家庭'
        }
      }
    }
    
    // 6. 获取用户基本信息
    const babyInfo = userData.babyInfo || null
    let userName = '家庭成员'
    
    if (babyInfo && babyInfo.nickName) {
      userName = babyInfo.nickName + '的家长'
    }
    
    // 7. 更新家庭成员列表
    const newMember = {
      openid: openid,
      nickName: userName,
      avatarUrl: babyInfo ? babyInfo.avatarUrl : '',
      role: 'member',
      joinTime: db.serverDate()
    }
    
    await familiesCollection.doc(familyId).update({
      data: {
        members: _.push(newMember)
      }
    })
    
    // 8. 更新用户的familyId字段
    await usersCollection.where({
      _openid: openid
    }).update({
      data: {
        familyId: familyId,
        role: 'member'
      }
    })
    
    console.log('用户成功加入家庭，家庭ID:', familyId)
    return {
      success: true,
      message: '成功加入家庭',
      familyId: familyId
    }
    
  } catch (err) {
    console.error('加入家庭失败:', err)
    return {
      success: false,
      message: '加入家庭失败',
      error: err
    }
  }
} 