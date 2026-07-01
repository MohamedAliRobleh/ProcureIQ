import { describe, it, expect } from 'vitest'
import { initialTourState, tourReducer } from './tourState'

describe('tourReducer', () => {
  it('START opens at step 0', () => {
    expect(tourReducer({ isOpen: false, stepIndex: 3 }, { type: 'START' })).toEqual({ isOpen: true, stepIndex: 0 })
  })
  it('NEXT and BACK move within bounds', () => {
    const s = tourReducer(initialTourState, { type: 'START' })
    expect(tourReducer(s, { type: 'NEXT' })).toEqual({ isOpen: true, stepIndex: 1 })
    expect(tourReducer({ isOpen: true, stepIndex: 0 }, { type: 'BACK' })).toEqual({ isOpen: true, stepIndex: 0 })
  })
  it('CLOSE resets', () => {
    expect(tourReducer({ isOpen: true, stepIndex: 4 }, { type: 'CLOSE' })).toEqual({ isOpen: false, stepIndex: 0 })
  })
})
