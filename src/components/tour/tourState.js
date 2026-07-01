export const initialTourState = { isOpen: false, stepIndex: 0 }

export function tourReducer(state, action) {
  switch (action.type) {
    case 'START':
      return { isOpen: true, stepIndex: 0 }
    case 'NEXT':
      return { ...state, stepIndex: state.stepIndex + 1 }
    case 'BACK':
      return { ...state, stepIndex: Math.max(0, state.stepIndex - 1) }
    case 'CLOSE':
      return { isOpen: false, stepIndex: 0 }
    default:
      return state
  }
}
