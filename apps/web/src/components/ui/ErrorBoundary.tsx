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
          style={{
            position: 'fixed',
            right: 0,
            top: 0,
            bottom: 0,
            width: 'min(560px, 95vw)',
            backgroundColor: 'var(--bg-surface)',
            borderLeft: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            zIndex: 50,
            gap: '1rem',
          }}
        >
          <div style={{ fontSize: '2rem' }}>⚠️</div>
          <div style={{ color: 'var(--text-primary)', fontWeight: 600, textAlign: 'center' }}>
            Error loading event details
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
            Something went wrong rendering this event.
          </div>
          <button
            onClick={() => this.setState({ hasError: false })}
            style={{
              background: 'var(--primary)',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 20px',
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
