// 睡眠记录页面
Page({
  data: {
    recordMode: 'timer', // 默认使用计时器模式
    // 计时器相关
    timerRunning: false, // 计时器是否运行中
    timerPaused: false, // 计时器是否暂停
    timerCompleted: false, // 计时器是否完成
    timerDisplay: '00:00:00', // 计时器显示
    timerStartTime: 0, // 计时开始时间
    timerEndTime: 0, // 计时结束时间
    timerInterval: null, // 计时器定时器
    // 手动输入相关
    date: '', // 日期
    startTime: '', // 开始时间
    endTime: '', // 结束时间
    duration: '0.0', // 睡眠时长(小时)
    // 共用
    sleepQuality: 'normal', // 睡眠质量，默认一般
    notes: '', // 备注
    isFormValid: false, // 表单是否有效
    sleepStatus: 'sleep', // 默认为入睡记录
    time: '12:00', // 默认时间
    lastSleepTime: '', // 上次入睡时间
    duration: 0 // 睡眠时长(小时)
  },

  onLoad: function(options) {
    // 设置当前日期和时间
    this.setCurrentDateTime();
    
    // 检查是否有上次未完成的计时
    this.checkPendingTimer();
    
    // 初始检查表单是否有效
    this.checkFormValid();

    // 如果有传入的状态参数，则设置睡眠状态
    if (options && options.status) {
      this.setData({
        sleepStatus: options.status
      });
    }

    // 获取上次入睡时间（实际应用中应从存储中获取）
    this.getLastSleepTime();
  },

  onUnload: function() {
    // 页面卸载时清除计时器
    if (this.data.timerInterval) {
      clearInterval(this.data.timerInterval);
    }
  },

  // 设置当前日期和时间为默认值
  setCurrentDateTime: function() {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const currentDate = `${year}-${month}-${day}`;
    
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const currentTime = `${hours}:${minutes}`;

    // 根据当前时间设置默认的开始和结束时间
    // 如果是手动模式，默认设置开始时间为1小时前，结束时间为现在
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const startHours = oneHourAgo.getHours().toString().padStart(2, '0');
    const startMinutes = oneHourAgo.getMinutes().toString().padStart(2, '0');
    const startTime = `${startHours}:${startMinutes}`;

    this.setData({
      date: currentDate,
      startTime: startTime,
      endTime: currentTime
    });

    // 计算默认时长
    this.calculateDuration(startTime, currentTime);
  },

  // 检查是否有上次未完成的计时
  checkPendingTimer: function() {
    try {
      const pendingTimerData = wx.getStorageSync('pendingSleepTimer');
      if (pendingTimerData) {
        const { startTime, runningTime } = pendingTimerData;
        
        // 恢复计时器状态
        this.setData({
          timerRunning: true,
          timerStartTime: startTime,
          timerDisplay: this.formatTimeDisplay(runningTime)
        });
        
        // 重新开始计时
        this.startTimer(startTime);
      }
    } catch (e) {
      console.error('读取未完成计时器失败', e);
    }
  },

  // 表单验证
  checkFormValid: function() {
    let isValid = false;
    
    if (this.data.recordMode === 'timer') {
      // 计时器模式：如果计时已完成，则表单有效
      isValid = this.data.timerCompleted;
    } else {
      // 手动输入模式：开始时间和结束时间都有值，且计算的时长大于0
      isValid = this.data.startTime && this.data.endTime && parseFloat(this.data.duration) > 0;
    }
    
    this.setData({ isFormValid: isValid });
  },

  // 切换记录模式
  switchMode: function(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({
      recordMode: mode
    });
    
    // 如果切换到计时器模式，并且有正在运行的计时器，则继续运行
    if (mode === 'timer' && this.data.timerRunning) {
      // 计时器已经在运行，不需要额外操作
    } else if (mode === 'manual') {
      // 如果切换到手动模式，则确保时间已设置正确
      if (!this.data.startTime || !this.data.endTime) {
        this.setCurrentDateTime();
      }
    }
    
    this.checkFormValid();
  },

  // 切换计时器状态（开始/暂停/继续）
  toggleTimer: function() {
    if (this.data.timerRunning) {
      // 如果计时器正在运行，则停止计时
      this.stopTimer();
    } else if (this.data.timerPaused) {
      // 如果计时器已暂停，则继续计时
      this.resumeTimer();
    } else {
      // 否则开始新的计时
      const startTime = Date.now();
      this.setData({
        timerRunning: true,
        timerPaused: false,
        timerCompleted: false,
        timerStartTime: startTime,
        timerDisplay: '00:00:00'
      });
      
      // 保存开始时间到存储
      try {
        wx.setStorageSync('pendingSleepTimer', {
          startTime: startTime,
          runningTime: 0
        });
      } catch (e) {
        console.error('保存计时器开始时间失败', e);
      }
      
      this.startTimer(startTime);
    }
    
    this.checkFormValid();
  },

  // 开始计时
  startTimer: function(startTime) {
    // 清除可能存在的旧计时器
    if (this.data.timerInterval) {
      clearInterval(this.data.timerInterval);
    }
    
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsedTime = now - startTime;
      
      // 更新显示
      this.setData({
        timerDisplay: this.formatTimeDisplay(elapsedTime)
      });
      
      // 每分钟保存一次当前计时状态
      if (elapsedTime % 60000 < 1000) {
        try {
          wx.setStorageSync('pendingSleepTimer', {
            startTime: startTime,
            runningTime: elapsedTime
          });
        } catch (e) {
          console.error('保存计时器状态失败', e);
        }
      }
    }, 1000);
    
    this.setData({
      timerInterval: interval
    });
  },

  // 停止计时
  stopTimer: function() {
    if (this.data.timerInterval) {
      clearInterval(this.data.timerInterval);
    }
    
    const endTimeMs = Date.now();
    const elapsedTimeMs = endTimeMs - this.data.timerStartTime;
    
    // 计算睡眠时长（小时）
    const durationHours = (elapsedTimeMs / (1000 * 60 * 60)).toFixed(1);

    // **新增：格式化结束时间为 HH:MM**
    const endDateTime = new Date(endTimeMs);
    const endHours = endDateTime.getHours().toString().padStart(2, '0');
    const endMinutes = endDateTime.getMinutes().toString().padStart(2, '0');
    const endTimeFormatted = `${endHours}:${endMinutes}`;
    
    // **新增：获取结束日期 YYYY-MM-DD**
    const year = endDateTime.getFullYear();
    const month = (endDateTime.getMonth() + 1).toString().padStart(2, '0');
    const day = endDateTime.getDate().toString().padStart(2, '0');
    const endDateFormatted = `${year}-${month}-${day}`;

    this.setData({
      timerRunning: false,
      timerPaused: false,
      timerCompleted: true,
      // timerEndTime: endTimeMs, // 这个原始时间戳可能不再需要
      duration: durationHours,
      timerInterval: null,
      endTime: endTimeFormatted, // **保存格式化后的结束时间**
      date: endDateFormatted // **同时更新日期，以防跨天**
    });
    
    // 清除存储中的计时器数据
    try {
      wx.removeStorageSync('pendingSleepTimer');
    } catch (e) {
      console.error('清除计时器数据失败', e);
    }
    
    this.checkFormValid();
  },

  // 继续计时
  resumeTimer: function() {
    // 恢复计时，使用当前时间减去已经计时的时间作为新的开始时间
    const elapsedTime = this.parseTimeDisplay(this.data.timerDisplay);
    const startTime = Date.now() - elapsedTime;
    
    this.setData({
      timerRunning: true,
      timerPaused: false,
      timerStartTime: startTime
    });
    
    // 保存恢复的计时状态
    try {
      wx.setStorageSync('pendingSleepTimer', {
        startTime: startTime,
        runningTime: elapsedTime
      });
    } catch (e) {
      console.error('保存恢复计时状态失败', e);
    }
    
    this.startTimer(startTime);
  },
  
  // 从HH:MM:SS格式解析为毫秒
  parseTimeDisplay: function(timeDisplay) {
    const [hours, minutes, seconds] = timeDisplay.split(':').map(Number);
    return (hours * 3600 + minutes * 60 + seconds) * 1000;
  },

  // 重置计时器
  resetTimer: function() {
    if (this.data.timerInterval) {
      clearInterval(this.data.timerInterval);
    }
    
    this.setData({
      timerRunning: false,
      timerPaused: false,
      timerCompleted: false,
      timerDisplay: '00:00:00',
      timerStartTime: 0,
      timerEndTime: 0,
      timerInterval: null
    });
    
    // 清除存储中的计时器数据
    try {
      wx.removeStorageSync('pendingSleepTimer');
    } catch (e) {
      console.error('清除计时器数据失败', e);
    }
    
    this.checkFormValid();
  },

  // 格式化时间显示 (毫秒 -> HH:MM:SS)
  formatTimeDisplay: function(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  },

  // 开始时间变化
  bindStartTimeChange: function(e) {
    this.setData({
      startTime: e.detail.value
    });
    
    this.calculateDuration(e.detail.value, this.data.endTime);
    this.checkFormValid();
  },

  // 结束时间变化
  bindEndTimeChange: function(e) {
    this.setData({
      endTime: e.detail.value
    });
    
    this.calculateDuration(this.data.startTime, e.detail.value);
    this.checkFormValid();
  },

  // 设置结束时间为当前时间
  setEndTimeToNow: function() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const currentTime = `${hours}:${minutes}`;
    
    this.setData({
      endTime: currentTime
    });
    
    this.calculateDuration(this.data.startTime, currentTime);
    this.checkFormValid();
  },

  // 计算睡眠时长
  calculateDuration: function(startTime, endTime) {
    // 解析时间
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const [endHours, endMinutes] = endTime.split(':').map(Number);
    
    // 计算分钟差
    let diffMinutes = (endHours * 60 + endMinutes) - (startHours * 60 + startMinutes);
    
    // 如果是负数，说明跨天了
    if (diffMinutes < 0) {
      diffMinutes += 24 * 60;
    }
    
    // 转换为小时，保留一位小数
    const durationHours = (diffMinutes / 60).toFixed(1);
    
    this.setData({
      duration: durationHours
    });
  },

  // 选择睡眠质量
  selectQuality: function(e) {
    const quality = e.currentTarget.dataset.quality;
    this.setData({
      sleepQuality: quality
    });
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
      url: '../history/history?type=sleep'
    });
  },

  // 取消记录
  cancelRecord: function() {
    // 如果有正在运行的计时器，提示用户是否确认取消
    if (this.data.timerRunning) {
      wx.showModal({
        title: '确认取消',
        content: '计时器正在运行中，取消将丢失当前记录，确定要取消吗？',
        success: (res) => {
          if (res.confirm) {
            // 用户确认取消，清除计时器并返回
            if (this.data.timerInterval) {
              clearInterval(this.data.timerInterval);
            }
            try {
              wx.removeStorageSync('pendingSleepTimer');
            } catch (e) {
              console.error('清除计时器数据失败', e);
            }
            wx.navigateBack();
          }
        }
      });
    } else {
      wx.navigateBack();
    }
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
    
    let recordData = {};
    
    if (this.data.recordMode === 'timer') {
      // 计时器模式
      recordData = {
        startTime: new Date(this.data.timerStartTime).toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit', hour12: false}),
        endTime: new Date(this.data.timerEndTime).toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit', hour12: false}),
        duration: parseFloat(this.data.duration),
        quality: this.data.sleepQuality,
        notes: this.data.notes,
        date: this.data.date, // 使用页面中保存的日期
        time: this.data.time,
        createTime: new Date(), // 添加创建时间字段，用于云数据库排序
        timestamp: new Date().getTime(),
        dateTime: `${this.data.date} ${new Date(this.data.timerStartTime).toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit', hour12: false})}`
      };
    } else {
      // 手动输入模式
      recordData = {
        startTime: this.data.startTime,
        endTime: this.data.endTime,
        duration: parseFloat(this.data.duration),
        quality: this.data.sleepQuality,
        notes: this.data.notes,
        date: this.data.date, // 使用页面中保存的日期
        time: this.data.time,
        createTime: new Date(), // 添加创建时间字段，用于云数据库排序
        timestamp: new Date().getTime(),
        dateTime: `${this.data.date} ${this.data.startTime}`
      };
    }
    
    console.log('[Sleep Save] Data sent to addRecord:', JSON.stringify(recordData)); // 添加日志

    // 调用云函数保存记录到云数据库
    wx.cloud.callFunction({
      name: 'addRecord',
      data: {
        collectionName: 'sleep_records', // 指定要保存到的集合
        recordData: recordData        // 传递记录数据
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

  // 获取上次入睡时间
  getLastSleepTime: function() {
    // 实际应用中，这里应该从本地存储或服务器获取上次入睡时间
    // 这里仅为模拟
    const lastSleepTime = wx.getStorageSync('lastSleepTime') || '';
    
    if (lastSleepTime && this.data.sleepStatus === 'wake') {
      this.setData({
        lastSleepTime: lastSleepTime
      });
      
      // 计算睡眠时长
      this.calculateDuration(lastSleepTime, this.data.time);
    }
  },

  // 切换睡眠状态（入睡/醒来）
  switchStatus: function(e) {
    const status = e.currentTarget.dataset.status;
    this.setData({
      sleepStatus: status
    });
    
    // 如果切换到醒来状态，获取上次入睡时间
    if (status === 'wake') {
      this.getLastSleepTime();
    }
  },

  // 设置为当前时间
  setTimeToNow: function() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    this.setData({
      time: `${hours}:${minutes}`
    });
    
    // 如果是醒来状态，重新计算时长
    if (this.data.sleepStatus === 'wake' && this.data.lastSleepTime) {
      this.calculateDuration(this.data.lastSleepTime, `${hours}:${minutes}`);
    }
  },

  // 时间选择器变化
  timeChange: function(e) {
    this.setData({
      time: e.detail.value
    });
    
    // 如果是醒来状态，重新计算时长
    if (this.data.sleepStatus === 'wake' && this.data.lastSleepTime) {
      this.calculateDuration(this.data.lastSleepTime, e.detail.value);
    }
  },

  // 日期选择器变化
  bindDateChange: function(e) {
    this.setData({
      date: e.detail.value
    });
    this.calculateDuration(); // 日期改变也可能影响时长（跨天）
    this.checkFormValid();
  }
})