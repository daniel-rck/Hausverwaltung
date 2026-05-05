import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('UI ErrorBoundary:', error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback(this.state.error, this.reset);
      return (
        <div className="p-6 max-w-xl mx-auto">
          <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-5">
            <h2 className="text-base font-semibold text-red-800 dark:text-red-200 mb-1">
              Da ist etwas schiefgelaufen
            </h2>
            <p className="text-sm text-red-700 dark:text-red-300 mb-3">
              Die Seite konnte nicht angezeigt werden. Du kannst es erneut versuchen oder die App
              neu laden.
            </p>
            <details className="text-xs text-red-700 dark:text-red-300 mb-3">
              <summary className="cursor-pointer">Technische Details</summary>
              <pre className="mt-2 whitespace-pre-wrap break-words">{this.state.error.message}</pre>
            </details>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={this.reset}
                className="h-9 px-4 text-sm font-medium rounded-lg bg-stone-900 text-white hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200"
              >
                Erneut versuchen
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="h-9 px-4 text-sm font-medium rounded-lg border border-stone-300 dark:border-stone-600 text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-700"
              >
                App neu laden
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
