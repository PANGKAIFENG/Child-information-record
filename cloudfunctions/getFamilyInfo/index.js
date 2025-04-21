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
  
  console.log('获取家庭信息，用户openid:', openid)
  
  if (!openid) {
    return {
      success: false,
      message: '无法获取用户信息'
    }
  }

  try {
    // 1. 先查询用户信息，获取关联的familyId
    const userResult = await usersCollection.where({
      _openid: openid
    }).get()
    
    if (!userResult.data || userResult.data.length === 0) {
      console.log('未找到用户记录')
      return {
        success: true,
        data: null
      }
    }
    
    const userData = userResult.data[0]
    const familyId = userData.familyId
    
    if (!familyId) {
      console.log('用户没有关联家庭')
      return {
        success: true,
        data: null
      }
    }
    
    // 2. 根据familyId查询家庭信息
    const familyResult = await familiesCollection.doc(familyId).get()
    
    if (!familyResult.data) {
      console.log('未找到家庭记录，家庭ID:', familyId)
      return {
        success: true,
        data: null
      }
    }
    
    console.log('成功获取家庭信息:', familyResult.data)
    return {
      success: true,
      data: familyResult.data
    }
    
  } catch (err) {
    console.error('获取家庭信息失败:', err)
    return {
      success: false,
      message: '获取家庭信息失败',
      error: err
    }
  }
} 