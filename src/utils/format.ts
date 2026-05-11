/** Returns a human-readable staleness string matching the Last Modified filter framing. */
export function formatStaleness(epochMs: number): string {
  const days = Math.floor((Date.now() - epochMs) / 86_400_000)
  if (days < 1) return 'Modified today'
  if (days === 1) return 'Modified yesterday'
  if (days < 90) return `Modified ${days} days ago`
  const months = Math.floor(days / 30)
  if (months < 24) return `Modified ${months} month${months === 1 ? '' : 's'} ago`
  const years = Math.floor(days / 365)
  return `Modified ${years} year${years === 1 ? '' : 's'} ago`
}

export function formatBytes(bytes: number): string {
  if (bytes < 0) return 'N/A'
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1_073_741_824) return `${(bytes / 1_048_576).toFixed(1)} MB`
  return `${(bytes / 1_073_741_824).toFixed(2)} GB`
}
