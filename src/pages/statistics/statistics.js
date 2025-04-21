// 统计分析页面
import * as echarts from '../../components/ec-canvas/echarts'; // Import ECharts
import { getAllRecords } from '../../utils/storage'; // Assuming a utility function to get all records
import { formatDate, getDateRange } from '../../utils/time'; // Assuming utility functions for time/date

// Helper to initialize charts
function initChart(canvasId, ecComponent, option) {
  if (!ecComponent) {
      console.error(`Component for canvasId '${canvasId}' not found.`);
      return;
  }
  // Ensure the component is ready before initializing
  ecComponent.init((canvas, width, height, dpr) => {
    const chart = echarts.init(canvas, null, {
      width: width,
      height: height,
      devicePixelRatio: dpr // new Add devicePixelRatio
    });
    canvas.setChart(chart);
    chart.setOption(option);
    console.log(`Chart initialized for ${canvasId}`);
    return chart;
  });
}

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
    selectedDimensionIndex: 0,
    startDate: '',
    endDate: '',

    ecFeeding: {
      lazyLoad: true
    },
    ecSleep: {
      lazyLoad: true
    },
    ecExcretion: {
      lazyLoad: true
    },
    // chartData 保持不变，用于内部处理
    chartData: {
      feeding: { xAxis: [], series: [] },
      sleep: { xAxis: [], series: [] },
      excretion: { xAxis: [], peeSeries: [], poopSeries: [] }
    }
  },

  onLoad: function(options) {
    // 移除旧的 fetchStatisticsData 调用
  },

  onReady: function() {
    this.feedingChartComponent = this.selectComponent('#feeding-chart-dom');
    this.sleepChartComponent = this.selectComponent('#sleep-chart-dom');
    this.excretionChartComponent = this.selectComponent('#excretion-chart-dom');
    this.handleDimensionChange(this.data.selectedDimensionIndex);
  },

  onShow: function() {
    // ... (保持不变)
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
    // Use Promise.resolve().then() to ensure loading indicator shows
    Promise.resolve().then(() => {
        const allRecords = getAllRecords(); // Fetch all records

        // Filter records by the selected date range
        const filteredRecords = allRecords.filter(record => {
            return record.date >= startDate && record.date <= endDate;
        });

        // Process data for charts and metrics
        const processedData = this.processRecordsForStats(filteredRecords, startDate, endDate);

        // Update core metrics display
        this.updateCoreMetrics(processedData.metrics);

        // Update chart data in state (optional, as options are generated directly)
        // this.setData({ chartData: processedData.charts });

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
            // Only count valid milk amounts
            if ((record.feedingType === '母乳' || record.feedingType === '配方奶')) {
              const milkAmount = parseInt(record.amount || 0);
              if (milkAmount > 0) {
                dailyStats[date].milk += milkAmount;
                totalMilk += milkAmount;
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
            if (record.type === 'pee') {
              dailyStats[date].pee++;
              totalPee++;
            } else if (record.type === 'poop') {
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
        // Avg milk per feeding event in the period
      avgMilk: totalFeedingCount > 0 ? Math.round(totalMilk / totalFeedingCount) : 0,
      totalFeedingCount: totalFeedingCount,
       // Avg sleep per day THAT HAD sleep records in the period
      avgSleep: sleepRecordDays > 0 ? (totalSleepDuration / sleepRecordDays).toFixed(1) : '0.0',
      totalExcretion: totalPee + totalPoop,
      // Add other metrics as needed (e.g., total sleep for the period)
      totalSleepPeriod: totalSleepDuration.toFixed(1)
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

  renderCharts: function (chartData) {
    // Check if components are ready before initializing
    if (this.feedingChartComponent) {
        console.log("Initializing feeding chart...");
        initChart('feeding-chart', this.feedingChartComponent, this.getFeedingOption(chartData.feeding));
    } else {
        console.warn("Feeding chart component not ready.")
    }
    if (this.sleepChartComponent) {
         console.log("Initializing sleep chart...");
        initChart('sleep-chart', this.sleepChartComponent, this.getSleepOption(chartData.sleep));
    } else {
         console.warn("Sleep chart component not ready.")
    }
    if (this.excretionChartComponent) {
         console.log("Initializing excretion chart...");
        initChart('excretion-chart', this.excretionChartComponent, this.getExcretionOption(chartData.excretion));
    } else {
         console.warn("Excretion chart component not ready.")
    }
  },

  // --- ECharts Option Generators --- //
  getFeedingOption: function (data) {
    return {
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'category', boundaryGap: false, data: data.xAxis },
      yAxis: { type: 'value', name: '奶量 (ml)' },
      series: [{
        name: '总奶量',
        type: 'line',
        smooth: true,
        data: data.series,
        itemStyle: { color: 'var(--primary-color)' },
        lineStyle: { color: 'var(--primary-color)' }
      }],
      color: ['var(--primary-color)']
    };
  },

  getSleepOption: function (data) {
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'category', data: data.xAxis },
      yAxis: { type: 'value', name: '时长 (小时)' },
      series: [{
        name: '总睡眠',
        type: 'bar',
        barWidth: '60%',
        data: data.series,
        itemStyle: { color: 'var(--primary-color)' }
      }],
      color: ['var(--primary-color)']
    };
  },

  getExcretionOption: function (data) {
    // Define specific colors, potentially using CSS variables if needed
    const peeColor = '#87CEFA'; // Light Sky Blue
    const poopColor = '#CD853F'; // Peru (Brownish)
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { data: ['小便', '大便'], top: 'bottom' },
      grid: { left: '3%', right: '4%', bottom: '10%', containLabel: true },
      xAxis: { type: 'category', data: data.xAxis },
      yAxis: { type: 'value', name: '次数' },
      series: [
        {
          name: '小便',
          type: 'bar',
          stack: '总量',
          barWidth: '60%',
          data: data.peeSeries,
          itemStyle: { color: peeColor }
        },
        {
          name: '大便',
          type: 'bar',
          stack: '总量',
          data: data.poopSeries,
          itemStyle: { color: poopColor }
        }
      ],
      color: [peeColor, poopColor] // Set default colors for legend etc.
    };
  }
}) 