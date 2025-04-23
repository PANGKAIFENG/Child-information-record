// 大小便记录页面
Page({
  data: {
    excretionType: 'pee', // 默认是小便
    date: '', // 日期
    time: '',  // 时间
    
    // Picker 数据
    consistencyOptions: ['正常', '稀便', '硬便'],
    consistencyIndex: 0, // 默认选中'正常'
    amountOptions: ['少', '一般', '多'],
    amountIndex: 1, // 默认选中'一般'
    
    note: '', // 备注
    photos: [], // 照片
    maxPhotos: 9 // 最多上传照片数
  },

  onLoad: function() {
    // 设置当前日期和时间
    this.setCurrentDateTime();
  },

  // 切换排泄类型
  switchType: function(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({
      excretionType: type
    });
  },

  // 设置当前日期和时间
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

  // 日期变化处理
  bindDateChange: function(e) {
    this.setData({
      date: e.detail.value
    });
  },

  // 时间变化处理
  bindTimeChange: function(e) {
    this.setData({
      time: e.detail.value
    });
  },

  // 新增: "现在" 按钮事件
  setCurrentTime: function() {
    this.setCurrentDateTime();
  },

  // 修改: Picker - 形状选择
  bindConsistencyChange: function(e) {
    console.log('picker发送选择改变，携带值为', e.detail.value)
    this.setData({
      consistencyIndex: e.detail.value
    });
  },
  
  // 修改: Picker - 量选择
  bindAmountChange: function(e) {
    console.log('picker发送选择改变，携带值为', e.detail.value)
    this.setData({
      amountIndex: e.detail.value
    });
  },

  // 输入备注
  noteInput: function(e) {
    this.setData({
      note: e.detail.value
    });
  },

  // 选择图片
  chooseImage: function() {
    const that = this;
    const remainingCount = this.data.maxPhotos - this.data.photos.length;

    if (remainingCount <= 0) {
      wx.showToast({
        title: '最多上传' + this.data.maxPhotos + '张图片',
        icon: 'none'
      });
      return;
    }

    wx.chooseImage({
      count: remainingCount,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: function(res) {
        that.setData({
          photos: that.data.photos.concat(res.tempFilePaths)
        });
      }
    });
  },

  // 预览图片
  previewImage: function(e) {
    const index = e.currentTarget.dataset.index;
    const photos = this.data.photos;

    wx.previewImage({
      current: photos[index],
      urls: photos
    });
  },

  // 删除照片
  deletePhoto: function(e) {
    const index = e.currentTarget.dataset.index;
    const photos = this.data.photos;
    photos.splice(index, 1);
    this.setData({
      photos: photos
    });
  },

  // 查看历史记录
  showHistory: function() {
    wx.navigateTo({
      url: '/pages/record/excretion/history/history'
    });
  },

  // 取消记录
  cancel: function() {
    wx.navigateBack();
  },

  // 保存记录
  saveRecord: function() {
    wx.showLoading({ title: '保存中...' });

    // 组装记录数据
    let excretionTypeChinese = '未知';
    if (this.data.excretionType === 'pee') {
        excretionTypeChinese = '小便';
    } else if (this.data.excretionType === 'poop') {
        excretionTypeChinese = '大便';
    } else {
        // 保留原始值以防万一
        excretionTypeChinese = this.data.excretionType;
    }
    const recordData = {
      excretionType: excretionTypeChinese,
      consistency: this.data.excretionType === 'poop' ? this.data.consistencyOptions[this.data.consistencyIndex] : null,
      amount: this.data.excretionType === 'poop' ? this.data.amountOptions[this.data.amountIndex] : null,
      dateTime: `${this.data.date} ${this.data.time}`,
      note: this.data.note.trim(),
      photos: [],
    };

    console.log('[Excretion Save] Data sent to addRecord:', JSON.stringify(recordData));

    // 处理照片上传
    const uploadTasks = [];
    const photoFileIDs = [];
    const photos = this.data.photos || [];

    // 如果有照片需要上传
    if (photos.length > 0) {
      for (let i = 0; i < photos.length; i++) {
        const filePath = photos[i];
        // 如果照片路径是临时路径，需要上传
        if (filePath.startsWith('http://tmp/') || filePath.startsWith('wxfile://')) {
          const timestamp = Date.now();
          const cloudPath = `excretion_photos/${timestamp}_${i}.jpg`;
          
          // 添加上传任务
          const promise = wx.cloud.uploadFile({
            cloudPath: cloudPath,
            filePath: filePath,
          }).then(res => {
            photoFileIDs.push(res.fileID);
            console.log('照片上传成功:', res.fileID);
          }).catch(err => {
            console.error('照片上传失败:', err);
          });
          
          uploadTasks.push(promise);
        } else {
          // 如果已经是云存储路径，直接添加
          if (filePath.includes('cloud://')) {
            photoFileIDs.push(filePath);
          }
        }
      }
    }

    // 等待所有照片上传完成，然后保存记录
    Promise.all(uploadTasks).then(() => {
      // 更新记录中的照片字段
      recordData.photos = photoFileIDs;
      
      // 调用云函数保存记录
      return wx.cloud.callFunction({
        name: 'addRecord',
        data: {
          collectionName: 'excretion_records',
          recordData: recordData
        }
      });
    }).then(res => {
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
    }).catch(err => {
      console.error('保存记录失败:', err);
      wx.showToast({
        title: '保存失败，请检查网络',
        icon: 'none'
      });
    }).finally(() => {
      wx.hideLoading();
    });
  },
  
  // 保存记录到本地存储 (已弃用，改为云存储)
  /* saveRecordToStorage: function(recordData) {
    // 获取现有的大小便记录
    let excretionRecords = wx.getStorageSync('excretionRecords') || [];
    
    // 添加新记录
    excretionRecords.unshift(recordData);
    
    // 保存回本地存储
    wx.setStorageSync('excretionRecords', excretionRecords);
    
    console.log('大小便记录已保存到本地存储', recordData);
  } */
}) 