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
  
  console.log('退出家庭，用户openid:', openid)
  
  if (!openid) {
    return {
      success: false,
      message: '无法获取用户信息'
    }
  }

  try {
    // 1. 查询用户信息，获取关联的familyId
    const userResult = await usersCollection.where({
      _openid: openid
    }).get()
    
    if (!userResult.data || userResult.data.length === 0) {
      return {
        success: false,
        message: '未找到用户记录'
      }
    }
    
    const userData = userResult.data[0]
    const familyId = userData.familyId
    
    if (!familyId) {
      return {
        success: false,
        message: '用户没有关联的家庭'
      }
    }
    
    // 2. 查询家庭信息
    const familyResult = await familiesCollection.doc(familyId).get()
    
    if (!familyResult.data) {
      // 家庭不存在，直接清除用户的家庭关联
      await usersCollection.where({
        _openid: openid
      }).update({
        data: {
          familyId: _.remove(),
          role: _.remove()
        }
      })
      
      return {
        success: true,
        message: '已退出家庭（家庭记录不存在）'
      }
    }
    
    const familyData = familyResult.data
    
    // 3. 检查用户是否为家庭管理员
    if (familyData.managerId === openid) {
      return {
        success: false,
        message: '家庭管理员不能直接退出，请先转移管理权限或解散家庭'
      }
    }
    
    // 4. 更新家庭成员列表，移除当前用户
    await familiesCollection.doc(familyId).update({
      data: {
        members: _.pull({
          openid: openid
        })
      }
    })
    
    // 5. 清除用户的家庭关联
    await usersCollection.where({
      _openid: openid
    }).update({
      data: {
        familyId: _.remove(),
        role: _.remove()
      }
    })
    
    console.log('用户成功退出家庭')
    return {
      success: true,
      message: '成功退出家庭'
    }
    
  } catch (err) {
    console.error('退出家庭失败:', err)
    return {
      success: false,
      message: '退出家庭失败',
      error: err
    }
  }
} 