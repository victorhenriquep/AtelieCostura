import type { CategoriaPagamento, FormaPagamento } from '../types';
import { NOME_CATEGORIA, NOME_FORMA } from './financeiro';

/** Formatação de valores para exibição (o banco guarda só os dígitos). */

export function soDigitos(valor: string) {
  return valor.replace(/\D/g, '');
}

export function formatarTelefone(valor: string) {
  const d = soDigitos(valor).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function formatarCpf(valor: string) {
  const d = soDigitos(valor).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

export function formatarDataHora(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR');
}

/** Nomes amigáveis para os campos que aparecem no log (o backend grava o nome da propriedade C#). */
const ROTULOS: Record<string, string> = {
  // Cliente
  Nome: 'Nome',
  Telefone: 'Telefone',
  Email: 'E-mail',
  Cpf: 'CPF',
  Endereco: 'Endereço',
  Observacoes: 'Observações',
  Ativo: 'Situação',
  // Serviço
  Descricao: 'Descrição',
  Preco: 'Preço',
  Complexidade: 'Complexidade',
  // Funcionário
  Perfil: 'Perfil',
  SenhaHash: 'Senha',
  // Pedido
  Cliente: 'Cliente',
  Itens: 'Itens',   // pedidos antigos, antes da divisão em peças
  Pecas: 'Peças e serviços',
  Recebimento: 'Recebimento',
  Estorno: 'Estorno de recebimento',
  // Pagamento
  Categoria: 'Categoria',
  Data: 'Data',
  Valor: 'Valor',
  FormaPagamento: 'Forma de pagamento',
  Observacao: 'Observação',
  Status: 'Status',
  DataEntrega: 'Data de entrega',
  ComplexidadeTotal: 'Complexidade total',
  ValorTotal: 'Valor total',
};

const STATUS_PEDIDO: Record<string, string> = {
  Pendente: 'Pendente',
  EmProducao: 'Em produção',
  Pronto: 'Pronto',
  Entregue: 'Entregue',
  Cancelado: 'Cancelado',
};

export function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** "2026-10-14" -> "14/10/2026" (sem passar por Date, para não mudar o dia por causa do fuso). */
export function formatarDataSimples(iso: string) {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

export function nomeStatusPedido(status: string) {
  return STATUS_PEDIDO[status] ?? status;
}

export function rotuloCampo(campo: string | null) {
  if (!campo) return '—';
  return ROTULOS[campo] ?? campo;
}

/** Deixa o valor do log legível: telefone formatado, true/false como Ativo/Inativo etc. */
export function formatarValorLog(campo: string | null, valor: string | null) {
  if (valor === null || valor === '') return '(vazio)';
  if (campo === 'Telefone') return formatarTelefone(valor);
  if (campo === 'Cpf') return formatarCpf(valor);
  if (campo === 'Ativo') return valor === 'true' ? 'Ativo' : 'Inativo';
  if (campo === 'Status') return nomeStatusPedido(valor);
  if (campo === 'DataEntrega' || campo === 'Data') return formatarDataSimples(valor);
  if (campo === 'Preco' || campo === 'ValorTotal' || campo === 'Valor') return formatarMoeda(Number(valor));
  if (campo === 'FormaPagamento') return NOME_FORMA[valor as FormaPagamento] ?? valor;
  if (campo === 'Categoria') return NOME_CATEGORIA[valor as CategoriaPagamento] ?? valor;
  return valor;
}
