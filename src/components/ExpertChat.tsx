import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { MessageCircle, X, Send, Lock, Sparkles, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type Props = {
  plano: string | undefined;
  avaliacaoId?: string;
};

const SUGESTOES = [
  "Por que o valor ficou abaixo do esperado?",
  "Como melhorar a homogeneização?",
  "O coeficiente de variação está adequado?",
  "Como justificar o arbítrio neste caso?",
  "Quais comparáveis devo buscar?",
];

export function ExpertChat({ plano, avaliacaoId }: Props) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const ehExpert = String(plano ?? "").toLowerCase() === "expert";

  useEffect(() => {
    if (!ehExpert) return;
    supabase.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setToken(session?.access_token ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, [ehExpert]);

  // Não-Expert: ícone bloqueado com tooltip
  if (!ehExpert) {
    return (
      <div className="fixed bottom-6 right-6 z-50 group">
        <button
          type="button"
          aria-label="Chat com IA disponível no plano Expert"
          className="h-14 w-14 rounded-full bg-muted text-muted-foreground shadow-lg border border-border flex items-center justify-center cursor-not-allowed opacity-80"
        >
          <Lock className="h-5 w-5" />
        </button>
        <div className="absolute bottom-full right-0 mb-2 px-3 py-1.5 rounded-md bg-foreground text-background text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
          Disponível no plano Expert
        </div>
      </div>
    );
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir chat com IA especialista"
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-gradient-to-br from-[#C8A951] to-[#E2C97E] text-[#0A1F44] shadow-[0_15px_30px_-10px_rgba(200,169,81,0.6)] flex items-center justify-center hover:scale-105 transition-transform"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}
      {open && token && (
        <ChatPanel token={token} avaliacaoId={avaliacaoId} onClose={() => setOpen(false)} />
      )}
      {open && !token && (
        <div className="fixed bottom-6 right-6 z-50 bg-card border rounded-2xl shadow-2xl p-4 w-80">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Autenticando...
          </div>
        </div>
      )}
    </>
  );
}

function ChatPanel({
  token,
  avaliacaoId,
  onClose,
}: {
  token: string;
  avaliacaoId?: string;
  onClose: () => void;
}) {
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: { Authorization: `Bearer ${token}` },
        body: { avaliacaoId },
      }),
    [token, avaliacaoId],
  );

  const { messages, sendMessage, status, error } = useChat({
    id: `expert-chat-${avaliacaoId ?? "geral"}`,
    transport,
  });

  const [input, setInput] = useState("");
  const isLoading = status === "submitted" || status === "streaming";
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const enviar = async (texto: string) => {
    const t = texto.trim();
    if (!t || isLoading) return;
    setInput("");
    await sendMessage({ text: t });
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[92vw] max-w-[400px] h-[600px] max-h-[80vh] bg-card border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#0A1F44] to-[#0F2D5C] text-white">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#C8A951] to-[#E2C97E] flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-[#0A1F44]" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">Especialista A8</p>
            <p className="text-[10px] text-white/70 leading-tight">IA · NBR 14653-2</p>
          </div>
        </div>
        <button onClick={onClose} aria-label="Fechar chat" className="p-1 hover:bg-white/10 rounded">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Mensagens */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-background">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Olá! Sou seu especialista em avaliação imobiliária. {avaliacaoId ? "Já tenho o contexto deste laudo carregado." : ""} Pergunte qualquer coisa ou escolha uma sugestão:
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGESTOES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => enviar(s)}
                  className="text-xs px-3 py-1.5 rounded-full border border-[#C8A951]/40 text-[#0A1F44] bg-[#C8A951]/5 hover:bg-[#C8A951]/15 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => {
          const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
          const isUser = m.role === "user";
          return (
            <div key={m.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
              {isUser ? (
                <div className="max-w-[85%] rounded-2xl px-3.5 py-2 bg-[#0A1F44] text-white text-sm whitespace-pre-wrap">
                  {text}
                </div>
              ) : (
                <div className="max-w-[90%] text-sm text-foreground prose prose-sm prose-neutral max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1">
                  <ReactMarkdown>{text}</ReactMarkdown>
                </div>
              )}
            </div>
          );
        })}

        {status === "submitted" && (
          <div className="text-xs text-muted-foreground italic flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" /> Pensando...
          </div>
        )}
        {error && (
          <div className="text-xs text-destructive">
            Erro: {error.message || "Falha ao enviar"}
          </div>
        )}
      </div>

      {/* Composer */}
      <form
        className="border-t p-3 flex items-end gap-2 bg-card"
        onSubmit={(e) => {
          e.preventDefault();
          void enviar(input);
        }}
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void enviar(input);
            }
          }}
          rows={1}
          placeholder="Pergunte sobre o laudo..."
          disabled={isLoading}
          className="flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8A951] max-h-32"
        />
        <Button
          type="submit"
          size="icon"
          disabled={isLoading || !input.trim()}
          className="bg-[#C8A951] text-[#0A1F44] hover:bg-[#E2C97E] h-9 w-9 shrink-0"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}
