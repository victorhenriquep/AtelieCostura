// Tipos compartilhados. Espelham os DTOs que o backend C# vai devolver.

export type Perfil = 'Administrador' | 'Visualizador';

export interface UsuarioLogado {
  id: number;
  nome: string;
  email: string;
  perfil: Perfil;
  token: string;
}

export interface Cliente {
  id: number;
  nome: string;
  telefone: string;
  email: string;
  cpf: string;
  endereco: string;
  observacoes: string;
  ativo: boolean;
  criadoEm: string; // ISO 8601
}

/** Campos que o usuário preenche no formulário de cliente. */
export type ClienteInput = Pick<Cliente, 'nome' | 'telefone' | 'email' | 'cpf' | 'endereco' | 'observacoes'>;

export type AcaoLog = 'Criacao' | 'Alteracao' | 'Exclusao';

/** Uma linha de log = um campo alterado em uma entidade. */
export interface LogAlteracao {
  id: number;
  entidade: string;      // "Cliente", "Servico", "Funcionario", "Pedido"
  entidadeId: number;
  acao: AcaoLog;
  campo: string | null;  // nome da propriedade em C# (ex.: "Telefone")
  valorAnterior: string | null;
  valorNovo: string | null;
  usuarioNome: string;
  dataHora: string;      // ISO 8601
}

// ---------------- Serviços ----------------

export interface Servico {
  id: number;
  nome: string;
  descricao: string;
  preco: number;
  complexidade: number; // quanto do limite diário (100) uma peça consome
  ativo: boolean;
  criadoEm: string;
}

export type ServicoInput = Pick<Servico, 'nome' | 'descricao' | 'preco' | 'complexidade'>;

export interface ServicoOpcao {
  id: number;
  nome: string;
  preco: number;
  complexidade: number;
}

// ---------------- Funcionários ----------------

export interface Funcionario {
  id: number;
  nome: string;
  email: string;
  perfil: Perfil;
  ativo: boolean;
  criadoEm: string;
}

export interface FuncionarioInput {
  nome: string;
  email: string;
  perfil: Perfil;
  senha: string; // vazio na edição = mantém a senha atual
}

// ---------------- Pedidos ----------------

export type StatusPedido = 'Pendente' | 'EmProducao' | 'Pronto' | 'Entregue' | 'Cancelado';

export interface ClienteOpcao {
  id: number;
  nome: string;
  telefone: string;
}

// Estrutura do pedido:  Pedido -> Peças -> Serviços de cada peça
// Ex.: 1x Calça jeans: Barra simples ("subir 3 cm") + Troca de zíper

/** Serviço aplicado a uma peça. Nome, preço e complexidade são uma cópia do momento do pedido. */
export interface PedidoPecaServico {
  id: number;
  servicoId: number;
  servicoNome: string;
  observacao: string;
  complexidadeUnitaria: number;
  precoUnitario: number;
}

/** Peça do pedido. Quantidade > 1 = várias peças iguais com os mesmos serviços. */
export interface PedidoPeca {
  id: number;
  descricao: string;
  quantidade: number;
  complexidade: number; // (soma da complexidade dos serviços) × quantidade
  subtotal: number;     // (soma do preço dos serviços) × quantidade
  servicos: PedidoPecaServico[];
}

export interface Pedido {
  id: number;
  clienteId: number;
  clienteNome: string;
  clienteTelefone: string;
  status: StatusPedido;
  dataEntrega: string; // "2026-10-14"
  complexidadeTotal: number;
  valorTotal: number;
  observacoes: string;
  criadoEm: string;
  podeEditar: boolean;
  pecas: PedidoPeca[];
  // Financeiro: null para o Visualizador
  valorRecebido: number | null;
  situacaoPagamento: SituacaoPagamento | null;
  recebimentos: RecebimentoDoPedido[] | null;
}

export interface PedidoResumo {
  id: number;
  clienteNome: string;
  status: StatusPedido;
  dataEntrega: string;
  complexidadeTotal: number;
  valorTotal: number;
  quantidadePecas: number; // soma das quantidades das peças
  criadoEm: string;
  valorRecebido?: number | null;
  situacaoPagamento?: SituacaoPagamento | null;
}

