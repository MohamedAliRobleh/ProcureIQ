// Escapes a value for safe interpolation into an HTML email body. Shared by the
// endpoints that build email HTML from stored (originally user-supplied) fields,
// so a field containing markup can't inject into the email markup.
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  )
}
