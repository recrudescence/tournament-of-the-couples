/**
 * Format response time in milliseconds to a readable string
 * @param ms - Time in milliseconds
 * @param decimals - Number of decimal places (default: 1)
 */
export function formatResponseTime(ms: number, decimals: number = 1): string {
  return (ms / 1000).toFixed(decimals);
}
