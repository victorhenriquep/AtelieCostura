import type { CategoriaPagamento, FormaPagamento, SituacaoPagamento } from '../types';
import { deIso, isoLocal } from './datas';

export const NOME_FORMA: Record<FormaPagamento, string> = {
  Dinheiro: 'Dinheiro',
  Pix: 'Pix',
  CartaoDebito: 'Cartão de débito',
  CartaoCredito: 'Cartão de crédito',
};

export const NOME_CATEGORIA: Record<CategoriaPagamento, string> = {
  Materiais: 'Materiais',
  Aluguel: 'Aluguel',
  Contas: 'Contas (água, luz, internet)',
  Salarios: 'Salários',
  Impostos: 'Impostos',
  Manutencao: 'Manutenção',
  Outros: 'Outros',
};

export const NOME_SITUACAO: Record<SituacaoPagamento, string> = {
  AReceber: 'A receber',
  Parcial: 'Parcial',
  Pago: 'Pago',
};

export const CLASSE_SITUACAO: Record<SituacaoPagamento, string> = {
  AReceber: 'etiqueta-pendente',
  Parcial: 'etiqueta-producao',
  Pago: 'etiqueta-pronto',
};

/** "2026-10" (valor de um <input type="month">) -> primeiro e último dia do mês. */
export function periodoDoMes(mes: string) {
  const [a, m] = mes.split('-').map(Number);
  return { de: isoLocal(new Date(a, m - 1, 1, 12)), ate: isoLocal(new Date(a, m, 0, 12)) };
}

export function mesAtual() {
  return isoLocal(new Date()).slice(0, 7);
}

/** "2026-10" -> "outubro de 2026" */
export function nomeDoMes(mes: string) {
  return deIso(`${mes}-01`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

/** "1.234,56" ou "1234.56" -> 1234.56 */
export const paraNumero = (v: string) => Number(v.includes(',') ? v.replace(/\./g, '').replace(',', '.') : v);

/** 50 -> "50,00" (valor inicial de um campo de dinheiro) */
export const paraTexto = (v: number) => v.toFixed(2).replace('.', ',');
