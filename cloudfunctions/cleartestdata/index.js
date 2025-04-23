// 云函数入口文件：clearTestData (仅用于清理测试数据，用后可删除)
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

const db = cloud.database()
const _ = db.command

// 在这里列出所有需要清空的集合名称
const COLLECTIONS_TO_CLEAR = [
  'feeding_records',
  'sleep_records',
  'excretion_records',
  'supplement_records',
  'abnormal_records',
  'users',             // 注意：如果 users 集合包含你不希望删除的用户配置，请从这里移除
  'families',          // 注意：会删除所有家庭信息
  'invites',           // 如果你有邀请码集合的话
  // ... 添加其他你可能创建的测试集合名称 ...
]

// 云函数入口函数
exports.main = async (event, context) => {
  console.log(`[clearTestData] Starting data clearing process for ${COLLECTIONS_TO_CLEAR.length} collections.`)

  const results = {}
  let totalSuccessCount = 0
  let totalFailCount = 0

  for (const collectionName of COLLECTIONS_TO_CLEAR) {
    console.log(`[clearTestData] Attempting to clear collection: ${collectionName}`)
    try {
      // where({}) 匹配所有记录, remove() 删除匹配到的记录
      // 注意：remove() 单次调用有上限，但对于测试数据量通常足够。
      // 错误：where({}) 不被允许，需要一个非空查询条件
      // const removeResult = await db.collection(collectionName).where({}).remove()

      // 修改：使用 _.exists(true) 匹配所有文档进行删除
      const removeResult = await db.collection(collectionName).where({
        _id: _.exists(true) 
      }).remove()
      
      const removedCount = removeResult.stats.removed
      console.log(`[clearTestData] Successfully cleared collection: ${collectionName}, Documents removed: ${removedCount}`)
      results[collectionName] = { success: true, removed: removedCount }
      totalSuccessCount++
    } catch (err) {
      console.error(`[clearTestData] Failed to clear collection: ${collectionName}`, err)
      results[collectionName] = { success: false, error: err.message }
      totalFailCount++
    }
  }

  const overallMessage = `Data clearing process completed. Success: ${totalSuccessCount}, Failed: ${totalFailCount}.`
  console.log(`[clearTestData] ${overallMessage}`)

  return {
    success: totalFailCount === 0, // 如果没有失败的集合则为 true
    message: overallMessage,
    details: results
  }
}