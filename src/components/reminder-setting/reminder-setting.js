Component({
  /**
   * 组件的属性列表
   */
  properties: {
    initialEnabled: {
      type: Boolean,
      value: false
    },
    initialHours: {
      type: Number,
      value: 3
    },
    initialMinutes: {
      type: Number,
      value: 0
    },
    // 喂养记录需要申请的消息模板 ID，需要替换成你自己的
    tmplId: {
        type: String,
        value: '58y3Xv0CmTCdnlHLCaG-v7riiT_GXu-xU3RFBSr0V1o' // !! 重要：请替换为你的小程序订阅消息模板 ID
    }
  },

  /**
   * 组件的初始数据
   */
  data: {
    enabled: false,
    hours: 3,
    minutes: 0,
    timeRange: [], // 小时和分钟的范围
    pickerValue: [3, 0], // picker 的初始值 [hourIndex, minuteIndex]
  },

  /**
   * 组件的方法列表
   */
  methods: {
    // 内部方法：更新 Picker 的值
    _updatePickerValue() {
      const hourIndex = this.data.hours;
      const minuteIndex = this.data.minutes;
      this.setData({ pickerValue: [hourIndex, minuteIndex] });
    },

    // 内部方法：触发 change 事件
    _triggerChange() {
      this.triggerEvent('change', {
        enabled: this.data.enabled,
        hours: this.data.hours,
        minutes: this.data.minutes
      });
    },

    // 开关状态变化
    onSwitchChange(e) {
      const targetEnabled = e.detail.value;
      if (targetEnabled) {
        // 尝试开启，请求权限
        const that = this;
        wx.requestSubscribeMessage({
          tmplIds: [this.properties.tmplId], // 需要申请接收下发消息的模板 id 列表
          success (res) {
            if (res[that.properties.tmplId] === 'accept') {
              // 用户同意
              console.log('用户同意订阅消息');
              that.setData({ enabled: true });
              that._triggerChange();
            } else {
              // 用户拒绝或发生错误，保持关闭状态
              console.log('用户拒绝或订阅失败', res);
              // 这里需要显式地将 switch 组件的状态设置回去，因为它可能已经乐观地变成了 true
              that.setData({ enabled: false }); 
              wx.showToast({
                title: '需要授权才能开启提醒',
                icon: 'none'
              });
            }
          },
          fail (err) {
            console.error('请求订阅消息失败', err);
            that.setData({ enabled: false });
            wx.showToast({
              title: '请求授权失败',
              icon: 'none'
            });
          }
        });
      } else {
        // 关闭
        this.setData({ enabled: false });
        this._triggerChange();
      }
    },

    // 时间选择器变化
    onTimeChange(e) {
      const val = e.detail.value; // [hourIndex, minuteIndex]
      this.setData({
        hours: val[0], 
        minutes: val[1],
        pickerValue: val
      });
      this._triggerChange();
    }
  },

  /**
   * 组件生命周期函数，在组件实例进入页面节点树时执行
   */
  lifetimes: {
    attached: function() {
      // 初始化时间范围
      const hours = [];
      const minutes = [];
      for (let i = 0; i < 24; i++) {
        hours.push({ value: i, label: `${i}小时` });
      }
      for (let i = 0; i < 60; i++) {
        minutes.push({ value: i, label: `${i}分钟` });
      }

      // 初始化状态
      this.setData({
        enabled: this.properties.initialEnabled,
        hours: this.properties.initialHours,
        minutes: this.properties.initialMinutes,
        timeRange: [hours, minutes]
      });

      // 更新 picker 的初始选中值
      this._updatePickerValue();
    }
  }
}) 