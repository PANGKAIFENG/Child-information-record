// 清空所有异常记录的云函数
const cloud = require('wx-server-sdk')

// 初始化云开发环境
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  // 获取用户的OpenID
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  
  // 安全检查
  if (!event.confirmed) {
    return {
      success: false,
      message: '未确认操作，清空取消'
    }
  }

  if (!openid) {
    return {
      success: false,
      message: '无法获取用户标识，请重新登录'
    }
  }

  try {
    // 删除该用户所有的异常记录
    const result = await db.collection('abnormal_records')
      .where({
        _openid: openid
      })
      .remove()

    console.log('删除结果:', result)

    // 返回成功结果
    return {
      success: true,
      message: '所有异常记录已清空',
      stats: result.stats
    }
  } catch (err) {
    console.error('删除异常记录失败:', err)
    return {
      success: false,
      message: '清空失败，请重试',
      error: err
    }
  }
} 