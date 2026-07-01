import { useOrganization, useIsDemoOrg } from './auth'

export const MANAGE_RESOURCES = ['suppliers', 'contracts', 'spend', 'portal']

export function canManage(role, resource) {
  if (!MANAGE_RESOURCES.includes(resource)) return false
  return role === 'org:admin'
}

export function canSeed(role) {
  return role === 'org:admin' || role === 'org:member'
}

export function usePermissions() {
  const { membership } = useOrganization()
  const role = membership?.role ?? null
  const isDemo = useIsDemoOrg()
  return {
    role,
    // In the demo org every visitor may manage resources — writes are captured
    // by the client-side sandbox, never the API.
    canManage: (resource) => (isDemo && MANAGE_RESOURCES.includes(resource)) || canManage(role, resource),
    canSeed: () => canSeed(role),
  }
}
