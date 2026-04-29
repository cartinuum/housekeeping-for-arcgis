import type { ArcGISItem } from '../types/arcgis'
import { buildItemUrl } from './portalUrl'

export const EMAIL_SUBJECT = 'ArcGIS Online content review'
export const MAILTO_MAX_LENGTH = 1800

export function buildEmailBody(
  items: Pick<ArcGISItem, 'id' | 'title'>[],
  ownerFullName: string,
  adminFullName: string,
  reasonMap: Record<string, string> = {},
  portalHostname?: string | null
): string {
  const itemLines = items
    .map(i => {
      const reason = reasonMap[i.id]
      const url = buildItemUrl(portalHostname, i.id)
      return reason
        ? `- ${i.title} (${reason}) — ${url}`
        : `- ${i.title} — ${url}`
    })
    .join('\n')

  return [
    `Hi ${ownerFullName},`,
    '',
    "As part of our organisation's content management review, the items below",
    'have been flagged for your attention. Please consider whether each is still',
    'required, up to date, and appropriately shared.',
    '',
    itemLines,
    '',
    'If an item is no longer needed, please consider deleting it or transferring',
    'ownership. Reply to this email if you have any questions.',
    '',
    adminFullName,
  ].join('\n')
}

export function buildBatchEmailBody(
  items: Pick<ArcGISItem, 'id' | 'title'>[],
  adminFullName: string,
  reasonMap: Record<string, string> = {},
  portalHostname?: string | null
): string {
  const itemLines = items
    .map(i => {
      const reason = reasonMap[i.id]
      const url = buildItemUrl(portalHostname, i.id)
      return reason
        ? `- ${i.title} (${reason}) — ${url}`
        : `- ${i.title} — ${url}`
    })
    .join('\n')

  return [
    'Hi,',
    '',
    "As part of our organisation's content management review, the items below",
    'have been flagged for attention. Please consider whether any items you own are still',
    'required, up to date, and appropriately shared.',
    '',
    itemLines,
    '',
    'If an item is no longer needed, please consider deleting it or transferring',
    'ownership. Reply to this email if you have any questions.',
    '',
    adminFullName,
  ].join('\n')
}

export function buildMailtoUrl(
  to: string | string[],
  body: string
): string {
  // Do NOT encodeURIComponent the to addresses — @ must stay as @ or Outlook
  // and many other mail clients will reject the address.
  const toStr = Array.isArray(to) ? to.join(',') : to
  return (
    `mailto:${toStr}` +
    `?subject=${encodeURIComponent(EMAIL_SUBJECT)}` +
    `&body=${encodeURIComponent(body)}`
  )
}

export function isMailtoTooLong(url: string): boolean {
  return url.length > MAILTO_MAX_LENGTH
}

export function groupItemsByOwner<T extends { owner: string }>(
  items: T[]
): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const group = map.get(item.owner) ?? []
    group.push(item)
    map.set(item.owner, group)
  }
  return map
}
