// import { formatTime, formatDate } from '../utils/util.js'; // 注释掉旧的导入
const app = getApp(); // 获取 App 实例
const { formatTime, formatDate } = app.globalData.utils; // 从 globalData 获取工具函数

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
    remainingChars: 200, // 剩余字数
    needRefresh: false // 新增：标记是否需要刷新列表
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
        
        // 检查记录数据的有效性
        if (!record.dateTime || ((!record.types || record.types.length === 0) && !record.isOtherType)) {
          console.error('记录数据无效:', record);
          wx.showToast({ 
            title: '记录数据无效或已损坏', 
            icon: 'none' 
          });
          // 延迟返回列表页
          setTimeout(() => wx.navigateBack(), 1500);
          return;
        }
        
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
          temperature: record.temperature || '',  // 确保空值为空字符串而不是null
          date: datePart || formatDate(new Date()), // 如果没有日期部分，用当前日期
          time: timePart || formatTime(new Date(), 'HH:mm'), // 如果没有时间部分，用当前时间
          photos: record.photos || [], // 注意：这里仍然是临时路径或fileId
          remarks: remarks,
          remainingChars: remaining >= 0 ? remaining : 0,
          needRefresh: true // 设置需要刷新列表
        });
        
        console.log('已加载记录详情:', this.data);

      } else {
        // 处理API返回的错误
        const errorMsg = res.result?.message || '未找到指定记录';
        console.error('加载记录详情失败:', errorMsg);
        wx.showToast({ 
          title: errorMsg, 
          icon: 'none' 
        });
        // 加载失败返回列表页
        setTimeout(() => wx.navigateBack(), 1500);
      }
    })
    .catch(err => {
      // 处理网络或其他错误
      console.error('调用 getRecordById 失败:', err);
      wx.showToast({ 
        title: '加载失败，请检查网络连接', 
        icon: 'none' 
      });
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

    // 2. 收集数据
    // 移除自动生成 recordId 和 timestamp，由云函数处理
    const recordData = {
      // recordId: Date.now().toString() + Math.random().toString(36).substring(2, 8),
      // timestamp: Date.now(), 
      dateTime: `${this.data.date} ${this.data.time}`,
      types: selectedTypes.filter(t => t.value !== 'other').map(t => t.name),
      isOtherType: isOtherChecked,
      otherTypeDescription: isOtherChecked ? otherDescription : '',
      temperature: this.data.temperature ? parseFloat(this.data.temperature) : null,
      photos: this.data.photos, // 暂时传递临时路径或 fileIDs
      remarks: this.data.remarks.trim()
    };

    // 3. 显示加载提示
    wx.showLoading({ title: '正在保存...' });

    // 4. 判断是新增还是更新，调用不同的云函数
    let cloudFunctionName = '';
    let requestData = {};

    if (this.data.recordId) {
      // --- 更新模式 ---
      cloudFunctionName = 'updateRecord';
      requestData = {
        collectionName: 'abnormal_records', // 指定集合
        recordId: this.data.recordId,      // 要更新的记录 ID
        recordData: recordData             // 更新的数据 (不包含 recordId, timestamp)
      };
      console.log('[saveRecord] Calling updateRecord with data:', requestData);
    } else {
      // --- 新增模式 ---
      cloudFunctionName = 'addRecord';
      // addRecord 云函数内部应自动添加 recordId, timestamp, createTime, _openid
      requestData = {
        collectionName: 'abnormal_records', // 指定集合
        recordData: recordData             // 新增的数据
      };
      console.log('[saveRecord] Calling addRecord with data:', requestData);
    }

    wx.cloud.callFunction({
      name: cloudFunctionName,
      data: requestData,
      success: res => {
        console.log(`调用云函数 ${cloudFunctionName} 成功:`, res);
        if (res.result && res.result.success) {
          const successMsg = this.data.recordId ? '更新成功' : '保存成功';
          wx.showToast({ title: successMsg, icon: 'success' });
          
          // 设置刷新标记，确保列表页能看到更新
          this.setData({ needRefresh: true });
          
          // 延迟返回上一页
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
        } else {
          // 云函数返回失败（业务逻辑失败）
          const errorMsg = this.data.recordId ? '更新失败' : '保存失败';
          wx.showToast({ title: res.result?.message || `${errorMsg}，请重试`, icon: 'none' });
        }
      },
      fail: err => {
        // 调用云函数本身失败（网络错误等）
        console.error(`调用云函数 ${cloudFunctionName} 失败:`, err);
        const errorMsg = this.data.recordId ? '更新失败' : '保存失败';
        wx.showToast({ title: `${errorMsg}，请检查网络`, icon: 'none' });
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
  },

  /**
   * 新增：处理点击删除按钮
   */
  handleDelete() {
    console.log('Deleting record:', this.data.recordId);
    
    // 显示确认对话框
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条异常记录吗？删除后将无法恢复。',
      confirmColor: '#e64340', // 红色确认按钮
      success: (res) => {
        if (res.confirm) {
          // 用户点击了确认按钮
          this.deleteRecord();
        }
      }
    });
  },
  
  /**
   * 执行删除记录操作
   */
  deleteRecord() {
    // 显示加载提示
    wx.showLoading({ title: '正在删除...' });
    
    // 调用云函数删除记录
    wx.cloud.callFunction({
      name: 'deleteRecord',
      data: {
        recordId: this.data.recordId,
        collection: 'abnormal_records' // 指定集合名称
      }
    })
    .then(res => {
      console.log('调用云函数 deleteRecord 成功:', res);
      
      // 无论成功失败，都先隐藏加载提示
      wx.hideLoading();
      
      if (res.result && res.result.success) {
        // 删除成功
        wx.showToast({ 
          title: '删除成功',
          icon: 'success',
          mask: true // 防止用户点击穿透
        });
        
        // 设置标记，表示需要刷新列表
        this.setData({ needRefresh: true });
        
        // 延迟返回列表页
        setTimeout(() => {
          wx.navigateBack({
            success: () => {
              console.log('成功返回列表页，将触发刷新');
            }
          });
        }, 1000);
      } else {
        // 删除失败
        console.error('删除失败:', res.result);
        
        // 特殊处理"记录不存在"的情况
        if (res.result && res.result.message === '未找到指定记录') {
          wx.showModal({
            title: '记录已不存在',
            content: '此记录可能已被删除，是否返回列表？',
            confirmText: '返回列表',
            cancelText: '留在当前页',
            success: (modalRes) => {
              if (modalRes.confirm) {
                // 用户选择返回列表
                this.setData({ needRefresh: true });
                wx.navigateBack();
              }
            }
          });
        } else {
          // 其他错误情况
          wx.showToast({ 
            title: res.result?.message || '删除失败，请重试', 
            icon: 'none',
            duration: 2000
          });
        }
      }
    })
    .catch(err => {
      // 确保在出错时也隐藏loading
      wx.hideLoading();
      
      console.error('调用云函数 deleteRecord 失败:', err);
      wx.showToast({ 
        title: '删除失败，请检查网络', 
        icon: 'none',
        duration: 2000
      });
    });
  }
}) 