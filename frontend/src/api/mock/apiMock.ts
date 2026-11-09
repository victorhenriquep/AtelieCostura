/**
 * API SIMULADA — permite usar o front sem o backend (VITE_USE_MOCK=true).
 * Guarda tudo no localStorage e imita as regras do backend:
 *  - login com os funcionários cadastrados
 *  - permissão por perfil (403)
 *  - log de alterações campo a campo
 *  - cálculo da data de entrega (hoje + 3 dias úteis, limite de 100 de complexidade por dia)
 */
import type { Api } from '../contrato';
import { ApiError, notificarNaoAutorizado } from '../http';
import { obterSessao } from '../../auth/sessao';
import { podeAcessar, type Recurso } from '../../auth/permissoes';
import type {
  CategoriaPagamento, FluxoDia, Indicadores, FormaPagamento, Pagamento, PagamentoInput, Recebimento, RecebimentoDoPedido, RecebimentoInput,
  SituacaoPagamento, AcaoLog, Cliente, ClienteInput, Funcionario, FuncionarioInput, LogAlteracao, OcupacaoDia, PecaInput, Pedido, PedidoPeca,
  PedidoResumo, Perfil, Servico, ServicoInput, StatusPedido,
} from '../../types';
import { adicionarDias, adicionarDiasUteis, deIso, ehDiaUtil, hojeIso, isoLocal, proximoDiaUtil } from '../../utils/datas';

// ======================= "Banco" =======================

const CAPACIDADE_DIARIA = 100;
const DIAS_UTEIS_ENTREGA = 3;

interface FuncionarioMock extends Funcionario { senha: string }

interface PedidoMock {
  id: number;
  clienteId: number;
  status: StatusPedido;
  dataEntrega: string;
  complexidadeTotal: number;
  valorTotal: number;
  observacoes: string;
  criadoEm: string;
  pecas: PedidoPeca[];
}

interface Banco {
  clientes: Cliente[];
  servicos: Servico[];
  funcionarios: FuncionarioMock[];
  pedidos: PedidoMock[];
  recebimentos: (RecebimentoDoPedido & { pedidoId: number; criadoEm: string })[];
  pagamentos: Pagamento[];
  logs: LogAlteracao[];
  seq: { cliente: number; servico: number; funcionario: number; pedido: number; peca: number; pecaServico: number; recebimento: number; pagamento: number; log: number };
}

const CHAVE = 'atelie.mock.banco.v6';

