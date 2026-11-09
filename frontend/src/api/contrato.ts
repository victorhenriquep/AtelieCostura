import type {
  Indicadores,
  CategoriaPagamento, FiltroPeriodo, FluxoCaixa, FormaPagamento, ListaPagamentos, ListaRecebimentos, Pagamento,
  PagamentoInput, PedidoAReceber, Recebimento, RecebimentoInput,
  Cliente, ClienteInput, ClienteOpcao, FiltroPedidos, Funcionario, FuncionarioInput, LogAlteracao,
  OcupacaoDia, PecaInput, Pedido, PedidoInput, PedidoResumo, Servico, ServicoInput, ServicoOpcao, SimulacaoEntrega,
  StatusPedido, UsuarioLogado,
} from '../types';

/** Filtro padrão das listagens de cadastro. */
export interface FiltroCadastro {
  busca?: string;
  incluirInativos?: boolean;
}

/**
 * Contrato da API. Existem duas implementações:
 *  - apiReal.ts  -> chama o backend C# via HTTP
 *  - mock/apiMock.ts -> simula o backend no navegador (localStorage)
 * As telas só conhecem este contrato, então trocar uma pela outra não muda nada nelas.
 */
export interface Api {
  auth: {
    login(email: string, senha: string): Promise<UsuarioLogado>;
  };
  clientes: {
    listar(filtro: FiltroCadastro): Promise<Cliente[]>;
    obter(id: number): Promise<Cliente>;
    criar(dados: ClienteInput): Promise<Cliente>;
    atualizar(id: number, dados: ClienteInput): Promise<Cliente>;
    alterarStatus(id: number, ativo: boolean): Promise<void>;
    /** Lista resumida de clientes ativos (para montar o pedido). */
    opcoes(busca?: string): Promise<ClienteOpcao[]>;
  };
  servicos: {
    listar(filtro: FiltroCadastro): Promise<Servico[]>;
    criar(dados: ServicoInput): Promise<Servico>;
    atualizar(id: number, dados: ServicoInput): Promise<Servico>;
    alterarStatus(id: number, ativo: boolean): Promise<void>;
    /** Serviços ativos (para montar o pedido). */
    opcoes(): Promise<ServicoOpcao[]>;
  };
  funcionarios: {
    listar(filtro: FiltroCadastro): Promise<Funcionario[]>;
    criar(dados: FuncionarioInput): Promise<Funcionario>;
    atualizar(id: number, dados: FuncionarioInput): Promise<Funcionario>;
    alterarStatus(id: number, ativo: boolean): Promise<void>;
  };
  pedidos: {
    listar(filtro: FiltroPedidos): Promise<PedidoResumo[]>;
    obter(id: number): Promise<Pedido>;
    criar(dados: PedidoInput): Promise<Pedido>;
    atualizar(id: number, dados: PedidoInput): Promise<Pedido>;
    alterarStatus(id: number, status: StatusPedido): Promise<void>;
    /** Calcula a data de entrega sem salvar (pedidoId = edição de um pedido existente). */
    simularEntrega(pecas: PecaInput[], pedidoId?: number): Promise<SimulacaoEntrega>;
    /** Complexidade reservada em cada dia útil. */
    ocupacao(de?: string, ate?: string): Promise<OcupacaoDia[]>;
  };
  recebimentos: {
    listar(filtro: FiltroPeriodo & { forma?: FormaPagamento }): Promise<ListaRecebimentos>;
    /** Pedidos não cancelados que ainda têm saldo. */
    pedidosAReceber(): Promise<PedidoAReceber[]>;
    registrar(dados: RecebimentoInput): Promise<Recebimento>;
    estornar(id: number): Promise<void>;
  };
  pagamentos: {
    listar(filtro: FiltroPeriodo & { categoria?: CategoriaPagamento }): Promise<ListaPagamentos>;
    criar(dados: PagamentoInput): Promise<Pagamento>;
    atualizar(id: number, dados: PagamentoInput): Promise<Pagamento>;
    excluir(id: number): Promise<void>;
  };
  fluxoCaixa(filtro: FiltroPeriodo): Promise<FluxoCaixa>;
  indicadores(filtro: FiltroPeriodo): Promise<Indicadores>;
  logs: {
    listar(entidade: string, entidadeId: number): Promise<LogAlteracao[]>;
  };
}
