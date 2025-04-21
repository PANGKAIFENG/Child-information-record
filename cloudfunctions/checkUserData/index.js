// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

const db = cloud.database()
const _ = db.command

// 要检查的记录集合列表
const RECORD_COLLECTIONS = [
  'feeding_records',
  'sleep_records',
  'excretion_records',
  'supplement_records',
  'abnormal_records'
];

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  
  console.log('检查用户数据，用户openid:', openid)
  
  if (!openid) {
    return {
      success: false,
      message: '无法获取用户信息'
    }
  }

  try {
    // 检查用户是否有自己的数据
    const checkPromises = RECORD_COLLECTIONS.map(async (collectionName) => {
      try {
        const recordsCollection = db.collection(collectionName)
        
        // 查询用户在该集合中的记录数
        const countResult = await recordsCollection.where({
          _openid: openid
        }).count()
        
        return { collection: collectionName, count: countResult.total }
      } catch (err) {
        console.error(`检查${collectionName}记录失败:`, err)
        throw err
      }
    })
    
    // 等待所有检查操作完成
    const results = await Promise.all(checkPromises)
    
    // 检查用户是否有数据
    const totalRecords = results.reduce((sum, result) => sum + result.count, 0)
    const hasData = totalRecords > 0
    
    console.log('用户数据检查结果:', { hasData, totalRecords, details: results })
    return {
      success: true,
      hasData,
      totalRecords,
      details: results
    }
    
  } catch (err) {
    console.error('检查用户数据失败:', err)
    return {
      success: false,
      message: '检查用户数据失败',
      error: err
    }
  }
}
