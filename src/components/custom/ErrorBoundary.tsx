// ============================================================
// ErrorBoundary — Catches render errors and shows fallback UI
// Prevents one component crash from taking down the whole app
// ============================================================

import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center h-64 text-center p-6">
          <p className="text-4xl mb-3">⚠️</p>
          <h2 className="text-lg font-semibold text-maintext mb-2">Something went wrong</h2>
          <p className="text-sm text-subtext mb-4 max-w-md">
            {this.state.error?.message ?? 'An unexpected error occurred.'}
          </p>
          <button
            onClick={this.handleReset}
            className="bg-brand text-white px-5 py-2 rounded-button text-sm font-medium hover:bg-brand-dark transition-colors"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
