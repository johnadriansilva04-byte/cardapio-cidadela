import { Component, ReactNode } from 'react';

interface AdErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface AdErrorBoundaryState {
  hasError: boolean;
}

export class AdErrorBoundary extends Component<AdErrorBoundaryProps, AdErrorBoundaryState> {
  constructor(props: AdErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    console.error('[AdErrorBoundary] Caught error:', error);
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('[AdErrorBoundary] Error details:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || null;
    }

    return this.props.children;
  }
}
