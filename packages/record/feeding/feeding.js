// 喂养记录页面
Page({
  data: {
    feedingTypes: ['母乳', '奶粉'],
    selectedTypeIndex: 0,
    amount: '', // 奶量
    date: '', // 日期
    time: '', // 时间
    notes: '', // 备注
    isFormValid: false, // 表单是否有效
    duration: '', // 假设母乳有时长输入，字段名为 duration (单位：分钟)
    
    // 新增：提醒设置相关状态
    reminderEnabled: false,
    reminderHours: 3,
    reminderMinutes: 0
  },

  onLoad: function(options) {
    // 设置当前日期和时间为默认值
    this.setNowDateTime();
    
    // 获取上次喂养类型的选择
    try {
      const lastFeedType = wx.getStorageSync('lastFeedType');
      if (lastFeedType) {
        const typeIndex = this.data.feedingTypes.indexOf(lastFeedType);
        if (typeIndex !== -1) {
          this.setData({ selectedTypeIndex: typeIndex });
        }
      }
    } catch (e) {
      console.error('读取上次喂养类型失败', e);
    }
    
    // 如果有传入的类型参数，则设置喂养类型（优先级高于上次的选择）
    if (options && options.type) {
      const typeIndex = this.data.feedingTypes.indexOf(options.type);
      if (typeIndex !== -1) {
        this.setData({ selectedTypeIndex: typeIndex });
      }
    }
    
    // 初始检查表单是否有效
    this.checkFormValid();
  },
  
  // 表单验证
  checkFormValid: function() {
    // 检查必填字段是否已填写
    let isValid = false;
    
    // 当前选择的喂养类型
    const currentFeedType = this.data.feedingTypes[this.data.selectedTypeIndex];
    
    if (currentFeedType === '母乳') {
      // 母乳喂养：奶量或时长至少填一项
      isValid = this.data.amount.trim() !== '' || this.data.duration.trim() !== '';
    } else {
      // 奶瓶：奶量必填
      isValid = this.data.amount.trim() !== '';
    }
    
    this.setData({ isFormValid: isValid });
  },

  // 喂养类型选择器变化
  bindTypeChange: function(e) {
    const selectedIndex = parseInt(e.detail.value);
    this.setData({
      selectedTypeIndex: selectedIndex
    });
    
    // 保存当前选择，以便下次使用
    try {
      wx.setStorageSync('lastFeedType', this.data.feedingTypes[selectedIndex]);
    } catch (e) {
      console.error('保存喂养类型失败', e);
    }
    
    this.checkFormValid();
  },

  // 设置为当前日期和时间
  setNowDateTime: function() {
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

  // 奶量输入变化
  inputAmount: function(e) {
    this.setData({
      amount: e.detail.value
    });
    this.checkFormValid();
  },

  // 母乳喂养时长输入
  inputDuration: function(e) {
    this.setData({
      duration: e.detail.value
    });
    this.checkFormValid();
  },

  // 备注输入
  inputNotes: function(e) {
    this.setData({
      notes: e.detail.value
    });
  },

  // 显示历史记录
  showHistory: function() {
    // 跳转到历史记录页面
    wx.navigateTo({
      url: '../history/history?type=feeding'
    });
  },

  // 取消记录
  cancelRecord: function() {
    wx.navigateBack();
  },

  // 保存记录
  saveRecord: function() {
    if (!this.data.isFormValid) {
      wx.showToast({
        title: '请完善必填信息',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({ title: '保存中...' }); // 添加加载提示

    // 当前选择的喂养类型
    const currentFeedType = this.data.feedingTypes[this.data.selectedTypeIndex];
    
    // 组装记录数据
    const recordData = {
      feedingType: currentFeedType,
      amount: parseFloat(this.data.amount) || null, // 确保未输入时为 null 或处理
      unit: 'ml', // 默认单位
      // date: this.data.date, // 不再单独发送 date
      // time: this.data.time, // 不再单独发送 time
      dateTime: `${this.data.date} ${this.data.time}`, // 新增合并后的 dateTime 字段
      notes: this.data.notes,
      // createTime 和 timestamp 由云函数添加
      // recordDate_local 由云函数从 dateTime 提取
      
      // 新增：添加提醒设置到记录数据
      reminder: {
          enabled: this.data.reminderEnabled,
          hours: this.data.reminderHours,
          minutes: this.data.reminderMinutes
      }
    };

    // --- 处理母乳的时长 --- 
    if (currentFeedType === '母乳') {
      // 确保amount字段有值 (如果未填amount但有duration，可选转换)
      if (!recordData.amount && this.data.duration) {
        recordData.amount = parseFloat(this.data.duration) * 10; 
      }
      // 保存时长字段（如果有）
      recordData.duration = parseFloat(this.data.duration) || null;
    } else if (currentFeedType === '奶粉') {
      // 奶粉喂养不需要 duration
      // delete recordData.duration; // 如果 recordData 从空对象开始，则不需要删除
      // 确保奶粉记录存在amount字段
      if (recordData.amount === null) { // 修改检查条件为 null
        recordData.amount = 0; // 默认值，避免 null
      }
    }
    // --------------------

    console.log('[Feeding Save] Data sent to addRecord:', JSON.stringify(recordData));

    // 保存本次的喂养类型作为下次默认值
    wx.setStorageSync('lastFeedType', currentFeedType);

    // 调用云函数保存记录到云数据库
    wx.cloud.callFunction({
      name: 'addRecord',
      data: {
        collectionName: 'feeding_records',
        recordData: recordData
      }
    })
    .then(res => {
      console.log('调用 addRecord 成功:', res);
      if (res.result && res.result.success) {
        wx.showToast({
          title: '记录已保存',
          icon: 'success',
          duration: 1500
        });
        // 延迟返回上一页
        setTimeout(() => wx.navigateBack(), 1500);
      } else {
        wx.showToast({ 
          title: res.result?.message || '保存失败', 
          icon: 'none' 
        });
      }
    })
    .catch(err => {
      console.error('调用 addRecord 失败:', err);
      wx.showToast({ 
        title: '保存失败，请检查网络', 
        icon: 'none' 
      });
    })
    .finally(() => {
      wx.hideLoading(); // 隐藏加载提示
    });
  },

  // 新增：处理提醒组件变化的事件
  handleReminderChange: function(e) {
    const { enabled, hours, minutes } = e.detail;
    this.setData({
      reminderEnabled: enabled,
      reminderHours: hours,
      reminderMinutes: minutes
    });
    console.log('Reminder settings changed:', e.detail);
  },

  // 保存记录到本地存储（已弃用，改为云存储）
  /* saveRecordToStorage: function(recordData) {
    // 获取现有的喂养记录
    let feedingRecords = wx.getStorageSync('feedingRecords') || [];
    
    // 添加新记录
    feedingRecords.push(recordData);
    
    // 保存回本地存储
    wx.setStorageSync('feedingRecords', feedingRecords);
    
    console.log('喂养记录已保存到本地存储', recordData);
  } */
}) 