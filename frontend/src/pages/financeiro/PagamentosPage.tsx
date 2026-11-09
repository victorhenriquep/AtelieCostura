import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../../api';
import { useAuth } from '../../auth/AuthContext';
import { useAvisos } from '../../components/Avisos';
import { Confirmacao } from '../../components/Confirmacao';
import { HistoricoModal } from '../../components/HistoricoModal';
import { IconeEditar, IconeHistorico, IconeLixeira, IconeMais } from '../../components/Icones';
import type { CategoriaPagamento, ListaPagamentos, Pagamento } from '../../types';
import { NOME_CATEGORIA, NOME_FORMA, mesAtual, nomeDoMes, periodoDoMes } from '../../utils/financeiro';
import { formatarDataSimples, formatarMoeda } from '../../utils/formatos';
import { PagamentoFormModal } from './PagamentoFormModal';

export function PagamentosPage() {
  const { pode } = useAuth();
  const avisar = useAvisos();
  const [mes, setMes] = useState(mesAtual());
  const [categoria, setCategoria] = useState<CategoriaPagamento | ''>('');
  const [lista, setLista] = useState<ListaPagamentos | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [formAberto, setFormAberto] = useState(false);
  const [emEdicao, setEmEdicao] = useState<Pagamento | null>(null);
  const [historicoDe, setHistoricoDe] = useState<Pagamento | null>(null);
  const [excluirDe, setExcluirDe] = useState<Pagamento | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const carregar = useCallback(async () => {
    if (!mes) return;
    setCarregando(true);
    setErro(null);
    try {
      setLista(await api.pagamentos.listar({ ...periodoDoMes(mes), categoria: categoria || undefined }));
    } catch (ex) {
      setErro(ex instanceof ApiError ? ex.message : 'Erro ao carregar os pagamentos.');
    } finally {
      setCarregando(false);
    }
  }, [mes, categoria]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function abrir(p: Pagamento | null) {
    setEmEdicao(p);
    setFormAberto(true);
  }

  function aoSalvar(p: Pagamento, novo: boolean) {
    setFormAberto(false);
    avisar('sucesso', novo ? `Pagamento de ${formatarMoeda(p.valor)} registrado.` : 'Alterações salvas.');
    carregar();
  }

  async function confirmarExclusao() {
    if (!excluirDe) return;
    setExcluindo(true);
    try {
      await api.pagamentos.excluir(excluirDe.id);
      avisar('sucesso', 'Pagamento excluído.');
      setExcluirDe(null);
      carregar();
    } catch (ex) {
      avisar('erro', ex instanceof ApiError ? ex.message : 'Não foi possível excluir.');
    } finally {
      setExcluindo(false);
    }
  }

  const pagamentos = lista?.pagamentos ?? [];

  return (
    <>
      <header className="pagina-cabecalho">
        <div>
          <h1>Pagamentos</h1>
        </div>
        <button type="button" className="botao botao-primario" onClick={() => abrir(null)}>
          <IconeMais /> Novo pagamento
        </button>
      </header>

      <div className="filtros">
        <label className="seletor">
          <span>Mês</span>
          <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} aria-label="Mês" />
        </label>
        <label className="seletor">
          <span>Categoria</span>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaPagamento | '')}>
            <option value="">Todas</option>
            {(Object.keys(NOME_CATEGORIA) as CategoriaPagamento[]).map((c) => <option key={c} value={c}>{NOME_CATEGORIA[c]}</option>)}
          </select>
        </label>
      </div>

      <section className="resumo-financeiro" aria-label="Totais">
        <div className="kpi kpi-saida">
          <span className="kpi-rotulo">Pago em {mes ? nomeDoMes(mes) : '—'}</span>
          <strong className="kpi-valor">{lista ? formatarMoeda(lista.total) : '–'}</strong>
          <span className="texto-pequeno texto-suave">{pagamentos.length} pagamento{pagamentos.length === 1 ? '' : 's'}</span>
        </div>
        <ul className="totais-lista" aria-label="Por categoria">
          {(lista?.porCategoria ?? []).map((t) => (
            <li key={t.categoria}><span>{NOME_CATEGORIA[t.categoria]}</span><strong>{formatarMoeda(t.total)}</strong></li>
          ))}
        </ul>
      </section>

      <div className="cartao">
        {erro && <p className="mensagem-erro">{erro}</p>}
        {!erro && carregando && pagamentos.length === 0 && <p className="texto-suave preenchimento">Carregando…</p>}
        {!erro && !carregando && pagamentos.length === 0 && (
          <p className="texto-suave preenchimento">Nenhum pagamento neste período.</p>
        )}

        {pagamentos.length > 0 && (
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Descrição</th>
                  <th className="ocultar-mobile">Categoria</th>
                  <th className="ocultar-mobile">Forma</th>
                  <th className="num">Valor</th>
                  <th className="col-acoes"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {pagamentos.map((p) => (
                  <tr key={p.id}>
                    <td className="sem-quebra">{formatarDataSimples(p.data)}</td>
                    <td>
                      <strong>{p.descricao}</strong>
                      {p.observacao && <div className="texto-pequeno texto-suave">{p.observacao}</div>}
                    </td>
                    <td className="ocultar-mobile">{NOME_CATEGORIA[p.categoria]}</td>
                    <td className="ocultar-mobile">{NOME_FORMA[p.formaPagamento]}</td>
                    <td className="num sem-quebra">{formatarMoeda(p.valor)}</td>
                    <td className="col-acoes">
                      <button type="button" className="botao-icone" title="Editar" aria-label={`Editar ${p.descricao}`} onClick={() => abrir(p)}>
                        <IconeEditar />
                      </button>
                      {pode('logs') && (
                        <button type="button" className="botao-icone" title="Histórico de alterações" aria-label={`Histórico de ${p.descricao}`}
                          onClick={() => setHistoricoDe(p)}>
                          <IconeHistorico />
                        </button>
                      )}
                      <button type="button" className="botao-icone perigo" title="Excluir" aria-label={`Excluir ${p.descricao}`} onClick={() => setExcluirDe(p)}>
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

      <PagamentoFormModal aberto={formAberto} pagamento={emEdicao} aoFechar={() => setFormAberto(false)} aoSalvar={aoSalvar} />

      <HistoricoModal entidade="Pagamento" entidadeId={historicoDe?.id ?? null} descricao={historicoDe?.descricao ?? ''}
        aoFechar={() => setHistoricoDe(null)} />

      <Confirmacao
        aberto={excluirDe !== null}
        titulo="Excluir pagamento"
        mensagem={excluirDe ? `"${excluirDe.descricao}" (${formatarMoeda(excluirDe.valor)}, ${formatarDataSimples(excluirDe.data)}) sai do fluxo de caixa. A exclusão fica no histórico.` : ''}
        textoConfirmar="Excluir"
        textoVoltar="Voltar"
        perigo
        carregando={excluindo}
        aoConfirmar={confirmarExclusao}
        aoCancelar={() => setExcluirDe(null)}
      />
    </>
  );
}
