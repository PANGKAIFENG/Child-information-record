// 首页逻辑
import { calculateAge } from '../../utils/util.js'; // 导入计算年龄函数

const DEFAULT_AVATAR = '/src/assets/images/Avatar.png'; // 默认头像路径

Page({
  data: {
    isLoggedIn: false, // 新增：登录状态
    babyInfo: {        // 宝宝信息
      avatarUrl: DEFAULT_AVATAR, // 默认头像
      nickName: '宝宝', // 默认昵称
      birthDate: null,
      age: '' // 年龄
    },
    todayStats: {      // 今日统计
      feedingCount: 0,
      totalMilk: 0,
      sleepHours: 0,
      excretionCount: 0
    },
    recentRecords: [] // 最近记录
  },

  onLoad: function() {
    // 加载初始数据
    this.loadBabyInfo();
    this.loadTodayStats();
    this.loadRecentRecords();
  },

  onShow: function() {
    console.log('Home page onShow');
    // 检查登录状态和宝宝信息
    const userLoggedIn = wx.getStorageSync('isLoggedIn') || false;
    const storedBabyInfo = wx.getStorageSync('babyInfo');
    let currentBabyInfo = this.data.babyInfo; // 先用默认值
    let babyAge = '';

    if (userLoggedIn && storedBabyInfo) {
      // 如果已登录且缓存中有信息，则使用缓存信息
      currentBabyInfo = storedBabyInfo;
      // 计算年龄
      if (currentBabyInfo.birthDate) {
        babyAge = calculateAge(currentBabyInfo.birthDate);
      }
      // 确保头像有值（如果缓存是旧的空值，用默认）
      if (!currentBabyInfo.avatarUrl) {
          currentBabyInfo.avatarUrl = DEFAULT_AVATAR;
      }
    } else {
      // 未登录或无信息，确保使用默认值
      currentBabyInfo = {
          avatarUrl: DEFAULT_AVATAR,
          nickName: '宝宝', // 或提示登录
          birthDate: null,
          age: '请先登录'
      };
    }
    
    currentBabyInfo.age = babyAge; // 更新年龄

    this.setData({
      isLoggedIn: userLoggedIn,
      babyInfo: currentBabyInfo
    });

    // 加载其他数据（统计和最近记录）
    if (userLoggedIn) {
      this.loadTodayStats();
      this.loadRecentRecords();
    } else {
      // 未登录状态下清空或设置默认统计/记录
      this.setData({
          todayStats: { feedingCount: '-', totalMilk: '-', sleepHours: '-', excretionCount: '-' },
          recentRecords: [] 
      });
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
   * 加载今日统计 (从云数据库获取)
   */
  async loadTodayStats() {
    // --- 添加日志 ---
    const storedOpenidForStats = wx.getStorageSync('openid');
    console.log('[loadTodayStats] Attempting to load stats. OpenID from storage:', storedOpenidForStats);
    // --- 日志结束 ---
    
    if (!this.data.isLoggedIn) {
      this.setData({
        todayStats: { feedingCount: '-', totalMilk: '-', sleepHours: '-', excretionCount: '-' }
      });
      return;
    }
    
    console.log('Loading today stats from cloud...');
    if (!storedOpenidForStats) {
      console.warn('OpenID not found in storage for loading stats.');
      return;
    }

    const db = wx.cloud.database();
    const _ = db.command;

    // 获取今天的日期范围 (YYYY-MM-DD 字符串)
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    const todayDateStr = `${year}-${month}-${day}`; // 使用本地日期字符串进行查询
    
    try {
      const queryResults = await Promise.all([
        db.collection('feeding_records')
          .where({
            _openid: storedOpenidForStats,
            recordDate_local: todayDateStr // 修改查询条件为 recordDate_local
          })
          .get(),
        db.collection('sleep_records')
          .where({
            _openid: storedOpenidForStats,
            recordDate_local: todayDateStr // 修改查询条件为 recordDate_local
          })
          .get(),
        db.collection('excretion_records')
          .where({
            _openid: storedOpenidForStats,
            recordDate_local: todayDateStr // 修改查询条件为 recordDate_local
          })
          .get()
      ]);
      
      // 使用数组索引获取各个结果
      const feedingResult = queryResults[0];
      const sleepResult = queryResults[1]; 
      const excretionResult = queryResults[2];

      console.log('[loadTodayStats] Raw DB Results:', { feedingResult, sleepResult, excretionResult });
      
      // 计算喂养次数和总奶量
      const feedingCount = feedingResult.data.length;
      let totalMilk = 0;
      feedingResult.data.forEach(record => {
        // 调试：打印每条记录的奶量和时长信息
        console.log('[计算奶量] 记录:', record.feedingType, 
                   '奶量:', record.amount, 
                   '时长:', record.duration);
        
        // 奶粉喂养：使用amount字段
        if (record.feedingType === '奶粉' && record.amount && !isNaN(parseFloat(record.amount))) {
          totalMilk += parseFloat(record.amount);
        } 
        // 母乳喂养：根据表单中提供的amount字段或估算
        else if (record.feedingType === '母乳') {
          if (record.amount && !isNaN(parseFloat(record.amount))) {
            totalMilk += parseFloat(record.amount);
          }
          // 如果没有奶量但有时长，启用基于时长估算
          else if (record.duration && !isNaN(parseFloat(record.duration))) {
            const estimatedMilk = parseFloat(record.duration) * 10; // 每分钟约10ml
            totalMilk += estimatedMilk;
            console.log('[计算奶量] 基于时长估算:', record.duration, '分钟 =', estimatedMilk, 'ml');
          }
        }
      });
      
      // 计算睡眠总时长
      let totalSleepHours = 0;
      sleepResult.data.forEach(record => {
        if (record.duration && !isNaN(parseFloat(record.duration))) {
          totalSleepHours += parseFloat(record.duration);
        }
      });
      totalSleepHours = Math.round(totalSleepHours * 10) / 10;
      
      // 计算排泄次数
      const excretionCount = excretionResult.data.length;
      
      // 更新页面数据
      this.setData({
        todayStats: {
          feedingCount: feedingCount,
          totalMilk: totalMilk,
          sleepHours: totalSleepHours,
          excretionCount: excretionCount
        }
      });
      
      console.log('Today stats loaded:', this.data.todayStats);
      
    } catch (e) {
      console.error('Error loading today stats:', e);
      this.setData({
        todayStats: { feedingCount: '-', totalMilk: '-', sleepHours: '-', excretionCount: '-' }
      });
    }
  },

  /**
   * 加载最近记录 (从云数据库获取)
   */
  async loadRecentRecords() {;
    // --- 添加日志 ---
    const storedOpenidForRecent = wx.getStorageSync('openid');
    console.log('[loadRecentRecords] Attempting to load recent records. OpenID from storage:', storedOpenidForRecent);
    // --- 日志结束 ---
    
    if (!this.data.isLoggedIn) {
      console.log('未登录状态，不加载最近记录');
      this.setData({ recentRecords: [] }); // 未登录则清空
      return;
    }
    console.log('Loading recent records from cloud...');
    if (!storedOpenidForRecent) {
      console.warn('OpenID not found in storage for loading records.');
      this.setData({ recentRecords: [] });
      return;
    }

    const db = wx.cloud.database();
    const _ = db.command;
    const MAX_RECENT_RECORDS = 5;

    try {
      const recordTypes = [
        { collection: 'feeding_records', type: 'feeding', icon: '/src/assets/images/feeding_icon.png' },
        { collection: 'sleep_records', type: 'sleep', icon: '/src/assets/images/sleep_icon.png' },
        { collection: 'excretion_records', type: 'excretion', icon: '/src/assets/images/excretion_icon.png' },
        { collection: 'supplement_records', type: 'supplement', icon: '/src/assets/images/supplement_icon.png' }
      ];

      const queryPromises = recordTypes.map(rt => 
        db.collection(rt.collection)
          .where({ _openid: storedOpenidForRecent })
          .orderBy('createTime', 'desc')
          .limit(MAX_RECENT_RECORDS)
          .get()
      );

      const queryResults = await Promise.all(queryPromises);
      console.log('[loadRecentRecords] Raw DB Results:', queryResults);
      
      // 检查每个结果集的数据量
      queryResults.forEach((res, idx) => {
        console.log(`[loadRecentRecords] ${recordTypes[idx].collection} records count:`, res.data?.length || 0);
        if (res.data && res.data.length > 0) {
          // 显示第一条记录的完整内容进行调试
          console.log(`[loadRecentRecords] First record from ${recordTypes[idx].collection}:`, 
                       JSON.stringify(res.data[0]));
        }
      });

      let allRecentRecords = [];
      queryResults.forEach((res, index) => {
        const recordTypeInfo = recordTypes[index];
        console.log(`[loadRecentRecords] Processing records for type: ${recordTypeInfo.type}`);
        res.data.forEach((record, recordIndex) => {
          console.log(`[loadRecentRecords] Raw record ${recordIndex} from ${recordTypeInfo.type}:`, record);
          try {
            const formattedTime = this.formatRecordTime(record.createTime);
            console.log(`[loadRecentRecords] Formatted time for record ${recordIndex}:`, formattedTime);
            const formattedDetail = this.formatRecordDetail(recordTypeInfo.type, record);
            console.log(`[loadRecentRecords] Formatted detail for record ${recordIndex}:`, formattedDetail);
            
            const processedRecord = {
              _id: record._id,
              type: recordTypeInfo.type,
              icon: recordTypeInfo.icon,
              createTime: record.createTime,
              time: formattedTime,
              detail: formattedDetail
            };
            console.log(`[loadRecentRecords] Processed record ${recordIndex}:`, processedRecord);
            allRecentRecords.push(processedRecord);

          } catch (formatError) {
            console.error(`[loadRecentRecords] Error formatting record ${recordIndex} of type ${recordTypeInfo.type}:`, formatError, 'Raw record:', record);
            // 如果格式化出错，可以选择跳过这条记录，或者给一个默认值
          }
        });
      });

      console.log('[loadRecentRecords] All processed records before sort:', allRecentRecords);
      // 排序逻辑 - 修改为更健壮的处理方式
      allRecentRecords.sort((a, b) => {
        let timeA = 0;
        let timeB = 0;
        
        try {
          // 尝试从 createTime 获取时间戳
          if (a.createTime) {
            if (a.createTime instanceof Date) {
              timeA = a.createTime.getTime();
            } else if (typeof a.createTime === 'string') {
              timeA = new Date(a.createTime).getTime();
            } else if (typeof a.createTime === 'number') {
              timeA = a.createTime;
            } else if (a.createTime.$date) {
              timeA = new Date(a.createTime.$date).getTime();
            }
          }
          
          // 如果 createTime 无效，尝试使用 timestamp 字段
          if (isNaN(timeA) && a.timestamp) {
            timeA = a.timestamp;
          }
          
          // 对 B 记录也做相同处理
          if (b.createTime) {
            if (b.createTime instanceof Date) {
              timeB = b.createTime.getTime();
            } else if (typeof b.createTime === 'string') {
              timeB = new Date(b.createTime).getTime();
            } else if (typeof b.createTime === 'number') {
              timeB = b.createTime;
            } else if (b.createTime.$date) {
              timeB = new Date(b.createTime.$date).getTime();
            }
          }
          
          // 如果 createTime 无效，尝试使用 timestamp 字段
          if (isNaN(timeB) && b.timestamp) {
            timeB = b.timestamp;
          }
        } catch (e) {
          console.error('[sort] Error comparing times:', e, a, b);
          // 出错时返回0，保持原顺序
          return 0;
        }
        
        // 降序排列（最新的在前面）
        return timeB - timeA;
      });
      console.log('[loadRecentRecords] All processed records after sort:', allRecentRecords);

      const finalRecentRecords = allRecentRecords.slice(0, MAX_RECENT_RECORDS);
      console.log('Formatted recent records:', finalRecentRecords);
      this.setData({ recentRecords: finalRecentRecords });

    } catch (e) {
      console.error('Error loading recent records from cloud:', e);
      wx.showToast({ title: '加载最近记录失败', icon: 'none' });
      this.setData({ recentRecords: [] });
    }
  },

  /**
   * 新增：格式化记录显示时间
   */
  formatRecordTime(date) {
    // 调试信息
    console.log('[formatRecordTime] Input date:', date, typeof date);
    
    if (!date) {
      return '--:--'; // 无数据返回占位符
    }
    
    let dateObj;
    try {
      // 如果是 Date 对象
      if (date instanceof Date) {
        dateObj = date;
      } 
      // 如果是字符串，尝试解析
      else if (typeof date === 'string') {
        dateObj = new Date(date);
      } 
      // 如果是数字（时间戳），转换成日期
      else if (typeof date === 'number') {
        dateObj = new Date(date);
      } 
      // 如果是云数据库日期类型，可能有 $date 属性
      else if (date.$date) {
        dateObj = new Date(date.$date);
      }
      
      // 验证是否是有效日期
      if (isNaN(dateObj.getTime())) {
        console.warn('[formatRecordTime] Invalid date', date);
        return '--:--';
      }
      
      const hours = dateObj.getHours().toString().padStart(2, '0');
      const minutes = dateObj.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    } catch (err) {
      console.error('[formatRecordTime] Error parsing date:', err, date);
      return '--:--';
    }
  },

  /**
   * 新增：格式化记录显示详情 (需要根据各种记录的实际字段调整)
   */
  formatRecordDetail(type, record) {
    // 添加调试信息
    console.log('[formatRecordDetail] Processing record type:', type, 'Record:', record);
    
    // --- 根据实际保存的字段进行处理 --- 
    switch (type) {
      case 'feeding':
        // 喂养记录使用 feedingType, amount 字段
        if (record.feedingType === '母乳') {
          // 如果有amount字段，优先显示毫升，否则显示时长
          if (record.amount) {
            return `${record.feedingType} ${record.amount}ml`;
          } else if (record.duration) {
            return `${record.feedingType} ${record.duration}分钟`;
          }
        }
        if (record.feedingType === '奶粉') {
          return `${record.feedingType} ${record.amount || '0'}ml`;
        }
        // 如果没有匹配的类型，返回通用消息
        return record.feedingType || '喂养记录';
        
      case 'sleep':
        // 睡眠记录有 duration 字段
        return `睡眠 ${record.duration || ''}小时`;
        
      case 'excretion':
        // 排泄记录处理
        let detail = record.excretionType || '排泄';
        if(record.properties && record.properties.length > 0) {
          detail += ` (${record.properties.join(',')})`;
        }
        return detail;
        
      case 'supplement':
        // 补剂记录处理
        return `${record.supplementName || '补剂'} ${record.dosage || ''}`;
        
      case 'abnormal':
        // 异常记录处理
        return record.symptom || record.remark || '异常记录';
        
      default:
        return '记录';
    }
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
          // 延迟一点跳转，让 Toast 显示完
          setTimeout(() => {
            wx.switchTab({ url: '/src/pages/my/my' }); // 跳转到"我的"页面
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
        url = '/src/pages/record/feeding/feeding';
        break;
      case 'sleep':
        url = '/src/pages/record/sleep/sleep';
        break;
      case 'excretion':
        url = '/src/pages/record/excretion/excretion';
        break;
      case 'supplement':
        url = '/src/pages/record/supplement/supplement';
        break;
      default:
        console.warn('Unknown record type:', recordType);
        return;
    }
    wx.navigateTo({ url });
  },

  /**
   * 新增：跳转到"我的"页面
   */
  goToMyPage() {
    wx.switchTab({ url: '/src/pages/my/my' });
  }
}) 