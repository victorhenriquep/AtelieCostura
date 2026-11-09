import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../api';
import { definirAoNaoAutorizado } from '../api/http';
import { limparSessao, obterSessao, salvarSessao } from './sessao';
import { podeAcessar, type Recurso } from './permissoes';
import type { UsuarioLogado } from '../types';

interface AuthContextValue {
  usuario: UsuarioLogado | null;
  entrar(email: string, senha: string): Promise<void>;
  sair(): void;
  pode(recurso: Recurso): boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioLogado | null>(() => obterSessao());

  const sair = useCallback(() => {
    limparSessao();
    setUsuario(null);
  }, []);

  const entrar = useCallback(async (email: string, senha: string) => {
    const logado = await api.auth.login(email, senha);
    salvarSessao(logado);
    setUsuario(logado);
  }, []);

  // Se qualquer chamada à API voltar 401, desloga.
  useEffect(() => {
    definirAoNaoAutorizado(sair);
    return () => definirAoNaoAutorizado(null);
  }, [sair]);

  const valor = useMemo<AuthContextValue>(
    () => ({ usuario, entrar, sair, pode: (r) => podeAcessar(usuario?.perfil, r) }),
    [usuario, entrar, sair],
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return ctx;
}
