import React from 'react'

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Top-level boundary so a single render crash doesn't leave the user staring
 * at a blank white page (audit finding #20). The debug message is rendered
 * collapsed by default and only shown in development.
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  private handleReload = () => {
    // Try a soft reset first.
    this.setState({ hasError: false, error: null })
    // Belt-and-suspenders — a full reload guarantees we recover from anything.
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const isDev = import.meta.env?.DEV ?? false

    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-md rounded-2xl border border-border/50 bg-card p-8 shadow-xl">
          <h1 className="text-2xl font-semibold text-foreground">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The page hit an unexpected error. Try reloading — if the problem keeps happening,
            please contact support.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="mt-6 inline-flex h-10 items-center justify-center rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Reload page
          </button>

          {isDev && this.state.error && (
            <details className="mt-6 rounded-lg border border-border/40 bg-muted/40 p-3 text-xs text-muted-foreground">
              <summary className="cursor-pointer font-medium text-foreground">
                Developer details
              </summary>
              <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words">
                {this.state.error.message}
                {'\n'}
                {this.state.error.stack}
              </pre>
            </details>
          )}
        </div>
      </div>
    )
  }
}
