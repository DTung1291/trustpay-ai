import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  error?: Error
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = {}

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('UI error', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div role="alert" className="glass mx-auto mt-10 max-w-xl p-6 text-center">
        <h2 className="text-xl font-semibold text-white">Something went wrong</h2>
        <p className="mt-2 break-words text-sm text-slate-400">{this.state.error.message}</p>
        <button type="button" className="btn-primary mt-5" onClick={() => this.setState({ error: undefined })}>
          Try again
        </button>
      </div>
    )
  }
}
