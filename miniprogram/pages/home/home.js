async loadRecentRecords() {
    if (!this.data.openid) {
      console.log('[loadRecentRecords] OpenID not ready.');
      return;
    }
    console.log('[loadRecentRecords] Attempting to load recent records. OpenID from storage:', this.data.openid);
    
    try {
      console.log('[loadRecentRecords] Loading recent records from cloud...');
      const res = await wx.cloud.callFunction({
        name: 'getRecentRecords',
        data: { openid: this.data.openid }
      });
      
      console.log('[loadRecentRecords] Raw DB Results:', res.result);
      
      // 关键修改：直接处理 res.result 数组
      // 根据日志，res.result 似乎直接是一个包含4条记录的数组，而不是按类型分组的对象
      let allProcessedRecords = [];
      
      if (Array.isArray(res.result)) {
        // 直接处理数组
        console.log('[loadRecentRecords] Result is an array with length:', res.result.length);
        
        res.result.forEach(record => {
          // 确定记录类型
          let recordType = '';
          if (record.feedingType) recordType = 'feeding';
          else if (record.sleepDuration) recordType = 'sleep';
          else if (record.excretionType) recordType = 'excretion';
          else if (record.supplementType) recordType = 'supplement';
          else recordType = 'unknown';
          
          console.log(`[loadRecentRecords] Processing record of type: ${recordType}`, record);
          
          const processed = this.processRecord(record, recordType);
          if (processed) {
            allProcessedRecords.push(processed);
          }
        });
      } else {
        // 如果不是数组，尝试按原来的方式处理
        console.log('[loadRecentRecords] Result is not an array, trying to process by type');
        
        const recordTypes = ['feeding', 'sleep', 'excretion', 'supplement'];
        recordTypes.forEach(type => {
          console.log(`[loadRecentRecords] Processing records for type: ${type}`);
          const recordsOfType = res.result && res.result[`${type}_records`] ? res.result[`${type}_records`] : [];
          console.log(`[loadRecentRecords] ${type}_records count:`, recordsOfType.length);
          
          recordsOfType.forEach(record => {
            const processed = this.processRecord(record, type);
            if (processed) {
              allProcessedRecords.push(processed);
            }
          });
        });
      }
      
      console.log('[loadRecentRecords] All processed records before sort:', allProcessedRecords);
      
      // 按时间戳降序排序
      allProcessedRecords.sort((a, b) => b.timestamp - a.timestamp);
      console.log('[loadRecentRecords] All processed records after sort:', allProcessedRecords);
      
      // 格式化时间并更新数据
      const formattedRecords = allProcessedRecords.map(record => ({
        ...record,
        displayTime: this.formatDisplayTime(record.timestamp)
      }));
      
      this.setData({ recentRecords: formattedRecords });
      console.log('Formatted recent records:', this.data.recentRecords);
    } catch (err) {
      console.error('[loadRecentRecords] Error loading recent records:', err);
      wx.showToast({ title: '加载记录失败', icon: 'none' });
    }
  },