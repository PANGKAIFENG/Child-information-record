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
  
  console.log('移除家庭成员，操作者openid:', openid)
  
  if (!openid) {
    return {
      success: false,
      message: '无法获取用户信息'
    }
  }

  // 获取要移除的成员ID
  const memberId = event.memberId
  
  if (!memberId) {
    return {
      success: false,
      message: '缺少成员ID参数'
    }
  }

  // 不能移除自己
  if (memberId === openid) {
    return {
      success: false,
      message: '不能移除自己，请使用退出家庭功能'
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
        message: '只有家庭管理员可以移除成员'
      }
    }
    
    // 2. 查询家庭信息
    const familyResult = await familiesCollection.doc(familyId).get()
    
    if (!familyResult.data) {
      return {
        success: false,
        message: '家庭记录不存在'
      }
    }
    
    const familyData = familyResult.data
    
    // 3. 检查要移除的成员是否存在
    const memberExists = familyData.members.some(member => member.openid === memberId)
    
    if (!memberExists) {
      return {
        success: false,
        message: '要移除的成员不在家庭中'
      }
    }
    
    // 4. 更新家庭成员列表，移除指定成员
    await familiesCollection.doc(familyId).update({
      data: {
        members: _.pull({
          openid: memberId
        })
      }
    })
    
    // 5. 更新成员的用户记录，清除家庭关联
    await usersCollection.where({
      _openid: memberId
    }).update({
      data: {
        familyId: _.remove(),
        role: _.remove()
      }
    })
    
    console.log('成功移除家庭成员:', memberId)
    return {
      success: true,
      message: '成功移除家庭成员'
    }
    
  } catch (err) {
    console.error('移除家庭成员失败:', err)
    return {
      success: false,
      message: '移除家庭成员失败',
      error: err
    }
  }
} 