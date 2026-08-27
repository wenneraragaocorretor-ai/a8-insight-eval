// Captura e gerencia o código de indicação de afiliado (?ref=CODIGO).
// Janela de atribuição: 30 dias, modelo "última indicação válida".

import { supabase } from "../integrations/supabase/client";

const STORAGE_KEY = "a8_ref_code";
const WINDOW_DAYS = 30;
const WINDOW_MS = WINDOW_DAYS * 24 * 60 * 60 * 1000;

type Stored = { code: string; ts: number };

function read(): Stored | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    if (!parsed?.code || typeof parsed.ts !== "number") return null;
    if (Date.now() - parsed.ts > WINDOW_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function write(code: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ code, ts: Date.now() }));
  } catch {}
}

export function clearRef() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export function getRefCode(): string | null {
  return read()?.code ?? null;
}

/**
 * Captura ?ref= da URL atual, salva no localStorage e limpa o param da URL
 * (sem reload). Última indicação válida sobrescreve a anterior.
 */
export function captureRefFromUrl() {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    const ref = url.searchParams.get("ref");
    if (!ref) return;
    const normalized = ref.trim().toUpperCase();
    if (!/^[A-Z0-9]{4,16}$/.test(normalized)) return;
    write(normalized);
    url.searchParams.delete("ref");
    const qs = url.searchParams.toString();
    const newUrl = url.pathname + (qs ? `?${qs}` : "") + url.hash;
    window.history.replaceState({}, "", newUrl);
  } catch {}
}

/**
 * Após cadastro bem-sucedido, vincula o usuário ao afiliado correspondente
 * (se o código for válido e ativo). Falhas são silenciosas — nunca bloqueiam
 * o fluxo de cadastro.
 */
export async function vincularAfiliadoSeNecessario(userId: string): Promise<void> {
  const code = getRefCode();
  if (!code) return;
  try {
    const { data: afiliadoId, error: rpcErr } = await supabase.rpc("resolver_codigo_afiliado", {
      _codigo: code,
    });
    if (rpcErr) {
      console.warn("[affiliateRef] rpc error", rpcErr);
      return;
    }
    if (!afiliadoId) {
      // Código inválido/inativo — limpa para não tentar de novo.
      clearRef();
      return;
    }
    const { error: updErr } = await supabase
      .from("profiles")
      .update({ afiliado_indicador_id: afiliadoId as string })
      .eq("id", userId)
      .is("afiliado_indicador_id", null);
    if (updErr) {
      console.warn("[affiliateRef] update profile error", updErr);
      return;
    }
    clearRef();
  } catch (e) {
    console.warn("[affiliateRef] vincular falhou", e);
  }
}