function bancoInicial(): Banco {
  const agora = Date.now();
  const diasAtras = (d: number) => new Date(agora - d * 86_400_000).toISOString();

  const banco: Banco = {
    clientes: [
      { id: 1, nome: 'Ana Paula Ribeiro', telefone: '31988887777', email: 'ana.ribeiro@email.com', cpf: '12345678909', endereco: 'Rua da Bahia, 1200 - Centro, Belo Horizonte', observacoes: 'Prefere retirar no sábado de manhã.', ativo: true, criadoEm: diasAtras(20) },
      { id: 2, nome: 'Carla Mendes', telefone: '31977776666', email: '', cpf: '', endereco: 'Av. Afonso Pena, 500', observacoes: '', ativo: true, criadoEm: diasAtras(12) },
      { id: 3, nome: 'Juliana Souza', telefone: '3133334444', email: 'ju.souza@email.com', cpf: '', endereco: '', observacoes: 'Vestidos de festa.', ativo: true, criadoEm: diasAtras(5) },
    ],
    servicos: [
      { id: 1, nome: 'Barra simples', descricao: 'Barra de calça ou saia', preco: 25, complexidade: 5, ativo: true, criadoEm: diasAtras(30) },
      { id: 2, nome: 'Troca de zíper', descricao: 'Calças, saias e jaquetas', preco: 35, complexidade: 10, ativo: true, criadoEm: diasAtras(30) },
      { id: 3, nome: 'Ajuste de cintura', descricao: 'Apertar ou soltar a cintura', preco: 45, complexidade: 15, ativo: true, criadoEm: diasAtras(30) },
      { id: 4, nome: 'Bainha de vestido', descricao: 'Vestidos longos ou de festa', preco: 60, complexidade: 20, ativo: true, criadoEm: diasAtras(30) },
      { id: 5, nome: 'Customização', descricao: 'Aplicações e bordados simples', preco: 90, complexidade: 30, ativo: true, criadoEm: diasAtras(30) },
      { id: 6, nome: 'Vestido sob medida', descricao: 'Confecção completa de vestido', preco: 600, complexidade: 80, ativo: true, criadoEm: diasAtras(30) },
    ],
    funcionarios: [
      { id: 1, nome: 'Administrador', email: 'admin@atelie.com', senha: 'admin123', perfil: 'Administrador', ativo: true, criadoEm: diasAtras(30) },
      { id: 2, nome: 'Maria Visualizadora', email: 'visualizador@atelie.com', senha: 'visualizador123', perfil: 'Visualizador', ativo: true, criadoEm: diasAtras(30) },
    ],
    pedidos: [],
    recebimentos: [],
    pagamentos: [],
    logs: [],
    seq: { cliente: 4, servico: 7, funcionario: 3, pedido: 1, peca: 1, pecaServico: 1, recebimento: 1, pagamento: 1, log: 1 },
  };

  for (const c of banco.clientes) log(banco, 'Cliente', c.id, 'Criacao', null, null, null, 'Administrador', c.criadoEm);
  for (const s of banco.servicos) log(banco, 'Servico', s.id, 'Criacao', null, null, null, 'Sistema', s.criadoEm);
  for (const f of banco.funcionarios) log(banco, 'Funcionario', f.id, 'Criacao', null, null, null, 'Sistema', f.criadoEm);
  log(banco, 'Cliente', 1, 'Alteracao', 'Telefone', '31999990000', '31988887777', 'Administrador', diasAtras(3));

  // Pedidos de exemplo. Os pendentes passam pela regra real de data de entrega;
  // juntos eles enchem o primeiro dia disponível (40 + 30 + 30 = 100) e o último vai para o dia seguinte.
  const hoje = hojeIso();
  const horasDepois = (iso: string, h: number) => new Date(new Date(iso).getTime() + h * 3_600_000).toISOString();
  /** producao = [horas após o cadastro em que entrou em produção, horas de produção até ficar pronto] */
  const exemplo = (clienteId: number, pecas: PecaInput[], status: StatusPedido, data: string | null, criadoHa: number,
    producao: [number, number] = [20, 30]) => {
    const montadas = montarPecas(banco, pecas);
    const complexidade = somaComplexidade(montadas);
    const pedido: PedidoMock = {
      id: banco.seq.pedido++,
      clienteId,
      status,
      dataEntrega: data ?? proximaDataDisponivel(dataMinima(hoje), complexidade, ocupacao(banco, dataMinima(hoje), 0)),
      complexidadeTotal: complexidade,
      valorTotal: somaValor(montadas),
      observacoes: '',
      criadoEm: diasAtras(criadoHa),
      pecas: montadas,
    };
    banco.pedidos.push(pedido);
    log(banco, 'Pedido', pedido.id, 'Criacao', null, null, null, 'Administrador', pedido.criadoEm);
    if (status === 'Pendente') return;
    const inicio = horasDepois(pedido.criadoEm, producao[0]);
    log(banco, 'Pedido', pedido.id, 'Alteracao', 'Status', 'Pendente', 'EmProducao', 'Administrador', inicio);
    if (status === 'EmProducao') return;
    const pronto = horasDepois(inicio, producao[1]);
    log(banco, 'Pedido', pedido.id, 'Alteracao', 'Status', 'EmProducao', 'Pronto', 'Administrador', pronto);
    if (status === 'Entregue') log(banco, 'Pedido', pedido.id, 'Alteracao', 'Status', 'Pronto', 'Entregue', 'Administrador', horasDepois(pronto, 30));
  };
  const peca = (descricao: string, quantidade: number, ...servicos: [number, string?][]): PecaInput => ({
    descricao, quantidade, servicos: servicos.map(([servicoId, observacao]) => ({ servicoId, observacao: observacao ?? '' })),
  });
  exemplo(1, [peca('Vestido de madrinha', 1, [6])], 'Entregue', adicionarDias(hoje, -2), 9);
  exemplo(1, [peca('Calça jeans', 4, [1]), peca('Saia preta', 1, [3, 'soltar 2 cm'], [1])], 'Pronto', proximoDiaUtil(hoje), 4);
  exemplo(2, [peca('Vestido de formatura', 1, [6])], 'EmProducao', adicionarDiasUteis(hoje, 2), 3);
  // Pendentes: 40 + 30 + 30 = 100 enchem o primeiro dia; o último vai para o dia seguinte.
  exemplo(3, [peca('Vestido longo azul', 1, [4, 'na altura do tornozelo'], [1]), peca('Vestido longo verde', 1, [3])], 'Pendente', null, 1);
  exemplo(1, [peca('Jaqueta de couro', 1, [2]), peca('Calça social', 2, [2, 'zíper invisível'])], 'Pendente', null, 1);
  exemplo(2, [peca('Jaqueta jeans', 1, [5, 'bordado nas costas'])], 'Pendente', null, 0);
  exemplo(3, [peca('Calça de linho', 2, [1])], 'Pendente', null, 0);

  // Histórico das últimas semanas (pedidos 8 a 17), para os indicadores do Início.
  // [cliente, peças, criado há (dias), entrega prometida há (dias), horas de produção]
  const historico: [number, PecaInput[], number, number, number][] = [
    [1, [peca('Calça social', 2, [1])], 70, 65, 6],
    [2, [peca('Vestido de festa', 1, [4], [3])], 66, 61, 30],
    [3, [peca('Jaqueta jeans', 1, [2])], 60, 55, 10],
    [1, [peca('Vestido de noiva', 1, [6])], 58, 50, 190],
    [2, [peca('Saia midi', 1, [3]), peca('Blusa', 1, [1])], 45, 40, 24],
    [3, [peca('Calça jeans', 3, [1], [2])], 38, 33, 40],
    [1, [peca('Camisa bordada', 1, [5])], 30, 25, 70],
    [2, [peca('Vestido curto', 1, [4])], 24, 19, 20],
    [3, [peca('Calças de uniforme', 5, [1])], 18, 13, 12],
    [1, [peca('Blazer', 1, [3], [2])], 12, 8, 50],
  ];
  for (const [cliente, pecas, criadoHa, entregaHa, horasProducao] of historico)
    exemplo(cliente, pecas, 'Entregue', adicionarDias(hoje, -entregaHa), criadoHa, [18, horasProducao]);

  // Financeiro de exemplo: pedido 1 pago, pedido 2 com sinal, pedido 4 com sinal; algumas saídas.
  const receber = (pedidoId: number, valor: number, formaPagamento: FormaPagamento, diasAtrasRec: number, observacao = '') => {
    const data = adicionarDias(hoje, -diasAtrasRec);
    banco.recebimentos.push({ id: banco.seq.recebimento++, pedidoId, data, valor, formaPagamento, observacao, criadoEm: diasAtras(diasAtrasRec) });
  };
  const pagar = (descricao: string, categoria: CategoriaPagamento, valor: number, formaPagamento: FormaPagamento, diasAtrasPag: number) => {
    banco.pagamentos.push({ id: banco.seq.pagamento++, descricao, categoria, data: adicionarDias(hoje, -diasAtrasPag), valor, formaPagamento, observacao: '', criadoEm: diasAtras(diasAtrasPag) });
  };
  receber(1, 300, 'Pix', 9, 'sinal');
  receber(1, 300, 'Dinheiro', 2, 'restante na retirada');
  receber(2, 80, 'CartaoDebito', 4, 'sinal');
  receber(4, 50, 'Pix', 1, 'sinal');
  // Histórico: quase todos pagos; o 13 e o 16 foram entregues com saldo em aberto.
  for (const p of banco.pedidos.filter((x) => x.id >= 8)) {
    const diasAtrasEntrega = Math.round((Date.parse(hoje) - Date.parse(p.dataEntrega)) / 86_400_000);
    receber(p.id, p.id === 13 || p.id === 16 ? Math.round(p.valorTotal / 2) : p.valorTotal, p.id % 2 ? 'Pix' : 'Dinheiro', diasAtrasEntrega);
  }
  pagar('Aluguel da sala', 'Aluguel', 900, 'Pix', 20);
  pagar('Linhas, zíperes e botões', 'Materiais', 145.9, 'CartaoCredito', 6);
  pagar('Conta de luz', 'Contas', 182.4, 'Pix', 3);
  for (const r of banco.recebimentos) log(banco, 'Pedido', r.pedidoId, 'Alteracao', 'Recebimento', null, descreverRecebimento(r), 'Administrador', r.criadoEm);
  for (const p of banco.pagamentos) log(banco, 'Pagamento', p.id, 'Criacao', null, null, null, 'Administrador', p.criadoEm);

  return banco;
}

let memoria: Banco | null = null;

function lerBanco(): Banco {
  if (memoria) return memoria;
  try {
    const bruto = localStorage.getItem(CHAVE);
    memoria = bruto ? (JSON.parse(bruto) as Banco) : bancoInicial();
  } catch {
    memoria = bancoInicial();
  }
  return memoria;
}

function salvarBanco(banco: Banco) {
  memoria = banco;
  try {
    localStorage.setItem(CHAVE, JSON.stringify(banco));
  } catch {
    /* sem storage: fica só em memória */
  }
}

// ======================= Utilitários =======================

const esperar = (ms = 200) => new Promise((r) => setTimeout(r, ms));
const erro = (mensagem: string) => new ApiError(400, mensagem);
const soDigitos = (v: string) => (v ?? '').replace(/\D/g, '');
const emailValido = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

/** Simula o [Authorize] do backend. */
function exigir(recurso: Recurso) {
  const sessao = obterSessao();
  if (!sessao) {
    notificarNaoAutorizado();
    throw new ApiError(401, 'Sessão expirada. Faça login novamente.');
  }
  if (!podeAcessar(sessao.perfil, recurso)) throw new ApiError(403, 'Você não tem permissão para esta ação.');
  return sessao;
}

function log(
  banco: Banco, entidade: string, entidadeId: number, acao: AcaoLog, campo: string | null,
  valorAnterior: string | null, valorNovo: string | null, usuarioNome: string, dataHora = new Date().toISOString(),
) {
  banco.logs.push({ id: banco.seq.log++, entidade, entidadeId, acao, campo, valorAnterior, valorNovo, usuarioNome, dataHora });
}

