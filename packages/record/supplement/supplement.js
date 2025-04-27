// pages/record/supplement/supplement.js
const app = getApp();

Page({
  /**
   * 页面的初始数据
   */
  data: {
    // 补给品类型选项
    typeArray: ['AD', 'D3', '益生菌', '铁剂', '药物', '自定义'],
    typeIndex: 0,
    customType: '', // 自定义类型
    showCustomType: false, // 是否显示自定义类型输入框
    customTypes: [], // 用户自定义的类型列表

    // 数量相关
    amount: 1,
    unitArray: ['g', 'ml', '次', '片', '袋', '勺'],
    unitIndex: 0,

    // 日期和时间
    currentDate: '',
    currentTime: '',

    // 备注
    notes: '',
    maxNoteLength: 200,
    
    // 表单是否有效
    isFormValid: false,
    
    // 轮换助手相关
    rotationEnabled: false,        // 轮换助手是否启用
    recommendationType: ''         // 建议的补剂类型
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    // 设置当前日期和时间
    this.setCurrentDateTime();
    
    // 加载用户自定义类型和上次选择的类型
    this.loadUserCustomTypes();
    this.loadLastSelectedType();
    
    // 如果传入了记录ID，则获取记录详情
    if (options && options.id) {
      this.loadRecordDetail(options.id);
    } else {
      // 初始化表单有效性检查
      this.checkFormValidity();
    }
    
    // 加载轮换助手状态
    this.setData({
      rotationEnabled: wx.getStorageSync('adD3RotationEnabled') || false
    });
  },

  /**
   * 加载用户自定义类型
   */
  loadUserCustomTypes: function() {
    const customTypes = wx.getStorageSync('userCustomSupplementTypes') || [];
    this.setData({
      customTypes: customTypes
    });
    
    // 将自定义类型添加到类型数组中
    if (customTypes.length > 0) {
      let allTypes = this.data.typeArray.slice();
      customTypes.forEach(type => {
        if (!allTypes.includes(type)) {
          allTypes.push(type);
        }
      });
      this.setData({
        typeArray: allTypes
      });
    }
  },

  /**
   * 加载上次选择的类型
   */
  loadLastSelectedType: function() {
    const lastTypeIndex = wx.getStorageSync('lastSupplementTypeIndex');
    if (lastTypeIndex !== '' && lastTypeIndex < this.data.typeArray.length) {
      const showCustom = (this.data.typeArray[lastTypeIndex] === '自定义');
      this.setData({
        typeIndex: lastTypeIndex,
        showCustomType: showCustom
      });
    }
  },

  /**
   * 设置当前日期和时间
   */
  setCurrentDateTime: function () {
    const now = new Date();
    
    // 格式化日期：yyyy-MM-dd
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const formattedDate = `${year}-${month}-${day}`;
    
    // 格式化时间：HH:mm
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const formattedTime = `${hours}:${minutes}`;
    
    this.setData({
      currentDate: formattedDate,
      currentTime: formattedTime
    });
  },

  /**
   * 加载记录详情
   */
  loadRecordDetail: function (id) {
    // TODO: 从数据库或缓存中获取记录详情
    // 这里仅作为示例，实际应用中需要实现具体的数据获取逻辑
    console.log('加载记录ID：', id);
    
    // 加载成功后更新表单有效性检查
    this.checkFormValidity();
  },

  /**
   * 类型选择改变
   */
  bindTypeChange: function (e) {
    const index = e.detail.value;
    const selectedType = this.data.typeArray[index];
    const showCustom = (selectedType === '自定义');
    
    this.setData({
      typeIndex: index,
      showCustomType: showCustom
    });
    
    // 保存上次选择的类型索引
    wx.setStorageSync('lastSupplementTypeIndex', index);
    
    this.checkFormValidity();
    
    // 如果选择的是AD或D3，并且轮换助手开启，需要触发轮换助手的刷新
    if ((selectedType === 'AD' || selectedType === 'D3') && this.data.rotationEnabled) {
      // 等待DOM更新后再获取组件实例
      setTimeout(() => {
        const rotationAssistant = this.selectComponent('#rotationAssistant');
        if (rotationAssistant) {
          rotationAssistant.refresh();
        }
      }, 100);
      
      // 如果选择符合推荐，可以给用户一个积极的反馈
      if (selectedType === this.data.recommendationType) {
        wx.vibrateShort(); // 轻微震动反馈
        wx.showToast({
          title: '已选择推荐补剂',
          icon: 'success',
          duration: 1000
        });
      }
    }
  },

  /**
   * 自定义类型输入
   */
  onCustomTypeInput: function (e) {
    this.setData({
      customType: e.detail.value
    });
    
    this.checkFormValidity();
  },

  /**
   * 保存自定义类型
   */
  saveCustomType: function() {
    if (!this.data.customType.trim()) return;
    
    // 获取现有的自定义类型列表
    let customTypes = wx.getStorageSync('userCustomSupplementTypes') || [];
    
    // 如果不存在，则添加到列表中
    if (!customTypes.includes(this.data.customType)) {
      customTypes.push(this.data.customType);
      wx.setStorageSync('userCustomSupplementTypes', customTypes);
      
      // 添加到下拉选项中
      let allTypes = this.data.typeArray.slice();
      allTypes.push(this.data.customType);
      this.setData({
        typeArray: allTypes,
        customTypes: customTypes
      });
    }
  },

  /**
   * 数量减少
   */
  decreaseAmount: function () {
    let currentAmount = parseFloat(this.data.amount) || 0;
    if (currentAmount > 0) {
      // 如果大于等于1，则减1；如果小于1，则减0.1
      const decrease = currentAmount >= 1 ? 1 : 0.1;
      currentAmount = Math.max(0, (currentAmount - decrease).toFixed(1));
      // 转换回数字类型，去除无用的0
      currentAmount = parseFloat(currentAmount);
      this.setData({
        amount: currentAmount
      });
    }
  },

  /**
   * 数量增加
   */
  increaseAmount: function () {
    let currentAmount = parseFloat(this.data.amount) || 0;
    // 如果小于1，则增加0.1；如果大于等于1，则增加1
    const increase = currentAmount < 1 ? 0.1 : 1;
    currentAmount = (currentAmount + increase).toFixed(1);
    // 转换回数字类型，去除无用的0
    currentAmount = parseFloat(currentAmount);
    this.setData({
      amount: currentAmount
    });
  },

  /**
   * 数量输入变化
   */
  onAmountInput: function (e) {
    let value = e.detail.value;
    
    // 允许空值和小数点
    if (value === '' || value === '.') {
      this.setData({
        amount: value
      });
      return;
    }
    
    // 处理有效数字输入
    if (!isNaN(value)) {
      // 保留一位小数
      if (value.indexOf('.') !== -1) {
        // 确保只有一个小数点
        const parts = value.split('.');
        if (parts.length > 2) {
          value = parts[0] + '.' + parts.slice(1).join('');
        }
      }
      
      this.setData({
        amount: value
      });
    }
  },

  /**
   * 单位选择变化
   */
  bindUnitChange: function (e) {
    this.setData({
      unitIndex: e.detail.value
    });
  },

  /**
   * 日期选择变化
   */
  bindDateChange: function (e) {
    this.setData({
      currentDate: e.detail.value
    });
  },

  /**
   * 时间选择变化
   */
  bindTimeChange: function (e) {
    this.setData({
      currentTime: e.detail.value
    });
  },

  /**
   * 点击"现在"按钮
   */
  onNowButtonTap: function () {
    this.setCurrentDateTime();
  },

  /**
   * 备注输入
   */
  onNotesInput: function (e) {
    const value = e.detail.value;
    this.setData({
      notes: value
    });
  },

  /**
   * 检查表单有效性
   */
  checkFormValidity: function () {
    let isValid = true;
    
    // 如果选择了"自定义"类型，自定义类型不能为空
    if (this.data.typeArray[this.data.typeIndex] === '自定义' && !this.data.customType.trim()) {
      isValid = false;
    }
    
    // 检查数量是否有效（不为空，且是有效数字）
    const amount = this.data.amount;
    if (amount === '' || amount === '.' || isNaN(parseFloat(amount))) {
      isValid = false;
    }
    
    this.setData({
      isFormValid: isValid
    });
  },

  /**
   * 取消按钮事件
   */
  onCancel: function () {
    wx.navigateBack();
  },

  /**
   * 轮换助手状态变化事件
   */
  onRotationStatusChange: function (e) {
    const { enabled } = e.detail;
    this.setData({ rotationEnabled: enabled });
  },
  
  /**
   * 轮换助手推荐变化事件
   */
  onRecommendationChange: function (e) {
    const { recommendation } = e.detail;
    this.setData({ recommendationType: recommendation });
    
    // 如果启用了轮换助手，并且有推荐类型，尝试在类型选择列表中找到对应类型
    if (this.data.rotationEnabled && recommendation) {
      const typeIndex = this.data.typeArray.findIndex(type => type === recommendation);
      if (typeIndex !== -1) {
        // 不自动选择，只高亮显示推荐类型，让用户自己决定是否选择
        // 但可以添加一个帮助提示
        wx.showToast({
          title: `推荐服用${recommendation}`,
          icon: 'none',
          duration: 2000
        });
      }
    }
  },
  
  /**
   * 选择推荐的补剂类型
   * 可以被轮换助手组件调用，也可以添加一个按钮供用户点击
   */
  selectRecommendedType: function () {
    if (!this.data.rotationEnabled || !this.data.recommendationType) {
      return;
    }
    
    const typeIndex = this.data.typeArray.findIndex(type => type === this.data.recommendationType);
    if (typeIndex !== -1 && typeIndex !== this.data.typeIndex) {
      this.setData({ typeIndex: typeIndex });
      
      // 保存上次选择的类型索引
      wx.setStorageSync('lastSupplementTypeIndex', typeIndex);
      
      // 提示用户已自动选择
      wx.showToast({
        title: `已选择${this.data.recommendationType}`,
        icon: 'success',
        duration: 1500
      });
      
      this.checkFormValidity();
    }
  },
  
  /**
   * 响应轮换助手的快速选择事件
   */
  onQuickSelectType: function (e) {
    // 直接调用选择推荐类型的方法
    this.selectRecommendedType();
  },
  
  /**
   * 在保存记录前执行
   */
  beforeSave: function () {
    // 如果是AD或D3记录，保存后需要刷新轮换助手
    const selectedType = this.data.typeArray[this.data.typeIndex];
    if ((selectedType === 'AD' || selectedType === 'D3') && this.data.rotationEnabled) {
      setTimeout(() => {
        const rotationAssistant = this.selectComponent('#rotationAssistant');
        if (rotationAssistant) {
          rotationAssistant.refresh();
        }
      }, 100);
    }
  },

  /**
   * 保存按钮事件
   */
  onSave: function () {
    if (!this.data.isFormValid) {
      wx.showToast({
        title: '请填写完整信息',
        icon: 'none'
      });
      return;
    }
    
    // 执行保存前的处理
    this.beforeSave();
    
    wx.showLoading({ title: '保存中...' });
    
    // 如果是自定义类型，则保存到自定义类型列表
    if (this.data.typeArray[this.data.typeIndex] === '自定义' && this.data.customType.trim()) {
      this.saveCustomType();
    }
    
    // 格式化数量，确保是有效数字
    let amount = parseFloat(this.data.amount);
    if (isNaN(amount)) amount = 0;
    
    // 构建记录数据
    const recordData = {
      type: this.data.typeArray[this.data.typeIndex] === '自定义' ? this.data.customType : this.data.typeArray[this.data.typeIndex],
      amount: amount,
      unit: this.data.unitArray[this.data.unitIndex],
      date: this.data.currentDate,
      time: this.data.currentTime,
      notes: this.data.notes,
      dateTime: `${this.data.currentDate} ${this.data.currentTime}`,
      recordType: 'supplement', // 记录类型：补给品
      createTime: new Date(), // 添加创建时间字段，用于云数据库排序
      timestamp: new Date().getTime()
    };
    
    console.log('[Supplement Save] Data sent to addRecord:', JSON.stringify(recordData)); // 添加日志

    // 调用云函数保存记录到云数据库
    wx.cloud.callFunction({
      name: 'addRecord',
      data: {
        collectionName: 'supplement_records', // 指定要保存到的集合
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
      wx.hideLoading();
    });
  },
  
  /**
   * 保存记录到本地存储 (已弃用，改为云存储)
   */
  /* saveRecordToStorage: function(recordData) {
    // 获取现有的补剂记录
    let supplementRecords = wx.getStorageSync('supplementRecords') || [];
    
    // 添加新记录
    supplementRecords.push(recordData);
    
    // 保存回本地存储
    wx.setStorageSync('supplementRecords', supplementRecords);
    
    console.log('补剂记录已保存到本地存储', recordData);
  } */
}); 