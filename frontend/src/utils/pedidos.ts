import type { StatusPedido } from '../types';
import { hojeIso } from './datas';

export const NOME_STATUS: Record<StatusPedido, string> = {
  Pendente: 'Pendente',
  EmProducao: 'Em produção',
  Pronto: 'Pronto',
  Entregue: 'Entregue',
  Cancelado: 'Cancelado',
};

/** Classe CSS da etiqueta de cada status (cores em styles.css). */
export const CLASSE_STATUS: Record<StatusPedido, string> = {
  Pendente: 'etiqueta-pendente',
  EmProducao: 'etiqueta-producao',
  Pronto: 'etiqueta-pronto',
  Entregue: 'etiqueta-entregue',
  Cancelado: 'etiqueta-cancelado',
};

/** Próximo passo do fluxo: Pendente -> Em produção -> Pronto -> Entregue. Mesmas regras do backend. */
export const PROXIMA_ETAPA: Partial<Record<StatusPedido, { status: StatusPedido; acao: string }>> = {
  Pendente: { status: 'EmProducao', acao: 'Iniciar produção' },
  EmProducao: { status: 'Pronto', acao: 'Marcar como pronto' },
  Pronto: { status: 'Entregue', acao: 'Registrar entrega' },
};

export const podeCancelar = (status: StatusPedido) =>
  status === 'Pendente' || status === 'EmProducao' || status === 'Pronto';

export const estaEmAberto = podeCancelar;

/** "hoje", "atrasado" ou null, para destacar a data de entrega. */
export function situacaoPrazo(dataEntrega: string, status: StatusPedido): 'hoje' | 'atrasado' | null {
  if (!estaEmAberto(status)) return null;
  const hoje = hojeIso();
  if (dataEntrega === hoje) return 'hoje';
  if (dataEntrega < hoje) return 'atrasado';
  return null;
}
