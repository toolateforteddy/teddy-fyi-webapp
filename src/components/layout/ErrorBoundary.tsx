import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught rendering error:', error, errorInfo)
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null })
    window.location.href = '/'
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100dvh',
            width: '100%',
            padding: '24px',
            boxSizing: 'border-box',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            backgroundColor: '#0a0a0a',
            color: '#ededed',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              maxWidth: '500px',
              width: '100%',
              padding: '40px 24px',
              borderRadius: '12px',
              backgroundColor: '#141414',
              border: '1px solid #262626',
              boxShadow: '0 4px 24px rgba(0, 0, 0, 0.5)',
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                fontSize: '48px',
                marginBottom: '16px',
              }}
            >
              ⚠️
            </div>
            <h1
              style={{
                fontSize: '24px',
                fontWeight: 600,
                margin: '0 0 12px 0',
                color: '#ffffff',
              }}
            >
              Application Error
            </h1>
            <p
              style={{
                fontSize: '15px',
                color: '#a3a3a3',
                lineHeight: '1.6',
                margin: '0 0 24px 0',
              }}
            >
              An unexpected error occurred during rendering. The issue has been logged, and we suggest returning home.
            </p>
            {this.state.error && (
              <pre
                style={{
                  textAlign: 'left',
                  padding: '16px',
                  borderRadius: '6px',
                  backgroundColor: '#1c1c1c',
                  border: '1px solid #2a2a2a',
                  overflowX: 'auto',
                  fontSize: '13px',
                  color: '#f87171',
                  fontFamily: 'monospace',
                  margin: '0 0 24px 0',
                  maxHeight: '150px',
                }}
              >
                {this.state.error.message || this.state.error.toString()}
              </pre>
            )}
            <button
              onClick={this.handleReset}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: 500,
                color: '#ffffff',
                backgroundColor: '#2563eb',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
              }}
            >
              Reset Application
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