function textoLog(valor: unknown) {
  if (typeof valor === 'number' && !Number.isInteger(valor)) return valor.toFixed(2);
  return String(valor);
}

/**
 * Mesmo princípio do backend: compara campo a campo e grava uma linha por campo alterado.
 * `campos` mapeia a propriedade do front para o nome da propriedade em C#.
 */
function registrarDiferencas(
  banco: Banco, entidade: string, id: number, antes: object, depois: object,
  campos: Record<string, string>, usuario: string, sensiveis: string[] = [],
) {
  const a = antes as Record<string, unknown>;
  const d = depois as Record<string, unknown>;
  for (const [chave, campo] of Object.entries(campos)) {
    if (a[chave] === d[chave]) continue;
    const oculto = sensiveis.includes(chave);
    log(banco, entidade, id, 'Alteracao', campo, oculto ? '******' : textoLog(a[chave]), oculto ? '******' : textoLog(d[chave]), usuario);
  }
}

function filtrarCadastro<T extends { nome: string; ativo: boolean }>(
  lista: T[], busca: string | undefined, incluirInativos: boolean | undefined, extras: (x: T) => string[] = () => [],
) {
  const termo = (busca ?? '').trim().toLowerCase();
  return lista
    .filter((x) => incluirInativos || x.ativo)
    .filter((x) => !termo || [x.nome, ...extras(x)].some((v) => v.toLowerCase().includes(termo)))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

function encontrar<T extends { id: number }>(lista: T[], id: number, mensagem: string) {
  const i = lista.findIndex((x) => x.id === id);
  if (i < 0) throw new ApiError(404, mensagem);
  return i;
}

// ======================= Regras: clientes =======================

const CAMPOS_CLIENTE = { nome: 'Nome', telefone: 'Telefone', email: 'Email', cpf: 'Cpf', endereco: 'Endereco', observacoes: 'Observacoes', ativo: 'Ativo' };

function validarCliente(dados: ClienteInput): ClienteInput {
  const d = {
    nome: dados.nome.trim(), telefone: soDigitos(dados.telefone), email: dados.email.trim().toLowerCase(),
    cpf: soDigitos(dados.cpf), endereco: dados.endereco.trim(), observacoes: dados.observacoes.trim(),
  };
  if (!d.nome) throw erro('O nome é obrigatório.');
  if (d.telefone.length < 10 || d.telefone.length > 11) throw erro('Informe um telefone válido com DDD.');
  if (d.email && !emailValido(d.email)) throw erro('E-mail inválido.');
  if (d.cpf && d.cpf.length !== 11) throw erro('CPF inválido.');
  return d;
}

// ======================= Regras: serviços =======================

const CAMPOS_SERVICO = { nome: 'Nome', descricao: 'Descricao', preco: 'Preco', complexidade: 'Complexidade', ativo: 'Ativo' };

function validarServico(banco: Banco, dados: ServicoInput, id: number): ServicoInput {
  const d = { nome: dados.nome.trim(), descricao: dados.descricao.trim(), preco: Math.round(Number(dados.preco) * 100) / 100, complexidade: Number(dados.complexidade) };
  if (!d.nome) throw erro('O nome do serviço é obrigatório.');
  if (!Number.isFinite(d.preco) || d.preco < 0) throw erro('Informe um preço válido.');
  if (!Number.isInteger(d.complexidade) || d.complexidade < 1 || d.complexidade > CAPACIDADE_DIARIA)
    throw erro(`A complexidade deve ser um número entre 1 e ${CAPACIDADE_DIARIA}.`);
  if (banco.servicos.some((s) => s.id !== id && s.nome.toLowerCase() === d.nome.toLowerCase()))
    throw erro('Já existe um serviço com este nome.');
  return d;
}

// ======================= Regras: funcionários =======================

const CAMPOS_FUNCIONARIO = { nome: 'Nome', email: 'Email', perfil: 'Perfil', senha: 'SenhaHash', ativo: 'Ativo' };

function validarFuncionario(banco: Banco, dados: FuncionarioInput, id: number, senhaObrigatoria: boolean) {
  const nome = dados.nome.trim();
  const email = dados.email.trim().toLowerCase();
  const senha = dados.senha ?? '';
  if (!nome) throw erro('O nome é obrigatório.');
  if (!emailValido(email)) throw erro('Informe um e-mail válido.');
  if (dados.perfil !== 'Administrador' && dados.perfil !== 'Visualizador') throw erro('Informe o perfil: Administrador ou Visualizador.');
  if (senhaObrigatoria && !senha) throw erro('Informe a senha.');
  if (senha && senha.length < 6) throw erro('A senha deve ter pelo menos 6 caracteres.');
  if (banco.funcionarios.some((f) => f.id !== id && f.email === email)) throw erro('Já existe um funcionário com este e-mail.');
  return { nome, email, perfil: dados.perfil as Perfil, senha };
}

function garantirOutroAdministrador(banco: Banco, f: FuncionarioMock) {
  if (f.ativo && f.perfil === 'Administrador') return;
  if (!banco.funcionarios.some((x) => x.id !== f.id && x.ativo && x.perfil === 'Administrador'))
    throw erro('O sistema precisa ter ao menos um Administrador ativo.');
}

const semSenha = (f: FuncionarioMock): Funcionario =>
  ({ id: f.id, nome: f.nome, email: f.email, perfil: f.perfil, ativo: f.ativo, criadoEm: f.criadoEm });

// ======================= Regras: pedidos e data de entrega =======================

const dataMinima = (hoje: string) => adicionarDiasUteis(hoje, DIAS_UTEIS_ENTREGA);

/** Complexidade reservada por dia (Entregue e Cancelado não contam). */
function ocupacao(banco: Banco, inicio: string, ignorarId: number) {
  const mapa = new Map<string, number>();
  for (const p of banco.pedidos) {
    if (p.id === ignorarId || p.dataEntrega < inicio || p.status === 'Entregue' || p.status === 'Cancelado') continue;
    mapa.set(p.dataEntrega, (mapa.get(p.dataEntrega) ?? 0) + p.complexidadeTotal);
  }
  return mapa;
}

function validarComplexidade(complexidade: number) {
  if (complexidade <= 0) throw erro('O pedido precisa ter ao menos um serviço.');
  if (complexidade > CAPACIDADE_DIARIA)
    throw erro(`Este pedido soma ${complexidade} de complexidade e o limite de produção por dia é ${CAPACIDADE_DIARIA}. Divida-o em mais de um pedido.`);
}

function proximaDataDisponivel(inicio: string, complexidade: number, ocup: Map<string, number>) {
  validarComplexidade(complexidade);
  let data = ehDiaUtil(inicio) ? inicio : proximoDiaUtil(inicio);
  while ((ocup.get(data) ?? 0) + complexidade > CAPACIDADE_DIARIA) data = proximoDiaUtil(data);
  return data;
}

/** Mesmas validações do PedidoRegras.MontarPecas do backend. */
function montarPecas(banco: Banco, pecas: PecaInput[], exigirDescricao = true): PedidoPeca[] {
  if (!pecas || pecas.length === 0) throw erro('Inclua ao menos uma peça no pedido.');
  if (pecas.length > 50) throw erro('Um pedido aceita no máximo 50 peças diferentes.');
  return pecas.map((dados, indice) => {
    const nomePeca = `Peça ${indice + 1}`;
    const descricao = (dados.descricao ?? '').trim();
    if (exigirDescricao && !descricao) throw erro(`${nomePeca}: informe a descrição (ex.: "calça jeans azul").`);
    if (descricao.length > 200) throw erro(`O campo descrição da ${nomePeca.toLowerCase()} aceita no máximo 200 caracteres.`);
    const quantidade = Number(dados.quantidade);
    if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 100)
      throw erro(`${nomePeca}: a quantidade deve ser entre 1 e 100.`);
    if (!dados.servicos || dados.servicos.length === 0) throw erro(`${nomePeca}: inclua ao menos um serviço.`);
    if (dados.servicos.length > 10) throw erro(`${nomePeca}: no máximo 10 serviços por peça.`);

    const servicos: PedidoPeca['servicos'] = [];
    for (const item of dados.servicos) {
      const servico = banco.servicos.find((s) => s.id === Number(item.servicoId));
      if (!servico) throw erro(`${nomePeca}: selecione um serviço válido.`);
      if (!servico.ativo) throw erro(`${nomePeca}: o serviço "${servico.nome}" está inativo.`);
      if (servicos.some((s) => s.servicoId === servico.id))
        throw erro(`${nomePeca}: o serviço "${servico.nome}" foi incluído duas vezes.`);
      servicos.push({
        id: banco.seq.pecaServico++, servicoId: servico.id, servicoNome: servico.nome, observacao: (item.observacao ?? '').trim(),
        complexidadeUnitaria: servico.complexidade, precoUnitario: servico.preco,
      });
    }

    const somaServicos = (f: (s: PedidoPeca['servicos'][number]) => number) => servicos.reduce((t, s) => t + f(s), 0);
    return {
      id: banco.seq.peca++, descricao, quantidade, servicos,
      complexidade: somaServicos((s) => s.complexidadeUnitaria) * quantidade,
      subtotal: somaServicos((s) => s.precoUnitario) * quantidade,
    };
  });
}

