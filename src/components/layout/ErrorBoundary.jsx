import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('ProcureIQ encountered an error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg-primary px-6 text-center">
          <h1 className="font-display text-xl font-semibold text-text-primary">Something went wrong</h1>
          <p className="max-w-md text-sm text-text-secondary">
            We hit an unexpected error loading this page. Try refreshing — if the problem persists, contact your
            ProcureIQ administrator.
          </p>
        </div>
      )
    }

    return this.props.children
  }
}
