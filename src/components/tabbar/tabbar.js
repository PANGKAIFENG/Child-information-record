// 底部导航栏组件
Component({
  /**
   * 组件的属性列表
   */
  properties: {
    active: {
      type: String,
      value: 'home' // 默认选中首页
    }
  },

  /**
   * 组件的方法列表
   */
  methods: {
    // 切换页面
    switchTab(e) {
      const page = e.currentTarget.dataset.page;
      // 如果点击的是当前页，不做跳转
      if (page === this.data.active) {
        return;
      }
      // 跳转到对应页面
      wx.switchTab({
        url: `/pages/${page}/${page}`
      });
    }
  }
}) 