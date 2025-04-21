/**
 * 常用工具函数
 */

/**
 * 格式化日期为 YYYY-MM-DD 格式
 */
const formatDate = date => {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()

  return [year, month, day].map(formatNumber).join('-')
}

/**
 * 格式化时间为 HH:mm 格式
 */
const formatTime = date => {
  const hours = date.getHours()
  const minutes = date.getMinutes()

  return [hours, minutes].map(formatNumber).join(':')
}

/**
 * 格式化数字，个位数前面补0
 */
const formatNumber = n => {
  n = n.toString()
  return n[1] ? n : `0${n}`
}

/**
 * 根据出生日期计算年龄
 * @param {string} birthDateString - 出生日期字符串 (e.g., "2023-01-15")
 * @returns {string} 年龄描述 (e.g., "1岁2个月", "3个月", "15天")
 */
const calculateAge = birthDateString => {
  if (!birthDateString) return '未知';

  try {
    const birthDate = new Date(birthDateString.replace(/-/g, "/")); // 兼容 iOS
    const today = new Date();

    // 确保出生日期有效且不晚于今天
    if (isNaN(birthDate.getTime()) || birthDate > today) {
      return '日期无效';
    }

    let years = today.getFullYear() - birthDate.getFullYear();
    let months = today.getMonth() - birthDate.getMonth();
    let days = today.getDate() - birthDate.getDate();

    // 处理月份借位
    if (months < 0 || (months === 0 && days < 0)) {
      years--;
      months += (months < 0 ? 12 : 0); // 如果月份为负，加12
      // 如果月份借位了，需要重新计算天数差异（考虑上个月天数）
      if (days < 0) {
        const prevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
        days += prevMonth.getDate();
        months--; // 月份因为天数借位再减1
      }
    }
    // 处理天数借位（如果月份没借位但天数是负数）
    else if (days < 0) {
        const prevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
        days += prevMonth.getDate();
        months--; // 月份因为天数借位再减1
    }
    
    // 如果月份因为天数借位变成负数，需要再次向年借位
    if (months < 0) {
        years--;
        months += 12;
    }

    if (years > 0) {
      return `${years}岁${months > 0 ? months + '个月' : ''}`;
    } else if (months > 0) {
      return `${months}个月${days > 0 ? days + '天' : ''}`;
    } else if (days >= 0) {
      // 如果是0天，显示"今天出生"或"0天"
      return days === 0 ? '今天' : `${days}天`;
    } else {
        return '日期异常'; // 理论上不应到达这里
    }
  } catch (e) {
    console.error('Error calculating age:', e);
    return '计算错误';
  }
}

module.exports = {
  formatDate,
  formatTime,
  formatNumber,
  calculateAge
} 