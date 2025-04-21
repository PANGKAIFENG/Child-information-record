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
  
  console.log('解散家庭，操作者openid:', openid)
  
  if (!openid) {
    return {
      success: false,
      message: '无法获取用户信息'
    }
  }

  try {
    // 1. 查询操作者信息，获取关联的familyId和角色
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
    const role = userData.role
    
    if (!familyId) {
      return {
        success: false,
        message: '用户没有关联的家庭'
      }
    }
    
    if (role !== 'manager') {
      return {
        success: false,
        message: '只有家庭管理员可以解散家庭'
      }
    }
    
    // 2. 查询家庭信息
    const familyResult = await familiesCollection.doc(familyId).get()
    
    if (!familyResult.data) {
      // 家庭不存在，只清除用户自己的家庭关联
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
        message: '已解散家庭（家庭记录不存在）'
      }
    }
    
    const familyData = familyResult.data
    
    // 3. 查询家庭所有成员
    const members = familyData.members || []
    const memberOpenIds = members.map(member => member.openid)
    
    // 4. 更新所有成员的用户记录，清除家庭关联
    for (const memberId of memberOpenIds) {
      if (memberId !== openid) { // 不包括管理员自己，后面单独处理
        await usersCollection.where({
          _openid: memberId
        }).update({
          data: {
            familyId: _.remove(),
            role: _.remove()
          }
        })
      }
    }
    
    // 5. 删除所有与该家庭相关的邀请码
    await invitesCollection.where({
      familyId: familyId
    }).remove()
    
    // 6. 删除家庭记录
    await familiesCollection.doc(familyId).remove()
    
    // 7. 最后更新管理员自己的记录
    await usersCollection.where({
      _openid: openid
    }).update({
      data: {
        familyId: _.remove(),
        role: _.remove()
      }
    })
    
    console.log('成功解散家庭:', familyId)
    return {
      success: true,
      message: '成功解散家庭'
    }
    
  } catch (err) {
    console.error('解散家庭失败:', err)
    return {
      success: false,
      message: '解散家庭失败',
      error: err
    }
  }
}
