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
    console.log("[统计页面] onShow 被触发");
    // 每次显示页面时，重新加载当前选中维度的数据
    if (this.feedingChartComponent && this.sleepChartComponent && this.excretionChartComponent) {
      // 确保图表组件都已初始化
      this.handleDimensionChange(this.data.selectedDimensionIndex);
      console.log("[统计页面] 已刷新数据");
    } else {
      console.log("[统计页面] 图表组件尚未初始化完成，将在onReady中加载数据");
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
    
    // 使用异步方式获取所有记录
    getAllRecords().then(allRecords => {
      // Filter records by the selected date range
      const filteredRecords = allRecords.filter(record => {
        // 确保日期格式一致用于比较
        const recordDate = record.date;
        return recordDate >= startDate && recordDate <= endDate;
      });

      console.log(`[statistics] 过滤后符合条件的记录数量: ${filteredRecords.length}, 日期范围: ${startDate} 到 ${endDate}`);
      
      // 打印筛选后的记录样本，帮助调试
      if (filteredRecords.length > 0) {
        console.log('[statistics] 筛选后的第一条记录:', filteredRecords[0]);
      }

      // Process data for charts and metrics
      const processedData = this.processRecordsForStats(filteredRecords, startDate, endDate);

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
      tooltip: { 
        trigger: 'axis',
        confine: true,
        formatter: function(params) {
          const param = params[0];
          return `${param.name}<br/>${param.seriesName}: ${param.value} ml`;
        }
      },
      grid: { 
        left: '10%', 
        right: '5%', 
        bottom: '15%', 
        top: '10%',
        containLabel: true 
      },
      dataZoom: [
        // 当数据超过7天时显示滚动条
        data.xAxis.length > 7 ? {
          type: 'slider',
          show: true,
          start: Math.max(0, 100 - (7/data.xAxis.length * 100)), // 默认显示最近7天
          end: 100,
          height: 15,
          bottom: 0,
          borderColor: 'transparent',
          backgroundColor: '#f5f5f5',
          fillerColor: 'rgba(255, 107, 129, 0.2)',
          handleStyle: {
            color: '#ff6b81',
            borderColor: '#ff6b81'
          }
        } : {}
      ],
      xAxis: { 
        type: 'category', 
        boundaryGap: false, 
        data: data.xAxis,
        axisLine: { lineStyle: { color: '#ddd', width: 1 } },
        axisLabel: { 
          color: '#666',
          interval: data.xAxis.length > 10 ? 'auto' : 0,
          rotate: data.xAxis.length > 7 ? 30 : 0,
          fontSize: 10,
          formatter: function(value) {
            // 当日期较多时简化显示
            if (data.xAxis.length > 14) {
              return value.split('-')[1];
            }
            return value;
          }
        },
      },
      yAxis: { 
        type: 'value', 
        name: 'ml',
        nameTextStyle: { color: '#666', fontSize: 10, padding: [0, 0, 0, 10] },
        axisLine: { lineStyle: { color: '#ddd', width: 1 } },
        splitLine: { lineStyle: { color: '#eee', type: 'dashed' } },
        axisLabel: { fontSize: 10 }
      },
      series: [{
        name: '奶量',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        sampling: 'average', // 数据量大时的抽样方法
        data: data.series,
        lineStyle: { 
          width: 2,
          color: '#ff6b81' 
        },
        itemStyle: { 
          color: '#ff6b81',
          borderWidth: 2,
          borderColor: '#fff'
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(255, 107, 129, 0.3)' },
              { offset: 1, color: 'rgba(255, 107, 129, 0.05)' }
            ]
          }
        },
        emphasis: {
          itemStyle: {
            borderColor: '#ff6b81',
            borderWidth: 3,
            shadowBlur: 5,
            shadowColor: 'rgba(255, 107, 129, 0.3)'
          }
        },
        animationDuration: 1000
      }]
    };
  },

  getSleepOption: function (data) {
    // 根据数据点数量动态调整柱子宽度 - 适应多天数据
    const barWidth = data.xAxis.length <= 7 ? '30%' : (data.xAxis.length <= 14 ? '20%' : '10%');
    
    // 计算合适的初始显示范围
    const visibleBars = Math.min(7, data.xAxis.length);
    const startZoom = data.xAxis.length > visibleBars ? 
      Math.max(0, 100 - (visibleBars/data.xAxis.length * 100)) : 0;
    
    return {
      tooltip: { 
        trigger: 'axis', 
        axisPointer: { type: 'shadow' },
        confine: true, // 确保提示框在图表区域内
        formatter: function(params) {
          const param = params[0];
          return `${param.name}<br/>${param.seriesName}: ${param.value} 小时`;
        },
        textStyle: { fontSize: 11 }
      },
      grid: { 
        left: '8%', 
        right: '5%', 
        bottom: data.xAxis.length > 7 ? '15%' : '10%', 
        top: '5%',
        containLabel: true 
      },
      dataZoom: [
        // 当数据超过7天时显示滚动条
        data.xAxis.length > visibleBars ? {
          type: 'slider',
          show: true,
          start: startZoom, // 默认显示最近几天
          end: 100,
          height: 15,
          bottom: 0,
          borderColor: 'transparent',
          backgroundColor: '#f5f5f5',
          fillerColor: 'rgba(146, 164, 245, 0.2)',
          handleStyle: {
            color: '#8E9EFF',
            borderColor: '#8E9EFF'
          },
          showDataShadow: false, // 不显示数据阴影，简化界面
          showDetail: false,     // 不显示详细信息，减少视觉干扰
          emphasis: {
            handleStyle: {
              shadowBlur: 5,
              shadowColor: 'rgba(146, 164, 245, 0.5)'
            }
          }
        } : {}
      ],
      xAxis: { 
        type: 'category', 
        data: data.xAxis,
        axisLine: { lineStyle: { color: '#ddd', width: 1 } },
        axisLabel: { 
          color: '#666',
          interval: data.xAxis.length > 15 ? 'auto' : 0, // 数据量大时自动调整间隔
          rotate: data.xAxis.length > 7 ? 30 : 0, // 数据量大时旋转标签
          fontSize: 9,
          formatter: function(value) {
            // 根据数据量简化日期显示
            if (data.xAxis.length > 30) {
              return value.split('-')[1]; // 只显示月份，如"04"
            } else if (data.xAxis.length > 14) {
              const parts = value.split('-');
              return parts[1]+'-'+parts[2]; // 显示"04-21"
            }
            return value;
          }
        },
        boundaryGap: true,
        axisTick: {
          alignWithLabel: true, // 刻度与标签对齐
          length: 3 // 短刻度线
        }
      },
      yAxis: { 
        type: 'value', 
        name: '小时',
        nameTextStyle: { color: '#666', fontSize: 9, padding: [0, 0, 0, 10] },
        axisLine: { lineStyle: { color: '#ddd', width: 1 } },
        splitLine: { lineStyle: { color: '#eee', type: 'dashed' } },
        axisLabel: { fontSize: 9 }
      },
      series: [{
        name: '睡眠',
        type: 'bar',
        barWidth: barWidth,
        data: data.series,
        itemStyle: { 
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: '#8E9EFF' },
              { offset: 1, color: '#4F66FF' }
            ]
          },
          borderRadius: [2, 2, 0, 0] // 顶部圆角
        },
        emphasis: {
          itemStyle: { 
            shadowBlur: 5,
            shadowColor: 'rgba(0,0,0,0.1)'
          },
          // 添加标签以便高亮显示数值
          label: {
            show: true,
            position: 'top',
            formatter: '{c}',
            fontSize: 10,
            color: '#666'
          }
        },
        animationDelay: function (idx) {
          return idx * 30;
        },
        animationDuration: 600
      }]
    };
  },

  getExcretionOption: function (data) {
    // 根据数据点数量动态调整柱子宽度
    const barWidth = data.xAxis.length <= 7 ? '30%' : (data.xAxis.length <= 14 ? '20%' : '10%');
    
    // 计算合适的初始显示范围
    const visibleBars = Math.min(7, data.xAxis.length);
    const startZoom = data.xAxis.length > visibleBars ? 
      Math.max(0, 100 - (visibleBars/data.xAxis.length * 100)) : 0;
    
    // 更美观的颜色
    const peeColor = {
      type: 'linear',
      x: 0, y: 0, x2: 0, y2: 1,
      colorStops: [
        { offset: 0, color: '#95D8FF' }, 
        { offset: 1, color: '#7AC5FF' }
      ]
    }; 
    const poopColor = {
      type: 'linear',
      x: 0, y: 0, x2: 0, y2: 1,
      colorStops: [
        { offset: 0, color: '#EFBB64' }, 
        { offset: 1, color: '#D9AA56' }
      ]
    };
    
    return {
      tooltip: { 
        trigger: 'axis', 
        axisPointer: { type: 'shadow' },
        confine: true,
        formatter: function(params) {
          let result = params[0].name + '<br/>';
          params.forEach(param => {
            result += `${param.seriesName}: ${param.value} 次<br/>`;
          });
          return result;
        },
        textStyle: { fontSize: 11 }
      },
      legend: { 
        data: ['小便', '大便'], 
        bottom: 25,
        icon: 'roundRect',
        itemWidth: 10,
        itemHeight: 10,
        itemGap: 15,
        textStyle: { fontSize: 10, color: '#666' }
      },
      grid: { 
        left: '8%', 
        right: '5%', 
        bottom: data.xAxis.length > 7 ? '20%' : '15%', 
        top: '5%',
        containLabel: true 
      },
      dataZoom: [
        // 当数据超过指定天数时显示滚动条
        data.xAxis.length > visibleBars ? {
          type: 'slider',
          show: true,
          start: startZoom,
          end: 100,
          height: 15,
          bottom: 30,
          borderColor: 'transparent',
          backgroundColor: '#f5f5f5',
          fillerColor: 'rgba(146, 164, 245, 0.2)',
          handleStyle: {
            color: '#8E9EFF',
            borderColor: '#8E9EFF'
          },
          showDataShadow: false, // 不显示数据阴影，简化界面
          showDetail: false      // 不显示详细信息，减少视觉干扰
        } : {}
      ],
      xAxis: { 
        type: 'category', 
        data: data.xAxis,
        axisLine: { lineStyle: { color: '#ddd', width: 1 } },
        axisLabel: { 
          color: '#666',
          interval: data.xAxis.length > 15 ? 'auto' : 0,
          rotate: data.xAxis.length > 7 ? 30 : 0,
          fontSize: 9,
          formatter: function(value) {
            // 根据数据量简化日期显示
            if (data.xAxis.length > 30) {
              return value.split('-')[1]; // 只显示月份，如"04"
            } else if (data.xAxis.length > 14) {
              const parts = value.split('-');
              return parts[1]+'-'+parts[2]; // 显示"04-21"
            }
            return value;
          }
        },
        boundaryGap: true,
        axisTick: {
          alignWithLabel: true, // 刻度与标签对齐
          length: 3 // 短刻度线
        }
      },
      yAxis: { 
        type: 'value', 
        name: '次',
        nameTextStyle: { color: '#666', fontSize: 9, padding: [0, 0, 0, 10] },
        axisLine: { lineStyle: { color: '#ddd', width: 1 } },
        splitLine: { lineStyle: { color: '#eee', type: 'dashed' } },
        axisLabel: { fontSize: 9 },
        minInterval: 1 // 确保Y轴增量至少为1
      },
      series: [
        {
          name: '小便',
          type: 'bar',
          stack: '总量',
          barWidth: barWidth,
          data: data.peeSeries,
          itemStyle: { 
            color: peeColor,
            borderRadius: [2, 0, 0, 0] // 左上角圆角
          },
          emphasis: { 
            itemStyle: { shadowBlur: 5, shadowColor: 'rgba(0,0,0,0.1)' },
            // 当只有一个系列有值时显示标签
            label: {
              show: function(params) {
                // 检查对应索引的大便数据是否为0
                return data.poopSeries[params.dataIndex] === 0;
              },
              position: 'top',
              formatter: '{c}',
              fontSize: 10,
              color: '#666'
            }
          },
          animationDelay: function (idx) { return idx * 30; }
        },
        {
          name: '大便',
          type: 'bar',
          stack: '总量',
          data: data.poopSeries,
          itemStyle: { 
            color: poopColor,
            borderRadius: [0, 2, 0, 0] // 右上角圆角
          },
          emphasis: { 
            itemStyle: { shadowBlur: 5, shadowColor: 'rgba(0,0,0,0.1)' },
            // 当只有一个系列有值或者位于顶部时显示标签
            label: {
              show: function(params) {
                return params.value > 0;
              },
              position: 'top',
              formatter: '{c}',
              fontSize: 10,
              color: '#666'
            }
          },
          animationDelay: function (idx) { return idx * 30 + 50; }
        }
      ],
      animationEasing: 'elasticOut',
      animationDuration: 600
    };
  }
}) 