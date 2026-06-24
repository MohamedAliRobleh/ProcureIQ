export const PORTAL_REQUEST_TYPES = ['esg_questionnaire', 'document', 'risk_review', 'general']
export const PORTAL_STATUSES = ['pending', 'submitted', 'approved', 'rejected']

export const PORTAL_STATUS_BADGE = {
  pending: 'amber',
  submitted: 'blue',
  approved: 'green',
  rejected: 'red',
}

export const PORTAL_TYPE_LABEL = {
  esg_questionnaire: 'ESG Questionnaire',
  document: 'Document Request',
  risk_review: 'Risk Review',
  general: 'General',
}

export function filterRequests(requests, { status = '', supplierId = '' } = {}) {
  return requests.filter((r) => {
    const matchesStatus = !status || r.status === status
    const matchesSupplier = !supplierId || r.supplierId === supplierId
    return matchesStatus && matchesSupplier
  })
}
