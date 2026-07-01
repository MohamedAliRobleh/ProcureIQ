// Each step: target CSS selector (null = centered, no spotlight), copy, and a
// preferred placement. Steps whose target is absent on the current route are
// skipped gracefully by <Tour>.
export const TOUR_STEPS = [
  {
    target: null,
    title: 'Welcome to the ProcureIQ demo',
    body: 'Take a 30-second tour. Everything here is a live sandbox — explore and edit freely.',
    placement: 'center',
  },
  {
    target: '[data-tour="nav"]',
    title: 'Every module, one click away',
    body: 'Suppliers, contracts, risk, ESG, and spend — navigate the whole procurement lifecycle here.',
    placement: 'right',
  },
  {
    target: '[data-tour="kpi"]',
    title: 'Live KPIs',
    body: 'Key metrics are computed from your data in real time.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="nav-suppliers"]',
    title: "It's your sandbox — try it",
    body: 'Open Suppliers and add or edit one. Your changes stay in your browser and never affect anyone else.',
    placement: 'right',
  },
  {
    target: '[data-tour="nav-assistant"]',
    title: 'Ask the AI assistant',
    body: 'Ask plain-English questions about your suppliers, contracts, and spend.',
    placement: 'right',
  },
  {
    target: '[data-tour="sandbox-badge"]',
    title: 'Reset anytime',
    body: 'Everything you change is local. Hit Reset to restore the original demo data.',
    placement: 'bottom',
  },
]
