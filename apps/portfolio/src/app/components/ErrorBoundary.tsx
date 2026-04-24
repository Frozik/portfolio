import type { ErrorInfo, ReactNode } from 'react';
import { Component, lazy, Suspense } from 'react';

const ErrorPage = lazy(() => import('./ErrorPage').then(module => ({ default: module.ErrorPage })));

interface IErrorBoundaryProps {
  readonly children: ReactNode;
}

interface IErrorBoundaryState {
  readonly hasError: boolean;
}

export class ErrorBoundary extends Component<IErrorBoundaryProps, IErrorBoundaryState> {
  state: IErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): IErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // biome-ignore lint/suspicious/noConsole: surface unhandled render errors to the browser console for diagnosis
    console.error('Uncaught render error:', error, info);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <Suspense fallback={null}>
          <ErrorPage />
        </Suspense>
      );
    }
    return this.props.children;
  }
}
