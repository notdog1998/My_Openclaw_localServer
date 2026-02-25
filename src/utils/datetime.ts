/**
 * 获取 GMT+8 (北京时间) 的 ISO 格式字符串
 */
export function getBeijingISOString(): string {
  const now = new Date();
  const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return beijingTime.toISOString().replace('Z', '+08:00');
}

/**
 * 获取 GMT+8 的格式化时间字符串 (本地格式)
 */
export function getBeijingTimeString(): string {
  return new Date().toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour12: false,
  });
}

/**
 * 将 Unix 时间戳 (秒) 转换为 GMT+8 格式化字符串
 */
export function formatTimestampToBeijing(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour12: false,
  });
}
