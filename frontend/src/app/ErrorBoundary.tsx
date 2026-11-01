import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { reportError } from '../lib/analytics'
import { ErrorPage } from '../pages/ErrorPage/ErrorPage'

type State = { failed: boolean }

/** Catches a render error anywhere below and shows the error page (design 9). */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError(error)
    console.error(error, info.componentStack)
  }

  render() {
    return this.state.failed ? <ErrorPage /> : this.props.children
  }
}
