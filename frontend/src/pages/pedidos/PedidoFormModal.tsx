import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, ApiError } from '../../api';
import { Campo } from '../../components/Campo';
import { IconeCalendario, IconeFechar, IconeLixeira, IconeMais } from '../../components/Icones';
import { Modal } from '../../components/Modal';
import { EtiquetaStatus } from '../../components/StatusPedido';
import type { ClienteOpcao, PecaInput, Pedido, PedidoInput, ServicoOpcao, SimulacaoEntrega } from '../../types';
import { formatarDataSimples, formatarMoeda, formatarTelefone } from '../../utils/formatos';
import { diaSemanaCurto } from '../../utils/datas';
import { CLASSE_SITUACAO, NOME_FORMA, NOME_SITUACAO } from '../../utils/financeiro';

interface Props {
  aberto: boolean;
  pedidoId: number | null;
  somenteLeitura?: boolean;
  aoFechar(): void;
  aoSalvar(pedido: Pedido, novo: boolean): void;
}

const CAPACIDADE_DIARIA = 100;
const MAXIMO_SERVICOS_POR_PECA = 10;

interface ServicoForm { chave: number; servicoId: string; observacao: string }
interface PecaForm { chave: number; descricao: string; quantidade: string; servicos: ServicoForm[] }

let proximaChave = 1;
const servicoVazio = (): ServicoForm => ({ chave: proximaChave++, servicoId: '', observacao: '' });
const pecaVazia = (): PecaForm => ({ chave: proximaChave++, descricao: '', quantidade: '1', servicos: [servicoVazio()] });

