// src/utils/time.js

// Format Date object to 'YYYY-MM-DD'
export function formatDate(date) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Get start and end date strings based on dimension index
export function getDateRange(dimensionIndex) {
  const now = new Date();
  let startDate = new Date();
  let endDate = new Date();

  switch (dimensionIndex) {
    case 0: // 今天 (Today)
      // startDate and endDate are already 'now'
      break;
    case 1: // 昨天 (Yesterday)
      startDate.setDate(now.getDate() - 1);
      endDate.setDate(now.getDate() - 1);
      break;
    case 2: // 本周 (This Week - Mon to Sun)
      const currentDayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ...
      const diffMonday = now.getDate() - currentDayOfWeek + (currentDayOfWeek === 0 ? -6 : 1); // Adjust for Sunday
      startDate = new Date(now.setDate(diffMonday));
      // End date is today unless today is Sunday, then it's Sunday
      // Or, more simply, end date is start date + 6 days
      endDate = new Date(startDate.getTime() + 6 * 24 * 60 * 60 * 1000);
      // Ensure endDate doesn't exceed today if week isn't over
      if (endDate > now) {
          endDate = new Date();
      }
      break;
    case 3: // 本月 (This Month)
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      // endDate is today
      endDate = new Date(); 
      break;
    // Add cases for Last Week, Last Month etc. if needed
    default:
       // Default to today
      break;
  }

  return {
    startDate: formatDate(startDate),
    endDate: formatDate(endDate)
  };
} 