// Builds the `data` object for an audit-log row. Returned (not awaited) so it can be
// used both inside a prisma.$transaction([...]) array and as a standalone create.
export function buildAuditData({ orgId, actorId, action }) {
  return {
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    orgId,
    actorId,
    action,
  }
}
