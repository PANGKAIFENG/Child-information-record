Page({

  /**
   * 页面的初始数据
   */
  data: {
    isLoading: true,
    isLoggedIn: false,
    hasFamily: false,
    isManager: false,
    familyInfo: null,
    members: [],
    inviteCode: '',
    showInviteDialog: false,
    pendingInviteCode: null,
    babyInfo: {}
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    console.log('[family.js onLoad] Options:', options);
    // 检查登录状态
    const isLoggedIn = wx.getStorageSync('isLoggedIn') || false;
    this.setData({ isLoggedIn });
    
    // 如果有邀请码参数
    if (options && options.inviteCode) {
      const inviteCode = options.inviteCode;
      console.log('[family.js onLoad] Found inviteCode:', inviteCode);
      if (isLoggedIn) {
        // 已登录，直接处理邀请
        console.log('[family.js onLoad] User logged in, handling invitation immediately.');
        this.handleInvitation(inviteCode);
      } else {
        // 未登录，暂存邀请码，等待用户登录
        console.log('[family.js onLoad] User not logged in, storing pending invite code.');
        this.setData({ pendingInviteCode: inviteCode });
        // WXML 中根据 !isLoggedIn 和 pendingInviteCode 显示登录提示
      }
    }
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    // 每次显示时，重新检查登录状态和家庭信息（如果已登录）
    const isLoggedIn = wx.getStorageSync('isLoggedIn') || false;
    this.setData({ isLoggedIn });

    if (isLoggedIn) {
      console.log('[family.js onShow] User is logged in, loading family info.');
      this.loadFamilyInfo();
      // 也尝试加载用户信息，以便显示昵称等 (如果需要)
      const cachedBabyInfo = wx.getStorageSync('babyInfo');
      if(cachedBabyInfo) {
        this.setData({ babyInfo: cachedBabyInfo });
      }
    } else {
      console.log('[family.js onShow] User is not logged in.');
      this.setData({ isLoading: false, hasFamily: false, members: [] }); // 未登录则清空家庭信息
    }
  },

  /**
   * 加载家庭信息
   */
  loadFamilyInfo: function () {
    this.setData({ isLoading: true });
    
    wx.cloud.callFunction({
      name: 'getFamilyInfo',
      data: {}
    })
    .then(res => {
      console.log('获取家庭信息成功:', res);
      if (res.result && res.result.success) {
        // 处理家庭信息
        const familyData = res.result.data;
        if (familyData) {
          const openid = wx.getStorageSync('openid');
          const isManager = familyData.managerId === openid;
          
          this.setData({
            hasFamily: true,
            isManager,
            familyInfo: familyData,
            members: familyData.members || []
          });
        } else {
          this.setData({ hasFamily: false });
        }
      } else {
        this.setData({ hasFamily: false });
        console.error('获取家庭信息失败:', res.result?.message);
      }
    })
    .catch(err => {
      console.error('调用获取家庭信息函数失败:', err);
      wx.showToast({
        title: '获取家庭信息失败',
        icon: 'none'
      });
    })
    .finally(() => {
      this.setData({ isLoading: false });
    });
  },

  /**
   * 创建家庭
   */
  createFamily: function () {
    wx.showLoading({ title: '创建中...' });
    
    wx.cloud.callFunction({
      name: 'createFamily',
      data: {}
    })
    .then(res => {
      console.log('创建家庭成功:', res);
      if (res.result && res.result.success) {
        wx.showToast({
          title: '创建成功',
          icon: 'success'
        });
        this.loadFamilyInfo(); // 重新加载家庭信息
      } else {
        wx.showToast({
          title: res.result?.message || '创建失败',
          icon: 'none'
        });
      }
    })
    .catch(err => {
      console.error('调用创建家庭函数失败:', err);
      wx.showToast({
        title: '创建失败，请检查网络',
        icon: 'none'
      });
    })
    .finally(() => {
      wx.hideLoading();
    });
  },

  /**
   * 处理邀请码
   */
  handleInvitation: function (inviteCode) {
    console.log('处理邀请码:', inviteCode);
    // 检查是否已有自己的家庭数据
    wx.cloud.callFunction({
      name: 'checkUserData',
      data: {}
    })
    .then(res => {
      if (res.result && res.result.success) {
        if (res.result.hasData) {
          // 用户有数据，需要先清空数据才能加入
          wx.showModal({
            title: '加入家庭',
            content: '您已有数据，加入其他家庭需要先清空您的所有数据。是否继续？',
            confirmText: '继续',
            cancelText: '取消',
            success: (modalRes) => {
              if (modalRes.confirm) {
                this.joinFamily(inviteCode, true); // 确认删除数据并加入
              }
            }
          });
        } else {
          // 用户没有数据，可以直接加入
          this.joinFamily(inviteCode, false);
        }
      } else {
        wx.showToast({
          title: res.result?.message || '处理邀请失败',
          icon: 'none'
        });
      }
    })
    .catch(err => {
      console.error('检查用户数据失败:', err);
      wx.showToast({
        title: '处理邀请失败',
        icon: 'none'
      });
    });
  },

  /**
   * 加入家庭
   */
  joinFamily: function (inviteCode, needDeleteData) {
    wx.showLoading({ title: '加入中...' });
    
    wx.cloud.callFunction({
      name: 'joinFamily',
      data: {
        inviteCode: inviteCode,
        needDeleteData: needDeleteData
      }
    })
    .then(res => {
      console.log('加入家庭结果:', res);
      if (res.result && res.result.success) {
        wx.showToast({
          title: '成功加入家庭',
          icon: 'success'
        });
        this.loadFamilyInfo(); // 重新加载家庭信息
      } else {
        wx.showToast({
          title: res.result?.message || '加入失败',
          icon: 'none'
        });
      }
    })
    .catch(err => {
      console.error('调用加入家庭函数失败:', err);
      wx.showToast({
        title: '加入失败，请检查网络',
        icon: 'none'
      });
    })
    .finally(() => {
      wx.hideLoading();
    });
  },

  /**
   * 显示邀请对话框
   */
  showInvite: function () {
    if (!this.data.inviteCode) {
      // 生成邀请码
      wx.showLoading({ title: '生成邀请码...' });
      
      wx.cloud.callFunction({
        name: 'generateInviteCode',
        data: {
          familyId: this.data.familyInfo._id
        }
      })
      .then(res => {
        if (res.result && res.result.success) {
          this.setData({
            inviteCode: res.result.inviteCode,
            showInviteDialog: true
          });
        } else {
          wx.showToast({
            title: res.result?.message || '生成邀请码失败',
            icon: 'none'
          });
        }
      })
      .catch(err => {
        console.error('生成邀请码失败:', err);
        wx.showToast({
          title: '生成邀请码失败',
          icon: 'none'
        });
      })
      .finally(() => {
        wx.hideLoading();
      });
    } else {
      this.setData({ showInviteDialog: true });
    }
  },

  /**
   * 隐藏邀请对话框
   */
  hideInvite: function () {
    this.setData({ showInviteDialog: false });
  },

  /**
   * 复制邀请码
   */
  copyInviteCode: function () {
    wx.setClipboardData({
      data: this.data.inviteCode,
      success: () => {
        wx.showToast({
          title: '邀请码已复制',
          icon: 'success'
        });
      }
    });
  },

  /**
   * 分享邀请
   */
  shareInvite: function () {
    // 由页面的onShareAppMessage处理
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage: function () {
    const inviteCode = this.data.inviteCode;
    return {
      title: '邀请您加入家庭共同记录宝宝成长',
      path: `/packages/profile/family/family?inviteCode=${inviteCode}`,
      imageUrl: '/src/assets/images/share-family.png' // 需要添加分享图片
    };
  },

  /**
   * 退出家庭
   */
  leaveFamily: function () {
    wx.showModal({
      title: '退出家庭',
      content: '退出后，您的记录将保留在当前家庭中。确定退出吗？',
      confirmText: '确定退出',
      confirmColor: '#FF4D4F',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          this.doLeaveFamily();
        }
      }
    });
  },

  /**
   * 执行退出家庭
   */
  doLeaveFamily: function () {
    wx.showLoading({ title: '退出中...' });
    
    wx.cloud.callFunction({
      name: 'leaveFamily',
      data: {}
    })
    .then(res => {
      console.log('退出家庭结果:', res);
      if (res.result && res.result.success) {
        wx.showToast({
          title: '已退出家庭',
          icon: 'success'
        });
        
        // 重置状态
        this.setData({
          hasFamily: false,
          isManager: false,
          familyInfo: null,
          members: [],
          inviteCode: ''
        });
      } else {
        wx.showToast({
          title: res.result?.message || '退出失败',
          icon: 'none'
        });
      }
    })
    .catch(err => {
      console.error('调用退出家庭函数失败:', err);
      wx.showToast({
        title: '退出失败，请检查网络',
        icon: 'none'
      });
    })
    .finally(() => {
      wx.hideLoading();
    });
  },

  /**
   * 移除家庭成员
   */
  removeMember: function (e) {
    const { memberid } = e.currentTarget.dataset;
    const member = this.data.members.find(m => m.openid === memberid);
    
    if (member) {
      wx.showModal({
        title: '移除成员',
        content: `确定要将 ${member.nickName} 从家庭中移除吗？`,
        confirmText: '确定移除',
        confirmColor: '#FF4D4F',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            this.doRemoveMember(memberid);
          }
        }
      });
    }
  },

  /**
   * 执行移除成员
   */
  doRemoveMember: function (memberId) {
    wx.showLoading({ title: '移除中...' });
    
    wx.cloud.callFunction({
      name: 'removeFamilyMember',
      data: {
        memberId: memberId
      }
    })
    .then(res => {
      console.log('移除成员结果:', res);
      if (res.result && res.result.success) {
        wx.showToast({
          title: '成员已移除',
          icon: 'success'
        });
        this.loadFamilyInfo(); // 重新加载家庭信息
      } else {
        wx.showToast({
          title: res.result?.message || '移除失败',
          icon: 'none'
        });
      }
    })
    .catch(err => {
      console.error('调用移除成员函数失败:', err);
      wx.showToast({
        title: '移除失败，请检查网络',
        icon: 'none'
      });
    })
    .finally(() => {
      wx.hideLoading();
    });
  },

  /**
   * 解散家庭
   */
  disbandFamily: function () {
    wx.showModal({
      title: '解散家庭',
      content: '解散后，所有成员将被移除，但数据仍保留在您的账户中。此操作不可撤销，确定解散吗？',
      confirmText: '确定解散',
      confirmColor: '#FF4D4F',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          this.doDisbandFamily();
        }
      }
    });
  },

  /**
   * 执行解散家庭
   */
  doDisbandFamily: function () {
    wx.showLoading({ title: '解散中...' });
    
    wx.cloud.callFunction({
      name: 'disbandFamily',
      data: {}
    })
    .then(res => {
      console.log('解散家庭结果:', res);
      if (res.result && res.result.success) {
        wx.showToast({
          title: '家庭已解散',
          icon: 'success'
        });
        
        // 重置状态
        this.setData({
          hasFamily: false,
          isManager: false,
          familyInfo: null,
          members: [],
          inviteCode: ''
        });
      } else {
        wx.showToast({
          title: res.result?.message || '解散失败',
          icon: 'none'
        });
      }
    })
    .catch(err => {
      console.error('调用解散家庭函数失败:', err);
      wx.showToast({
        title: '解散失败，请检查网络',
        icon: 'none'
      });
    })
    .finally(() => {
      wx.hideLoading();
    });
  },

  /**
   * 处理登录
   */
  handleLogin: function () {
    console.log('[family.js handleLogin] Login button clicked');
    wx.showLoading({ title: '登录中...' });

    wx.cloud.callFunction({
      name: 'login',
      data: {}
    })
    .then(res => {
      console.log('[family.js handleLogin] Cloud function login result:', res);
      if (res.result && res.result.success && res.result.openid) {
        const openid = res.result.openid;
        console.log('[family.js handleLogin] Login success, openid:', openid);
        try {
          wx.setStorageSync('isLoggedIn', true);
          wx.setStorageSync('openid', openid);
          this.setData({ isLoggedIn: true }); // 更新页面登录状态
          console.log('[family.js handleLogin] Saved login state and openid to storage.');
          // 登录成功后，检查用户信息
          return this.checkUserInfo(openid);
        } catch (e) {
          console.error('[family.js handleLogin] Save storage failed:', e);
          wx.showToast({ title: '登录状态保存失败', icon: 'none' });
          return Promise.reject('Save storage failed');
        }
      } else {
        console.error('[family.js handleLogin] Cloud function login failed:', res.result);
        wx.showToast({ title: res.result?.message || '登录失败', icon: 'none' });
        return Promise.reject('Login cloud function failed');
      }
    })
    .catch(err => {
      console.error('[family.js handleLogin] Login process error:', err);
       if (typeof err !== 'string' || (!err.includes('Save storage failed') && !err.includes('Login cloud function failed'))) {
           wx.showToast({ title: '登录过程出错', icon: 'none' });
       }
    })
    .finally(() => {
      wx.hideLoading();
    });
  },

  /**
   * 检查用户信息 (适配自 my.js)
   * @param {string} openid 
   */
  checkUserInfo(openid) {
    console.log('[family.js checkUserInfo] Checking user info for openid:', openid);
    const db = wx.cloud.database();
    return db.collection('users').where({ _openid: openid }).get()
      .then(res => {
        let userBabyInfo = null;
        if (res.data && res.data.length > 0) {
           userBabyInfo = res.data[0].babyInfo; // 可能为 null 或 object
           console.log('[family.js checkUserInfo] Found user record. BabyInfo:', userBabyInfo);
           if (userBabyInfo) {
              this.setData({ babyInfo: userBabyInfo }); // 更新页面存储的 babyInfo
              wx.setStorageSync('babyInfo', userBabyInfo); // 也更新缓存
           } else {
              // 用户记录存在，但没有 babyInfo，可能需要引导设置
              console.log('[family.js checkUserInfo] User record exists, but babyInfo is missing/null.');
              // 清空页面和缓存中的 babyInfo，防止残留旧数据
              const defaultBaby = { avatarUrl: '', nickName: '宝宝', birthDate: '' }; // 或使用 my.js 的常量
              this.setData({ babyInfo: defaultBaby });
              wx.setStorageSync('babyInfo', defaultBaby);
           }
        } else {
            // 按理说 login 成功后调用，用户记录应该已存在 (joinFamily会创建)
            // 但以防万一，如果还未找到用户记录
            console.warn('[family.js checkUserInfo] User record not found even after login for openid:', openid);
            // 也许需要创建用户？ 但 joinFamily 应该做了，这里暂时只清空信息
             const defaultBaby = { avatarUrl: '', nickName: '宝宝', birthDate: '' };
             this.setData({ babyInfo: defaultBaby });
             wx.setStorageSync('babyInfo', defaultBaby);
        }
        
        // --- 关键：登录和检查用户信息完成后，处理待处理的邀请码 ---
        if (this.data.pendingInviteCode) {
          console.log('[family.js checkUserInfo] Login complete, processing pending invite code:', this.data.pendingInviteCode);
          const codeToProcess = this.data.pendingInviteCode;
          this.setData({ pendingInviteCode: null }); // 清除待处理状态
          this.handleInvitation(codeToProcess); // 调用处理邀请的函数
        } else {
          // 如果没有待处理邀请码，登录后应该重新加载家庭信息
          console.log('[family.js checkUserInfo] Login complete, no pending invite code, reloading family info.');
          this.loadFamilyInfo();
        }
        // ---------------------------------------------------
        
      })
      .catch(err => {
        console.error('[family.js checkUserInfo] Check user info failed:', err);
        wx.showToast({ title: '检查用户信息失败', icon: 'none' });
        // 检查失败，也尝试处理邀请码？或者提示后引导？
        // 为保持流程，即使检查失败，如果 PENDING 邀请码存在，也尝试处理
         if (this.data.pendingInviteCode) {
           console.warn('[family.js checkUserInfo] Check failed, but attempting to process pending invite code anyway.');
           const codeToProcess = this.data.pendingInviteCode;
           this.setData({ pendingInviteCode: null }); 
           this.handleInvitation(codeToProcess);
         } else {
           // 没有邀请码，检查失败，停留在当前页提示
         }
      });
  }
}) 