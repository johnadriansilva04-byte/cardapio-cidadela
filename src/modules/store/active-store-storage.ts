/**
 * Loja ativa lembrada no dispositivo (não na conta): quem opera o balcão quer
 * a mesma loja aberta ao recarregar, mas outra pessoa na mesma conta pode
 * preferir a dela. Fica fora do provider para o fast refresh não reclamar de
 * um arquivo que exporta componente e função ao mesmo tempo.
 */
const STORAGE_KEY = "cidadela:active-store";

export function readStoredStoreId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

export function persistStoreId(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* storage bloqueado — a escolha vale só para esta sessão */
  }
}
