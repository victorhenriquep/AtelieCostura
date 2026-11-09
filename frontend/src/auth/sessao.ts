import type { UsuarioLogado } from '../types';

// A sessão fica no sessionStorage: fecha a aba, precisa logar de novo.
const CHAVE = 'atelie.sessao';

export function obterSessao(): UsuarioLogado | null {
  try {
    const bruto = sessionStorage.getItem(CHAVE);
    return bruto ? (JSON.parse(bruto) as UsuarioLogado) : null;
  } catch {
    return null;
  }
}

export function salvarSessao(usuario: UsuarioLogado) {
  try {
    sessionStorage.setItem(CHAVE, JSON.stringify(usuario));
  } catch {
    /* navegador sem storage: a sessão dura só enquanto a página estiver aberta */
  }
}

export function limparSessao() {
  try {
    sessionStorage.removeItem(CHAVE);
  } catch {
    /* ignore */
  }
}
