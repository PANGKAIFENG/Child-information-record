// 喂养记录页面
Page({
  data: {
    feedingType: '',
    amount: '',
    unit: 'ml',
    date: '',
    time: '',
    notes: ''
  },
  
  onLoad: function() {
    // 设置当前日期和时间
    this.setCurrentDateTime();
  },
  
  setCurrentDateTime: function() {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    
    this.setData({
      date: `${year}-${month}-${day}`,
      time: `${hours}:${minutes}`
    });
  },
  
  // 日期选择器变化
  bindDateChange: function(e) {
    this.setData({
      date: e.detail.value
    });
  },
  
  // 时间选择器变化
  bindTimeChange: function(e) {
    this.setData({
      time: e.detail.value
    });
  },
  
  // 喂养类型选择
  bindFeedingTypeChange: function(e) {
    this.setData({
      feedingType: e.detail.value
    });
  },
  
  // 奶量输入
  inputAmount: function(e) {
    this.setData({
      amount: e.detail.value
    });
  },
  
  // 单位选择
  bindUnitChange: function(e) {
    this.setData({
      unit: e.detail.value
    });
  },
  
  // 备注输入
  inputNotes: function(e) {
    this.setData({
      notes: e.detail.value
    });
  },
  
  saveRecord: async function() {
    // ... 验证代码 ...
    
    wx.showLoading({ title: '保存中...' });
    
    try {
      // 添加本地日期字符串用于查询
      const recordDate_local = this.data.date;
      
      const dataToSend = {
        collectionName: 'feeding_records', // 指定要保存到的集合
        recordData: {
          feedingType: this.data.feedingType,
          amount: parseFloat(this.data.amount),
          unit: this.data.unit,
          date: this.data.date,
          time: this.data.time,
          notes: this.data.notes,
          recordType: 'feeding', // 明确指定记录类型
          recordDate_local: recordDate_local, // 添加本地日期字符串用于查询
          createTime: new Date(), // 添加创建时间
          timestamp: new Date().getTime() // 添加时间戳用于排序
        }
      };
      
      console.log('[saveRecord] Data to be sent to cloud:', dataToSend);
      
      const res = await wx.cloud.callFunction({
        name: 'addRecord',
        data: dataToSend
      });
      
      console.log('调用 addRecord 成功:', res);
      
      if (res.result && (res.result._id || res.result.success)) {
        wx.showToast({ title: '保存成功', icon: 'success' });
        
        // 设置上一页（首页）需要刷新
        const pages = getCurrentPages();
        if (pages.length >= 2) {
          const prevPage = pages[pages.length - 2];
          if (prevPage.route.includes('home')) {
            prevPage.setData({ needsRefresh: true });
            console.log('已设置首页需要刷新');
          }
        }
        
        // 返回上一页
        setTimeout(() => {
          wx.navigateBack();
        }, 500);
      } else {
        console.error('addRecord 返回结果异常:', res);
        wx.showToast({ title: '保存失败，请重试', icon: 'none' });
      }
    } catch (err) {
      console.error('调用 addRecord 失败:', err);
      wx.showToast({ title: '保存失败，请检查网络', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  }
});