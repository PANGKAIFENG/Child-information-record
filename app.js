// 使用 require 导入工具函数
const utils = require('/src/utils/util.js');

App({
  onLaunch: function () {
    console.log('App Launch');

    // 云开发环境初始化
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        // env 参数说明：
        //   env 参数决定接下来小程序发起的云开发调用（wx.cloud.xxx）会默认请求到哪个云环境的资源
        //   此处请填入环境 ID, 环境 ID 可打开云控制台查看
        //   如不填则使用默认环境（第一个创建的环境）
        env: 'cloud1-9gnf195a36664dc4', // 使用你提供的环境 ID
        traceUser: true, // 是否在将用户访问记录到用户管理中，在控制台中可见
      });
      console.log('云开发环境初始化成功！Env ID:', 'cloud1-9gnf195a36664dc4');
    }
    // --- 云开发初始化结束 ---

    // 这里可以添加其他小程序启动时需要的逻辑
  },
  onShow: function () {
    console.log('App Show');
  },
  onHide: function () {
    console.log('App Hide');
  },
  globalData: {
    utils: utils // 将导入的 utils 模块挂载到 globalData
  }
}) 