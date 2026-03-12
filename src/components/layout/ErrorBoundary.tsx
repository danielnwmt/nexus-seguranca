import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-8">
          <div className="max-w-lg w-full rounded-lg border border-destructive/30 bg-card p-6 space-y-4">
            <h2 className="text-lg font-bold text-destructive">Erro na renderização</h2>
            <p className="text-sm text-muted-foreground">
              Ocorreu um erro ao renderizar esta página. Copie a mensagem abaixo para diagnóstico.
            </p>
            <pre className="text-xs font-mono text-foreground bg-muted p-3 rounded overflow-auto max-h-48 whitespace-pre-wrap break-all">
              {this.state.error?.toString()}
              {'\n\n'}
              {this.state.errorInfo?.componentStack}
            </pre>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null, errorInfo: null });
                window.location.href = '/';
              }}
              className="px-4 py-2 rounded bg-primary text-primary-foreground text-sm font-medium"
            >
              Recarregar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
