// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }); // 使用当前云环境

const db = cloud.database();
const _ = db.command;

// 云函数入口函数
exports.main = async (event, context) => {
  console.log('[scheduleReminders] Triggered with event:', event);
  
  try {
    // 获取当前时间，并设置查询范围
    // 只检查过去15分钟到当前时间的提醒，避免错过的提醒积累太多
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000); // 15分钟前
    
    console.log(`[scheduleReminders] Checking reminders between ${fiveMinutesAgo.toISOString()} and ${now.toISOString()}`);
    
    // 查询已到时间但尚未发送的提醒
    const remindersToSend = await db.collection('scheduled_reminders')
      .where({
        status: 'pending', // 只处理待发送的
        scheduledTime: _.gte(fiveMinutesAgo).lte(now) // 在查询范围内的提醒
      })
      .limit(100) // 限制一次处理的数量，避免超时
      .get();
    
    console.log(`[scheduleReminders] Found ${remindersToSend.data.length} reminders to process`);
    
    // 如果没有需要发送的提醒，直接返回
    if (remindersToSend.data.length === 0) {
      return {
        success: true,
        message: '没有找到需要发送的提醒',
        processedCount: 0
      };
    }
    
    // 处理每个找到的提醒
    const processResults = [];
    for (const reminder of remindersToSend.data) {
      try {
        console.log(`[scheduleReminders] Processing reminder: ${reminder._id}`);
        
        // 调用发送提醒消息的云函数
        const sendResult = await cloud.callFunction({
          name: 'sendReminderMessage',
          data: {
            reminderId: reminder._id
          }
        });
        
        console.log(`[scheduleReminders] Reminder ${reminder._id} processed. Result:`, sendResult);
        
        processResults.push({
          reminderId: reminder._id,
          success: sendResult.result.success,
          message: sendResult.result.message
        });
      } catch (e) {
        console.error(`[scheduleReminders] Error processing reminder ${reminder._id}:`, e);
        
        // 更新提醒状态为失败
        await db.collection('scheduled_reminders').doc(reminder._id).update({
          data: {
            status: 'failed',
            error: e.message || '处理时发生错误',
            processTime: db.serverDate()
          }
        });
        
        processResults.push({
          reminderId: reminder._id,
          success: false,
          error: e.message || '处理时发生错误'
        });
      }
    }
    
    // 返回处理结果
    return {
      success: true,
      message: `处理了 ${processResults.length} 个提醒`,
      processedCount: processResults.length,
      results: processResults
    };
  } catch (err) {
    console.error('[scheduleReminders] Main error:', err);
    
    return {
      success: false,
      message: '处理提醒任务时出错',
      error: err.message || err
    };
  }
}; 