/**
 * Format response time in milliseconds to a readable string with units
 * @param ms - Time in milliseconds
 * @param decimals - Number of decimal places (default: 1)
 * For times >= 60 seconds, returns "Xm Ys" format
 * For times < 60 seconds, returns "X.XX s" format
 */
export function formatResponseTime(ms: number, decimals: number = 1): string {
  const totalSeconds = ms / 1000;
  if (totalSeconds >= 60) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.round(totalSeconds % 60);
    return `${minutes}m ${seconds}s`;
  }
  return `${totalSeconds.toFixed(decimals)}s`;
}