const somaComplexidade = (pecas: PedidoPeca[]) => pecas.reduce((t, p) => t + p.complexidade, 0);
const somaValor = (pecas: PedidoPeca[]) => pecas.reduce((t, p) => t + p.subtotal, 0);
/** Ex.: "1x Calça jeans: Barra simples (subir 3 cm) + Troca de zíper; 2x Camisa: Ajuste de cintura" */
const descreverPecas = (pecas: PedidoPeca[]) =>
  pecas
    .map((p) => `${p.quantidade}x ${p.descricao || 'Peça'}: ` +
      p.servicos.map((s) => s.servicoNome + (s.observacao ? ` (${s.observacao})` : '')).join(' + '))
    .join('; ');

function clienteAtivo(banco: Banco, clienteId: number) {
  const c = banco.clientes.find((x) => x.id === Number(clienteId));
  if (!c) throw erro('Selecione o cliente.');
  if (!c.ativo) throw erro('Este cliente está inativo.');
  return c;
}

function financeiroDoPedido(banco: Banco, p: PedidoMock) {
  if (!podeAcessar(obterSessao()?.perfil, 'financeiro')) return { valorRecebido: null, situacaoPagamento: null, recebimentos: null };
  const recebido = recebidoDo(banco, p.id);
  return {
    valorRecebido: recebido,
    situacaoPagamento: situacao(p.valorTotal, recebido),
    recebimentos: banco.recebimentos
      .filter((r) => r.pedidoId === p.id)
      .sort((a, b) => a.data.localeCompare(b.data) || a.id - b.id)
      .map(({ id, data, valor, formaPagamento, observacao }) => ({ id, data, valor, formaPagamento, observacao })),
  };
}

function paraPedido(banco: Banco, p: PedidoMock): Pedido {
  const c = banco.clientes.find((x) => x.id === p.clienteId);
  return {
    ...p, clienteNome: c?.nome ?? '?', clienteTelefone: c?.telefone ?? '', podeEditar: p.status === 'Pendente',
    pecas: p.pecas.map((peca) => ({ ...peca, servicos: peca.servicos.map((s) => ({ ...s })) })),
    ...financeiroDoPedido(banco, p),
  };
}

const TRANSICOES: Record<StatusPedido, StatusPedido[]> = {
  Pendente: ['EmProducao', 'Cancelado'],
  EmProducao: ['Pronto', 'Cancelado'],
  Pronto: ['Entregue', 'Cancelado'],
  Entregue: [],
  Cancelado: [],
};

const NOME_STATUS: Record<StatusPedido, string> = {
  Pendente: 'Pendente', EmProducao: 'Em produção', Pronto: 'Pronto', Entregue: 'Entregue', Cancelado: 'Cancelado',
};

// ======================= Regras: financeiro =======================

const FORMAS: FormaPagamento[] = ['Dinheiro', 'Pix', 'CartaoDebito', 'CartaoCredito'];
const CATEGORIAS: CategoriaPagamento[] = ['Materiais', 'Aluguel', 'Contas', 'Salarios', 'Impostos', 'Manutencao', 'Outros'];
const NOME_FORMA: Record<FormaPagamento, string> = { Dinheiro: 'Dinheiro', Pix: 'Pix', CartaoDebito: 'Cartão de débito', CartaoCredito: 'Cartão de crédito' };
const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/\u00a0/g, ' ');
const descreverRecebimento = (r: { valor: number; formaPagamento: FormaPagamento; data: string }) =>
  `${moeda(r.valor)} · ${NOME_FORMA[r.formaPagamento]} · ${r.data.split('-').reverse().join('/')}`;

const recebidoDo = (banco: Banco, pedidoId: number) =>
  Math.round(banco.recebimentos.filter((r) => r.pedidoId === pedidoId).reduce((t, r) => t + r.valor, 0) * 100) / 100;

const situacao = (total: number, recebido: number): SituacaoPagamento =>
  recebido <= 0 ? 'AReceber' : recebido < total ? 'Parcial' : 'Pago';

function periodo(de: string | undefined, ate: string | undefined) {
  const hoje = hojeIso();
  const inicio = de ?? `${hoje.slice(0, 7)}-01`;
  const [a, m] = inicio.split('-').map(Number);
  const fim = ate ?? `${a}-${String(m).padStart(2, '0')}-${String(new Date(a, m, 0).getDate()).padStart(2, '0')}`;
  if (fim < inicio) throw erro('A data final deve ser igual ou posterior à inicial.');
  return { inicio, fim };
}

function validarData(data: string) {
  if (!data) throw erro('Informe a data.');
  if (data > hojeIso()) throw erro('A data não pode ser futura.');
  return data;
}

function validarValor(valor: number) {
  const v = Math.round(Number(valor) * 100) / 100;
  if (!Number.isFinite(v) || v <= 0) throw erro('Informe um valor maior que zero.');
  return v;
}

function validarForma(forma: FormaPagamento) {
  if (!FORMAS.includes(forma)) throw erro('Informe a forma de pagamento.');
  return forma;
}

const CAMPOS_PAGAMENTO = { descricao: 'Descricao', categoria: 'Categoria', data: 'Data', valor: 'Valor', formaPagamento: 'FormaPagamento', observacao: 'Observacao' };

