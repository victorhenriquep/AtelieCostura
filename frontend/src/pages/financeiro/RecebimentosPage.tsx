import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../../api';
import { useAvisos } from '../../components/Avisos';
import { Confirmacao } from '../../components/Confirmacao';
import { IconeLixeira, IconeMais } from '../../components/Icones';
import type { FormaPagamento, ListaRecebimentos, Recebimento } from '../../types';
import { CLASSE_SITUACAO, NOME_FORMA, NOME_SITUACAO, mesAtual, nomeDoMes, periodoDoMes } from '../../utils/financeiro';
import { formatarDataSimples, formatarMoeda } from '../../utils/formatos';
import { RecebimentoFormModal } from './RecebimentoFormModal';

export function RecebimentosPage() {
  const avisar = useAvisos();
  const [mes, setMes] = useState(mesAtual());
  const [forma, setForma] = useState<FormaPagamento | ''>('');
  const [lista, setLista] = useState<ListaRecebimentos | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [formAberto, setFormAberto] = useState(false);
  const [estornarDe, setEstornarDe] = useState<Recebimento | null>(null);
  const [estornando, setEstornando] = useState(false);

  const carregar = useCallback(async () => {
    if (!mes) return;
    setCarregando(true);
    setErro(null);
    try {
      setLista(await api.recebimentos.listar({ ...periodoDoMes(mes), forma: forma || undefined }));
    } catch (ex) {
      setErro(ex instanceof ApiError ? ex.message : 'Erro ao carregar os recebimentos.');
    } finally {
      setCarregando(false);
    }
  }, [mes, forma]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function aoSalvar(r: Recebimento) {
    setFormAberto(false);
    avisar('sucesso', `Recebimento de ${formatarMoeda(r.valor)} registrado no pedido #${r.pedidoId}.`);
    carregar();
  }

  async function confirmarEstorno() {
    if (!estornarDe) return;
    setEstornando(true);
    try {
      await api.recebimentos.estornar(estornarDe.id);
      avisar('sucesso', 'Recebimento estornado.');
      setEstornarDe(null);
      carregar();
    } catch (ex) {
      avisar('erro', ex instanceof ApiError ? ex.message : 'Não foi possível estornar.');
    } finally {
      setEstornando(false);
    }
  }

  const recebimentos = lista?.recebimentos ?? [];

  return (
    <>
      <header className="pagina-cabecalho">
        <div>
          <h1>Recebimentos</h1>
        </div>
        <button type="button" className="botao botao-primario" onClick={() => setFormAberto(true)}>
          <IconeMais /> Registrar recebimento
        </button>
      </header>

      <div className="filtros">
        <label className="seletor">
          <span>Mês</span>
          <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} aria-label="Mês" />
        </label>
        <label className="seletor">
          <span>Forma</span>
          <select value={forma} onChange={(e) => setForma(e.target.value as FormaPagamento | '')}>
            <option value="">Todas</option>
            {(Object.keys(NOME_FORMA) as FormaPagamento[]).map((f) => <option key={f} value={f}>{NOME_FORMA[f]}</option>)}
          </select>
        </label>
      </div>

      <section className="resumo-financeiro" aria-label="Totais">
        <div className="kpi kpi-entrada">
          <span className="kpi-rotulo">Recebido em {mes ? nomeDoMes(mes) : '—'}</span>
          <strong className="kpi-valor">{lista ? formatarMoeda(lista.total) : '–'}</strong>
          <span className="texto-pequeno texto-suave">{recebimentos.length} recebimento{recebimentos.length === 1 ? '' : 's'}</span>
        </div>
        <ul className="totais-lista" aria-label="Por forma de pagamento">
          {(lista?.porForma ?? []).map((t) => (
            <li key={t.forma}><span>{NOME_FORMA[t.forma]}</span><strong>{formatarMoeda(t.total)}</strong></li>
          ))}
        </ul>
      </section>

      <div className="cartao">
        {erro && <p className="mensagem-erro">{erro}</p>}
        {!erro && carregando && recebimentos.length === 0 && <p className="texto-suave preenchimento">Carregando…</p>}
        {!erro && !carregando && recebimentos.length === 0 && (
          <p className="texto-suave preenchimento">Nenhum recebimento neste período.</p>
        )}

        {recebimentos.length > 0 && (
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Data</th>
                  <th className="num">Pedido</th>
                  <th>Cliente</th>
                  <th className="ocultar-mobile">Forma</th>
                  <th className="ocultar-mobile">Observação</th>
                  <th className="num">Valor</th>
                  <th className="ocultar-mobile">Situação do pedido</th>
                  <th className="col-acoes"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {recebimentos.map((r) => (
                  <tr key={r.id}>
                    <td className="sem-quebra">{formatarDataSimples(r.data)}</td>
                    <td className="num texto-suave">#{r.pedidoId}</td>
                    <td><strong>{r.clienteNome}</strong></td>
                    <td className="ocultar-mobile">{NOME_FORMA[r.formaPagamento]}</td>
                    <td className="ocultar-mobile">{r.observacao || <span className="texto-suave">—</span>}</td>
                    <td className="num sem-quebra">{formatarMoeda(r.valor)}</td>
                    <td className="ocultar-mobile">
                      <span className={`etiqueta ${CLASSE_SITUACAO[r.situacaoPedido]}`}>{NOME_SITUACAO[r.situacaoPedido]}</span>
                    </td>
                    <td className="col-acoes">
                      <button type="button" className="botao-icone perigo" title="Estornar"
                        aria-label={`Estornar recebimento de ${formatarMoeda(r.valor)} do pedido ${r.pedidoId}`} onClick={() => setEstornarDe(r)}>
                        <IconeLixeira />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <RecebimentoFormModal aberto={formAberto} aoFechar={() => setFormAberto(false)} aoSalvar={aoSalvar} />

      <Confirmacao
        aberto={estornarDe !== null}
        titulo="Estornar recebimento"
        mensagem={estornarDe
          ? `O recebimento de ${formatarMoeda(estornarDe.valor)} (${NOME_FORMA[estornarDe.formaPagamento]}, ${formatarDataSimples(estornarDe.data)}) do pedido #${estornarDe.pedidoId} será apagado e o valor volta a ficar em aberto. O estorno fica no histórico do pedido.`
          : ''}
        textoConfirmar="Estornar"
        textoVoltar="Voltar"
        perigo
        carregando={estornando}
        aoConfirmar={confirmarEstorno}
        aoCancelar={() => setEstornarDe(null)}
      />
    </>
  );
}
