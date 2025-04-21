import { formatTime, formatDate } from '../../../utils/util.js'; // 假设有日期时间格式化工具

Page({
  /**
   * 页面的初始数据
   */
  data: {
    recordId: null, // 新增：用于存储当前记录的ID（如果是编辑模式）
    isEditMode: false, // 新增：标记是否为编辑/查看模式
    isViewMode: false, // 新增：标记是否为查看模式
    abnormalTypes: [
      { name: '发烧', value: 'fever', checked: false },
      { name: '呕吐', value: 'vomit', checked: false },
      { name: '腹泻', value: 'diarrhea', checked: false },
      { name: '皮疹', value: 'rash', checked: false },
      { name: '咳嗽', value: 'cough', checked: false },
      { name: '其它', value: 'other', checked: false } // '其它' 选项
    ],
    showOtherInput: false, // 是否显示'其它'输入框
    otherTypeDescription: '', // '其它'类型描述

    temperature: null, // 体温
    
    date: formatDate(new Date()), // 默认日期
    time: formatTime(new Date(), 'HH:mm'), // 默认时间

    photos: [], // 照片列表 (临时路径)
    maxPhotos: 9, // 最大照片数

    remarks: '', // 备注
    maxLength: 200, // 最大备注字数
    remainingChars: 200 // 剩余字数
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    console.log('Abnormal page onLoad, options:', options);
    if (options && options.id) {
      // 如果 options 中有 id，说明是编辑/查看模式
      const recordId = options.id;
      this.setData({ 
        recordId: recordId,
        isEditMode: true, 
        isViewMode: true // 默认进入查看模式
      });
      wx.setNavigationBarTitle({ title: '查看异常记录' }); // 初始标题为查看
      this.loadRecordDetail(recordId);
    } else {
      // 新增模式
      this.setData({ 
          isEditMode: false,
          isViewMode: false // 新增模式直接可编辑
      });
      wx.setNavigationBarTitle({ title: '记录异常情况' });
    }
  },

  /**
   * 新增：根据 ID 加载记录详情
   */
  loadRecordDetail(recordId) {
    wx.showLoading({ title: '加载中...' });
    wx.cloud.callFunction({
      name: 'getRecordById',
      data: { recordId: recordId }
    })
    .then(res => {
      console.log('调用 getRecordById 成功:', res);
      if (res.result && res.result.success && res.result.data) {
        const record = res.result.data;
        
        // 填充表单数据
        const [datePart, timePart] = (record.dateTime || '').split(' '); // 分割日期和时间
        const updatedTypes = this.data.abnormalTypes.map(item => {
          // 检查数据库中的 types 数组是否包含当前项的 name
          // 同时，如果 isOtherType 为 true 且当前项是 'other'，也标记为选中
          item.checked = (record.types && record.types.includes(item.name)) || 
                         (item.value === 'other' && record.isOtherType);
          return item;
        });
        const showOther = record.isOtherType || false;
        const remarks = record.remarks || '';
        const remaining = this.data.maxLength - remarks.length;

        this.setData({
          abnormalTypes: updatedTypes,
          showOtherInput: showOther,
          otherTypeDescription: record.otherTypeDescription || '',
          temperature: record.temperature,
          date: datePart || formatDate(new Date()), // 如果没有日期部分，用当前日期
          time: timePart || formatTime(new Date(), 'HH:mm'), // 如果没有时间部分，用当前时间
          photos: record.photos || [], // 注意：这里仍然是临时路径或fileId
          remarks: remarks,
          remainingChars: remaining >= 0 ? remaining : 0
        });

      } else {
        wx.showToast({ title: res.result.message || '加载记录失败', icon: 'none' });
        // 加载失败可能需要返回列表页
        setTimeout(() => wx.navigateBack(), 1500);
      }
    })
    .catch(err => {
      console.error('调用 getRecordById 失败:', err);
      wx.showToast({ title: '加载失败，请重试', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
    })
    .finally(() => {
      wx.hideLoading();
    });
  },

  // 处理异常类型选择变化
  onTypeChange(e) {
    const selectedValues = e.detail.value; // 用户选中的 value 数组
    const types = this.data.abnormalTypes.map(item => {
      item.checked = selectedValues.includes(item.value);
      return item;
    });
    
    // 检查 '其它' 是否被选中
    const otherSelected = selectedValues.includes('other');

    this.setData({
      abnormalTypes: types,
      showOtherInput: otherSelected
    });
  },

  // 处理'其它'类型输入
  onOtherInputChange(e) {
    this.setData({
      otherTypeDescription: e.detail.value
    });
  },

  // --- 体温相关 ---
  inputTemperature(e) {
    let value = e.detail.value;
    // 可以添加一些输入校验，例如限制小数点位数
    this.setData({ temperature: value });
  },
  adjustTemperature(e) {
    const action = e.currentTarget.dataset.action;
    let temp = parseFloat(this.data.temperature) || 36.5; // 如果为空或无效，默认为36.5
    if (action === 'increase') {
      temp = (temp + 0.1).toFixed(1);
    } else if (action === 'decrease') {
      temp = (temp - 0.1).toFixed(1);
      if (temp < 30) temp = 30; // 设置最低温度
    }
    this.setData({ temperature: temp });
  },

  // --- 日期时间相关 ---
  bindDateChange(e) {
    this.setData({ date: e.detail.value });
  },
  bindTimeChange(e) {
    this.setData({ time: e.detail.value });
  },
  setCurrentTime() {
    this.setData({
      date: formatDate(new Date()),
      time: formatTime(new Date(), 'HH:mm')
    });
  },

  // --- 照片相关 ---
  chooseImage() {
    if (this.data.isViewMode) return; // 查看模式下禁止选择图片
    const remainingCount = this.data.maxPhotos - this.data.photos.length;
    if (remainingCount <= 0) return;
    wx.chooseMedia({
      count: remainingCount,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFiles = res.tempFiles.map(file => file.tempFilePath);
        this.setData({
          photos: [...this.data.photos, ...tempFiles]
        });
      }
    })
  },
  previewImage(e) {
    const current = e.currentTarget.dataset.index;
    wx.previewImage({
      current: this.data.photos[current],
      urls: this.data.photos
    });
  },
  deleteImage(e) {
    if (this.data.isViewMode) return; // 查看模式下禁止删除图片
    const index = e.currentTarget.dataset.index;
    const newPhotos = [...this.data.photos];
    newPhotos.splice(index, 1);
    this.setData({ photos: newPhotos });
  },

  // --- 备注相关 ---
  inputRemarks(e) {
    const value = e.detail.value;
    const remaining = this.data.maxLength - value.length;
    this.setData({
      remarks: value,
      remainingChars: remaining >= 0 ? remaining : 0 
    });
  },

  // --- 保存记录 (修改为调用云函数) ---
  saveRecord() {
    // 1. 数据校验
    const selectedTypes = this.data.abnormalTypes.filter(item => item.checked);
    const selectedTypeValues = selectedTypes.map(item => item.value);
    const isOtherChecked = selectedTypeValues.includes('other');
    const otherDescription = this.data.otherTypeDescription.trim();

    if (selectedTypes.length === 0) {
      wx.showToast({ title: '请至少选择一种异常类型', icon: 'none' });
      return;
    }
    if (isOtherChecked && !otherDescription) {
      wx.showToast({ title: '请填写具体的其它异常情况', icon: 'none' });
      return;
    }

    // 2. 收集数据 (保持不变，暂时忽略照片上传)
    const recordData = {
      recordId: Date.now().toString() + Math.random().toString(36).substring(2, 8),
      timestamp: Date.now(),
      dateTime: `${this.data.date} ${this.data.time}`,
      types: selectedTypes.filter(t => t.value !== 'other').map(t => t.name),
      isOtherType: isOtherChecked,
      otherTypeDescription: isOtherChecked ? otherDescription : '',
      temperature: this.data.temperature ? parseFloat(this.data.temperature) : null,
      photos: this.data.photos, // 暂时传递临时路径
      remarks: this.data.remarks.trim()
    };

    // 3. 显示加载提示
    wx.showLoading({ title: '正在保存...' });

    // 4. 调用云函数 addRecord
    wx.cloud.callFunction({
      name: 'addRecord', // 要调用的云函数名称
      data: {
        recordData: recordData // 将收集的数据作为参数传递给云函数
      },
      success: res => {
        console.log('调用云函数 addRecord 成功:', res);
        if (res.result && res.result.success) {
          // 云函数返回成功
          wx.showToast({ title: '保存成功' });
          // 延迟返回上一页
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
        } else {
          // 云函数返回失败（业务逻辑失败）
          wx.showToast({ title: res.result.message || '保存失败，请重试', icon: 'none' });
        }
      },
      fail: err => {
        // 调用云函数本身失败（网络错误等）
        console.error('调用云函数 addRecord 失败:', err);
        wx.showToast({ title: '保存失败，请检查网络', icon: 'none' });
      },
      complete: () => {
        // 无论成功失败，都隐藏加载提示
        wx.hideLoading();
      }
    });
  },

  // --- 取消记录 ---
  cancelRecord() {
    wx.navigateBack();
  },

  /**
   * 新增：处理点击编辑按钮
   */
  handleEdit() {
    console.log('Switching to Edit Mode');
    this.setData({ isViewMode: false });
    wx.setNavigationBarTitle({ title: '编辑异常记录' }); // 修改标题
  }
}) 