function validarPagamento(dados: PagamentoInput): PagamentoInput {
  const descricao = (dados.descricao ?? '').trim();
  if (!descricao) throw erro('Informe a descrição.');
  if (!CATEGORIAS.includes(dados.categoria)) throw erro('Informe a categoria.');
  return {
    descricao, categoria: dados.categoria, data: validarData(dados.data), valor: validarValor(dados.valor),
    formaPagamento: validarForma(dados.formaPagamento), observacao: (dados.observacao ?? '').trim(),
  };
}

// ======================= Regras: indicadores (mesmas do CalculadoraIndicadores) =======================

function calcularIndicadores(banco: Banco, de: string, ate: string, financeiro: boolean): Indicadores {
  const hoje = hojeIso();
  const pedidos = banco.pedidos.filter((p) => p.status !== 'Cancelado' && p.dataEntrega >= de && p.dataEntrega <= ate);
  const primeira = (id: number, status: string) =>
    banco.logs.filter((l) => l.entidade === 'Pedido' && l.entidadeId === id && l.campo === 'Status' && l.valorNovo === status)
      .map((l) => l.dataHora).sort()[0] as string | undefined;

  const tempo = new Map<string, { horas: number; pecas: number; valor: number }>();
  const ticket = new Map<string, { valor: number; pedidos: Set<number> }>();
  let noPrazo = 0, atrasados = 0, emAndamento = 0;

  for (const p of pedidos) {
    const inicio = primeira(p.id, 'EmProducao');
    const pronto = primeira(p.id, 'Pronto');
    const itens = p.pecas.flatMap((peca) => peca.servicos.map((s) => ({
      nome: s.servicoNome, qtd: peca.quantidade, complexidade: s.complexidadeUnitaria * peca.quantidade, valor: s.precoUnitario * peca.quantidade,
    })));
    const totalComplexidade = itens.reduce((t, i) => t + i.complexidade, 0);
    const horas = inicio && pronto ? (Date.parse(pronto) - Date.parse(inicio)) / 3_600_000 : 0;
    for (const i of itens) {
      const t = ticket.get(i.nome) ?? { valor: 0, pedidos: new Set<number>() };
      t.valor += i.valor; t.pedidos.add(p.id); ticket.set(i.nome, t);
      if (horas > 0) {
        const h = tempo.get(i.nome) ?? { horas: 0, pecas: 0, valor: 0 };
        h.horas += totalComplexidade ? (horas * i.complexidade) / totalComplexidade : horas / itens.length;
        h.pecas += i.qtd; h.valor += i.valor; tempo.set(i.nome, h);
      }
    }
    if (pronto) {
      if (isoLocal(new Date(pronto)) <= p.dataEntrega) noPrazo++; else atrasados++;
    } else if (p.dataEntrega < hoje) atrasados++;
    else emAndamento++;
  }

  const semanas: Indicadores['ocupacaoSemanal'] = [];
  const dow = deIso(de).getDay();
  for (let seg = adicionarDias(de, -((dow + 6) % 7)); seg <= ate; seg = adicionarDias(seg, 7)) {
    const dias = [0, 1, 2, 3, 4].map((i) => adicionarDias(seg, i)).filter((d) => d >= de && d <= ate);
    if (!dias.length) continue;
    const complexidade = pedidos.filter((p) => dias.includes(p.dataEntrega)).reduce((t, p) => t + p.complexidadeTotal, 0);
    const capacidade = dias.length * CAPACIDADE_DIARIA;
    semanas.push({ semana: seg, percentual: Math.round((1000 * complexidade) / capacidade) / 10, complexidade, capacidade });
  }

  const r2 = (v: number) => Math.round(v * 100) / 100;
  const faturamento = pedidos.reduce((t, p) => t + p.valorTotal, 0);
  const porCliente = new Map<string, { valor: number; pedidos: number }>();
  for (const p of pedidos) {
    const nome = banco.clientes.find((c) => c.id === p.clienteId)?.nome ?? '?';
    const c = porCliente.get(nome) ?? { valor: 0, pedidos: 0 };
    c.valor += p.valorTotal; c.pedidos++; porCliente.set(nome, c);
  }
  const emAberto = pedidos.filter((p) => p.status === 'Entregue' && recebidoDo(banco, p.id) < p.valorTotal);

  return {
    de, ate, totalPedidos: pedidos.length,
    tempoPorServico: [...tempo].map(([servico, t]) => ({ servico, horasMedias: Math.round((10 * t.horas) / t.pecas) / 10, pecas: t.pecas }))
      .sort((a, b) => b.horasMedias - a.horasMedias),
    ocupacaoSemanal: semanas,
    prazos: { noPrazo, atrasados, emAndamento, indice: noPrazo + atrasados ? Math.round((1000 * noPrazo) / (noPrazo + atrasados)) / 10 : null },
    faturamento: financeiro ? faturamento : null,
    ticketMedioPedido: financeiro && pedidos.length ? r2(faturamento / pedidos.length) : null,
    ticketPorServico: financeiro
      ? [...ticket].map(([servico, t]) => ({ servico, ticketMedio: r2(t.valor / t.pedidos.size), pedidos: t.pedidos.size })).sort((a, b) => b.ticketMedio - a.ticketMedio)
      : null,
    receitaPorHora: financeiro
      ? [...tempo].filter(([, t]) => t.horas > 0).map(([servico, t]) => ({ servico, receitaPorHora: r2(t.valor / t.horas), horas: Math.round(t.horas * 10) / 10 }))
        .sort((a, b) => b.receitaPorHora - a.receitaPorHora)
      : null,
    faturamentoPorCliente: financeiro
      ? [...porCliente].map(([cliente, c]) => ({ cliente, ...c })).sort((a, b) => b.valor - a.valor).slice(0, 10)
      : null,
    inadimplencia: financeiro
      ? { pedidos: emAberto.length, valor: r2(emAberto.reduce((t, p) => t + p.valorTotal - recebidoDo(banco, p.id), 0)) }
      : null,
  };
}

// ======================= API =======================

