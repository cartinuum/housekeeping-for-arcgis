/**
 * Navigate the browser to a URL. Intended for mailto: and external links.
 *
 * For mailto: links, creating a hidden anchor and clicking it is more reliable
 * than window.location.href — Chrome silently ignores mailto: assignments in
 * certain security contexts (e.g. sandboxed iframes, strict CSP).
 */
export function navigateTo(url: string): void {
  if (url.startsWith('mailto:')) {
    const a = document.createElement('a')
    a.href = url
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  } else {
    window.location.href = url
  }
}
