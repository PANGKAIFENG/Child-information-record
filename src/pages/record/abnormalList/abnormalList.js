Page({
  /**
   * 页面的初始数据
   */
  data: {
    recordList: [] // 异常记录列表
  },

  /**
   * 生命周期函数--监听页面显示
   * 每次进入页面都尝试加载数据
   */
  onShow() {
    console.log('Abnormal list page onShow: Loading records...');
    this.loadRecords();
  },

  /**
   * 加载记录列表 (修改为调用云函数)
   */
  loadRecords() {
    // 显示加载提示
    wx.showLoading({ title: '加载中...' });

    // 调用 getRecords 云函数
    wx.cloud.callFunction({
      name: 'getRecords',
      // data: { } // 如果需要传递分页或筛选参数，在这里添加
    })
    .then(res => {
      console.log('调用云函数 getRecords 成功:', res);
      if (res.result && res.result.success && res.result.data) {
        // 获取数据成功
        this.setData({ recordList: res.result.data });
        console.log('Real records loaded:', this.data.recordList.length);
      } else {
        // 获取失败或无数据
        console.warn('获取记录失败或无数据:', res.result);
        this.setData({ recordList: [] }); // 清空列表
        // 可以根据需要显示提示，例如:
        if (res.result && !res.result.success) {
           wx.showToast({ title: res.result.message || '加载失败', icon: 'none' });
        }
      }
    })
    .catch(err => {
      // 调用云函数本身失败
      console.error('调用云函数 getRecords 失败:', err);
      this.setData({ recordList: [] }); // 清空列表
      wx.showToast({ title: '加载失败，请检查网络', icon: 'none' });
    })
    .finally(() => {
      // 无论成功失败，都隐藏加载提示
      wx.hideLoading();
      // 停止下拉刷新动画 (如果在下拉刷新时调用)
      wx.stopPullDownRefresh(); 
    });

    // --- 移除模拟数据加载 ---
    /*
    const mockData = [...];
    setTimeout(() => {
      this.setData({ recordList: mockData });
      console.log('Mock records loaded.', this.data.recordList);
    }, 500);
    */
  },

  /**
   * 跳转到记录详情页 (修改为实际跳转)
   */
  goToDetail(e) {
    const recordId = e.currentTarget.dataset.id;
    console.log('Navigate to detail for recordId:', recordId);

    // --- 取消注释并确认路径 ---
    wx.navigateTo({
      url: `/src/pages/record/abnormal/abnormal?id=${recordId}` // 传递ID
    });
    
    // --- 移除或注释掉临时提示 ---
    // wx.showToast({ title: `准备查看记录 ${recordId}`, icon: 'none' });
  },

  /**
   * 新增：跳转到新增记录页面
   */
  goToAddRecord() {
    console.log('Navigate to add abnormal record page.');
    wx.navigateTo({
      url: '/src/pages/record/abnormal/abnormal' 
    });
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {},

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {},

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {},

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    console.log('Pull down to refresh...');
    this.loadRecords(); // 调用修改后的加载函数
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {
    console.log('Reach bottom, load more...');
    // --- 未来实现分页加载更多逻辑 ---
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {}
}) 