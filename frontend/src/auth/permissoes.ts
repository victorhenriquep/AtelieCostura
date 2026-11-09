import type { Perfil } from '../types';

/**
 * Quem acessa cada parte do sistema.
 *  - Administrador: acessa e altera tudo.
 *  - Visualizador: somente consulta pedidos e clientes (sem cadastrar, editar, mudar status ou cancelar).
 *    Não vê o financeiro (recebimentos, pagamentos e fluxo de caixa).
 *
 * Recursos terminados em ".editar" controlam botões de cadastro/alteração dentro de uma tela
 * que o perfil pode ver. O backend repete essas regras; o front só esconde o que não pode.
 */
export const permissoes = {
  dashboard: ['Administrador', 'Visualizador'],
  pedidos: ['Administrador', 'Visualizador'],
  'pedidos.editar': ['Administrador'],
  clientes: ['Administrador', 'Visualizador'],
  'clientes.editar': ['Administrador'],
  servicos: ['Administrador'],
  funcionarios: ['Administrador'],
  logs: ['Administrador'],
  financeiro: ['Administrador'],
} as const satisfies Record<string, readonly Perfil[]>;

export type Recurso = keyof typeof permissoes;

export function podeAcessar(perfil: Perfil | undefined, recurso: Recurso): boolean {
  if (!perfil) return false;
  return (permissoes[recurso] as readonly Perfil[]).includes(perfil);
}
