// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }); // 使用当前云环境

const db = cloud.database();

// 云函数入口函数
exports.main = async (event, context) => {
  console.log('[sendReminderMessage] Event received:', event);
  
  try {
    // 如果直接传入了 reminderId，则从数据库获取提醒详情
    if (event.reminderId) {
      console.log(`[sendReminderMessage] Getting reminder with ID: ${event.reminderId}`);
      
      const reminderRes = await db.collection('scheduled_reminders')
        .doc(event.reminderId)
        .get();
      
      if (!reminderRes.data) {
        throw new Error(`找不到 ID 为 ${event.reminderId} 的提醒`);
      }
      
      const reminderData = reminderRes.data;
      
      // 如果提醒已经发送或取消，则跳过
      if (reminderData.status !== 'pending') {
        console.log(`[sendReminderMessage] Reminder ${event.reminderId} already processed (status: ${reminderData.status}). Skipping.`);
        return {
          success: false,
          message: `提醒已经处理过了，当前状态: ${reminderData.status}`
        };
      }
      
      // 发送订阅消息
      const result = await sendSubscriptionMessage(
        reminderData.userId,
        reminderData.templateId,
        reminderData.templateData,
        reminderData.page || 'pages/index/index'
      );
      
      // 更新提醒状态
      await db.collection('scheduled_reminders').doc(event.reminderId).update({
        data: {
          status: result.success ? 'sent' : 'failed',
          sendTime: db.serverDate(),
          sendResult: result
        }
      });
      
      // 如果是喂养记录的提醒，更新原记录的提醒状态
      if (reminderData.type === 'feeding' && reminderData.sourceRecordId) {
        await db.collection('feeding_records')
          .where({ recordId: reminderData.sourceRecordId })
          .update({
            data: {
              'reminder.reminderStatus': result.success ? 'sent' : 'failed',
              'reminder.sendTime': db.serverDate(),
              'reminder.sendResult': result
            }
          });
      }
      
      console.log(`[sendReminderMessage] Subscription message sent for reminder ${event.reminderId}. Result:`, result);
      
      return {
        success: result.success,
        message: result.success ? '提醒消息发送成功' : '提醒消息发送失败',
        result
      };
    } 
    // 直接传入发送参数的情况
    else if (event.userId && event.templateId && event.data) {
      console.log(`[sendReminderMessage] Sending direct message to user: ${event.userId}`);
      
      const result = await sendSubscriptionMessage(
        event.userId,
        event.templateId,
        event.data,
        event.page || 'pages/index/index'
      );
      
      console.log(`[sendReminderMessage] Direct subscription message sent. Result:`, result);
      
      return {
        success: result.success,
        message: result.success ? '提醒消息发送成功' : '提醒消息发送失败',
        result
      };
    } 
    else {
      throw new Error('缺少必要参数: 需要提供 reminderId 或 (userId, templateId, data)');
    }
  } catch (err) {
    console.error('[sendReminderMessage] Error:', err);
    return {
      success: false,
      message: '发送提醒消息时出错',
      error: err.message
    };
  }
};

// 发送订阅消息的辅助函数
async function sendSubscriptionMessage(toUserId, templateId, data, page = 'pages/index/index') {
  try {
    console.log(`[sendSubscriptionMessage] Sending to user ${toUserId}, template ${templateId}, page ${page}`);
    console.log(`[sendSubscriptionMessage] Template data:`, data);
    
    const result = await cloud.openapi.subscribeMessage.send({
      touser: toUserId,
      templateId: templateId,
      page: page,
      data: formatTemplateData(data),
      miniprogramState: 'formal' // developer-体验版, trial-试用版, formal-正式版
    });
    
    console.log(`[sendSubscriptionMessage] Send result:`, result);
    
    return {
      success: true,
      ...result
    };
  } catch (err) {
    console.error(`[sendSubscriptionMessage] Error sending message:`, err);
    
    return {
      success: false,
      error: err.message || err
    };
  }
}

// 格式化模板数据的辅助函数
function formatTemplateData(data) {
  // 订阅消息的数据需要一定的格式，每个字段值需要有 value 属性
  const formattedData = {};
  
  Object.keys(data).forEach(key => {
    formattedData[key] = {
      value: data[key]
    };
  });
  
  return formattedData;
} 