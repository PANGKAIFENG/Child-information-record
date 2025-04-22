Page({
  /**
   * 页面的初始数据
   */
  data: {
    recordList: [], // 异常记录列表
    isLoggedIn: false // 用户登录状态
  },

  /**
   * 生命周期函数--监听页面显示
   * 每次进入页面都尝试加载数据
   */
  onShow() {
    console.log('Abnormal list page onShow: Loading records...');
    // 检查并更新登录状态
    const isLoggedIn = wx.getStorageSync('isLoggedIn') || false;
    this.setData({ isLoggedIn });
    
    // 检查是否从deleteRecord后返回（来自详情页的删除操作）
    const pages = getCurrentPages();
    if (pages.length > 1) {
      const prevPage = pages[pages.length - 2]; // 获取上一页面
      if (prevPage && prevPage.data && prevPage.data.needRefresh) {
        console.log('检测到needRefresh标记，强制刷新列表');
        prevPage.setData({ needRefresh: false }); // 重置标记
        
        // 直接加载记录，不进行清理
        this.loadRecords();
        return;
      }
    }
    
    // 正常的页面显示逻辑
    if (isLoggedIn) {
      // 如果用户已登录，自动清理无效数据
      this.autoCleanInvalidRecords();
    } else {
      // 用户未登录，直接加载记录（显示空列表）
      this.loadRecords();
    }
  },

  /**
   * 加载记录列表 (修改为调用云函数)
   */
  loadRecords() {
    // 检查用户是否登录
    if (!this.data.isLoggedIn) {
      console.log('用户未登录，显示空列表');
      this.setData({ recordList: [] });
      return;
    }
    
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
        try {
          // 获取数据成功
          // 恢复严格的前端过滤逻辑
          const validRecords = res.result.data.filter(record => {
            try {
              // 更安全的有效性检查
              const isValid = 
                record && 
                typeof record === 'object' &&
                record._id && 
                record.recordId &&
                typeof record.dateTime === 'string' && 
                // 类型检查 - 至少有一个类型或标记为"其它"
                (
                  (Array.isArray(record.types) && record.types.length > 0) || 
                  record.isOtherType === true
                );
              
              if (!isValid) {
                console.log('前端过滤掉无效记录:', record);
                
                // 只清理有recordId的记录，避免过多无效请求
                if (record && record.recordId) {
                  this.directCleanInvalidRecord(record);
                }
              }
              return isValid;
            } catch (err) {
              console.error('过滤记录时出错:', err, record);
              return false;
            }
          });
          
          // 对有效记录进行排序（按日期时间降序）
          validRecords.sort((a, b) => {
            // 尝试解析日期时间
            const getTimestamp = (record) => {
              try {
                // 优先使用timestamp字段
                if (record.timestamp) return record.timestamp;
                
                // 否则尝试解析dateTime字段
                if (record.dateTime) {
                  const dt = new Date(record.dateTime.replace(' ', 'T')); // 标准化时间格式
                  return dt.getTime();
                }
                
                // 最后使用ID (可能包含时间戳)
                return 0; // 默认最低优先级
              } catch (e) {
                return 0; // 解析错误时默认最低优先级
              }
            };
            
            // 降序排列（最新的在前）
            return getTimestamp(b) - getTimestamp(a);
          });
          
          this.setData({ recordList: validRecords });
          console.log('有效记录数量:', validRecords.length, '/ 总记录数:', res.result.data.length);
          
          // 如果过滤掉了记录，在控制台中显示详细日志
          if (validRecords.length < res.result.data.length) {
            const filteredCount = res.result.data.length - validRecords.length;
            console.warn(`前端已过滤 ${filteredCount} 条无效记录`);
          }
        } catch (error) {
          // 处理过滤和排序过程中的错误
          console.error('处理数据时出错:', error);
          this.setData({ recordList: [] });
          wx.showToast({ title: '数据处理错误', icon: 'none' });
        }
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
  },

  /**
   * 跳转到记录详情页 (修改为实际跳转)
   */
  goToDetail(e) {
    // 检查登录状态
    if (!this.data.isLoggedIn) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    
    const recordId = e.currentTarget.dataset.id;
    console.log('Navigate to detail for recordId:', recordId);

    // --- 使用绝对路径 ---
    wx.navigateTo({
      url: `/packages/record/abnormal/abnormal?id=${recordId}` // 更新为绝对路径
    });
  },

  /**
   * 新增：跳转到新增记录页面
   */
  goToAddRecord() {
    // 检查登录状态
    if (!this.data.isLoggedIn) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    
    console.log('Navigate to add abnormal record page.');
    wx.navigateTo({
      url: '/packages/record/abnormal/abnormal' // 更新为绝对路径
    });
  },

  /**
   * 新增：跳转到登录页面 (修改为直接调用云函数登录)
   */
  goToLogin() {
    console.log('直接调用登录云函数');
    wx.showLoading({ title: '登录中...' });

    // 调用 login 云函数
    wx.cloud.callFunction({
      name: 'login',
      data: {} // login 云函数不需要额外参数
    })
    .then(res => {
      console.log('调用云函数 login 成功:', res);
      if (res.result && res.result.success && res.result.openid) {
        // 获取 openid 成功
        const openid = res.result.openid;
        console.log('Login success, openid:', openid);
        
        // 保存登录状态和 openid 到本地缓存
        try {
          wx.setStorageSync('isLoggedIn', true);
          wx.setStorageSync('openid', openid);
          console.log('登录状态和 openid 已保存到本地缓存');
          
          // 更新本页面登录状态
          this.setData({ isLoggedIn: true });
          
          // 登录成功后立即加载记录
          this.loadRecords();
          
          wx.showToast({ title: '登录成功', icon: 'success' });
        } catch (e) {
          console.error('保存登录状态到本地缓存失败:', e);
          wx.showToast({ title: '登录状态保存失败', icon: 'none' });
        }
      } else {
        // 获取 openid 失败
        console.error('云函数 login 返回失败或缺少 openid:', res.result);
        wx.showToast({ title: res.result.message || '登录失败，请稍后重试', icon: 'none' });
      }
    })
    .catch(err => {
      // 调用云函数本身失败
      console.error('调用云函数 login 失败:', err);
      wx.showToast({ title: '登录失败，请检查网络', icon: 'none' });
    })
    .finally(() => {
      // 隐藏加载提示
      wx.hideLoading();
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
   * 新增：清理无效记录
   */
  cleanInvalidRecords() {
    // 检查用户是否登录
    if (!this.data.isLoggedIn) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    
    // 显示确认对话框
    wx.showModal({
      title: '清理数据',
      content: '是否清理所有无效记录？此操作不可撤销。',
      confirmColor: '#00c853', // 绿色按钮
      success: (res) => {
        if (res.confirm) {
          this.executeCleanInvalidRecords();
        }
      }
    });
  },
  
  /**
   * 执行清理无效记录操作
   */
  executeCleanInvalidRecords() {
    wx.showLoading({ title: '正在清理数据...' });
    
    // 调用清理无效记录的云函数
    wx.cloud.callFunction({
      name: 'cleanInvalidRecords',
      data: {}
    })
    .then(res => {
      console.log('调用云函数 cleanInvalidRecords 成功:', res);
      if (res.result && res.result.success) {
        // 清理成功
        const msg = res.result.message || `清理完成 (${res.result.cleaned}/${res.result.total})`;
        wx.showToast({ title: msg });
        
        // 重新加载记录
        this.loadRecords();
      } else {
        // 清理失败
        wx.showToast({ 
          title: res.result?.message || '清理失败，请重试', 
          icon: 'none' 
        });
      }
    })
    .catch(err => {
      console.error('调用云函数 cleanInvalidRecords 失败:', err);
      wx.showToast({ 
        title: '清理失败，请检查网络', 
        icon: 'none' 
      });
    })
    .finally(() => {
      wx.hideLoading();
    });
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
  onShareAppMessage() {},

  /**
   * 自动清理无效数据并加载记录
   * 这会在后台自动执行，用户无需确认
   */
  autoCleanInvalidRecords() {
    console.log('自动清理无效数据开始...');
    
    // 隐式执行清理，不显示loading
    wx.cloud.callFunction({
      name: 'cleanInvalidRecords',
      data: {}
    })
    .then(res => {
      console.log('自动清理结果:', res);
      if (res.result && res.result.success) {
        const cleanedCount = res.result.cleaned || 0;
        if (cleanedCount > 0) {
          console.log(`成功清理了${cleanedCount}条无效记录`);
        }
      }
    })
    .catch(err => {
      console.error('自动清理失败:', err);
    })
    .finally(() => {
      // 无论清理成功与否，都加载记录
      this.loadRecords();
    });
  },

  /**
   * 直接清理特定的无效记录（无需用户确认）
   * 这个函数会在前端过滤时检测到无效记录时被调用
   */
  directCleanInvalidRecord(record) {
    // 确保记录存在且有ID
    if (!record) return;
    
    // 只通过云函数删除记录，避免权限问题
    if (record.recordId) {
      console.log(`尝试清理无效记录: recordId=${record.recordId}`);
      
      wx.cloud.callFunction({
        name: 'deleteRecord',
        data: {
          recordId: record.recordId,
          collection: 'abnormal_records',
          force: true // 添加标记表示强制删除
        }
      })
      .then(res => {
        console.log(`清理记录结果(recordId=${record.recordId}):`, res);
      })
      .catch(err => {
        // 忽略错误，只记录日志
        console.warn(`清理记录失败(recordId=${record.recordId}):`, err);
      });
    } else {
      console.log('记录没有recordId，无法清理:', record);
    }
  },

  /**
   * 手动清理所有无效记录
   */
  cleanAllInvalidRecords() {
    if (!this.data.isLoggedIn) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    
    // 询问用户是否确认清理
    wx.showModal({
      title: '清理所有无效记录',
      content: '这将尝试删除所有不完整或损坏的记录，确定继续吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '正在清理...' });
          
          wx.cloud.callFunction({
            name: 'cleanInvalidRecords',
            data: { forceClean: true }
          })
          .then(res => {
            console.log('清理结果:', res);
            wx.hideLoading();
            
            if (res.result && res.result.success) {
              wx.showToast({ 
                title: `成功清理${res.result.cleaned || 0}条记录`, 
                icon: 'success' 
              });
              
              // 清理后重新加载数据
              setTimeout(() => this.loadRecords(), 1000);
            } else {
              wx.showToast({ 
                title: res.result?.message || '清理失败', 
                icon: 'none' 
              });
            }
          })
          .catch(err => {
            console.error('清理失败:', err);
            wx.hideLoading();
            wx.showToast({ title: '清理失败，请重试', icon: 'none' });
          });
        }
      }
    });
  },
}) 