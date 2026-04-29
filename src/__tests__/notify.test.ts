import { describe, it, expect } from 'vitest'
import {
  buildEmailBody,
  buildBatchEmailBody,
  buildMailtoUrl,
  isMailtoTooLong,
  groupItemsByOwner,
} from '../utils/notify'

describe('buildEmailBody', () => {
  it('opens with greeting using owner full name', () => {
    const body = buildEmailBody(
      [{ id: 'abc', title: 'Test Layer' }],
      'Sarah Chen',
      'Admin User'
    )
    expect(body).toContain('Hi Sarah Chen,')
  })

  it('includes each item title and AGOL link', () => {
    const body = buildEmailBody(
      [
        { id: 'abc123', title: 'Test Layer' },
        { id: 'def456', title: 'Another Item' },
      ],
      'Sarah Chen',
      'Admin User'
    )
    expect(body).toContain(
      '- Test Layer — https://www.arcgis.com/home/item.html?id=abc123'
    )
    expect(body).toContain(
      '- Another Item — https://www.arcgis.com/home/item.html?id=def456'
    )
  })

  it('ends with admin full name as sign-off', () => {
    const body = buildEmailBody(
      [{ id: 'abc', title: 'Layer' }],
      'Sarah Chen',
      'John Smith'
    )
    expect(body.trim().endsWith('John Smith')).toBe(true)
  })

  it('uses Australian English spelling in boilerplate', () => {
    const body = buildEmailBody(
      [{ id: 'abc', title: 'Layer' }],
      'Sarah',
      'Admin'
    )
    expect(body).toContain('organisation')
  })
})

describe('buildBatchEmailBody', () => {
  it('uses generic greeting (not owner-specific)', () => {
    const body = buildBatchEmailBody(
      [{ id: 'abc', title: 'Layer' }],
      'Admin User'
    )
    expect(body).toContain('Hi,')
    expect(body).not.toMatch(/Hi [A-Z]/)
  })

  it('includes all items flat', () => {
    const body = buildBatchEmailBody(
      [
        { id: 'a1', title: 'Layer One' },
        { id: 'b2', title: 'Layer Two' },
      ],
      'Admin User'
    )
    expect(body).toContain('Layer One')
    expect(body).toContain('Layer Two')
  })

  it('ends with admin full name', () => {
    const body = buildBatchEmailBody(
      [{ id: 'abc', title: 'Layer' }],
      'Jane Admin'
    )
    expect(body.trim().endsWith('Jane Admin')).toBe(true)
  })
})

describe('buildMailtoUrl', () => {
  it('starts with mailto:', () => {
    const url = buildMailtoUrl('a@b.com', 'Hello body')
    expect(url).toMatch(/^mailto:/)
  })

  it('does not encode @ in recipient address', () => {
    const url = buildMailtoUrl('user@example.com', 'Hello')
    // @ must remain literal — encoding it as %40 breaks Outlook and most mail clients
    expect(url).toContain('mailto:user@example.com')
    expect(url).not.toContain('%40')
  })

  it('joins multiple recipients with comma', () => {
    const url = buildMailtoUrl(['a@b.com', 'c@d.com'], 'Hello')
    expect(url).toContain('mailto:a@b.com,c@d.com')
    expect(url).not.toContain('%40')
  })

  it('includes encoded subject and body', () => {
    const url = buildMailtoUrl('a@b.com', 'My body')
    expect(url).toContain('subject=')
    expect(url).toContain('body=')
    expect(url).toContain(encodeURIComponent('My body'))
  })
})

describe('isMailtoTooLong', () => {
  it('returns false for short URLs', () => {
    expect(
      isMailtoTooLong('mailto:a@b.com?subject=Hi&body=Hello')
    ).toBe(false)
  })

  it('returns true for URLs exceeding 1800 characters', () => {
    const longBody = 'x'.repeat(2000)
    const url = buildMailtoUrl('a@b.com', longBody)
    expect(isMailtoTooLong(url)).toBe(true)
  })
})

describe('groupItemsByOwner', () => {
  it('groups items by owner username', () => {
    const items = [
      { owner: 'alice', id: '1', title: 'A1' },
      { owner: 'bob',   id: '2', title: 'B1' },
      { owner: 'alice', id: '3', title: 'A2' },
    ]
    const groups = groupItemsByOwner(items)
    expect(groups.get('alice')).toHaveLength(2)
    expect(groups.get('bob')).toHaveLength(1)
  })

  it('preserves insertion order across owner groups', () => {
    const items = [
      { owner: 'alice', id: '1', title: 'A' },
      { owner: 'bob',   id: '2', title: 'B' },
    ]
    const keys = [...groupItemsByOwner(items).keys()]
    expect(keys).toEqual(['alice', 'bob'])
  })

  it('returns empty map for empty input', () => {
    expect(groupItemsByOwner([])).toEqual(new Map())
  })
})
