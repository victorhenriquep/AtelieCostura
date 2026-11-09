import type { StatusPedido } from '../types';
import { CLASSE_STATUS, NOME_STATUS } from '../utils/pedidos';

export function EtiquetaStatus({ status }: { status: StatusPedido }) {
  return <span className={`etiqueta ${CLASSE_STATUS[status]}`}>{NOME_STATUS[status]}</span>;
}
