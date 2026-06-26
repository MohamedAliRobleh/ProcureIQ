import { describe, it, expect } from 'vitest'
import { escapeHtml } from './htmlEscape.js'

describe('escapeHtml', () => {
  it('escapes the HTML-significant characters', () => {
    expect(escapeHtml('A & <b>"x"</b> \'y\'')).toBe('A &amp; &lt;b&gt;&quot;x&quot;&lt;/b&gt; &#39;y&#39;')
  })

  it('coerces null/undefined to an empty string', () => {
    expect(escapeHtml(null)).toBe('')
    expect(escapeHtml(undefined)).toBe('')
  })

  it('stringifies non-string values', () => {
    expect(escapeHtml(42)).toBe('42')
  })
})
