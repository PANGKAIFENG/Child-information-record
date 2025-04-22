// 统计分析页面

// --- 移除 ECharts 引入 ---
// import * as echarts from '../../components/ec-canvas/echarts';
// import { CanvasRenderer } from 'echarts/renderers';
// import { LineChart, BarChart } from 'echarts/charts';
// import {
//   GridComponent,
//   TooltipComponent,
//   LegendComponent,
// } from 'echarts/components';

// if (echarts.use) {
//     echarts.use([
//       CanvasRenderer,
//       LineChart,
//       BarChart,
//       GridComponent,
//       TooltipComponent,
//       LegendComponent,
//     ]);
//     console.log('[ECharts] Registered components for tree shaking.');
// } else {
//     console.error("echarts.use is not available...");
// }
// --- 移除结束 ---

import { getAllRecords } from '../../utils/storage';
import { formatDate, getDateRange } from '../../utils/time';

// 1. 引入 wx-charts
const wxCharts = require('../../utils/wx-charts.js'); // 确保路径正确

// --- 可以移除之前注释掉的 ECharts initChart 函数 ---

// 存储图表实例，方便后续操作（例如更新数据、处理交互）
let feedingChart = null;
let sleepChart = null;
let excretionChart = null;

Page({
  data: {
    // 移除 activeTabIndex
    // dateRange 也不再需要，由 selectedDimensionIndex 控制
    // metrics 对象结构也调整，直接绑定到 coreMetrics
    coreMetrics: { // 用于 WXML 绑定
        totalFeedingCount: undefined,
        avgMilk: undefined,
        avgSleep: undefined,
        totalExcretion: undefined
    },
    
    timeDimensions: ['今天', '昨天', '本周', '本月'],
    selectedDimensionIndex: 2,
    startDate: '',
    endDate: '',

    // 移除 ecFeeding, ecSleep, ecExcretion
    chartData: { // chartData 结构基本可用，excretion 需要适配 series
      feeding: { xAxis: [], series: [] },
      sleep: { xAxis: [], series: [] },
      excretion: { xAxis: [], peeSeries: [], poopSeries: [] }
    },
    chartWidth: 300 // 重新加入 chartWidth
  },

  onLoad: function(options) {
    // 重新加入宽度计算
    const sysInfo = wx.getSystemInfoSync();
    this.setData({
      chartWidth: sysInfo.windowWidth * 0.9 // 或其他合适的计算
    });
  },

  onReady: function() {
    console.log("[统计页面] onReady 被触发");
    wx.nextTick(() => {
        console.log("[统计页面] onReady -> nextTick: 回调开始");
        // !! 取消注释，恢复数据加载 !!
        this.handleDimensionChange(this.data.selectedDimensionIndex);
        // 移除所有诊断代码
    });
  },

  onShow: function() {
    console.log("[统计页面] onShow 被触发");
    // 保留这里的逻辑，只有图表实例存在时才刷新
    if (feedingChart || sleepChart || excretionChart) {
        this.handleDimensionChange(this.data.selectedDimensionIndex);
    } else {
        console.log("[统计页面] onShow: 图表尚未初始化，等待 onReady 完成");
    }
  },

  // 移除 switchTab 函数

  // 移除 switchDateRange 函数 (已改为 bindDimensionChange)

  // 移除 fetchStatisticsData 函数 (逻辑已合并到 loadAndProcessData)

  // 移除 fetchTabData 函数

  // 移除 navigateTo 函数 (如果只用于底部导航)

  bindDimensionChange: function (e) {
    const index = parseInt(e.detail.value, 10);
    this.setData({
      selectedDimensionIndex: index
    });
    this.handleDimensionChange(index);
  },

  handleDimensionChange: function (index) {
    const { startDate, endDate } = getDateRange(index);
    this.setData({ startDate, endDate });
    console.log(`Loading data for: ${this.data.timeDimensions[index]} (${startDate} to ${endDate})`);
    this.loadAndProcessData(startDate, endDate);
  },

  loadAndProcessData: function (startDate, endDate) {
    wx.showLoading({ title: '加载中...' });
    
    // 调用修改后的 getAllRecords，传入日期范围
    getAllRecords({ startDate, endDate }).then(allRecords => {
      // 不再需要前端筛选，因为 getAllRecords 内部已经按日期范围查询了
      // const filteredRecords = allRecords.filter(record => {
      //   const recordDate = record.date;
      //   return recordDate >= startDate && recordDate <= endDate;
      // });

      // 直接使用 allRecords 进行处理
      console.log(`[statistics] 获取到符合条件的记录数量: ${allRecords.length}, 日期范围: ${startDate} 到 ${endDate}`);
      
      if (allRecords.length > 0) {
        console.log('[statistics] 第一条记录:', allRecords[0]);
      }

      // Process data for charts and metrics using allRecords
      const processedData = this.processRecordsForStats(allRecords, startDate, endDate);

      // Update core metrics display
      this.updateCoreMetrics(processedData.metrics);

      // Initialize/Update charts
      this.renderCharts(processedData.charts);
      
      wx.hideLoading();
    }).catch(error => {
      console.error("Error loading or processing data:", error);
      wx.hideLoading();
      wx.showToast({ title: '加载数据失败', icon: 'none' });
    });
  },

  processRecordsForStats: function (records, startDate, endDate) {
    const dailyStats = {}; // Store stats per day: { 'YYYY-MM-DD': { milk: 0, sleep: 0, pee: 0, poop: 0, sleepCounted: false } }
    let totalMilk = 0;
    let totalFeedingCount = 0;
    let totalSleepDuration = 0;
    let sleepRecordDays = 0; // Count days with any sleep records
    let totalPee = 0;
    let totalPoop = 0;

    // Initialize dailyStats for the entire range
    let currentDate = new Date(startDate.replace(/-/g, '/'));
    const end = new Date(endDate.replace(/-/g, '/'));
    while (currentDate <= end) {
        const dateStr = formatDate(currentDate);
        dailyStats[dateStr] = { milk: 0, sleep: 0, pee: 0, poop: 0, sleepCounted: false };
        currentDate.setDate(currentDate.getDate() + 1);
    }

    // Aggregate data from records
    records.forEach(record => {
      const date = record.date;
      if (dailyStats[date]) { // Ensure the date is within our range
        switch (record.recordType) {
          case 'feeding':
            // 正确处理喂养记录的奶量
            if (record.feedingType === '母乳' || record.feedingType === '奶粉') {
              // 优先使用amount字段
              let milkAmount = 0;
              if (record.amount && !isNaN(parseFloat(record.amount))) {
                milkAmount = parseFloat(record.amount);
              } 
              // 如果是母乳且没有amount但有duration，估算奶量
              else if (record.feedingType === '母乳' && record.duration && !isNaN(parseFloat(record.duration))) {
                milkAmount = parseFloat(record.duration) * 10; // 每分钟约10ml
              }
              
              if (milkAmount > 0) {
                dailyStats[date].milk += milkAmount;
                totalMilk += milkAmount;
                console.log(`[statistics] 记录奶量: ${milkAmount}ml, 类型: ${record.feedingType}, 日期: ${date}`);
              }
            }
            totalFeedingCount++; // Count all feeding records
            break;
          case 'sleep':
            const sleepDuration = parseFloat(record.duration || 0);
            if (sleepDuration > 0) {
              dailyStats[date].sleep += sleepDuration;
              totalSleepDuration += sleepDuration;
              // Count this day for average calculation if it hasn't been counted yet
              if (!dailyStats[date].sleepCounted) {
                sleepRecordDays++;
                dailyStats[date].sleepCounted = true;
              }
            }
            break;
          case 'excretion':
            // 确认排泄记录的类型并计数
            if (record.excretionType === '尿布' || record.type === 'pee') {
              dailyStats[date].pee++;
              totalPee++;
            } else if (record.excretionType === '便便' || record.type === 'poop') {
              dailyStats[date].poop++;
              totalPoop++;
            }
            break;
        }
      }
    });

    // Prepare data for ECharts
    const dates = Object.keys(dailyStats).sort(); // Get sorted dates for X-axis
    const feedingSeriesData = dates.map(date => dailyStats[date].milk);
    const sleepSeriesData = dates.map(date => parseFloat(dailyStats[date].sleep.toFixed(1)));
    const peeSeriesData = dates.map(date => dailyStats[date].pee);
    const poopSeriesData = dates.map(date => dailyStats[date].poop);

    // Format dates for X-axis (e.g., 'MM-DD')
    const xAxisDates = dates.map(date => date.substring(5));

    // Calculate overall metrics for the period
    const periodDays = dates.length || 1; // Avoid division by zero
    const metrics = {
        // 显示总奶量而非平均奶量
      avgMilk: Math.round(totalMilk), // 总奶量(ml)
      totalFeedingCount: totalFeedingCount,
       // 平均睡眠时间取整，不显示小数
      avgSleep: sleepRecordDays > 0 ? Math.round(totalSleepDuration / sleepRecordDays).toString() : '0',
      totalExcretion: totalPee + totalPoop,
      // Add other metrics as needed (e.g., total sleep for the period)
      totalSleepPeriod: Math.round(totalSleepDuration).toString()
    };

    return {
      metrics: metrics,
      charts: {
        feeding: { xAxis: xAxisDates, series: feedingSeriesData },
        sleep: { xAxis: xAxisDates, series: sleepSeriesData },
        excretion: { xAxis: xAxisDates, peeSeries: peeSeriesData, poopSeries: poopSeriesData }
      }
    };
  },

  updateCoreMetrics: function(metrics) {
      // 直接更新 data 下的 coreMetrics 对象
      this.setData({
          coreMetrics: {
              totalFeedingCount: metrics.totalFeedingCount,
              avgMilk: metrics.avgMilk,
              avgSleep: metrics.avgSleep,
              totalExcretion: metrics.totalExcretion
              // totalSleepPeriod: metrics.totalSleepPeriod // 如果需要显示
          }
      });
  },

  // 2. 重写 renderCharts 函数
  renderCharts: function (chartData) {
    console.log("[statistics] Rendering charts with wx-charts. Data:", chartData);
    if (!chartData) {
        console.warn("[statistics] No chart data provided to renderCharts.");
        return;
    }

    // 使用 wx.nextTick 确保 DOM 更新后再查询
    wx.nextTick(() => {
        this.renderChartsWithQuery(chartData); // 调用包含查询逻辑的函数
    });
  },

  // 3. 移除旧的 ECharts Option 生成函数
  // getFeedingOption: function (data) { ... },
  // getSleepOption: function (data) { ... },
  // getExcretionOption: function (data) { ... }

  // 可以添加图表交互处理函数，例如：
  // handleChartTouch: function(e) {
  //   console.log("Chart touch event:", e);
  //   // wxCharts 实例通常有 showToolTip 方法
  //   const chartInstance = e.target.id === 'feeding-chart-canvas' ? feedingChart : ...; // 判断是哪个图表
  //   chartInstance.showToolTip(e, {
  //      // tooltip 配置
  //   });
  // }

  // !! 重命名旧的 renderCharts，移除 setTimeout !!
  renderChartsWithQuery: function (chartData) {
    console.log("[statistics] Rendering charts with fixed dimensions after nextTick. Data:", chartData);

    // !! 不再使用 createSelectorQuery !!
    const chartWidth = this.data.chartWidth;
    const chartHeight = 200; // 使用 WXML 中设置的高度

    // --- 喂养图表 ---
    if (chartData.feeding && chartData.feeding.xAxis.length > 0) {
        feedingChart = new wxCharts({
            canvasId: 'feeding-chart', type: 'column', categories: chartData.feeding.xAxis,
            series: [{ name: '奶量(ml)', data: chartData.feeding.series }],
            yAxis: { format: (val) => val.toFixed(0), title: '奶量 (ml)', min: 0 },
            xAxis: { disableGrid: true },
            width: chartWidth, // 使用 this.data.chartWidth
            height: chartHeight, // 使用固定高度
            dataLabel: false, legend: false,
        });
        console.log(`[statistics] Feeding chart initialized.`);
    } else { console.warn("[statistics] No data for feeding chart."); }

    // --- 睡眠图表 ---
    if (chartData.sleep && chartData.sleep.xAxis.length > 0) {
         sleepChart = new wxCharts({
             canvasId: 'sleep-chart', type: 'column', categories: chartData.sleep.xAxis,
             series: [{ name: '睡眠(小时)', data: chartData.sleep.series }],
             yAxis: { format: (val) => val.toFixed(1), title: '时长 (小时)', min: 0 },
             xAxis: { disableGrid: true },
             width: chartWidth, // 使用 this.data.chartWidth
             height: chartHeight, // 使用固定高度
             dataLabel: false, legend: false
         });
         console.log(`[statistics] Sleep chart initialized.`);
     } else { console.warn("[statistics] No data for sleep chart."); }

    // --- 排泄图表 ---
    if (chartData.excretion && chartData.excretion.xAxis.length > 0) {
         const pointCount = chartData.excretion.xAxis.length;
         // 这里的宽度计算可以基于 this.data.chartWidth
         const estimatedDrawableWidth = chartWidth * 0.8;
         const columnWidth = Math.max(5, Math.min(15, (estimatedDrawableWidth / pointCount / 2) * 0.8));
         excretionChart = new wxCharts({
             canvasId: 'excretion-chart', type: 'column', categories: chartData.excretion.xAxis,
             series: [ { name: '小便', data: chartData.excretion.peeSeries }, { name: '大便', data: chartData.excretion.poopSeries } ],
             yAxis: { format: (val) => val.toFixed(0), title: '次数', min: 0 },
             xAxis: { disableGrid: true },
             width: chartWidth, // 使用 this.data.chartWidth
             height: chartHeight, // 使用固定高度
             dataLabel: false, legend: true, extra: { column: { width: columnWidth } }
         });
         console.log(`[statistics] Excretion chart initialized.`);
     } else { console.warn("[statistics] No data for excretion chart."); }
  },

}); 