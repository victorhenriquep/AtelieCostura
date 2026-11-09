import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../api';
import { useAuth } from '../../auth/AuthContext';
import { useAvisos } from '../../components/Avisos';
import { Confirmacao } from '../../components/Confirmacao';
import { HistoricoModal } from '../../components/HistoricoModal';
import { IconeAvancar, IconeBusca, IconeCancelar, IconeDinheiro, IconeEditar, IconeHistorico, IconeMais, IconeVer } from '../../components/Icones';
import { EtiquetaStatus } from '../../components/StatusPedido';
import type { Pedido, PedidoResumo, StatusPedido } from '../../types';
import { CLASSE_SITUACAO, NOME_SITUACAO } from '../../utils/financeiro';
import { formatarDataSimples, formatarMoeda } from '../../utils/formatos';
import { RecebimentoFormModal } from '../financeiro/RecebimentoFormModal';
import { NOME_STATUS, PROXIMA_ETAPA, podeCancelar, situacaoPrazo } from '../../utils/pedidos';
import { PedidoFormModal } from './PedidoFormModal';

type FiltroStatus = '' | 'todos' | StatusPedido;

interface MudancaStatus { pedido: PedidoResumo; para: StatusPedido; titulo: string; mensagem: string; perigo: boolean }

export function PedidosPage() {
  const { pode } = useAuth();
  const podeEditar = pode('pedidos.editar');
  const veFinanceiro = pode('financeiro');
  const avisar = useAvisos();
  const location = useLocation();
  const navigate = useNavigate();

  const [pedidos, setPedidos] = useState<PedidoResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('');

  const [formAberto, setFormAberto] = useState(false);
  const [pedidoAberto, setPedidoAberto] = useState<number | null>(null);
  const [historicoDe, setHistoricoDe] = useState<PedidoResumo | null>(null);
  const [mudanca, setMudanca] = useState<MudancaStatus | null>(null);
  const [mudando, setMudando] = useState(false);
  const [receberDe, setReceberDe] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setPedidos(await api.pedidos.listar({
        busca,
        status: filtroStatus && filtroStatus !== 'todos' ? filtroStatus : undefined,
        incluirFinalizados: filtroStatus === 'todos',
      }));
    } catch (ex) {
      setErro(ex instanceof ApiError ? ex.message : 'Erro ao carregar pedidos.');
    } finally {
      setCarregando(false);
    }
  }, [busca, filtroStatus]);

  useEffect(() => {
    const t = setTimeout(carregar, 300);
    return () => clearTimeout(t);
  }, [carregar]);

  useEffect(() => {
    if ((location.state as { novoPedido?: boolean } | null)?.novoPedido) {
      if (podeEditar) abrir(null);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location, navigate, podeEditar]);

  function abrir(id: number | null) {
    setPedidoAberto(id);
    setFormAberto(true);
  }

  function aoReceber() {
    setReceberDe(null);
    avisar('sucesso', 'Recebimento registrado.');
    carregar();
  }

  function aoSalvar(p: Pedido, novo: boolean) {
    setFormAberto(false);
    avisar('sucesso', novo
      ? `Pedido #${p.id} criado. Entrega em ${formatarDataSimples(p.dataEntrega)}.`
      : `Pedido #${p.id} atualizado. Entrega em ${formatarDataSimples(p.dataEntrega)}.`);
    carregar();
  }

  function pedirAvanco(p: PedidoResumo) {
    const etapa = PROXIMA_ETAPA[p.status];
    if (!etapa) return;
    setMudanca({
      pedido: p, para: etapa.status, titulo: etapa.acao, perigo: false,
      mensagem: `O pedido #${p.id} (${p.clienteNome}) passará de "${NOME_STATUS[p.status]}" para "${NOME_STATUS[etapa.status]}".` +
        (etapa.status === 'Entregue' ? ' Depois disso ele não pode mais ser alterado.' : '') +
        (etapa.status === 'Entregue' && veFinanceiro && p.situacaoPagamento !== 'Pago'
          ? ` Atenção: ainda faltam ${formatarMoeda(p.valorTotal - (p.valorRecebido ?? 0))} a receber.`
          : ''),
    });
  }

  function pedirCancelamento(p: PedidoResumo) {
    if ((p.valorRecebido ?? 0) > 0) {
      avisar('erro', `O pedido #${p.id} tem recebimentos. Estorne-os na tela Recebimentos antes de cancelar.`);
      return;
    }
    setMudanca({
      pedido: p, para: 'Cancelado', titulo: 'Cancelar pedido', perigo: true,
      mensagem: `O pedido #${p.id} (${p.clienteNome}) será cancelado e o espaço do dia ${formatarDataSimples(p.dataEntrega)} ficará livre. Não é possível desfazer.`,
    });
  }

  async function confirmarMudanca() {
    if (!mudanca) return;
    setMudando(true);
    try {
      await api.pedidos.alterarStatus(mudanca.pedido.id, mudanca.para);
      avisar('sucesso', `Pedido #${mudanca.pedido.id}: ${NOME_STATUS[mudanca.para].toLowerCase()}.`);
      setMudanca(null);
      carregar();
    } catch (ex) {
      avisar('erro', ex instanceof ApiError ? ex.message : 'Não foi possível alterar o status.');
    } finally {
      setMudando(false);
    }
  }

  return (
    <>
      <header className="pagina-cabecalho">
        <div>
          <h1>Pedidos</h1>
        </div>
        {podeEditar && (
          <button type="button" className="botao botao-primario" onClick={() => abrir(null)}>
            <IconeMais /> Novo pedido
          </button>
        )}
      </header>

      <div className="filtros">
        <label className="busca">
          <IconeBusca />
          <input type="search" placeholder="Buscar pelo nome do cliente" value={busca}
            onChange={(e) => setBusca(e.target.value)} aria-label="Buscar pedidos" />
        </label>
        <label className="seletor">
          <span>Mostrar</span>
          <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value as FiltroStatus)}>
            <option value="">Em aberto</option>
            {(Object.keys(NOME_STATUS) as StatusPedido[]).map((s) => (
              <option key={s} value={s}>{NOME_STATUS[s]}</option>
            ))}
            <option value="todos">Todos</option>
          </select>
        </label>
      </div>

      <div className="cartao">
        {erro && <p className="mensagem-erro">{erro}</p>}
        {!erro && carregando && pedidos.length === 0 && <p className="texto-suave preenchimento">Carregando…</p>}
        {!erro && !carregando && pedidos.length === 0 && (
          <p className="texto-suave preenchimento">Nenhum pedido encontrado.</p>
        )}

        {pedidos.length > 0 && (
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead>
                <tr>
                  <th className="num">Nº</th>
                  <th>Cliente</th>
                  <th>Entrega</th>
                  <th className="num ocultar-mobile">Peças</th>
                  <th className="num ocultar-mobile">Valor</th>
                  <th>Status</th>
                  {veFinanceiro && <th className="ocultar-mobile">Pagamento</th>}
                  <th className="col-acoes"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {pedidos.map((p) => {
                  const prazo = situacaoPrazo(p.dataEntrega, p.status);
                  const etapa = PROXIMA_ETAPA[p.status];
                  const editavel = podeEditar && p.status === 'Pendente';
                  return (
                    <tr key={p.id} className={p.status === 'Cancelado' ? 'inativo' : ''}>
                      <td className="num texto-suave">#{p.id}</td>
                      <td><strong>{p.clienteNome}</strong></td>
                      <td className="sem-quebra">
                        {formatarDataSimples(p.dataEntrega)}
                        {prazo && <span className={`tag-prazo tag-${prazo}`}>{prazo === 'hoje' ? 'Hoje' : 'Atrasado'}</span>}
                      </td>
                      <td className="num ocultar-mobile">{p.quantidadePecas}</td>
                      <td className="num sem-quebra ocultar-mobile">{formatarMoeda(p.valorTotal)}</td>
                      <td><EtiquetaStatus status={p.status} /></td>
                      {veFinanceiro && (
                        <td className="ocultar-mobile">
                          {p.status !== 'Cancelado' && p.situacaoPagamento && (
                            <span className={`etiqueta ${CLASSE_SITUACAO[p.situacaoPagamento]}`}
                              title={`Recebido ${formatarMoeda(p.valorRecebido ?? 0)} de ${formatarMoeda(p.valorTotal)}`}>
                              {NOME_SITUACAO[p.situacaoPagamento]}
                            </span>
                          )}
                        </td>
                      )}
                      <td className="col-acoes">
                        <button type="button" className="botao-icone" title={editavel ? 'Editar' : 'Ver detalhes'}
                          aria-label={`${editavel ? 'Editar' : 'Ver'} pedido ${p.id}`} onClick={() => abrir(p.id)}>
                          {editavel ? <IconeEditar /> : <IconeVer />}
                        </button>
                        {podeEditar && etapa && (
                          <button type="button" className="botao-icone sucesso" title={etapa.acao}
                            aria-label={`${etapa.acao}: pedido ${p.id}`} onClick={() => pedirAvanco(p)}>
                            <IconeAvancar />
                          </button>
                        )}
                        {veFinanceiro && p.status !== 'Cancelado' && p.situacaoPagamento !== 'Pago' && (
                          <button type="button" className="botao-icone" title="Registrar recebimento"
                            aria-label={`Registrar recebimento do pedido ${p.id}`} onClick={() => setReceberDe(p.id)}>
                            <IconeDinheiro />
                          </button>
                        )}
                        {pode('logs') && (
                          <button type="button" className="botao-icone" title="Histórico de alterações"
                            aria-label={`Histórico do pedido ${p.id}`} onClick={() => setHistoricoDe(p)}>
                            <IconeHistorico />
                          </button>
                        )}
                        {podeEditar && podeCancelar(p.status) && (
                          <button type="button" className="botao-icone perigo" title="Cancelar pedido"
                            aria-label={`Cancelar pedido ${p.id}`} onClick={() => pedirCancelamento(p)}>
                            <IconeCancelar />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PedidoFormModal aberto={formAberto} pedidoId={pedidoAberto} somenteLeitura={!podeEditar} aoFechar={() => setFormAberto(false)} aoSalvar={aoSalvar} />

      <RecebimentoFormModal aberto={receberDe !== null} pedidoId={receberDe} aoFechar={() => setReceberDe(null)} aoSalvar={aoReceber} />

      <HistoricoModal entidade="Pedido" entidadeId={historicoDe?.id ?? null}
        descricao={historicoDe ? `Pedido #${historicoDe.id} · ${historicoDe.clienteNome}` : ''}
        aoFechar={() => setHistoricoDe(null)} />

      <Confirmacao
        aberto={mudanca !== null}
        titulo={mudanca?.titulo ?? ''}
        mensagem={mudanca?.mensagem ?? ''}
        textoConfirmar={mudanca?.perigo ? 'Cancelar pedido' : 'Confirmar'}
        textoVoltar="Voltar"
        perigo={mudanca?.perigo}
        carregando={mudando}
        aoConfirmar={confirmarMudanca}
        aoCancelar={() => setMudanca(null)}
      />
    </>
  );
}
