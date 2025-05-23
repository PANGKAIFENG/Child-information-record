// 首页逻辑
import { calculateAge } from '../../utils/util.js'; // 导入计算年龄函数

const DEFAULT_AVATAR = '/src/assets/images/Avatar.png'; // 默认头像路径

console.log('首页JS文件执行');

Page({
  data: {
    initialRenderDone: false, // 改为 false，用于骨架屏
    contentLoaded: false,     // 改为 false，用于骨架屏
    isLoggedIn: false, // 新增：登录状态
    babyInfo: {        // 宝宝信息
      avatarUrl: DEFAULT_AVATAR, // 默认头像
      nickName: '宝宝', // 默认昵称
      birthDate: null,
      age: '' // 年龄
    },
    todayStats: {      // 今日统计
      feedingCount: '-', // 初始化为占位符
      totalMilk: '-',
      sleepHours: '-',
      excretionCount: '-'
    },
    recentRecords: [] // 最近记录
  },

  onLoad: function() {
    console.log('[onLoad] 首页加载开始');
    // 不再显示 Toast，骨架屏处理加载状态
    // wx.showToast({
    //   title: '页面正在加载',
    //   icon: 'loading',
    //   duration: 2000
    // });
    
    // 加载初始数据（仅本地信息）
    this.loadBabyInfo();
    
    // 可以在 onLoad 结束时标记初始渲染完成
    this.setData({ initialRenderDone: true }); 

    // 监听宝宝信息更新事件
    const eventChannel = this.getOpenerEventChannel();
    if (eventChannel && eventChannel.on) {
      eventChannel.on('babyInfoUpdated', (data) => {
        console.log('Received babyInfoUpdated event', data);
        if (data && data.babyInfo) {
          let updatedBabyInfo = data.babyInfo;
          if (updatedBabyInfo.birthDate) {
              updatedBabyInfo.age = calculateAge(updatedBabyInfo.birthDate);
          }
           if (!updatedBabyInfo.avatarUrl) {
               updatedBabyInfo.avatarUrl = DEFAULT_AVATAR;
           }
          this.setData({
            babyInfo: updatedBabyInfo,
            isLoggedIn: true // 信息更新意味着已登录
          });
          // 宝宝信息更新后，重新从云函数加载数据
          this.loadDataFromCloud(); 
        }
      });
    }
  },

  onShow: function() {
    console.log('Home page onShow');
    // 检查登录状态和宝宝信息
    const userLoggedIn = wx.getStorageSync('isLoggedIn') || false; // 先读取登录状态
    const storedBabyInfo = wx.getStorageSync('babyInfo');
    let currentBabyInfo = this.data.babyInfo;
    let babyAge = '';

    if (userLoggedIn && storedBabyInfo) {
      // 处理已登录用户的信息显示
      currentBabyInfo = storedBabyInfo;
      if (currentBabyInfo.birthDate) {
        babyAge = calculateAge(currentBabyInfo.birthDate);
      }
      if (!currentBabyInfo.avatarUrl) {
        currentBabyInfo.avatarUrl = DEFAULT_AVATAR;
      }
      currentBabyInfo.age = babyAge;
    } else {
      // 处理未登录用户的信息显示
      currentBabyInfo = {
        avatarUrl: DEFAULT_AVATAR,
        nickName: '宝宝',
        birthDate: null,
        age: '请先登录'
      };
    }

    // 设置初始状态，包括骨架屏状态
    this.setData({
      isLoggedIn: userLoggedIn,
      babyInfo: currentBabyInfo,
      contentLoaded: false // 每次都先重置骨架屏状态
    });

    // 只有当进入 onShow 时就已经登录，才主动加载云端数据
    if (userLoggedIn) {
      console.log('[onShow] User is logged in. Calling loadDataFromCloud.');
      this.loadDataFromCloud();
    } else {
      // 如果进入 onShow 时未登录，则直接显示未登录内容，
      // 后续的数据加载由 handleLogin 触发（如果用户点击登录）
      console.log('[onShow] User is not logged in. Setting contentLoaded.');
      this.setData({
          todayStats: { feedingCount: '-', totalMilk: '-', sleepHours: '-', excretionCount: '-' },
          recentRecords: [],
          contentLoaded: true // 显示未登录界面
      });
    }
  },

  // 新增：统一从云函数加载数据
  async loadDataFromCloud() {
    if (!this.data.isLoggedIn) {
      console.log('[loadDataFromCloud] User not logged in. Aborting.');
      this.setData({ contentLoaded: true }); // 确保骨架屏消失
      return;
    }

    console.log('[loadDataFromCloud] Calling cloud function getHomeData...');
    wx.showLoading({ title: '加载中...' }); // 显示加载提示

    try {
      const res = await wx.cloud.callFunction({
        name: 'getHomeData'
      });
      console.log('[loadDataFromCloud] Cloud function result:', res);

      if (res.result && res.result.success) {
        this.setData({
          todayStats: res.result.todayStats,
          recentRecords: res.result.recentRecords,
          contentLoaded: true // 数据加载成功，显示内容
        });
      } else {
        console.error('[loadDataFromCloud] Cloud function returned error:', res.result);
        wx.showToast({ title: res.result.message || '加载数据失败', icon: 'none' });
        // 加载失败也需要显示内容区，避免一直卡在骨架屏
        this.setData({ 
            contentLoaded: true,
            // 保留之前的占位符或清空
            todayStats: { feedingCount: '-', totalMilk: '-', sleepHours: '-', excretionCount: '-' },
            recentRecords: []
        });
      }
    } catch (err) {
      console.error('[loadDataFromCloud] Error calling cloud function:', err);
      wx.showToast({ title: '网络错误，加载失败', icon: 'none' });
      this.setData({ 
          contentLoaded: true,
          todayStats: { feedingCount: '-', totalMilk: '-', sleepHours: '-', excretionCount: '-' },
          recentRecords: []
      });
    } finally {
      wx.hideLoading(); // 隐藏加载提示
    }
  },

  // 加载婴儿信息
  loadBabyInfo: function() {
    // 尝试从本地存储获取婴儿信息
    const babyInfo = wx.getStorageSync('babyInfo');
    if (babyInfo) {
      this.setData({
        babyInfo: babyInfo
      });
    }
    console.log('加载婴儿信息');
  },

  /**
   * 加载今日统计 (旧逻辑 - 移除实现，或删除函数)
   */
  async loadTodayStats() {
     console.log('[loadTodayStats] Function called, but logic is now in getHomeData cloud function.');
     // 实现已移除
  },

  /**
   * 加载最近记录 (旧逻辑 - 移除实现，或删除函数)
   */
  async loadRecentRecords() {
    console.log('[loadRecentRecords] Function called, but logic is now in getHomeData cloud function.');
    // 实现已移除
  },

  // 获取所有记录
  getAllRecords: function() {
    // 从本地存储获取各类记录，并立即进行 map 添加 recordType
    const feedingRecords = (wx.getStorageSync('feedingRecords') || []).map(record => ({...record, recordType: 'feeding'}));
    const sleepRecords = (wx.getStorageSync('sleepRecords') || []).map(record => ({...record, recordType: 'sleep'}));
    const excretionRecords = (wx.getStorageSync('excretionRecords') || []).map(record => ({...record, recordType: 'excretion'}));
    const supplementRecords = (wx.getStorageSync('supplementRecords') || []).map(record => ({...record, recordType: 'supplement'}));
    const abnormalRecords = (wx.getStorageSync('abnormalRecords') || []).map(record => ({...record, recordType: 'abnormal'}));
    
    // 使用 concat 合并所有处理后的记录数组
    let allRecords = [].concat(
      feedingRecords,
      sleepRecords,
      excretionRecords,
      supplementRecords,
      abnormalRecords
    );
    
    // 如果需要，可以在这里对 allRecords 进行排序
    // allRecords.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    
    return allRecords;
  },

  // 跳转到记录页
  goToRecord: function(e) {
    // 先检查登录状态
    if (!this.data.isLoggedIn) {
      wx.showToast({
        title: '请先登录',
        icon: 'none',
        duration: 1500,
        complete: () => {
          // 延迟一点调用登录，让 Toast 显示完
          setTimeout(() => {
            this.goToMyPage(); // 直接调用登录函数，不再跳转到"我的"页面
          }, 1500);
        }
      });
      return; // 阻止后续跳转
    }

    // 已登录，执行原跳转逻辑
    const recordType = e.currentTarget.dataset.type;
    let url = '';
    switch (recordType) {
      case 'feeding':
        url = '/packages/record/feeding/feeding';
        break;
      case 'sleep':
        url = '/packages/record/sleep/sleep';
        break;
      case 'excretion':
        url = '/packages/record/excretion/excretion';
        break;
      case 'supplement':
        url = '/packages/record/supplement/supplement';
        break;
      default:
        console.warn('Unknown record type:', recordType);
        return;
    }
    wx.navigateTo({ url });
  },

  /**
   * 修改：直接调用微信登录，而不是跳转到"我的"页面
   */
  goToMyPage() {
    // 直接执行登录流程
    console.log('Home page login button clicked');
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
        } catch (e) {
          console.error('保存登录状态到本地缓存失败:', e);
        }

        // 检查用户是否已设置过信息
        this.checkUserInfo(openid);
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
   * 新增：检查用户是否已设置过信息
   * @param {string} openid - 用户的openid
   */
  checkUserInfo(openid) {
    // 从云数据库中查询用户信息
    const db = wx.cloud.database();
    db.collection('users')
      .where({ _openid: openid })
      .get()
      .then(res => {
        if (res.data && res.data.length > 0 && res.data[0].babyInfo) {
          const userBabyInfo = res.data[0].babyInfo;
          // 检查信息是否完整
          if (userBabyInfo.nickName && userBabyInfo.birthDate && userBabyInfo.avatarUrl) {
            console.log('用户已有完整信息，直接加载:', userBabyInfo);
            
            // 保存用户信息到本地缓存
            wx.setStorageSync('babyInfo', userBabyInfo);
            wx.setStorageSync('isInfoSet', true);
            
            // 更新页面状态
            this.setData({
              isLoggedIn: true,
              babyInfo: {
                ...userBabyInfo,
                age: this.calculateAge(userBabyInfo.birthDate)
              }
            });
            
            // 加载数据
            this.loadDataFromCloud();
            
            wx.showToast({ title: '登录成功', icon: 'success' });
          } else {
            // 信息不完整，需要跳转到设置页面
            console.log('用户信息不完整，需要设置');
            wx.switchTab({ url: '/pages/my/my' });
          }
        } else {
          // 未找到用户信息，跳转到设置页面
          console.log('未找到用户信息，需要设置');
          wx.switchTab({ url: '/pages/my/my' });
        }
      })
      .catch(err => {
        console.error('查询用户信息失败:', err);
        // 出错时也跳转到设置页面
        wx.switchTab({ url: '/pages/my/my' });
      });
  },
  
  /**
   * 新增：计算年龄
   */
  calculateAge(birthDate) {
    if (!birthDate) return '';
    try {
      return calculateAge(birthDate);
    } catch (err) {
      console.error('计算年龄出错:', err);
      return '';
    }
  },

  /**
   * 修改：处理首页未登录状态下的点击事件
   */
  handleLogin() {
    console.log('Login initiated from home page');
    wx.showLoading({ title: '登录中...' });

    let userOpenid = ''; // 用于存储 openid

    wx.cloud.callFunction({
      name: 'login',
      data: {}
    })
    .then(res => {
      if (res.result && res.result.success && res.result.openid) {
        userOpenid = res.result.openid;
        console.log('[Home Login] Success, openid:', userOpenid);
        try {
          wx.setStorageSync('isLoggedIn', true);
          wx.setStorageSync('openid', userOpenid);
          this.setData({ isLoggedIn: true }); 
          // 返回检查用户注册状态的 Promise
          return this.checkUserRegistration(userOpenid);
        } catch (e) {
          console.error('[Home Login] Save cache failed:', e);
          wx.showToast({ title: '登录状态保存失败', icon: 'none' });
          return Promise.reject('Save cache failed'); // 返回拒绝的 Promise
        }
      } else {
        console.error('[Home Login] Cloud function failed:', res.result);
        wx.showToast({ title: res.result.message || '登录失败', icon: 'none' });
        return Promise.reject('Login cloud function failed');
      }
    })
    .then(isRegisteredAndComplete => {
      // 根据检查结果执行后续操作
      wx.hideLoading(); // 在最终操作前隐藏 loading
      if (isRegisteredAndComplete) {
        console.log('[handleLogin] User check returned true. Updating UI and loading data.');
        
        // --- 新增：立即更新页面 babyInfo --- 
        const confirmedBabyInfo = wx.getStorageSync('babyInfo');
        if (confirmedBabyInfo) {
            // 计算年龄
            confirmedBabyInfo.age = this.calculateAge(confirmedBabyInfo.birthDate);
            // 确保有头像
             if (!confirmedBabyInfo.avatarUrl) {
               confirmedBabyInfo.avatarUrl = DEFAULT_AVATAR;
             }
            this.setData({ babyInfo: confirmedBabyInfo });
            console.log('[handleLogin] Updated page babyInfo immediately.');
        } else {
            console.warn('[handleLogin] Could not get babyInfo from storage even though user is registered.');
        }
        // --- 结束新增 ---
        
        this.loadDataFromCloud(); // 老用户，刷新统计和最近记录
      } else {
        console.log('[handleLogin] User check returned false, navigating to My page.');
        wx.switchTab({ url: '/src/pages/my/my' }); // 新用户，跳转设置
      }
    })
    .catch(err => {
      wx.hideLoading(); // 确保隐藏 loading
      console.error('[handleLogin] Overall login/check process failed:', err);
      // 根据错误类型可以给出不同的提示，或者统一提示
      if (typeof err !== 'string' || (!err.includes('Save cache failed') && !err.includes('Login cloud function failed'))) {
         wx.showToast({ title: '登录或检查用户信息时出错', icon: 'none' });
      }
    });
  },

  /**
   * 修改：检查用户注册状态，返回 Promise<boolean>
   */
  checkUserRegistration(openid) {
    console.log('[checkUserRegistration] Checking user:', openid);
    const db = wx.cloud.database();
    // 返回一个 Promise
    return new Promise((resolve, reject) => {
      db.collection('users').where({ _openid: openid }).get()
        .then(res => {
          let isComplete = false;
          if (res.data && res.data.length > 0 && res.data[0].babyInfo && 
              res.data[0].babyInfo.nickName && res.data[0].babyInfo.birthDate && res.data[0].babyInfo.avatarUrl &&
              res.data[0].babyInfo.nickName !== '小可爱') { 
              
            console.log('[checkUserRegistration] User registered and info complete.');
            // 保存信息到缓存
            wx.setStorageSync('isInfoSet', true);
            wx.setStorageSync('babyInfo', res.data[0].babyInfo);
            isComplete = true;
          } else {
            console.log('[checkUserRegistration] New user or incomplete info.');
            // 标记信息未设置
            wx.setStorageSync('isInfoSet', false);
            isComplete = false;
          }
          resolve(isComplete); // 返回检查结果 (true 或 false)
        })
        .catch(err => {
          console.error('[checkUserRegistration] Check user info failed:', err);
          wx.showToast({ title: '检查用户信息失败', icon: 'none' });
          // 检查失败，也认为需要设置信息（或可以根据业务决定）
          wx.setStorageSync('isInfoSet', false);
          resolve(false); // 返回 false，让流程引导去设置页
          // 或者 reject(err); 如果希望上层 catch 处理
        });
    });
  },

  formatRecordTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString();
  },

  formatDuration(duration) {
    // Implementation of formatDuration function
  }
}) 