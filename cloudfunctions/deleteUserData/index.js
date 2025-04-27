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
        console.log(`Attempting to remove records from ${collectionName} for openid: ${targetOpenid}`);
        const deleteResult = await db.collection(collectionName).where({
          _openid: targetOpenid
        }).remove();
        
        const count = deleteResult.stats.removed;
        console.log(`Successfully removed ${count} records from ${collectionName}`);
        return { collection: collectionName, success: true, count: count };
      } catch (err) {
        // 即使某个集合删除失败，也记录错误并继续尝试其他集合
        console.error(`Failed to remove records from ${collectionName}:`, err);
        // 可以选择抛出错误让 Promise.all 失败，或者返回失败状态
        // return { collection: collectionName, success: false, error: err }; 
        throw err; // 让 Promise.all 捕获到错误
      }
    });
    
    // 等待所有删除操作完成
    let results;
    try {
       results = await Promise.all(deletePromises);
       console.log('All record deletion attempts finished.', results);
    } catch (batchError) {
       // 如果 Promise.all 因为其中一个删除失败而 reject
       console.error('One or more record deletion tasks failed:', batchError);
       // 根据业务逻辑决定是否继续，这里选择中断并返回失败
       return {
           success: false,
           message: '删除部分用户记录失败，请稍后重试'
       }
    }
    
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