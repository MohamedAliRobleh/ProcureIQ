export const MANAGE_RESOURCES = ['suppliers', 'contracts', 'spend', 'portal']

// True if the given Clerk org role may create/edit/delete the resource. Reads are
// open to all members; only "manage" actions are gated. Admin manages everything.
export function canManage(orgRole, resource) {
  if (!MANAGE_RESOURCES.includes(resource)) return false
  return orgRole === 'org:admin'
}
