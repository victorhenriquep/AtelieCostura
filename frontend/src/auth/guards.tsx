import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import type { Recurso } from './permissoes';
import { AcessoNegado } from '../pages/AcessoNegado';

/** Bloqueia rotas para quem não está logado e manda para o login. */
export function RequerLogin() {
  const { usuario } = useAuth();
  const location = useLocation();
  if (!usuario) return <Navigate to="/login" replace state={{ de: location.pathname }} />;
  return <Outlet />;
}

/** Bloqueia uma tela para perfis sem permissão. */
export function RequerPermissao({ recurso, children }: { recurso: Recurso; children: ReactNode }) {
  const { pode } = useAuth();
  return pode(recurso) ? <>{children}</> : <AcessoNegado />;
}
