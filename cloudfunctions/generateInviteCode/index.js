// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

const db = cloud.database()
const _ = db.command
const usersCollection = db.collection('users')
const familiesCollection = db.collection('families')
const invitesCollection = db.collection('invites')

// 生成随机邀请码 (6位字母数字组合)
function generateRandomCode(length = 6) {
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去除容易混淆的字符
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  
  console.log('生成邀请码，用户openid:', openid)
  
  if (!openid) {
    return {
      success: false,
      message: '无法获取用户信息'
    }
  }

  // 获取请求中的家庭ID
  const { familyId } = event
  
  if (!familyId) {
    return {
      success: false,
      message: '缺少家庭ID参数'
    }
  }

  try {
    // 1. 检查用户是否为该家庭的管理员
    const userResult = await usersCollection.where({
      _openid: openid,
      familyId: familyId,
      role: 'manager'
    }).get()
    
    if (!userResult.data || userResult.data.length === 0) {
      return {
        success: false,
        message: '只有家庭管理员可以生成邀请码'
      }
    }
    
    // 2. 检查家庭是否存在
    const familyResult = await familiesCollection.doc(familyId).get()
    
    if (!familyResult.data) {
      return {
        success: false,
        message: '家庭不存在'
      }
    }
    
    // 3. 检查是否已有有效的邀请码
    const now = new Date()
    const inviteResult = await invitesCollection.where({
      familyId: familyId,
      expireTime: _.gt(now)
    }).get()
    
    // 如果已有有效邀请码，直接返回
    if (inviteResult.data && inviteResult.data.length > 0) {
      return {
        success: true,
        inviteCode: inviteResult.data[0].code
      }
    }
    
    // 4. 生成新的邀请码
    let code
    let isUnique = false
    
    // 确保生成的邀请码是唯一的
    while (!isUnique) {
      code = generateRandomCode()
      
      const existingCode = await invitesCollection.where({
        code: code,
        expireTime: _.gt(now)
      }).count()
      
      if (existingCode.total === 0) {
        isUnique = true
      }
    }
    
    // 5. 设置邀请码的过期时间 (24小时后)
    const expireTime = new Date()
    expireTime.setHours(expireTime.getHours() + 24)
    
    // 6. 保存邀请码
    const inviteData = {
      code: code,
      familyId: familyId,
      creatorId: openid,
      createTime: db.serverDate(),
      expireTime: expireTime
    }
    
    await invitesCollection.add({
      data: inviteData
    })
    
    console.log('成功生成邀请码:', code)
    return {
      success: true,
      inviteCode: code
    }
    
  } catch (err) {
    console.error('生成邀请码失败:', err)
    return {
      success: false,
      message: '生成邀请码失败',
      error: err
    }
  }
} 