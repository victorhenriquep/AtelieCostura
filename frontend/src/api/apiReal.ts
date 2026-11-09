import type { Api, FiltroCadastro } from './contrato';
import { http } from './http';
import type {
  Indicadores,
  FluxoCaixa, ListaPagamentos, ListaRecebimentos, Pagamento, PedidoAReceber, Recebimento,
  Cliente, ClienteOpcao, Funcionario, LogAlteracao, OcupacaoDia, Pedido, PedidoResumo, Servico, ServicoOpcao,
  SimulacaoEntrega, UsuarioLogado,
} from '../types';

/** Monta "?a=1&b=2" ignorando valores vazios. */
function query(params: Record<string, string | number | boolean | undefined>) {
  const qs = new URLSearchParams();
  for (const [chave, valor] of Object.entries(params)) {
    if (valor !== undefined && valor !== '' && valor !== false) qs.set(chave, String(valor));
  }
  const texto = qs.toString();
  return texto ? `?${texto}` : '';
}

const filtroCadastro = (f: FiltroCadastro) => query({ busca: f.busca, incluirInativos: f.incluirInativos });

const json = (method: string, corpo: unknown): RequestInit => ({ method, body: JSON.stringify(corpo) });

// Rotas expostas pelo backend C# (veja backend/README.md).
export const apiReal: Api = {
  auth: {
    login: (email, senha) => http<UsuarioLogado>('/auth/login', json('POST', { email, senha })),
  },
  clientes: {
    listar: (filtro) => http<Cliente[]>(`/clientes${filtroCadastro(filtro)}`),
    obter: (id) => http<Cliente>(`/clientes/${id}`),
    criar: (dados) => http<Cliente>('/clientes', json('POST', dados)),
    atualizar: (id, dados) => http<Cliente>(`/clientes/${id}`, json('PUT', dados)),
    alterarStatus: (id, ativo) => http<void>(`/clientes/${id}/status`, json('PATCH', { ativo })),
    opcoes: (busca) => http<ClienteOpcao[]>(`/clientes/opcoes${query({ busca })}`),
  },
  servicos: {
    listar: (filtro) => http<Servico[]>(`/servicos${filtroCadastro(filtro)}`),
    criar: (dados) => http<Servico>('/servicos', json('POST', dados)),
    atualizar: (id, dados) => http<Servico>(`/servicos/${id}`, json('PUT', dados)),
    alterarStatus: (id, ativo) => http<void>(`/servicos/${id}/status`, json('PATCH', { ativo })),
    opcoes: () => http<ServicoOpcao[]>('/servicos/opcoes'),
  },
  funcionarios: {
    listar: (filtro) => http<Funcionario[]>(`/funcionarios${filtroCadastro(filtro)}`),
    criar: (dados) => http<Funcionario>('/funcionarios', json('POST', dados)),
    atualizar: (id, dados) => http<Funcionario>(`/funcionarios/${id}`, json('PUT', dados)),
    alterarStatus: (id, ativo) => http<void>(`/funcionarios/${id}/status`, json('PATCH', { ativo })),
  },
  pedidos: {
    listar: (f) =>
      http<PedidoResumo[]>(`/pedidos${query({ status: f.status, busca: f.busca, incluirFinalizados: f.incluirFinalizados })}`),
    obter: (id) => http<Pedido>(`/pedidos/${id}`),
    criar: (dados) => http<Pedido>('/pedidos', json('POST', dados)),
    atualizar: (id, dados) => http<Pedido>(`/pedidos/${id}`, json('PUT', dados)),
    alterarStatus: (id, status) => http<void>(`/pedidos/${id}/status`, json('PATCH', { status })),
    simularEntrega: (pecas, pedidoId) =>
      http<SimulacaoEntrega>('/pedidos/simular-entrega', json('POST', { pecas, pedidoId: pedidoId ?? null })),
    ocupacao: (de, ate) => http<OcupacaoDia[]>(`/pedidos/ocupacao${query({ de, ate })}`),
  },
  recebimentos: {
    listar: (f) => http<ListaRecebimentos>(`/recebimentos${query({ de: f.de, ate: f.ate, forma: f.forma })}`),
    pedidosAReceber: () => http<PedidoAReceber[]>('/recebimentos/pedidos-a-receber'),
    registrar: (dados) => http<Recebimento>('/recebimentos', json('POST', dados)),
    estornar: (id) => http<void>(`/recebimentos/${id}`, { method: 'DELETE' }),
  },
  pagamentos: {
    listar: (f) => http<ListaPagamentos>(`/pagamentos${query({ de: f.de, ate: f.ate, categoria: f.categoria })}`),
    criar: (dados) => http<Pagamento>('/pagamentos', json('POST', dados)),
    atualizar: (id, dados) => http<Pagamento>(`/pagamentos/${id}`, json('PUT', dados)),
    excluir: (id) => http<void>(`/pagamentos/${id}`, { method: 'DELETE' }),
  },
  fluxoCaixa: (f) => http<FluxoCaixa>(`/fluxo-caixa${query({ de: f.de, ate: f.ate })}`),
  indicadores: (f) => http<Indicadores>(`/indicadores${query({ de: f.de, ate: f.ate })}`),
  logs: {
    listar: (entidade, entidadeId) =>
      http<LogAlteracao[]>(`/logs${query({ entidade, entidadeId })}`),
  },
};
