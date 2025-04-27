Component({
  properties: {
    // 当前选中的补剂类型
    currentType: {
      type: String,
      value: '',
      observer: function(newVal) {
        // 当当前选中类型变化时，如果是AD或D3，则更新建议
        if (newVal === 'AD' || newVal === 'D3') {
          this.updateRecommendation();
        }
      }
    }
  },

  data: {
    enabled: false,        // 是否启用轮换助手
    collapsed: false,      // 是否折叠内容区域
    lastRecord: null,      // 最近一次AD/D3记录
    recommendation: '',    // 今日建议服用类型
    loading: false         // 是否正在加载数据
  },

  lifetimes: {
    attached: function() {
      // 从本地存储加载轮换助手的启用状态
      const enabled = wx.getStorageSync('adD3RotationEnabled') || false;
      const collapsed = wx.getStorageSync('adD3RotationCollapsed') || false;
      
      this.setData({ 
        enabled,
        collapsed
      });
      
      // 如果启用了轮换助手，则加载历史记录
      if (enabled) {
        this.loadLastRecord();
      }
    }
  },

  methods: {
    // 切换折叠状态
    toggleCollapsed() {
      const newCollapsed = !this.data.collapsed;
      this.setData({ collapsed: newCollapsed });
      wx.setStorageSync('adD3RotationCollapsed', newCollapsed);
    },
    
    // 开关状态变化
    onSwitchChange(e) {
      const enabled = e.detail.value;
      this.setData({ enabled });
      wx.setStorageSync('adD3RotationEnabled', enabled);
      
      if (enabled) {
        // 如果开启了轮换助手，则加载历史记录
        this.loadLastRecord();
      }
      
      // 触发事件通知父组件
      this.triggerEvent('statuschange', { enabled });
    },
    
    // 加载最近一次AD/D3记录
    loadLastRecord() {
      if (this.data.loading) return;
      
      this.setData({ loading: true });
      
      wx.cloud.callFunction({
        name: 'getRecords',
        data: {
          collectionName: 'supplement_records',
          filter: {
            type: { $in: ['AD', 'D3'] }
          },
          orderBy: { field: 'createTime', direction: 'desc' },
          limit: 1
        }
      })
      .then(res => {
        this.setData({ loading: false });
        
        if (res.result && res.result.success && res.result.data && res.result.data.length > 0) {
          const record = res.result.data[0];
          
          // 格式化日期为YYYY-MM-DD
          let date = record.date;
          if (record.dateTime) {
            const dateObj = new Date(record.dateTime.replace(/-/g, '/'));
            if (!isNaN(dateObj.getTime())) {
              date = dateObj.toISOString().split('T')[0];
            }
          }
          
          this.setData({
            lastRecord: {
              type: record.type,
              date: date,
              amount: record.amount,
              unit: record.unit
            }
          });
          
          this.updateRecommendation();
        } else {
          this.setData({ lastRecord: null, recommendation: '' });
        }
      })
      .catch(err => {
        console.error('获取历史记录失败:', err);
        this.setData({ 
          loading: false,
          lastRecord: null, 
          recommendation: '' 
        });
        
        wx.showToast({
          title: '获取历史记录失败',
          icon: 'none'
        });
      });
    },
    
    // 更新今日建议
    updateRecommendation() {
      if (!this.data.lastRecord) {
        // 如果没有历史记录，默认推荐AD
        this.setData({ recommendation: 'AD' });
        return;
      }
      
      // 如果上次是AD，推荐D3；如果上次是D3，推荐AD
      const recommendation = this.data.lastRecord.type === 'AD' ? 'D3' : 'AD';
      this.setData({ recommendation });
      
      // 触发事件通知父组件
      this.triggerEvent('recommendationchange', { recommendation });
    },
    
    // 手动刷新数据
    refresh() {
      if (this.data.enabled) {
        this.loadLastRecord();
      }
    },
    
    // 快速选择按钮点击事件
    onQuickSelect() {
      if (!this.data.enabled || !this.data.recommendation) {
        return;
      }
      
      // 触发事件通知父组件，请求选择推荐的补剂类型
      this.triggerEvent('quickselect', { type: this.data.recommendation });
    }
  }
}); 