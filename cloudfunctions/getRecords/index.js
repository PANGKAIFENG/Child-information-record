// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }); // 使用当前云环境

const db = cloud.database(); // 获取数据库引用
const abnormalRecordsCollection = db.collection('abnormal_records'); // 获取集合引用
const _ = db.command; // 获取查询指令

// 云函数入口函数
exports.main = async (event, context) => {
  console.log('Executing getRecords cloud function. Event:', event);

  try {
    // 查询 abnormal_records 集合
    // 默认按 timestamp 降序（最新在前）获取所有记录
    // 未来可以根据 event 中传递的参数进行筛选或分页
    const queryResult = await abnormalRecordsCollection
      .where({
        // 这里可以添加查询条件，例如根据用户 openid 查询
        // _openid: event.userInfo.openId // 需要前端传递 userInfo
      })
      .orderBy('timestamp', 'desc') // 按时间戳降序排列
      // .skip(event.skip || 0) // 用于分页，跳过指定数量的记录
      // .limit(event.limit || 20) // 用于分页，限制返回数量
      .get();

    console.log('Records fetched successfully:', queryResult.data.length);

    // 返回成功结果和查询到的数据列表
    return {
      success: true,
      message: '记录获取成功',
      data: queryResult.data // 返回数据数组
    };

  } catch (e) {
    console.error('Error fetching records:', e);
    // 返回失败结果
    return {
      success: false,
      message: '记录获取失败',
      error: e
    };
  }
};
