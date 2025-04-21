// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

const db = cloud.database()
const _ = db.command
const usersCollection = db.collection('users')
const familiesCollection = db.collection('families')

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  
  console.log('创建家庭，用户openid:', openid)
  
  if (!openid) {
    return {
      success: false,
      message: '无法获取用户信息'
    }
  }

  try {
    // 1. 查询用户信息，检查是否已有家庭
    const userResult = await usersCollection.where({
      _openid: openid
    }).get()
    
    let userData
    
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
    } else {
      userData = userResult.data[0]
    }
    
    // 检查用户是否已有家庭
    if (userData.familyId) {
      // 查询这个家庭是否还存在
      try {
        const existingFamily = await familiesCollection.doc(userData.familyId).get()
        if (existingFamily.data) {
          return {
            success: false,
            message: '您已经在一个家庭中，无法创建新家庭'
          }
        }
      } catch (e) {
        // 家庭不存在，可以继续创建
        console.log('关联的家庭不存在，将创建新家庭')
      }
    }
    
    // 2. 获取用户基本信息
    const babyInfo = userData.babyInfo || null
    let userName = '家庭成员'
    
    if (babyInfo && babyInfo.nickName) {
      userName = babyInfo.nickName + '的家长'
    }
    
    // 3. 创建家庭记录
    const familyData = {
      name: '我的家庭',
      managerId: openid,
      members: [{
        openid: openid,
        nickName: userName,
        avatarUrl: babyInfo ? babyInfo.avatarUrl : '',
        role: 'manager',
        joinTime: db.serverDate()
      }],
      babyInfo: babyInfo,
      createTime: db.serverDate()
    }
    
    const addFamilyResult = await familiesCollection.add({
      data: familyData
    })
    
    const familyId = addFamilyResult._id
    
    // 4. 更新用户的familyId字段
    await usersCollection.where({
      _openid: openid
    }).update({
      data: {
        familyId: familyId,
        role: 'manager'
      }
    })
    
    console.log('成功创建家庭，ID:', familyId)
    return {
      success: true,
      message: '创建家庭成功',
      familyId: familyId
    }
    
  } catch (err) {
    console.error('创建家庭失败:', err)
    return {
      success: false,
      message: '创建家庭失败',
      error: err
    }
  }
} 