export interface ServicoPecaInput {
  servicoId: number;
  observacao: string;
}

export interface PecaInput {
  descricao: string;
  quantidade: number;
  servicos: ServicoPecaInput[];
}

export interface PedidoInput {
  clienteId: number;
  observacoes: string;
  pecas: PecaInput[];
}

export interface FiltroPedidos {
  status?: StatusPedido;
  busca?: string;
  incluirFinalizados?: boolean;
}

export interface SimulacaoEntrega {
  dataEntrega: string;
  complexidadeTotal: number;
  capacidadeDiaria: number;
  valorTotal: number;
}

export interface OcupacaoDia {
  data: string;
  complexidade: number;
  capacidade: number;
  disponivel: number;
}

// ---------------- Financeiro ----------------

export type FormaPagamento = 'Dinheiro' | 'Pix' | 'CartaoDebito' | 'CartaoCredito';
export type CategoriaPagamento = 'Materiais' | 'Aluguel' | 'Contas' | 'Salarios' | 'Impostos' | 'Manutencao' | 'Outros';
export type SituacaoPagamento = 'AReceber' | 'Parcial' | 'Pago';

/** Período "2026-10-01" a "2026-10-31". Sem datas = mês atual. */
export interface FiltroPeriodo {
  de?: string;
  ate?: string;
}

export interface RecebimentoDoPedido {
  id: number;
  data: string;
  valor: number;
  formaPagamento: FormaPagamento;
  observacao: string;
}

export interface Recebimento {
  id: number;
  pedidoId: number;
  clienteNome: string;
  data: string;
  valor: number;
  formaPagamento: FormaPagamento;
  observacao: string;
  situacaoPedido: SituacaoPagamento;
  criadoEm: string;
}

export interface RecebimentoInput {
  pedidoId: number;
  data: string;
  valor: number;
  formaPagamento: FormaPagamento;
  observacao: string;
}

export interface PedidoAReceber {
  id: number;
  clienteNome: string;
  status: StatusPedido;
  dataEntrega: string;
  valorTotal: number;
  valorRecebido: number;
  saldo: number;
}

export interface ListaRecebimentos {
  recebimentos: Recebimento[];
  total: number;
  porForma: { forma: FormaPagamento; total: number }[];
}

export interface Pagamento {
  id: number;
  descricao: string;
  categoria: CategoriaPagamento;
  data: string;
  valor: number;
  formaPagamento: FormaPagamento;
  observacao: string;
  criadoEm: string;
}

export type PagamentoInput = Pick<Pagamento, 'descricao' | 'categoria' | 'data' | 'valor' | 'formaPagamento' | 'observacao'>;

export interface ListaPagamentos {
  pagamentos: Pagamento[];
  total: number;
  porCategoria: { categoria: CategoriaPagamento; total: number }[];
}

export interface FluxoDia {
  data: string;
  entradas: number;
  saidas: number;
  saldoDoDia: number;
  saldoAcumulado: number;
}

export interface FluxoCaixa {
  de: string;
  ate: string;
  saldoInicial: number;
  totalEntradas: number;
  totalSaidas: number;
  saldoFinal: number;
  dias: FluxoDia[];
  entradasPorForma: { forma: FormaPagamento; total: number }[];
  saidasPorCategoria: { categoria: CategoriaPagamento; total: number }[];
}

// ---------------- Indicadores (painel do Início) ----------------

export interface Indicadores {
  de: string;
  ate: string;
  totalPedidos: number;
  tempoPorServico: { servico: string; horasMedias: number; pecas: number }[];           // P1
  ocupacaoSemanal: { semana: string; percentual: number; complexidade: number; capacidade: number }[]; // P2
  prazos: { noPrazo: number; atrasados: number; emAndamento: number; indice: number | null };          // P4
  // Financeiro: null para o Visualizador
  faturamento: number | null;
  ticketMedioPedido: number | null;
  ticketPorServico: { servico: string; ticketMedio: number; pedidos: number }[] | null;  // P3
  receitaPorHora: { servico: string; receitaPorHora: number; horas: number }[] | null;   // P3
  faturamentoPorCliente: { cliente: string; valor: number; pedidos: number }[] | null;   // P5
  inadimplencia: { pedidos: number; valor: number } | null;                              // P5
}
