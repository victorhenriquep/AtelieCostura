import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api';
import { useAuth } from '../auth/AuthContext';
import { IconeMais } from '../components/Icones';
import { GraficoBarras, GraficoLinha, GraficoPizza } from '../components/Graficos';
import { OcupacaoGrafico } from '../components/OcupacaoGrafico';
import { EtiquetaStatus } from '../components/StatusPedido';
import type { Indicadores, OcupacaoDia, PedidoResumo } from '../types';
import { adicionarDias, adicionarDiasUteis, diaMes, diaSemanaCurto, hojeIso, isoLocal } from '../utils/datas';
import { formatarDataSimples, formatarMoeda } from '../utils/formatos';
import { situacaoPrazo } from '../utils/pedidos';

const DIAS_NO_GRAFICO = 10;
const DIAS_UTEIS_ENTREGA = 3; // mesmo prazo mínimo do backend

/** Período padrão dos indicadores: o mês atual e os dois anteriores (o mesmo do backend). */
function periodoPadrao() {
  const h = new Date();
  return { de: isoLocal(new Date(h.getFullYear(), h.getMonth() - 2, 1, 12)), ate: isoLocal(new Date(h.getFullYear(), h.getMonth() + 1, 0, 12)) };
}

const horas = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`;
const porcento = (v: number) => `${Math.round(v)}%`;

/** Página inicial: resumo dos pedidos em aberto e da capacidade dos próximos dias. */
export function InicioPage() {
  const { usuario, pode } = useAuth();
  const navigate = useNavigate();
  const primeiroNome = usuario?.nome.split(' ')[0];

  const [pedidos, setPedidos] = useState<PedidoResumo[]>([]);
  const [ocupacao, setOcupacao] = useState<OcupacaoDia[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState(periodoPadrao);
  const [indicadores, setIndicadores] = useState<Indicadores | null>(null);
  const [erroIndicadores, setErroIndicadores] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    const hoje = hojeIso();
    Promise.all([api.pedidos.listar({}), api.pedidos.ocupacao(hoje, adicionarDias(hoje, 20))])
      .then(([p, o]) => {
        if (cancelado) return;
        setPedidos(p);
        setOcupacao(o.slice(0, DIAS_NO_GRAFICO));
      })
      .catch((ex) => !cancelado && setErro(ex instanceof ApiError ? ex.message : 'Erro ao carregar o painel.'))
      .finally(() => !cancelado && setCarregando(false));
    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    if (!periodo.de || !periodo.ate || periodo.ate < periodo.de) return;
    let cancelado = false;
    setErroIndicadores(null);
    api.indicadores(periodo)
      .then((r) => !cancelado && setIndicadores(r))
      .catch((ex) => !cancelado && setErroIndicadores(ex instanceof ApiError ? ex.message : 'Erro ao carregar os indicadores.'));
    return () => {
      cancelado = true;
    };
  }, [periodo]);

  const hoje = hojeIso();
  const prontos = pedidos.filter((p) => p.status === 'Pronto').length;
  const entregasHoje = pedidos.filter((p) => p.dataEntrega === hoje).length;
  const atrasados = pedidos.filter((p) => p.dataEntrega < hoje).length;
  // Pedido novo só pode ser entregue a partir de hoje + 3 dias úteis
  const dataMinima = adicionarDiasUteis(hoje, DIAS_UTEIS_ENTREGA);
  const proximoLivre = ocupacao.find((d) => d.data >= dataMinima && d.disponivel > 0);
  const proximas = pedidos.slice(0, 6); // a API já devolve ordenado pela data de entrega

  return (
    <>
      <header className="pagina-cabecalho">
        <div>
          <h1>Olá, {primeiroNome}</h1>
          <p className="texto-suave">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        {pode('pedidos.editar') && (
          <button type="button" className="botao botao-primario" onClick={() => navigate('/pedidos', { state: { novoPedido: true } })}>
            <IconeMais /> Novo pedido
          </button>
        )}
      </header>

      {erro && <p className="mensagem-erro">{erro}</p>}

      <section className="kpis" aria-label="Resumo">
        <Indicador rotulo="Pedidos em aberto" valor={pedidos.length} carregando={carregando} />
        <Indicador rotulo="Prontos para retirada" valor={prontos} carregando={carregando} />
        <Indicador rotulo="Entregas hoje" valor={entregasHoje} carregando={carregando} />
        <Indicador rotulo="Atrasados" valor={atrasados} carregando={carregando} alerta={atrasados > 0} />
      </section>

      <div className="painel-grade">
        <section className="cartao painel-bloco">
          <header className="bloco-cabecalho">
            <div>
              <h2>Ocupação da produção</h2>
              <p className="texto-suave texto-pequeno">Complexidade reservada nos próximos {DIAS_NO_GRAFICO} dias úteis</p>
            </div>
            {proximoLivre && (
              <p className="destaque-texto">
                Pedido novo hoje: entrega a partir de <strong>{diaSemanaCurto(proximoLivre.data)}, {diaMes(proximoLivre.data)}</strong>
                {' '}({proximoLivre.disponivel} livres)
              </p>
            )}
          </header>
          {carregando ? <p className="texto-suave">Carregando…</p> : <OcupacaoGrafico dias={ocupacao} />}
        </section>

        <section className="cartao painel-bloco">
          <header className="bloco-cabecalho">
            <h2>Próximas entregas</h2>
            <Link to="/pedidos" className="link-discreto">Ver todos</Link>
          </header>
          {!carregando && proximas.length === 0 && <p className="texto-suave">Nenhum pedido em aberto.</p>}
          <ul className="lista-entregas">
            {proximas.map((p) => {
              const prazo = situacaoPrazo(p.dataEntrega, p.status);
              return (
                <li key={p.id}>
                  <span className={`data-chip ${prazo ? `chip-${prazo}` : ''}`}>
                    <span>{diaSemanaCurto(p.dataEntrega)}</span>
                    <strong>{diaMes(p.dataEntrega)}</strong>
                  </span>
                  <span className="entrega-info">
                    <strong>{p.clienteNome}</strong>
                    <span className="texto-suave texto-pequeno">
                      #{p.id} · {p.quantidadePecas} peça{p.quantidadePecas === 1 ? '' : 's'}
                      {prazo === 'atrasado' && ' · atrasado'}
                    </span>
                  </span>
                  <EtiquetaStatus status={p.status} />
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <section className="indicadores" aria-label="Indicadores">
        <header className="indicadores-cabecalho">
          <h2>Indicadores</h2>
          <div className="filtros filtros-periodo">
            <label className="seletor">
              <span>De</span>
              <input type="date" value={periodo.de} max={periodo.ate} onChange={(e) => setPeriodo((p) => ({ ...p, de: e.target.value }))} />
            </label>
            <label className="seletor">
              <span>até</span>
              <input type="date" value={periodo.ate} min={periodo.de} onChange={(e) => setPeriodo((p) => ({ ...p, ate: e.target.value }))} />
            </label>
          </div>
        </header>
        <p className="texto-suave texto-pequeno indicadores-nota">
          Pedidos não cancelados com entrega prevista de {formatarDataSimples(periodo.de)} a {formatarDataSimples(periodo.ate)}
          {indicadores && ` · ${indicadores.totalPedidos} pedido${indicadores.totalPedidos === 1 ? '' : 's'}`}
        </p>
        {erroIndicadores && <p className="mensagem-erro">{erroIndicadores}</p>}

        {indicadores && (
          <>
            {indicadores.faturamento !== null && (
              <div className="kpis">
                <Indicador rotulo="Faturamento" valor={formatarMoeda(indicadores.faturamento)} carregando={false} />
                <Indicador rotulo="Ticket médio por pedido" valor={formatarMoeda(indicadores.ticketMedioPedido ?? 0)} carregando={false} />
                <Indicador rotulo="Cumprimento de prazos" valor={indicadores.prazos.indice === null ? '—' : porcento(indicadores.prazos.indice)} carregando={false} />
                <Indicador rotulo="Entregues com saldo a receber" valor={formatarMoeda(indicadores.inadimplencia?.valor ?? 0)}
                  carregando={false} alerta={(indicadores.inadimplencia?.pedidos ?? 0) > 0}
                  nota={indicadores.inadimplencia?.pedidos ? `${indicadores.inadimplencia.pedidos} pedido${indicadores.inadimplencia.pedidos === 1 ? '' : 's'}` : undefined} />
              </div>
            )}

            <div className="indicadores-grade">
              <section className="cartao painel-bloco">
                <header className="bloco-cabecalho">
                  <div>
                    <h2><span className="tag-pergunta">P1</span> Tempo médio de execução por serviço</h2>
                    <p className="texto-suave texto-pequeno">Horas entre "Em produção" e "Pronto", por peça</p>
                  </div>
                </header>
                <GraficoBarras formatar={horas} vazio="Nenhum pedido passou de Em produção para Pronto no período."
                  itens={indicadores.tempoPorServico.map((t) => ({ rotulo: t.servico, valor: t.horasMedias, detalhe: `${t.pecas} peça${t.pecas === 1 ? '' : 's'}` }))} />
              </section>

              <section className="cartao painel-bloco">
                <header className="bloco-cabecalho">
                  <div>
                    <h2><span className="tag-pergunta">P2</span> Taxa de ocupação da capacidade diária</h2>
                    <p className="texto-suave texto-pequeno">Média de cada semana (dias úteis)</p>
                  </div>
                </header>
                <GraficoLinha referencia={100} rotuloReferencia="Capacidade" formatar={porcento}
                  pontos={indicadores.ocupacaoSemanal.map((o) => ({
                    rotulo: diaMes(o.semana), valor: o.percentual,
                    detalhe: `${porcento(o.percentual)} · ${o.complexidade} de ${o.capacidade}`,
                  }))} />
              </section>

              <section className="cartao painel-bloco">
                <header className="bloco-cabecalho">
                  <div>
                    <h2><span className="tag-pergunta">P4</span> Índice de cumprimento de prazos</h2>
                    <p className="texto-suave texto-pequeno">Pronto até a data de entrega prometida</p>
                  </div>
                </header>
                <GraficoPizza
                  centro={indicadores.prazos.indice === null ? '—' : porcento(indicadores.prazos.indice)}
                  legendaCentro="no prazo"
                  fatias={[
                    { rotulo: 'No prazo', valor: indicadores.prazos.noPrazo, cor: 'var(--sucesso)' },
                    { rotulo: 'Atrasado', valor: indicadores.prazos.atrasados, cor: 'var(--perigo)' },
                    { rotulo: 'Em andamento', valor: indicadores.prazos.emAndamento, cor: 'var(--neutro-grafico)' },
                  ]} />
              </section>

              {indicadores.ticketPorServico && (
                <section className="cartao painel-bloco">
                  <header className="bloco-cabecalho">
                    <div>
                      <h2><span className="tag-pergunta">P3</span> Ticket médio por serviço</h2>
                      <p className="texto-suave texto-pequeno">Valor do serviço por pedido que o inclui</p>
                    </div>
                  </header>
                  <GraficoBarras formatar={formatarMoeda}
                    itens={indicadores.ticketPorServico.map((t) => ({ rotulo: t.servico, valor: t.ticketMedio, detalhe: `${t.pedidos} pedido${t.pedidos === 1 ? '' : 's'}` }))} />
                </section>
              )}

              {indicadores.receitaPorHora && (
                <section className="cartao painel-bloco">
                  <header className="bloco-cabecalho">
                    <div>
                      <h2><span className="tag-pergunta">P3</span> Receita por hora trabalhada</h2>
                      <p className="texto-suave texto-pequeno">Valor do serviço ÷ horas de produção (P1)</p>
                    </div>
                  </header>
                  <GraficoBarras formatar={(v) => `${formatarMoeda(v)}/h`} vazio="Nenhum pedido passou de Em produção para Pronto no período."
                    itens={indicadores.receitaPorHora.map((r) => ({ rotulo: r.servico, valor: r.receitaPorHora, detalhe: horas(r.horas) }))} />
                </section>
              )}

              {indicadores.faturamentoPorCliente && (
                <section className="cartao painel-bloco">
                  <header className="bloco-cabecalho">
                    <div>
                      <h2><span className="tag-pergunta">P5</span> Faturamento por cliente</h2>
                      <p className="texto-suave texto-pequeno">10 maiores no período</p>
                    </div>
                  </header>
                  <GraficoBarras formatar={formatarMoeda}
                    itens={indicadores.faturamentoPorCliente.map((f) => ({ rotulo: f.cliente, valor: f.valor, detalhe: `${f.pedidos} pedido${f.pedidos === 1 ? '' : 's'}` }))} />
                </section>
              )}
            </div>
          </>
        )}
      </section>
    </>
  );
}

function Indicador({ rotulo, valor, carregando, alerta, nota }: { rotulo: string; valor: number | string; carregando: boolean; alerta?: boolean; nota?: string }) {
  return (
    <div className={`kpi ${alerta ? 'kpi-alerta' : ''}`}>
      <span className="kpi-rotulo">{rotulo}</span>
      <strong className="kpi-valor">{carregando ? '–' : valor}</strong>
      {alerta && <span className="kpi-nota">{nota ?? 'Precisa de atenção'}</span>}
    </div>
  );
}