export function PedidoFormModal({ aberto, pedidoId, somenteLeitura: forcarLeitura = false, aoFechar, aoSalvar }: Props) {
  const novo = pedidoId === null;

  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [clientes, setClientes] = useState<ClienteOpcao[]>([]);
  const [servicos, setServicos] = useState<ServicoOpcao[]>([]);
  const [carregando, setCarregando] = useState(false);

  const [clienteId, setClienteId] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [pecas, setPecas] = useState<PecaForm[]>([pecaVazia()]);

  const [simulacao, setSimulacao] = useState<SimulacaoEntrega | null>(null);
  const [erroSimulacao, setErroSimulacao] = useState<string | null>(null);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const somenteLeitura = forcarLeitura || (pedido !== null && !pedido.podeEditar);

  useEffect(() => {
    if (!aberto) return;
    let cancelado = false;
    setCarregando(true);
    setErroGeral(null);
    setSimulacao(null);
    setErroSimulacao(null);

    Promise.all([
      forcarLeitura ? Promise.resolve([]) : api.clientes.opcoes(),
      forcarLeitura ? Promise.resolve([]) : api.servicos.opcoes(),
      pedidoId !== null ? api.pedidos.obter(pedidoId) : Promise.resolve(null),
    ])
      .then(([cli, serv, ped]) => {
        if (cancelado) return;
        if (ped && !cli.some((c) => c.id === ped.clienteId))
          cli = [...cli, { id: ped.clienteId, nome: `${ped.clienteNome} (inativo)`, telefone: ped.clienteTelefone }];
        for (const s of ped?.pecas.flatMap((p) => p.servicos) ?? []) {
          if (!serv.some((x) => x.id === s.servicoId))
            serv = [...serv, { id: s.servicoId, nome: `${s.servicoNome} (inativo)`, preco: s.precoUnitario, complexidade: s.complexidadeUnitaria }];
        }
        setClientes(cli);
        setServicos(serv);
        setPedido(ped);
        setClienteId(ped ? String(ped.clienteId) : '');
        setObservacoes(ped?.observacoes ?? '');
        setPecas(ped
          ? ped.pecas.map((p) => ({
            chave: proximaChave++,
            descricao: p.descricao,
            quantidade: String(p.quantidade),
            servicos: p.servicos.map((s) => ({ chave: proximaChave++, servicoId: String(s.servicoId), observacao: s.observacao })),
          }))
          : [pecaVazia()]);
      })
      .catch((ex) => !cancelado && setErroGeral(ex instanceof ApiError ? ex.message : 'Erro ao carregar o pedido.'))
      .finally(() => !cancelado && setCarregando(false));

    return () => {
      cancelado = true;
    };
  }, [aberto, pedidoId, forcarLeitura]);

  const servicoPorId = useMemo(() => new Map(servicos.map((s) => [s.id, s])), [servicos]);

  const pecasParaCalculo = useMemo<PecaInput[]>(
    () => pecas
      .map((p) => ({
        descricao: p.descricao,
        quantidade: Number(p.quantidade),
        servicos: p.servicos
          .filter((s) => s.servicoId)
          .map((s) => ({ servicoId: Number(s.servicoId), observacao: s.observacao })),
      }))
      .filter((p) => p.quantidade >= 1 && p.servicos.length > 0),
    [pecas],
  );

  function totaisUnitarios(peca: PecaForm) {
    let complexidade = 0;
    let valor = 0;
    for (const s of peca.servicos) {
      const servico = servicoPorId.get(Number(s.servicoId));
      if (!servico) continue;
      complexidade += servico.complexidade;
      valor += servico.preco;
    }
    return { complexidade, valor };
  }

  const totais = useMemo(() => {
    let complexidade = 0;
    let valor = 0;
    let unidades = 0;
    for (const p of pecasParaCalculo) {
      for (const s of p.servicos) {
        const servico = servicoPorId.get(s.servicoId);
        if (!servico) continue;
        complexidade += servico.complexidade * p.quantidade;
        valor += servico.preco * p.quantidade;
      }
      unidades += p.quantidade;
    }
    return { complexidade, valor, unidades };
  }, [pecasParaCalculo, servicoPorId]);

  const chaveSimulacao = JSON.stringify(pecasParaCalculo.map((p) => [p.quantidade, p.servicos.map((s) => s.servicoId)]));

  useEffect(() => {
    if (!aberto || carregando || somenteLeitura) return;
    setSimulacao(null);
    setErroSimulacao(null);
    if (pecasParaCalculo.length === 0) return;

    let cancelado = false;
    const t = setTimeout(() => {
      api.pedidos
        .simularEntrega(pecasParaCalculo, pedidoId ?? undefined)
        .then((r) => !cancelado && setSimulacao(r))
        .catch((ex) => !cancelado && setErroSimulacao(ex instanceof ApiError ? ex.message : 'Não foi possível calcular a entrega.'));
    }, 400);
    return () => {
      cancelado = true;
      clearTimeout(t);
    };
    // Dependência é a chaveSimulacao (e não pecasParaCalculo) para não recalcular a cada letra digitada.
  }, [aberto, carregando, somenteLeitura, chaveSimulacao, pedidoId]);

  // ---------- Alterações no formulário ----------
  function alterarPeca(chave: number, mudanca: Partial<Omit<PecaForm, 'chave'>>) {
    setPecas((lista) => lista.map((p) => (p.chave === chave ? { ...p, ...mudanca } : p)));
  }

  function alterarServico(chavePeca: number, chaveServico: number, mudanca: Partial<Omit<ServicoForm, 'chave'>>) {
    setPecas((lista) => lista.map((p) => (p.chave !== chavePeca ? p : {
      ...p,
      servicos: p.servicos.map((s) => (s.chave === chaveServico ? { ...s, ...mudanca } : s)),
    })));
  }

  function adicionarServico(chavePeca: number) {
    setPecas((lista) => lista.map((p) => (p.chave === chavePeca ? { ...p, servicos: [...p.servicos, servicoVazio()] } : p)));
  }

  function removerServico(chavePeca: number, chaveServico: number) {
    setPecas((lista) => lista.map((p) => (p.chave === chavePeca
      ? { ...p, servicos: p.servicos.filter((s) => s.chave !== chaveServico) }
      : p)));
  }

  function validar(): string | null {
    if (!clienteId) return 'Selecione o cliente.';
    for (const [i, p] of pecas.entries()) {
      const nome = `Peça ${i + 1}`;
      if (!p.descricao.trim()) return `${nome}: informe a descrição (ex.: "calça jeans azul").`;
      if (!(Number(p.quantidade) >= 1)) return `${nome}: a quantidade deve ser pelo menos 1.`;
      if (p.servicos.length === 0) return `${nome}: inclua ao menos um serviço.`;
      if (p.servicos.some((s) => !s.servicoId)) return `${nome}: selecione o serviço em todas as linhas (ou remova a linha vazia).`;
    }
    return erroSimulacao;
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const problema = validar();
    if (problema) return setErroGeral(problema);

    const dados: PedidoInput = {
      clienteId: Number(clienteId),
      observacoes,
      pecas: pecas.map((p) => ({
        descricao: p.descricao.trim(),
        quantidade: Number(p.quantidade),
        servicos: p.servicos.map((s) => ({ servicoId: Number(s.servicoId), observacao: s.observacao.trim() })),
      })),
    };
    setSalvando(true);
    setErroGeral(null);
    try {
      const salvo = novo ? await api.pedidos.criar(dados) : await api.pedidos.atualizar(pedidoId!, dados);
      aoSalvar(salvo, novo);
    } catch (ex) {
      setErroGeral(ex instanceof ApiError ? ex.message : 'Não foi possível salvar o pedido.');
    } finally {
      setSalvando(false);
    }
  }

  const titulo = novo ? 'Novo pedido' : `Pedido #${pedidoId}`;
  const ocupado = Math.min(100, (totais.complexidade / CAPACIDADE_DIARIA) * 100);
  const excedeu = totais.complexidade > CAPACIDADE_DIARIA;

  return (
    <Modal
      aberto={aberto}
      titulo={titulo}
      subtitulo={somenteLeitura && !forcarLeitura ? 'Somente pedidos pendentes podem ser alterados.' : undefined}
      aoFechar={aoFechar}
      largura="larga"
      rodape={
        somenteLeitura ? (
          <button type="button" className="botao botao-secundario" onClick={aoFechar}>Fechar</button>
        ) : (
          <>
            <button type="button" className="botao botao-secundario" onClick={aoFechar} disabled={salvando}>Cancelar</button>
            <button type="submit" form="form-pedido" className="botao botao-primario" disabled={salvando || carregando}>
              {salvando ? 'Salvando…' : novo ? 'Criar pedido' : 'Salvar alterações'}
            </button>
          </>
        )
      }
    >
      {carregando ? (
        <p className="texto-suave">Carregando…</p>
      ) : somenteLeitura && pedido ? (
        <PedidoDetalhe pedido={pedido} />
      ) : (
        <form id="form-pedido" className="form-pedido" onSubmit={salvar} noValidate>
          <div className="grade-form">
            <Campo rotulo="Cliente *" largo>
              <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} autoFocus={novo}>
                <option value="">Selecione…</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome} · {formatarTelefone(c.telefone)}</option>
                ))}
              </select>
            </Campo>
          </div>

          <fieldset className="pecas-pedido">
            <legend>Peças</legend>

            {pecas.map((peca, indicePeca) => {
              const numero = indicePeca + 1;
              const unitario = totaisUnitarios(peca);
              const quantidade = Number(peca.quantidade) || 0;
              const escolhidos = new Set(peca.servicos.map((s) => s.servicoId).filter(Boolean));

              return (
                <section key={peca.chave} className="peca-card" aria-label={`Peça ${numero}`}>
                  <header className="peca-cabecalho">
                    <span className="peca-numero">Peça {numero}</span>
                    <button type="button" className="botao-icone perigo" title="Remover peça" aria-label={`Remover peça ${numero}`}
                      disabled={pecas.length === 1} onClick={() => setPecas((l) => l.filter((x) => x.chave !== peca.chave))}>
                      <IconeLixeira />
                    </button>
                  </header>

                  <div className="peca-dados">
                    <label className="campo">
                      <span>Descrição *</span>
                      <input placeholder="Ex.: calça jeans azul" maxLength={200} value={peca.descricao}
                        onChange={(e) => alterarPeca(peca.chave, { descricao: e.target.value })} />
                    </label>
                    <label className="campo">
                      <span>Qtd.</span>
                      <input inputMode="numeric" aria-label={`Quantidade da peça ${numero}`} value={peca.quantidade}
                        onChange={(e) => alterarPeca(peca.chave, { quantidade: e.target.value.replace(/\D/g, '').slice(0, 3) })} />
                    </label>
                  </div>

                  <div className="peca-servicos" role="group" aria-label={`Serviços da peça ${numero}`}>
                    <span className="peca-subtitulo">Serviços</span>
                    {peca.servicos.length === 0 && (
                      <p className="texto-pequeno aviso-texto">Inclua ao menos um serviço nesta peça.</p>
                    )}
                    {peca.servicos.map((linha, indiceServico) => {
                      const servico = servicoPorId.get(Number(linha.servicoId));
                      return (
                        <div key={linha.chave} className="servico-linha">
                          <select aria-label={`Serviço ${indiceServico + 1} da peça ${numero}`} value={linha.servicoId}
                            onChange={(e) => alterarServico(peca.chave, linha.chave, { servicoId: e.target.value })}>
                            <option value="">Selecione o serviço…</option>
                            {servicos.map((s) => (
                              <option key={s.id} value={s.id} disabled={escolhidos.has(String(s.id)) && linha.servicoId !== String(s.id)}>
                                {s.nome} · complex. {s.complexidade}
                              </option>
                            ))}
                          </select>
                          <input aria-label={`Observação do serviço ${indiceServico + 1} da peça ${numero}`} maxLength={200}
                            placeholder="Observação (ex.: subir 3 cm)" value={linha.observacao}
                            onChange={(e) => alterarServico(peca.chave, linha.chave, { observacao: e.target.value })} />
                          <span className="num sem-quebra">{servico ? formatarMoeda(servico.preco) : '—'}</span>
                          <button type="button" className="botao-icone" title="Remover serviço"
                            aria-label={`Remover serviço ${indiceServico + 1} da peça ${numero}`}
                            onClick={() => removerServico(peca.chave, linha.chave)}>
                            <IconeFechar />
                          </button>
                        </div>
                      );
                    })}
                    <button type="button" className="botao-texto" onClick={() => adicionarServico(peca.chave)}
                      disabled={peca.servicos.length >= MAXIMO_SERVICOS_POR_PECA}>
                      <IconeMais /> Serviço nesta peça
                    </button>
                  </div>

                  <footer className="peca-rodape texto-pequeno">
                    <span>
                      Complexidade <strong>{unitario.complexidade * quantidade}</strong>
                      {quantidade > 1 && <span className="texto-suave"> ({unitario.complexidade} × {quantidade})</span>}
                    </span>
                    <span>
                      Subtotal <strong>{formatarMoeda(unitario.valor * quantidade)}</strong>
                      {quantidade > 1 && <span className="texto-suave"> ({formatarMoeda(unitario.valor)} × {quantidade})</span>}
                    </span>
                  </footer>
                </section>
              );
            })}

            <button type="button" className="botao botao-secundario botao-pequeno" onClick={() => setPecas((l) => [...l, pecaVazia()])}>
              <IconeMais /> Adicionar peça
            </button>
          </fieldset>

          <Campo rotulo="Observações do pedido">
            <textarea rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} maxLength={500} />
          </Campo>

          <section className={`resumo-pedido ${excedeu ? 'excedeu' : ''}`} aria-live="polite">
            <div className="resumo-coluna">
              <span className="resumo-rotulo">Complexidade do pedido</span>
              <div className="medidor medidor-grande" role="img" aria-label={`${totais.complexidade} de ${CAPACIDADE_DIARIA}`}>
                <span style={{ width: `${ocupado}%` }} />
              </div>
              <span className="texto-pequeno">
                <strong>{totais.complexidade}</strong> de {CAPACIDADE_DIARIA} por dia
                {excedeu && ' (acima do limite)'}
              </span>
            </div>
            <div className="resumo-coluna">
              <span className="resumo-rotulo">Valor total</span>
              <strong className="resumo-valor">{formatarMoeda(totais.valor)}</strong>
              <span className="texto-pequeno texto-suave">
                {totais.unidades} peça{totais.unidades === 1 ? '' : 's'}
                {!!pedido?.valorRecebido && ` · já recebido ${formatarMoeda(pedido.valorRecebido)}`}
              </span>
            </div>
            <div className="resumo-coluna">
              <span className="resumo-rotulo">Entrega prevista</span>
              {simulacao ? (
                <strong className="resumo-valor resumo-data">
                  <IconeCalendario /> {diaSemanaCurto(simulacao.dataEntrega)}, {formatarDataSimples(simulacao.dataEntrega)}
                </strong>
              ) : (
                <span className="texto-suave texto-pequeno">
                  {pecasParaCalculo.length === 0 ? 'Escolha um serviço para calcular.' : erroSimulacao ? '—' : 'Calculando…'}
                </span>
              )}
              {!novo && simulacao && pedido && simulacao.dataEntrega !== pedido.dataEntrega && (
                <span className="texto-pequeno aviso-texto">Antes: {formatarDataSimples(pedido.dataEntrega)}</span>
              )}
            </div>
          </section>

          {erroSimulacao && <p className="mensagem-erro" role="alert">{erroSimulacao}</p>}
          {erroGeral && erroGeral !== erroSimulacao && <p className="mensagem-erro" role="alert">{erroGeral}</p>}
        </form>
      )}
    </Modal>
  );
}

