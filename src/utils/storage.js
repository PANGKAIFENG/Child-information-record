// src/utils/storage.js

// Get all records from storage and add recordType
export function getAllRecords() {
  const recordTypes = [
    { key: 'feedingRecords', type: 'feeding' },
    { key: 'sleepRecords', type: 'sleep' },
    { key: 'excretionRecords', type: 'excretion' },
    { key: 'supplementRecords', type: 'supplement' },
    { key: 'abnormalRecords', type: 'abnormal' }
  ];

  let allRecords = [];

  recordTypes.forEach(item => {
    try {
      const records = wx.getStorageSync(item.key) || [];
      if (Array.isArray(records)) {
        // Add recordType to each record
        const typedRecords = records.map(record => ({ ...record, recordType: item.type }));
        allRecords = allRecords.concat(typedRecords);
      } else {
          console.warn(`Storage key ${item.key} did not return an array.`);
      }
    } catch (e) {
      console.error(`Failed to get records from ${item.key}:`, e);
    }
  });

  // Optional: Sort by timestamp here if needed, although stats processing might re-sort
  // allRecords.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)); 

  return allRecords;
} 