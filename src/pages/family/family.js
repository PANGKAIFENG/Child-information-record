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
    showInviteDialog: false
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    // 检查登录状态
    const isLoggedIn = wx.getStorageSync('isLoggedIn') || false;
    this.setData({ isLoggedIn });
    
    // 如果有邀请码参数，处理邀请加入
    if (options && options.inviteCode) {
      this.handleInvitation(options.inviteCode);
    }
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    if (this.data.isLoggedIn) {
      this.loadFamilyInfo();
    } else {
      this.setData({ isLoading: false });
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
      path: `/src/pages/family/family?inviteCode=${inviteCode}`,
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
    wx.switchTab({ url: '/src/pages/my/my' });
  }
}) 