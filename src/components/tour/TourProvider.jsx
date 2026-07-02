import { createContext, useContext, useEffect, useReducer } from 'react'
import { useIsDemoOrg } from '../../lib/auth'
import { initialTourState, tourReducer } from './tourState'
import { TOUR_STEPS } from './tourSteps'

const TOUR_DONE_KEY = 'procureiq_tour_done_v1'
const TourContext = createContext(null)

export function TourProvider({ children }) {
  const isDemo = useIsDemoOrg()
  const [state, dispatch] = useReducer(tourReducer, initialTourState)

  // Auto-start once per browser, demo org only.
  useEffect(() => {
    if (isDemo && !localStorage.getItem(TOUR_DONE_KEY)) {
      dispatch({ type: 'START' })
    }
  }, [isDemo])

  function markDone() {
    try {
      localStorage.setItem(TOUR_DONE_KEY, '1')
    } catch {
      /* ignore */
    }
  }
  function start() {
    dispatch({ type: 'START' })
  }
  function next() {
    if (state.stepIndex >= TOUR_STEPS.length - 1) {
      markDone()
      dispatch({ type: 'CLOSE' })
    } else {
      dispatch({ type: 'NEXT' })
    }
  }
  function back() {
    dispatch({ type: 'BACK' })
  }
  function close() {
    markDone()
    dispatch({ type: 'CLOSE' })
  }

  return (
    <TourContext.Provider value={{ isOpen: state.isOpen, stepIndex: state.stepIndex, start, next, back, close }}>
      {children}
    </TourContext.Provider>
  )
}

export function useTour() {
  const ctx = useContext(TourContext)
  if (!ctx) throw new Error('useTour must be used inside TourProvider')
  return ctx
}