function PedidoDetalhe({ pedido }: { pedido: Pedido }) {
  return (
    <div className="pedido-detalhe">
      <dl className="detalhes">
        <div><dt>Cliente</dt><dd>{pedido.clienteNome}<br /><span className="texto-suave">{formatarTelefone(pedido.clienteTelefone)}</span></dd></div>
        <div><dt>Status</dt><dd><EtiquetaStatus status={pedido.status} /></dd></div>
        <div><dt>Entrega</dt><dd>{diaSemanaCurto(pedido.dataEntrega)}, {formatarDataSimples(pedido.dataEntrega)}</dd></div>
        <div><dt>Valor total</dt><dd>{formatarMoeda(pedido.valorTotal)}</dd></div>
      </dl>
      <div className="tabela-rolagem">
        <table className="tabela tabela-compacta tabela-pecas">
          <thead>
            <tr><th>Peça</th><th>Serviços</th><th className="num">Complex.</th><th className="num">Subtotal</th></tr>
          </thead>
          <tbody>
            {pedido.pecas.map((p) => (
              <tr key={p.id}>
                <td>
                  <strong>{p.descricao}</strong>
                  {p.quantidade > 1 && <span className="texto-suave"> × {p.quantidade}</span>}
                </td>
                <td>
                  <ul className="lista-servicos-peca">
                    {p.servicos.map((s) => (
                      <li key={s.id}>
                        {s.servicoNome} <span className="texto-suave">· {formatarMoeda(s.precoUnitario)}</span>
                        {s.observacao && <div className="texto-pequeno texto-suave">{s.observacao}</div>}
                      </li>
                    ))}
                  </ul>
                </td>
                <td className="num">{p.complexidade}</td>
                <td className="num sem-quebra">{formatarMoeda(p.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pedido.observacoes && <p><strong>Observações:</strong> {pedido.observacoes}</p>}
      {pedido.recebimentos && pedido.situacaoPagamento && pedido.status !== 'Cancelado' && (
        <section className="pagamento-pedido" aria-label="Pagamento">
          <header>
            <h3>Pagamento</h3>
            <span className={`etiqueta ${CLASSE_SITUACAO[pedido.situacaoPagamento]}`}>{NOME_SITUACAO[pedido.situacaoPagamento]}</span>
          </header>
          <p className="texto-pequeno">
            Recebido <strong>{formatarMoeda(pedido.valorRecebido ?? 0)}</strong> de {formatarMoeda(pedido.valorTotal)}
            {pedido.situacaoPagamento !== 'Pago' && <> · falta <strong>{formatarMoeda(pedido.valorTotal - (pedido.valorRecebido ?? 0))}</strong></>}
          </p>
          {pedido.recebimentos.length > 0 && (
            <ul className="lista-recebimentos">
              {pedido.recebimentos.map((r) => (
                <li key={r.id}>
                  <span className="sem-quebra">{formatarDataSimples(r.data)}</span>
                  <span>{NOME_FORMA[r.formaPagamento]}{r.observacao && <span className="texto-suave"> · {r.observacao}</span>}</span>
                  <strong className="num sem-quebra">{formatarMoeda(r.valor)}</strong>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
