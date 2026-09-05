import type { ErrorInfo, ReactNode } from 'react';
import { Component, lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';

const ErrorPage = lazy(() => import('./ErrorPage').then(module => ({ default: module.ErrorPage })));

interface IErrorBoundaryProps {
  /** Route key; a change resets the boundary so navigation escapes a stuck `ErrorPage`. */
  readonly locationKey: string;
  readonly children: ReactNode;
}

interface IErrorBoundaryState {
  readonly hasError: boolean;
}

class ErrorBoundaryInner extends Component<IErrorBoundaryProps, IErrorBoundaryState> {
  state: IErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): IErrorBoundaryState {
    return { hasError: true };
  }

  componentDidUpdate(previousProps: IErrorBoundaryProps): void {
    if (this.state.hasError && previousProps.locationKey !== this.props.locationKey) {
      this.setState({ hasError: false });
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // oxlint-disable-next-line no-console -- surface unhandled render errors to the browser console for diagnosis
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

export function ErrorBoundary({ children }: { readonly children: ReactNode }): ReactNode {
  const location = useLocation();
  return <ErrorBoundaryInner locationKey={location.key}>{children}</ErrorBoundaryInner>;
}
