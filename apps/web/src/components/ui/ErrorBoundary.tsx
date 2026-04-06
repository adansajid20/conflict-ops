'use client'

import React from 'react'

interface Props {
  children: React.ReactNode
  fallback?: React.ReactNode
}
interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div
          className="fixed right-0 top-0 bottom-0 w-[min(560px,_95vw)] bg-white/[0.015] border-l border-white/[0.05] flex flex-col items-center justify-center p-8 z-50 gap-4"
        >
          <div style={{ fontSize: '2rem' }}>⚠️</div>
          <div className="font-semibold text-center text-white">
            Error loading event details
          </div>
          <div className="text-white/30 text-sm text-center">
            Something went wrong rendering this event.
          </div>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="bg-blue-500 text-white border-none rounded px-5 py-2 cursor-pointer text-sm"
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
