import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../../api';
import { useAuth } from '../../auth/AuthContext';
import { useAvisos } from '../../components/Avisos';
import { Confirmacao } from '../../components/Confirmacao';
import { HistoricoModal } from '../../components/HistoricoModal';
import { IconeBloquear, IconeBusca, IconeEditar, IconeHistorico, IconeMais, IconeReativar } from '../../components/Icones';
import type { Funcionario } from '../../types';
import { FuncionarioFormModal } from './FuncionarioFormModal';

export function FuncionariosPage() {
  const { usuario, pode } = useAuth();
  const avisar = useAvisos();

  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [incluirInativos, setIncluirInativos] = useState(false);

  const [formAberto, setFormAberto] = useState(false);
  const [emEdicao, setEmEdicao] = useState<Funcionario | null>(null);
  const [historicoDe, setHistoricoDe] = useState<Funcionario | null>(null);
  const [statusDe, setStatusDe] = useState<Funcionario | null>(null);
  const [alterandoStatus, setAlterandoStatus] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setFuncionarios(await api.funcionarios.listar({ busca, incluirInativos }));
    } catch (ex) {
      setErro(ex instanceof ApiError ? ex.message : 'Erro ao carregar funcionários.');
    } finally {
      setCarregando(false);
    }
  }, [busca, incluirInativos]);

  useEffect(() => {
    const t = setTimeout(carregar, 300);
    return () => clearTimeout(t);
  }, [carregar]);

  function abrir(f: Funcionario | null) {
    setEmEdicao(f);
    setFormAberto(true);
  }

  function aoSalvar(f: Funcionario, novo: boolean) {
    setFormAberto(false);
    avisar('sucesso', novo ? `Funcionário ${f.nome} cadastrado.` : 'Alterações salvas.');
    carregar();
  }

  async function confirmarStatus() {
    if (!statusDe) return;
    setAlterandoStatus(true);
    try {
      await api.funcionarios.alterarStatus(statusDe.id, !statusDe.ativo);
      avisar('sucesso', statusDe.ativo ? 'Funcionário inativado.' : 'Funcionário reativado.');
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
          <h1>Funcionários</h1>
        </div>
        <button type="button" className="botao botao-primario" onClick={() => abrir(null)}>
          <IconeMais /> Novo funcionário
        </button>
      </header>

      <div className="filtros">
        <label className="busca">
          <IconeBusca />
          <input type="search" placeholder="Buscar por nome ou e-mail" value={busca}
            onChange={(e) => setBusca(e.target.value)} aria-label="Buscar funcionários" />
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={incluirInativos} onChange={(e) => setIncluirInativos(e.target.checked)} />
          Mostrar inativos
        </label>
      </div>

      <div className="cartao">
        {erro && <p className="mensagem-erro">{erro}</p>}
        {!erro && carregando && funcionarios.length === 0 && <p className="texto-suave preenchimento">Carregando…</p>}
        {!erro && !carregando && funcionarios.length === 0 && (
          <p className="texto-suave preenchimento">Nenhum funcionário encontrado.</p>
        )}

        {funcionarios.length > 0 && (
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th className="ocultar-mobile">E-mail</th>
                  <th>Perfil</th>
                  <th className="ocultar-mobile">Situação</th>
                  <th className="col-acoes"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {funcionarios.map((f) => {
                  const ehVoce = f.id === usuario?.id;
                  return (
                    <tr key={f.id} className={f.ativo ? '' : 'inativo'}>
                      <td>
                        <strong>{f.nome}</strong> {ehVoce && <span className="texto-suave texto-pequeno">(você)</span>}
                      </td>
                      <td className="ocultar-mobile">{f.email}</td>
                      <td>
                        <span className={`etiqueta ${f.perfil === 'Administrador' ? 'etiqueta-admin' : 'etiqueta-neutra'}`}>{f.perfil}</span>
                      </td>
                      <td className="ocultar-mobile">
                        <span className={`etiqueta ${f.ativo ? 'etiqueta-ativo' : 'etiqueta-inativo'}`}>{f.ativo ? 'Ativo' : 'Inativo'}</span>
                      </td>
                      <td className="col-acoes">
                        <button type="button" className="botao-icone" title="Editar" aria-label={`Editar ${f.nome}`} onClick={() => abrir(f)}>
                          <IconeEditar />
                        </button>
                        {pode('logs') && (
                          <button type="button" className="botao-icone" title="Histórico de alterações" aria-label={`Histórico de ${f.nome}`} onClick={() => setHistoricoDe(f)}>
                            <IconeHistorico />
                          </button>
                        )}
                        <button
                          type="button"
                          className={`botao-icone ${f.ativo ? 'perigo' : ''}`}
                          title={ehVoce && f.ativo ? 'Você não pode inativar o seu próprio usuário' : f.ativo ? 'Inativar' : 'Reativar'}
                          aria-label={`${f.ativo ? 'Inativar' : 'Reativar'} ${f.nome}`}
                          onClick={() => setStatusDe(f)}
                          disabled={ehVoce && f.ativo}
                        >
                          {f.ativo ? <IconeBloquear /> : <IconeReativar />}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <FuncionarioFormModal aberto={formAberto} funcionario={emEdicao} aoFechar={() => setFormAberto(false)} aoSalvar={aoSalvar} />

      <HistoricoModal entidade="Funcionario" entidadeId={historicoDe?.id ?? null} descricao={historicoDe?.nome ?? ''}
        aoFechar={() => setHistoricoDe(null)} />

      <Confirmacao
        aberto={statusDe !== null}
        titulo={statusDe?.ativo ? 'Inativar funcionário' : 'Reativar funcionário'}
        mensagem={statusDe?.ativo
          ? `${statusDe.nome} não conseguirá mais entrar no sistema. O histórico é mantido.`
          : `${statusDe?.nome} voltará a conseguir entrar no sistema.`}
        textoConfirmar={statusDe?.ativo ? 'Inativar' : 'Reativar'}
        perigo={statusDe?.ativo}
        carregando={alterandoStatus}
        aoConfirmar={confirmarStatus}
        aoCancelar={() => setStatusDe(null)}
      />
    </>
  );
}
