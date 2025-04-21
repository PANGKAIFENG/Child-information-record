// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

// 在 init 之后获取数据库
const db = cloud.database()
const usersCollection = db.collection('users')
const _ = db.command

// 云函数入口函数
exports.main = async (event, context) => {
  console.log('Executing login cloud function. Event:', event)
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  if (!openid) {
    console.error('Failed to get openid from context')
    return { success: false, message: '无法获取用户信息' }
  }

  console.log('WX Context fetched. OpenID:', openid)

  try {
    // 检查用户是否已存在
    const userRecord = await usersCollection.where({ _openid: openid }).limit(1).get()

    if (userRecord.data && userRecord.data.length > 0) {
      // 用户已存在，可以选择更新登录时间等（可选）
      console.log('User already exists:', openid)
      // 示例：更新最后登录时间
      // await usersCollection.doc(userRecord.data[0]._id).update({ data: { lastLoginTime: db.serverDate() } })
    } else {
      // 用户不存在，创建新用户记录
      console.log('User does not exist, creating new record for:', openid)
      await usersCollection.add({
        data: {
          _openid: openid,
          createTime: db.serverDate(),
          lastLoginTime: db.serverDate(),
          // 可以添加其他初始字段，比如空的 babyInfo 或默认设置
          babyInfo: {
            // avatarUrl: '', // 初始可以为空或默认
            // nickName: '',
            // birthDate: ''
          }
        }
      })
      console.log('New user record created successfully for:', openid)
    }

    // 无论用户是否存在，都返回成功和 openid
    return {
      success: true,
      message: '登录成功',
      openid: openid,
      // appid: wxContext.APPID, // 通常前端不太需要 appid
      // unionid: wxContext.UNIONID // unionid 也可能没有，按需返回
    }

  } catch (e) {
    console.error('Error checking or creating user record:', e)
    return { success: false, message: '登录处理失败', error: e }
  }
}