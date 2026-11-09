import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../../api';
import { useAuth } from '../../auth/AuthContext';
import { useAvisos } from '../../components/Avisos';
import { Confirmacao } from '../../components/Confirmacao';
import { HistoricoModal } from '../../components/HistoricoModal';
import { IconeBloquear, IconeBusca, IconeEditar, IconeHistorico, IconeMais, IconeReativar } from '../../components/Icones';
import type { Servico } from '../../types';
import { formatarMoeda } from '../../utils/formatos';
import { ServicoFormModal } from './ServicoFormModal';

export function ServicosPage() {
  const { pode } = useAuth();
  const avisar = useAvisos();

  const [servicos, setServicos] = useState<Servico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [incluirInativos, setIncluirInativos] = useState(false);

  const [formAberto, setFormAberto] = useState(false);
  const [emEdicao, setEmEdicao] = useState<Servico | null>(null);
  const [historicoDe, setHistoricoDe] = useState<Servico | null>(null);
  const [statusDe, setStatusDe] = useState<Servico | null>(null);
  const [alterandoStatus, setAlterandoStatus] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setServicos(await api.servicos.listar({ busca, incluirInativos }));
    } catch (ex) {
      setErro(ex instanceof ApiError ? ex.message : 'Erro ao carregar serviços.');
    } finally {
      setCarregando(false);
    }
  }, [busca, incluirInativos]);

  useEffect(() => {
    const t = setTimeout(carregar, 300);
    return () => clearTimeout(t);
  }, [carregar]);

  function abrir(servico: Servico | null) {
    setEmEdicao(servico);
    setFormAberto(true);
  }

  function aoSalvar(s: Servico, novo: boolean) {
    setFormAberto(false);
    avisar('sucesso', novo ? `Serviço ${s.nome} cadastrado.` : 'Alterações salvas.');
    carregar();
  }

  async function confirmarStatus() {
    if (!statusDe) return;
    setAlterandoStatus(true);
    try {
      await api.servicos.alterarStatus(statusDe.id, !statusDe.ativo);
      avisar('sucesso', statusDe.ativo ? 'Serviço inativado.' : 'Serviço reativado.');
      setStatusDe(null);
      carregar();
    } catch (ex) {
      avisar('erro', ex instanceof ApiError ? ex.message : 'Não foi possível alterar a situação.');
    } finally {
      setAlterandoStatus(false);
    }
  }

  return (
    <>
      <header className="pagina-cabecalho">
        <div>
          <h1>Serviços</h1>
        </div>
        <button type="button" className="botao botao-primario" onClick={() => abrir(null)}>
          <IconeMais /> Novo serviço
        </button>
      </header>

      <div className="filtros">
        <label className="busca">
          <IconeBusca />
          <input type="search" placeholder="Buscar por nome ou descrição" value={busca}
            onChange={(e) => setBusca(e.target.value)} aria-label="Buscar serviços" />
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={incluirInativos} onChange={(e) => setIncluirInativos(e.target.checked)} />
          Mostrar inativos
        </label>
      </div>

      <div className="cartao">
        {erro && <p className="mensagem-erro">{erro}</p>}
        {!erro && carregando && servicos.length === 0 && <p className="texto-suave preenchimento">Carregando…</p>}
        {!erro && !carregando && servicos.length === 0 && (
          <p className="texto-suave preenchimento">{busca ? 'Nenhum serviço encontrado.' : 'Nenhum serviço cadastrado ainda.'}</p>
        )}

        {servicos.length > 0 && (
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Serviço</th>
                  <th className="num">Preço</th>
                  <th>Complexidade</th>
                  <th className="ocultar-mobile">Situação</th>
                  <th className="col-acoes"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {servicos.map((s) => (
                  <tr key={s.id} className={s.ativo ? '' : 'inativo'}>
                    <td>
                      <strong>{s.nome}</strong>
                      {s.descricao && <div className="texto-suave texto-pequeno">{s.descricao}</div>}
                    </td>
                    <td className="num sem-quebra">{formatarMoeda(s.preco)}</td>
                    <td>
                      <div className="medidor-linha" title={`${s.complexidade} de 100 por peça`}>
                        <span className="medidor"><span style={{ width: `${s.complexidade}%` }} /></span>
                        <span className="num">{s.complexidade}</span>
                      </div>
                    </td>
                    <td className="ocultar-mobile">
                      <span className={`etiqueta ${s.ativo ? 'etiqueta-ativo' : 'etiqueta-inativo'}`}>{s.ativo ? 'Ativo' : 'Inativo'}</span>
                    </td>
                    <td className="col-acoes">
                      <button type="button" className="botao-icone" title="Editar" aria-label={`Editar ${s.nome}`} onClick={() => abrir(s)}>
                        <IconeEditar />
                      </button>
                      {pode('logs') && (
                        <button type="button" className="botao-icone" title="Histórico de alterações" aria-label={`Histórico de ${s.nome}`} onClick={() => setHistoricoDe(s)}>
                          <IconeHistorico />
                        </button>
                      )}
                      <button type="button" className={`botao-icone ${s.ativo ? 'perigo' : ''}`} title={s.ativo ? 'Inativar' : 'Reativar'}
                        aria-label={`${s.ativo ? 'Inativar' : 'Reativar'} ${s.nome}`} onClick={() => setStatusDe(s)}>
                        {s.ativo ? <IconeBloquear /> : <IconeReativar />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ServicoFormModal aberto={formAberto} servico={emEdicao} aoFechar={() => setFormAberto(false)} aoSalvar={aoSalvar} />

      <HistoricoModal entidade="Servico" entidadeId={historicoDe?.id ?? null} descricao={historicoDe?.nome ?? ''}
        aoFechar={() => setHistoricoDe(null)} />

      <Confirmacao
        aberto={statusDe !== null}
        titulo={statusDe?.ativo ? 'Inativar serviço' : 'Reativar serviço'}
        mensagem={statusDe?.ativo
          ? `${statusDe.nome} não poderá ser incluído em novos pedidos. Pedidos já feitos não mudam.`
          : `${statusDe?.nome} voltará a aparecer na criação de pedidos.`}
        textoConfirmar={statusDe?.ativo ? 'Inativar' : 'Reativar'}
        perigo={statusDe?.ativo}
        carregando={alterandoStatus}
        aoConfirmar={confirmarStatus}
        aoCancelar={() => setStatusDe(null)}
      />
    </>
  );
}
