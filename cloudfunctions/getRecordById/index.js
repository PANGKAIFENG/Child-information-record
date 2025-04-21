// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }); // 使用当前云环境

const db = cloud.database(); // 获取数据库引用
const abnormalRecordsCollection = db.collection('abnormal_records'); // 获取集合引用

// 云函数入口函数
exports.main = async (event, context) => {
  console.log('Executing getRecordById cloud function. Event:', event);

  // 从 event 中获取前端传递过来的记录 ID
  // 我们约定前端调用时传递的参数名为 recordId
  const recordId = event.recordId;

  if (!recordId) {
    console.error('Error: recordId is missing in event');
    return {
      success: false,
      message: '缺少记录 ID',
      error: 'recordId is undefined or null'
    };
  }

  try {
    // 根据文档 ID (_id) 查询单条记录
    // 注意：数据库中的主键是 _id，但我们存入时用的是自己生成的 recordId
    // 因此，查询条件是使用我们自己生成的 recordId 字段
    const queryResult = await abnormalRecordsCollection.where({
      recordId: recordId 
    }).limit(1).get(); // 使用 where 查询并限制只取一条

    if (queryResult.data && queryResult.data.length > 0) {
      console.log('Record fetched successfully:', queryResult.data[0]);
       // 返回成功结果和查询到的单条记录数据
       return {
         success: true,
         message: '记录获取成功',
         data: queryResult.data[0] // 返回数据对象
       };
    } else {
       console.warn('Record not found for ID:', recordId);
       return {
         success: false,
         message: '未找到指定记录',
         data: null
       };
    }

  } catch (e) {
    console.error('Error fetching record by ID:', e);
    // 返回失败结果
    return {
      success: false,
      message: '记录获取失败',
      error: e
    };
  }
};