export const apiMock: Api = {
  auth: {
    async login(email, senha) {
      await esperar(400);
      const banco = lerBanco();
      const f = banco.funcionarios.find((x) => x.email === email.trim().toLowerCase() && x.senha === senha);
      if (!f) throw erro('E-mail ou senha inválidos.');
      if (!f.ativo) throw erro('Usuário inativo. Fale com o administrador.');
      return { id: f.id, nome: f.nome, email: f.email, perfil: f.perfil, token: `mock-token-${f.id}` };
    },
  },

  clientes: {
    async listar({ busca, incluirInativos }) {
      exigir('clientes');
      await esperar();
      const digitos = soDigitos(busca ?? '');
      return filtrarCadastro(lerBanco().clientes, busca, incluirInativos, (c) => [c.email, ...(digitos ? [c.telefone, c.cpf] : [])]);
    },
    async obter(id) {
      exigir('clientes');
      await esperar();
      const banco = lerBanco();
      return banco.clientes[encontrar(banco.clientes, id, 'Cliente não encontrado.')];
    },
    async criar(dados) {
      const sessao = exigir('clientes.editar');
      await esperar();
      const banco = lerBanco();
      const novo: Cliente = { ...validarCliente(dados), id: banco.seq.cliente++, ativo: true, criadoEm: new Date().toISOString() };
      banco.clientes.push(novo);
      log(banco, 'Cliente', novo.id, 'Criacao', null, null, null, sessao.nome);
      salvarBanco(banco);
      return novo;
    },
    async atualizar(id, dados) {
      const sessao = exigir('clientes.editar');
      await esperar();
      const banco = lerBanco();
      const i = encontrar(banco.clientes, id, 'Cliente não encontrado.');
      const depois = { ...banco.clientes[i], ...validarCliente(dados) };
      registrarDiferencas(banco, 'Cliente', id, banco.clientes[i], depois, CAMPOS_CLIENTE, sessao.nome);
      banco.clientes[i] = depois;
      salvarBanco(banco);
      return depois;
    },
    async alterarStatus(id, ativo) {
      const sessao = exigir('clientes.editar');
      await esperar();
      const banco = lerBanco();
      const i = encontrar(banco.clientes, id, 'Cliente não encontrado.');
      const depois = { ...banco.clientes[i], ativo };
      registrarDiferencas(banco, 'Cliente', id, banco.clientes[i], depois, CAMPOS_CLIENTE, sessao.nome);
      banco.clientes[i] = depois;
      salvarBanco(banco);
    },
    async opcoes(busca) {
      exigir('pedidos.editar');
      await esperar(100);
      return filtrarCadastro(lerBanco().clientes, busca, false).map((c) => ({ id: c.id, nome: c.nome, telefone: c.telefone }));
    },
  },

  servicos: {
    async listar({ busca, incluirInativos }) {
      exigir('servicos');
      await esperar();
      return filtrarCadastro(lerBanco().servicos, busca, incluirInativos, (s) => [s.descricao]);
    },
    async criar(dados) {
      const sessao = exigir('servicos');
      await esperar();
      const banco = lerBanco();
      const novo: Servico = { ...validarServico(banco, dados, 0), id: banco.seq.servico++, ativo: true, criadoEm: new Date().toISOString() };
      banco.servicos.push(novo);
      log(banco, 'Servico', novo.id, 'Criacao', null, null, null, sessao.nome);
      salvarBanco(banco);
      return novo;
    },
    async atualizar(id, dados) {
      const sessao = exigir('servicos');
      await esperar();
      const banco = lerBanco();
      const i = encontrar(banco.servicos, id, 'Serviço não encontrado.');
      const depois = { ...banco.servicos[i], ...validarServico(banco, dados, id) };
      registrarDiferencas(banco, 'Servico', id, banco.servicos[i], depois, CAMPOS_SERVICO, sessao.nome);
      banco.servicos[i] = depois;
      salvarBanco(banco);
      return depois;
    },
    async alterarStatus(id, ativo) {
      const sessao = exigir('servicos');
      await esperar();
      const banco = lerBanco();
      const i = encontrar(banco.servicos, id, 'Serviço não encontrado.');
      const depois = { ...banco.servicos[i], ativo };
      registrarDiferencas(banco, 'Servico', id, banco.servicos[i], depois, CAMPOS_SERVICO, sessao.nome);
      banco.servicos[i] = depois;
      salvarBanco(banco);
    },
    async opcoes() {
      exigir('pedidos.editar');
      await esperar(100);
      return filtrarCadastro(lerBanco().servicos, '', false).map((s) => ({ id: s.id, nome: s.nome, preco: s.preco, complexidade: s.complexidade }));
    },
  },

  funcionarios: {
    async listar({ busca, incluirInativos }) {
      exigir('funcionarios');
      await esperar();
      return filtrarCadastro(lerBanco().funcionarios, busca, incluirInativos, (f) => [f.email]).map(semSenha);
    },
    async criar(dados) {
      const sessao = exigir('funcionarios');
      await esperar();
      const banco = lerBanco();
      const v = validarFuncionario(banco, dados, 0, true);
      const novo: FuncionarioMock = { ...v, id: banco.seq.funcionario++, ativo: true, criadoEm: new Date().toISOString() };
      banco.funcionarios.push(novo);
      log(banco, 'Funcionario', novo.id, 'Criacao', null, null, null, sessao.nome);
      salvarBanco(banco);
      return semSenha(novo);
    },
    async atualizar(id, dados) {
      const sessao = exigir('funcionarios');
      await esperar();
      const banco = lerBanco();
      const i = encontrar(banco.funcionarios, id, 'Funcionário não encontrado.');
      const v = validarFuncionario(banco, dados, id, false);
      const antes = banco.funcionarios[i];
      const depois: FuncionarioMock = { ...antes, nome: v.nome, email: v.email, perfil: v.perfil, senha: v.senha || antes.senha };
      garantirOutroAdministrador(banco, depois);
      registrarDiferencas(banco, 'Funcionario', id, antes, depois, CAMPOS_FUNCIONARIO, sessao.nome, ['senha']);
      banco.funcionarios[i] = depois;
      salvarBanco(banco);
      return semSenha(depois);
    },
    async alterarStatus(id, ativo) {
      const sessao = exigir('funcionarios');
      await esperar();
      if (!ativo && sessao.id === id) throw erro('Você não pode inativar o seu próprio usuário.');
      const banco = lerBanco();
      const i = encontrar(banco.funcionarios, id, 'Funcionário não encontrado.');
      const depois = { ...banco.funcionarios[i], ativo };
      garantirOutroAdministrador(banco, depois);
      registrarDiferencas(banco, 'Funcionario', id, banco.funcionarios[i], depois, CAMPOS_FUNCIONARIO, sessao.nome, ['senha']);
      banco.funcionarios[i] = depois;
      salvarBanco(banco);
    },
  },

  pedidos: {
    async listar({ status, busca, incluirFinalizados }) {
      exigir('pedidos');
      await esperar();
      const banco = lerBanco();
      const termo = (busca ?? '').trim().toLowerCase();
      return banco.pedidos
        .filter((p) => (status ? p.status === status : incluirFinalizados || (p.status !== 'Entregue' && p.status !== 'Cancelado')))
        .map((p) => paraPedido(banco, p))
        .filter((p) => !termo || p.clienteNome.toLowerCase().includes(termo))
        .sort((a, b) => a.dataEntrega.localeCompare(b.dataEntrega) || a.id - b.id)
        .map((p): PedidoResumo => ({
          id: p.id, clienteNome: p.clienteNome, status: p.status, dataEntrega: p.dataEntrega,
          complexidadeTotal: p.complexidadeTotal, valorTotal: p.valorTotal,
          quantidadePecas: p.pecas.reduce((t, peca) => t + peca.quantidade, 0), criadoEm: p.criadoEm,
          valorRecebido: p.valorRecebido, situacaoPagamento: p.situacaoPagamento,
        }));
    },

    async obter(id) {
      exigir('pedidos');
      await esperar();
      const banco = lerBanco();
      return paraPedido(banco, banco.pedidos[encontrar(banco.pedidos, id, 'Pedido não encontrado.')]);
    },

    async criar(dados) {
      const sessao = exigir('pedidos.editar');
      await esperar(300);
      const banco = lerBanco();
      const cliente = clienteAtivo(banco, dados.clienteId);
      const pecas = montarPecas(banco, dados.pecas);
      const complexidade = somaComplexidade(pecas);
      const inicio = dataMinima(hojeIso());
      const pedido: PedidoMock = {
        id: banco.seq.pedido++, clienteId: cliente.id, status: 'Pendente',
        dataEntrega: proximaDataDisponivel(inicio, complexidade, ocupacao(banco, inicio, 0)),
        complexidadeTotal: complexidade, valorTotal: somaValor(pecas), observacoes: (dados.observacoes ?? '').trim(),
        criadoEm: new Date().toISOString(), pecas,
      };
      banco.pedidos.push(pedido);
      log(banco, 'Pedido', pedido.id, 'Criacao', null, null, null, sessao.nome);
      salvarBanco(banco);
      return paraPedido(banco, pedido);
    },

    async atualizar(id, dados) {
      const sessao = exigir('pedidos.editar');
      await esperar(300);
      const banco = lerBanco();
      const i = encontrar(banco.pedidos, id, 'Pedido não encontrado.');
      const antes = banco.pedidos[i];
      if (antes.status !== 'Pendente') throw erro('Somente pedidos pendentes podem ser alterados.');

      const cliente = Number(dados.clienteId) === antes.clienteId
        ? banco.clientes.find((c) => c.id === antes.clienteId)!
        : clienteAtivo(banco, dados.clienteId);
      const pecas = montarPecas(banco, dados.pecas);
      const complexidade = somaComplexidade(pecas);
      const recebido = recebidoDo(banco, id);
      if (somaValor(pecas) < recebido)
        throw erro(`O cliente já pagou ${moeda(recebido)} e o pedido passaria a valer ${moeda(somaValor(pecas))}. Estorne um recebimento antes de diminuir o pedido.`);
      // Mantém a data prometida se ainda couber; senão, próximo dia útil com espaço.
      const novaData = proximaDataDisponivel(antes.dataEntrega, complexidade, ocupacao(banco, antes.dataEntrega, id));

      if (cliente.id !== antes.clienteId) {
        const anterior = banco.clientes.find((c) => c.id === antes.clienteId);
        log(banco, 'Pedido', id, 'Alteracao', 'Cliente', anterior?.nome ?? '', cliente.nome, sessao.nome);
      }
      const pecasAntes = descreverPecas(antes.pecas);
      const pecasDepois = descreverPecas(pecas);
      if (pecasAntes !== pecasDepois) log(banco, 'Pedido', id, 'Alteracao', 'Pecas', pecasAntes, pecasDepois, sessao.nome);

      const depois: PedidoMock = {
        ...antes, clienteId: cliente.id, observacoes: (dados.observacoes ?? '').trim(), pecas,
        complexidadeTotal: complexidade, valorTotal: somaValor(pecas), dataEntrega: novaData,
      };
      registrarDiferencas(banco, 'Pedido', id, antes, depois,
        { observacoes: 'Observacoes', complexidadeTotal: 'ComplexidadeTotal', valorTotal: 'ValorTotal', dataEntrega: 'DataEntrega' },
        sessao.nome);
      banco.pedidos[i] = depois;
      salvarBanco(banco);
      return paraPedido(banco, depois);
    },

    async alterarStatus(id, status) {
      const sessao = exigir('pedidos.editar');
      await esperar();
      const banco = lerBanco();
      const i = encontrar(banco.pedidos, id, 'Pedido não encontrado.');
      const antes = banco.pedidos[i];
      if (antes.status === status) return;
      if (!TRANSICOES[antes.status].includes(status))
        throw erro(`Não é possível mudar o pedido de "${NOME_STATUS[antes.status]}" para "${NOME_STATUS[status]}".`);
      if (status === 'Cancelado' && banco.recebimentos.some((r) => r.pedidoId === id))
        throw erro('Este pedido tem recebimentos. Estorne-os na tela Recebimentos antes de cancelar.');
      const depois = { ...antes, status };
      registrarDiferencas(banco, 'Pedido', id, antes, depois, { status: 'Status' }, sessao.nome);
      banco.pedidos[i] = depois;
      salvarBanco(banco);
    },

    async simularEntrega(pecas, pedidoId) {
      exigir('pedidos.editar');
      await esperar(150);
      const banco = lerBanco();
      // Cópia do contador para não consumir ids; descrição não é exigida (o usuário ainda está digitando).
      const montadas = montarPecas({ ...banco, seq: { ...banco.seq } }, pecas, false);
      const complexidade = somaComplexidade(montadas);
      let data: string;
      if (pedidoId) {
        const p = banco.pedidos[encontrar(banco.pedidos, pedidoId, 'Pedido não encontrado.')];
        data = proximaDataDisponivel(p.dataEntrega, complexidade, ocupacao(banco, p.dataEntrega, p.id));
      } else {
        const inicio = dataMinima(hojeIso());
        data = proximaDataDisponivel(inicio, complexidade, ocupacao(banco, inicio, 0));
      }
      return { dataEntrega: data, complexidadeTotal: complexidade, capacidadeDiaria: CAPACIDADE_DIARIA, valorTotal: somaValor(montadas) };
    },

    async ocupacao(de, ate) {
      exigir('pedidos');
      await esperar(150);
      const inicio = de ?? hojeIso();
      const fim = ate ?? adicionarDias(inicio, 30);
      const ocup = ocupacao(lerBanco(), inicio, 0);
      const dias: OcupacaoDia[] = [];
      for (let d = inicio; d <= fim; d = adicionarDias(d, 1)) {
        if (!ehDiaUtil(d)) continue;
        const usada = ocup.get(d) ?? 0;
        dias.push({ data: d, complexidade: usada, capacidade: CAPACIDADE_DIARIA, disponivel: Math.max(0, CAPACIDADE_DIARIA - usada) });
      }
      return dias;
    },
  },

  recebimentos: {
    async listar({ de, ate, forma }) {
      exigir('financeiro');
      await esperar();
      const banco = lerBanco();
      const { inicio, fim } = periodo(de, ate);
      const recebimentos: Recebimento[] = banco.recebimentos
        .filter((r) => r.data >= inicio && r.data <= fim && (!forma || r.formaPagamento === forma))
        .sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id)
        .map((r) => {
          const p = banco.pedidos.find((x) => x.id === r.pedidoId)!;
          const cliente = banco.clientes.find((c) => c.id === p.clienteId);
          return { ...r, clienteNome: cliente?.nome ?? '?', situacaoPedido: situacao(p.valorTotal, recebidoDo(banco, p.id)) };
        });
      const porForma = FORMAS
        .map((f) => ({ forma: f, total: recebimentos.filter((r) => r.formaPagamento === f).reduce((t, r) => t + r.valor, 0) }))
        .filter((x) => x.total > 0)
        .sort((a, b) => b.total - a.total);
      return { recebimentos, total: recebimentos.reduce((t, r) => t + r.valor, 0), porForma };
    },

    async pedidosAReceber() {
      exigir('financeiro');
      await esperar(150);
      const banco = lerBanco();
      return banco.pedidos
        .filter((p) => p.status !== 'Cancelado')
        .map((p) => {
          const recebido = recebidoDo(banco, p.id);
          const cliente = banco.clientes.find((c) => c.id === p.clienteId);
          return { id: p.id, clienteNome: cliente?.nome ?? '?', status: p.status, dataEntrega: p.dataEntrega, valorTotal: p.valorTotal, valorRecebido: recebido, saldo: Math.round((p.valorTotal - recebido) * 100) / 100 };
        })
        .filter((p) => p.saldo > 0)
        .sort((a, b) => a.dataEntrega.localeCompare(b.dataEntrega) || a.id - b.id);
    },

    async registrar(dados: RecebimentoInput) {
      const sessao = exigir('financeiro');
      await esperar(300);
      const banco = lerBanco();
      if (!dados.pedidoId) throw erro('Selecione o pedido.');
      const data = validarData(dados.data);
      const valor = validarValor(dados.valor);
      const formaPagamento = validarForma(dados.formaPagamento);
      const p = banco.pedidos[encontrar(banco.pedidos, Number(dados.pedidoId), 'Pedido não encontrado.')];
      if (p.status === 'Cancelado') throw erro('Pedido cancelado não recebe pagamentos.');
      const saldo = Math.round((p.valorTotal - recebidoDo(banco, p.id)) * 100) / 100;
      if (saldo <= 0) throw erro('Este pedido já está pago.');
      if (valor > saldo) throw erro(`O valor passa do saldo do pedido (${moeda(saldo)}).`);
      const r = { id: banco.seq.recebimento++, pedidoId: p.id, data, valor, formaPagamento, observacao: (dados.observacao ?? '').trim(), criadoEm: new Date().toISOString() };
      banco.recebimentos.push(r);
      log(banco, 'Pedido', p.id, 'Alteracao', 'Recebimento', null, descreverRecebimento(r), sessao.nome);
      salvarBanco(banco);
      const cliente = banco.clientes.find((c) => c.id === p.clienteId);
      return { ...r, clienteNome: cliente?.nome ?? '?', situacaoPedido: situacao(p.valorTotal, recebidoDo(banco, p.id)) };
    },

    async estornar(id) {
      const sessao = exigir('financeiro');
      await esperar();
      const banco = lerBanco();
      const i = encontrar(banco.recebimentos, id, 'Recebimento não encontrado.');
      const r = banco.recebimentos[i];
      log(banco, 'Pedido', r.pedidoId, 'Alteracao', 'Estorno', descreverRecebimento(r), null, sessao.nome);
      banco.recebimentos.splice(i, 1);
      salvarBanco(banco);
    },
  },

  pagamentos: {
    async listar({ de, ate, categoria }) {
      exigir('financeiro');
      await esperar();
      const { inicio, fim } = periodo(de, ate);
      const pagamentos = lerBanco().pagamentos
        .filter((p) => p.data >= inicio && p.data <= fim && (!categoria || p.categoria === categoria))
        .sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id)
        .map((p) => ({ ...p }));
      const porCategoria = CATEGORIAS
        .map((c) => ({ categoria: c, total: pagamentos.filter((p) => p.categoria === c).reduce((t, p) => t + p.valor, 0) }))
        .filter((x) => x.total > 0)
        .sort((a, b) => b.total - a.total);
      return { pagamentos, total: pagamentos.reduce((t, p) => t + p.valor, 0), porCategoria };
    },

    async criar(dados) {
      const sessao = exigir('financeiro');
      await esperar(300);
      const banco = lerBanco();
      const pagamento: Pagamento = { id: banco.seq.pagamento++, ...validarPagamento(dados), criadoEm: new Date().toISOString() };
      banco.pagamentos.push(pagamento);
      log(banco, 'Pagamento', pagamento.id, 'Criacao', null, null, null, sessao.nome);
      salvarBanco(banco);
      return { ...pagamento };
    },

    async atualizar(id, dados) {
      const sessao = exigir('financeiro');
      await esperar(300);
      const banco = lerBanco();
      const i = encontrar(banco.pagamentos, id, 'Pagamento não encontrado.');
      const antes = banco.pagamentos[i];
      const depois: Pagamento = { ...antes, ...validarPagamento(dados) };
      registrarDiferencas(banco, 'Pagamento', id, antes, depois, CAMPOS_PAGAMENTO, sessao.nome);
      banco.pagamentos[i] = depois;
      salvarBanco(banco);
      return { ...depois };
    },

    async excluir(id) {
      const sessao = exigir('financeiro');
      await esperar();
      const banco = lerBanco();
      const i = encontrar(banco.pagamentos, id, 'Pagamento não encontrado.');
      banco.pagamentos.splice(i, 1);
      log(banco, 'Pagamento', id, 'Exclusao', null, null, null, sessao.nome);
      salvarBanco(banco);
    },
  },

  async fluxoCaixa({ de, ate }) {
    exigir('financeiro');
    await esperar();
    const banco = lerBanco();
    const { inicio, fim } = periodo(de, ate);
    const soma = (xs: { valor: number }[]) => Math.round(xs.reduce((t, x) => t + x.valor, 0) * 100) / 100;
    const saldoInicial = soma(banco.recebimentos.filter((r) => r.data < inicio)) - soma(banco.pagamentos.filter((p) => p.data < inicio));
    const entradas = banco.recebimentos.filter((r) => r.data >= inicio && r.data <= fim);
    const saidas = banco.pagamentos.filter((p) => p.data >= inicio && p.data <= fim);
    const datas = [...new Set([...entradas.map((e) => e.data), ...saidas.map((s) => s.data)])].sort();
    let acumulado = saldoInicial;
    const dias: FluxoDia[] = datas.map((data) => {
      const entrou = soma(entradas.filter((e) => e.data === data));
      const saiu = soma(saidas.filter((s) => s.data === data));
      acumulado = Math.round((acumulado + entrou - saiu) * 100) / 100;
      return { data, entradas: entrou, saidas: saiu, saldoDoDia: Math.round((entrou - saiu) * 100) / 100, saldoAcumulado: acumulado };
    });
    const totalEntradas = soma(entradas);
    const totalSaidas = soma(saidas);
    return {
      de: inicio, ate: fim, saldoInicial, totalEntradas, totalSaidas,
      saldoFinal: Math.round((saldoInicial + totalEntradas - totalSaidas) * 100) / 100, dias,
      entradasPorForma: FORMAS.map((f) => ({ forma: f, total: soma(entradas.filter((e) => e.formaPagamento === f)) })).filter((x) => x.total > 0).sort((a, b) => b.total - a.total),
      saidasPorCategoria: CATEGORIAS.map((c) => ({ categoria: c, total: soma(saidas.filter((s) => s.categoria === c)) })).filter((x) => x.total > 0).sort((a, b) => b.total - a.total),
    };
  },

  async indicadores({ de, ate }) {
    const sessao = exigir('dashboard');
    await esperar();
    const h = new Date();
    const inicio = de ?? isoLocal(new Date(h.getFullYear(), h.getMonth() - 2, 1, 12));
    const fim = ate ?? isoLocal(new Date(h.getFullYear(), h.getMonth() + 1, 0, 12));
    if (fim < inicio) throw erro('A data final deve ser igual ou posterior à inicial.');
    return calcularIndicadores(lerBanco(), inicio, fim, podeAcessar(sessao.perfil, 'financeiro'));
  },

  logs: {
    async listar(entidade, entidadeId) {
      exigir('logs');
      await esperar();
      return lerBanco()
        .logs.filter((l) => l.entidade === entidade && l.entidadeId === entidadeId)
        .sort((a, b) => b.id - a.id);
    },
  },
};
