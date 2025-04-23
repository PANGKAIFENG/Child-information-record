// src/pages/my/my.js
import { formatDate } from '../../utils/util.js'; // 假设有日期格式化工具

const DEFAULT_AVATAR = '/src/assets/images/Avatar.png'; // 定义默认头像路径常量
const DEFAULT_NICKNAME = '小可爱';

Page({

  /**
   * 页面的初始数据
   */
  data: {
    isLoggedIn: false,    // 用户是否已登录
    isInfoSet: false,     // 宝宝信息是否已设置
    isUploadingAvatar: false, // 新增：头像是否正在上传中
    // userInfo: null,    // 微信用户信息 (根据新需求，不再需要)
    babyInfo: {           // 宝宝信息
      avatarUrl: '',      // 头像临时路径或 File ID
      nickName: DEFAULT_NICKNAME, 
      birthDate: ''       // 出生日期 yyyy-MM-dd
    },
    currentDate: formatDate(new Date()) // 用于限制日期选择器的最大可选日期
    // babyAge: ''        // 可以根据生日计算年龄显示
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {

  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   * 每次进入页面时检查登录状态和宝宝信息状态
   */
  onShow() {
    console.log('My page onShow');
    const userLoggedIn = wx.getStorageSync('isLoggedIn') || false;
    let infoIsSet = wx.getStorageSync('isInfoSet') || false; 
    // 读取缓存，如果缓存没有，则使用 data 中的默认值（包含 nickName: '小可爱'）
    let currentBabyInfo = wx.getStorageSync('babyInfo') || this.data.babyInfo; 

    if (userLoggedIn) {
      // 简单判断：如果昵称还是默认值 或 生日为空，则认为信息未完全设置
      if (currentBabyInfo.nickName === DEFAULT_NICKNAME || !currentBabyInfo.birthDate) {
          infoIsSet = false;
      }
      // 如果 avatarUrl 为空 (可能缓存的就是空)，在未设置状态下强制设为默认头像
      if (!infoIsSet && !currentBabyInfo.avatarUrl) {
          currentBabyInfo.avatarUrl = DEFAULT_AVATAR;
      }
    } else {
        // 未登录，重置信息
        infoIsSet = false;
        currentBabyInfo = { avatarUrl: '', nickName: DEFAULT_NICKNAME, birthDate: '' };
    }

    this.setData({
      isLoggedIn: userLoggedIn,
      isInfoSet: infoIsSet,
      babyInfo: currentBabyInfo, // 使用读取或重置后的 babyInfo
      currentDate: formatDate(new Date())
    });
    
    // 确保在"未设置"状态下，生日有默认值
    if (this.data.isLoggedIn && !this.data.isInfoSet && !this.data.babyInfo.birthDate) {
        this.setData({
            'babyInfo.birthDate': formatDate(new Date())
            // 头像和昵称已在上面处理或来自缓存
        });
    }
    console.log('Current state:', this.data.isLoggedIn, this.data.isInfoSet, 'BabyInfo:', this.data.babyInfo);
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  },

  /**
   * 处理登录按钮点击 (修改为调用云函数，并检查用户信息)
   */
  handleLogin() {
    console.log('Login button clicked');
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
              isInfoSet: true,
              babyInfo: userBabyInfo
            });
            
            wx.showToast({ title: '登录成功', icon: 'success' });
          } else {
            // 信息不完整，进入设置界面
            console.log('用户信息不完整，需要设置');
            this.setData({ 
              isLoggedIn: true, 
              isInfoSet: false,
              babyInfo: {
                avatarUrl: userBabyInfo.avatarUrl || DEFAULT_AVATAR,
                nickName: userBabyInfo.nickName || DEFAULT_NICKNAME,
                birthDate: userBabyInfo.birthDate || formatDate(new Date())
              }
            });
          }
        } else {
          // 未找到用户信息，进入设置界面
          console.log('未找到用户信息，需要设置');
          this.setData({ 
            isLoggedIn: true, 
            isInfoSet: false, 
            babyInfo: { 
              avatarUrl: DEFAULT_AVATAR, 
              nickName: DEFAULT_NICKNAME, 
              birthDate: formatDate(new Date())
            }
          });
        }
      })
      .catch(err => {
        console.error('查询用户信息失败:', err);
        // 出错时也进入设置界面
        this.setData({ 
          isLoggedIn: true, 
          isInfoSet: false, 
          babyInfo: { 
            avatarUrl: DEFAULT_AVATAR, 
            nickName: DEFAULT_NICKNAME, 
            birthDate: formatDate(new Date())
          }
        });
      });
  },

  /**
   * 选择头像回调 (修改)
   */
  onChooseAvatar(e) {
    const tempPath = e.detail.avatarUrl;
    if (tempPath) {
      console.log('New avatar temp path:', tempPath);
      this.uploadAvatar(tempPath);
    } else {
      console.warn('Choose avatar failed or cancelled');
    }
  },

  /**
   * 新增：上传头像到云存储
   * @param {string} tempPath - 图片临时文件路径
   */
  uploadAvatar(tempPath) {
    const openid = wx.getStorageSync('openid');
    if (!openid) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '上传头像中...' });
    this.setData({ isUploadingAvatar: true }); // 开始上传，设置状态为 true

    const timestamp = Date.now();
    const fileExtension = tempPath.split('.').pop();
    const cloudPath = `user_avatars/${openid}/${timestamp}.${fileExtension}`;

    wx.cloud.uploadFile({
      cloudPath: cloudPath, // 上传至云端的路径
      filePath: tempPath, // 小程序临时文件路径
      success: res => {
        console.log('[上传文件] 成功：', res);
        const fileID = res.fileID;
        // 更新页面数据和缓存
        this.setData({
          'babyInfo.avatarUrl': fileID // 更新为云文件 ID
        });
        // 注意：这里不直接调用 saveBabyInfo，让用户手动点击保存按钮
        // 如果希望选择后立即保存，可以在这里调用 saveBabyInfo，但需确保其他信息也准备好
         wx.showToast({ title: '头像设置成功', icon: 'success' });
      },
      fail: e => {
        console.error('[上传文件] 失败：', e);
        wx.showToast({
          icon: 'none',
          title: '头像上传失败',
        });
      },
      complete: () => {
        wx.hideLoading();
        this.setData({ isUploadingAvatar: false }); // 上传结束（无论成功失败），设置状态为 false
      }
    });
  },

  /**
   * 昵称输入
   */
  onNameInput(e) {
    this.setData({
      'babyInfo.nickName': e.detail.value
    });
  },

  /**
   * 日期选择
   */
  onDateChange(e) {
    this.setData({
      'babyInfo.birthDate': e.detail.value
    });
  },

  /**
   * 保存宝宝信息 (修改为调用云函数)
   */
  saveBabyInfo() {
    // 新增：检查头像是否正在上传
    if (this.data.isUploadingAvatar) {
        wx.showToast({ title: '头像上传中，请稍候...', icon: 'none' });
        return; // 阻止保存
    }

    const wasInfoSetBefore = this.data.isInfoSet; // 记录保存前的状态
    console.log('Attempting to save baby info:', this.data.babyInfo, 'Was info set before:', wasInfoSetBefore);
    // --- 校验数据 (保持不变) --- 
    if (!this.data.babyInfo.avatarUrl || 
        !this.data.babyInfo.nickName || 
        this.data.babyInfo.nickName === DEFAULT_NICKNAME || 
        !this.data.babyInfo.birthDate) {
      wx.showToast({ title: '请完善宝宝信息', icon: 'none' });
      return;
    }

    // --- 检查头像是否为临时路径 (理论上应该在 onChooseAvatar 后变成 fileID 或保持默认路径) ---
    if (this.data.babyInfo.avatarUrl.startsWith('http://tmp/') || this.data.babyInfo.avatarUrl.startsWith('wxfile://')) {
        wx.showToast({ title: '头像正在上传或上传失败，请稍后保存', icon: 'none' });
        // 或者在这里重新触发一次上传？ uploadAvatar(this.data.babyInfo.avatarUrl)
        return;
    }

    wx.showLoading({ title: '保存中...' });

    // --- 调用 updateBabyInfo 云函数 --- 
    wx.cloud.callFunction({
      name: 'updateBabyInfo',
      data: {
        babyInfo: this.data.babyInfo // 传递当前 data 中的 babyInfo
      }
    })
    .then(res => {
      console.log('调用 updateBabyInfo 成功:', res);
      if (res.result && res.result.success) {
        wx.showToast({ title: '保存成功' });
        this.setData({ isInfoSet: true }); // 更新状态为已设置
        // 将确认保存成功的宝宝信息更新到缓存
        try {
          wx.setStorageSync('isInfoSet', true);
          wx.setStorageSync('babyInfo', this.data.babyInfo);
          console.log('宝宝信息已更新到本地缓存');
          
          // 发送事件通知首页刷新头像
          const eventChannel = this.getOpenerEventChannel();
          if (eventChannel && eventChannel.emit) {
            try {
              eventChannel.emit('babyInfoUpdated', { babyInfo: this.data.babyInfo });
            } catch(e) {
              console.log('事件通知发送失败，可能不是从首页打开的', e);
            }
          }
          
          // 强制刷新TabBar页面
          const pages = getCurrentPages();
          if (pages.length > 0) {
            const homePage = pages.find(p => p.route && p.route.includes('/pages/home/home'));
            if (homePage) {
              homePage.onShow(); // 主动触发首页的onShow方法
            }
          }

          // --- 新增：如果是首次设置，跳转到首页 ---
          if (!wasInfoSetBefore) {
            console.log('First time setup complete, navigating to home page.');
            wx.switchTab({ 
              url: '/src/pages/home/home',
              fail: (err) => {
                  console.error('SwitchTab to home failed:', err);
                  // 跳转失败尝试提示
                  wx.showToast({ title: '信息已保存，请手动切换到首页', icon: 'none'});
              }
            });
          }
          // ------------------------------------
          
        } catch(e) {
          console.error('保存宝宝信息到本地缓存失败:', e);
        }
      } else {
        wx.showToast({ title: res.result.message || '保存失败', icon: 'none' });
      }
    })
    .catch(err => {
      console.error('调用 updateBabyInfo 失败:', err);
      wx.showToast({ title: '保存失败，请检查网络', icon: 'none' });
    })
    .finally(() => {
      wx.hideLoading();
    });

    // --- 移除模拟保存逻辑 ---
  },

  /**
   * 编辑宝宝信息 (占位)
   */
  editBabyInfo() {
    console.log('Edit baby info clicked');
    // 只改变状态，让页面进入编辑模式，保留现有数据
    this.setData({ isInfoSet: false }); 
  },

  /**
   * 跳转到家庭管理页面
   */
  goToFamilyManage() {
    // 跳转到家庭管理页面
    console.log('---- goToFamilyManage FUNCTION CALLED! ----'); // 日志可以保留或移除
    wx.navigateTo({
     url: '/packages/profile/family/family' // 恢复跳转，使用正确路径
    });
  },

  /**
   * 退出登录 (修改为清除缓存)
   */
  handleLogout() {
    console.log('Logout button clicked');
    // 清除登录状态和用户信息（缓存）
    try {
      wx.removeStorageSync('isLoggedIn');
      wx.removeStorageSync('isInfoSet');
      wx.removeStorageSync('openid');
      wx.removeStorageSync('babyInfo');
      console.log('本地缓存已清除');
    } catch (e) {
      console.error('清除本地缓存失败:', e);
    }

    this.setData({
      isLoggedIn: false,
      isInfoSet: false,
      babyInfo: { // 重置为初始状态
        avatarUrl: '', 
        nickName: DEFAULT_NICKNAME,
        birthDate: ''
      }
    });
    wx.showToast({ title: '已退出登录' });
  }
})