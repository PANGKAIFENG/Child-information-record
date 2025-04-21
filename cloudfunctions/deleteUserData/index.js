// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

const db = cloud.database()
const _ = db.command
const usersCollection = db.collection('users')

// 要删除的记录集合列表
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
  
  // 确定要删除谁的数据
  let targetOpenid = event.openid || wxContext.OPENID
  
  console.log('删除用户数据，目标用户openid:', targetOpenid)
  
  if (!targetOpenid) {
    return {
      success: false,
      message: '无法获取用户信息'
    }
  }

  try {
    // 1. 检查用户是否存在
    const userResult = await usersCollection.where({
      _openid: targetOpenid
    }).get()
    
    if (!userResult.data || userResult.data.length === 0) {
      return {
        success: false,
        message: '未找到用户记录'
      }
    }
    
    // 2. 删除用户关联的所有记录
    const deletePromises = RECORD_COLLECTIONS.map(async (collectionName) => {
      try {
        // 分批次删除，先获取所有记录的ID
        const recordsCollection = db.collection(collectionName)
        
        // 由于可能存在较多记录，需要分批次查询
        // 先获取记录总数
        const countResult = await recordsCollection.where({
          _openid: targetOpenid
        }).count()
        
        const total = countResult.total
        const batchSize = 100 // 每次最多获取100条记录
        
        // 分批获取记录ID并删除
        for (let i = 0; i < total; i += batchSize) {
          const records = await recordsCollection.where({
            _openid: targetOpenid
          }).skip(i).limit(batchSize).get()
          
          // 删除这一批记录
          for (const record of records.data) {
            await recordsCollection.doc(record._id).remove()
          }
        }
        
        console.log(`成功删除${collectionName}中${total}条记录`)
        return { collection: collectionName, count: total }
      } catch (err) {
        console.error(`删除${collectionName}记录失败:`, err)
        throw err
      }
    })
    
    // 等待所有删除操作完成
    const results = await Promise.all(deletePromises)
    
    // 3. 更新用户的家庭关系状态
    await usersCollection.where({
      _openid: targetOpenid
    }).update({
      data: {
        familyId: _.remove() // 移除家庭ID
      }
    })
    
    console.log('成功删除用户数据')
    return {
      success: true,
      message: '成功删除用户数据',
      details: results
    }
    
  } catch (err) {
    console.error('删除用户数据失败:', err)
    return {
      success: false,
      message: '删除用户数据失败',
      error: err
    }
  }
} 