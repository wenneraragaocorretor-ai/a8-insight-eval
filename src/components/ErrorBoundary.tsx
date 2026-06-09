import { Component, type ReactNode } from "react";
import { Button } from "./ui/button";
import { AlertTriangle } from "lucide-react";

type Props = { children: ReactNode; fallbackTitle?: string };
type State = { hasError: boolean; message?: string };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error("ErrorBoundary capturou erro:", error, info);
  }

  reset = () => this.setState({ hasError: false, message: undefined });

  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-xl mx-auto py-16 text-center space-y-4">
          <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
          <h2 className="text-2xl font-bold text-brand-blue">
            {this.props.fallbackTitle ?? "Algo deu errado"}
          </h2>
          <p className="text-muted-foreground text-sm">
            Tivemos um problema ao renderizar esta tela. Você pode tentar novamente sem perder o acesso à plataforma.
          </p>
          {this.state.message && (
            <p className="text-xs text-muted-foreground italic">{this.state.message}</p>
          )}
          <Button onClick={this.reset} className="bg-brand-blue">Tentar novamente</Button>
        </div>
      );
    }
    return this.props.children;
  }
}
