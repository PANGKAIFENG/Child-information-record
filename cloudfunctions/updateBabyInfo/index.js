// 云函数入口文件
const cloud = require('wx-server-sdk')

// 初始化云环境，必须在使用云能力前调用
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// 在 init 之后获取数据库和命令对象
const db = cloud.database()
const usersCollection = db.collection('users') // 假设用户信息存在 'users' 集合
const _ = db.command

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID // 获取当前用户的 openid

  if (!openid) {
    return { success: false, message: '无法获取用户信息' }
  }

  // 从 event 中获取前端传递的 babyInfo 对象
  const babyInfo = event.babyInfo
  if (!babyInfo || !babyInfo.nickName || !babyInfo.birthDate || !babyInfo.avatarUrl) {
    return { success: false, message: '宝宝信息不完整' }
  }

  console.log(`Updating baby info for openid: ${openid}`, babyInfo)

  try {
    // 查找该用户的记录是否存在
    const userRecord = await usersCollection.where({ _openid: openid }).limit(1).get()

    let result
    if (userRecord.data && userRecord.data.length > 0) {
      // 用户记录存在，更新 babyInfo 字段
      const userId = userRecord.data[0]._id
      result = await usersCollection.doc(userId).update({
        data: {
          babyInfo: _.set(babyInfo) // 使用 set 更新整个对象
          // updateTime: db.serverDate() // 可选：更新时间
        }
      })
      console.log('User babyInfo updated:', result)
    } else {
      // 用户记录不存在
      console.warn('User record not found for openid:', openid)
      // 注意：login 云函数应该负责创建用户记录，这里不再创建
      return { success: false, message: '未找到用户记录，请确保已正确登录' }
    }

    // 仅检查更新操作的结果
    if (result.stats.updated === 1) {
      return { success: true, message: '宝宝信息保存成功' }
    } else {
      console.error('Update failed, result stats:', result.stats)
      return { success: false, message: '保存失败，请重试' }
    }
  } catch (e) {
    console.error('Error updating baby info:', e)
    return { success: false, message: '数据库操作失败', error: e }
  }
}