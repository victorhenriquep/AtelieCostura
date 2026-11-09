import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../../api';
import { useAuth } from '../../auth/AuthContext';
import { useAvisos } from '../../components/Avisos';
import { Confirmacao } from '../../components/Confirmacao';
import { HistoricoModal } from '../../components/HistoricoModal';
import { IconeBloquear, IconeBusca, IconeEditar, IconeHistorico, IconeMais, IconeReativar, IconeVer } from '../../components/Icones';
import type { Cliente } from '../../types';
import { formatarCpf, formatarTelefone } from '../../utils/formatos';
import { ClienteFormModal } from './ClienteFormModal';

export function ClientesPage() {
  const { pode } = useAuth();
  const podeEditar = pode('clientes.editar');
  const avisar = useAvisos();

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [incluirInativos, setIncluirInativos] = useState(false);

  const [formAberto, setFormAberto] = useState(false);
  const [emEdicao, setEmEdicao] = useState<Cliente | null>(null);
  const [historicoDe, setHistoricoDe] = useState<Cliente | null>(null);
  const [statusDe, setStatusDe] = useState<Cliente | null>(null);
  const [alterandoStatus, setAlterandoStatus] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setClientes(await api.clientes.listar({ busca, incluirInativos }));
    } catch (ex) {
      setErro(ex instanceof ApiError ? ex.message : 'Erro ao carregar clientes.');
    } finally {
      setCarregando(false);
    }
  }, [busca, incluirInativos]);

  useEffect(() => {
    const t = setTimeout(carregar, 300);
    return () => clearTimeout(t);
  }, [carregar]);

  function abrirNovo() {
    setEmEdicao(null);
    setFormAberto(true);
  }

  function abrirEdicao(c: Cliente) {
    setEmEdicao(c);
    setFormAberto(true);
  }

  function aoSalvar(c: Cliente, novo: boolean) {
    setFormAberto(false);
    avisar('sucesso', novo ? `Cliente ${c.nome} cadastrado.` : 'Alterações salvas.');
    carregar();
  }

  async function confirmarStatus() {
    if (!statusDe) return;
    setAlterandoStatus(true);
    try {
      await api.clientes.alterarStatus(statusDe.id, !statusDe.ativo);
      avisar('sucesso', statusDe.ativo ? 'Cliente inativado.' : 'Cliente reativado.');
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
          <h1>Clientes</h1>
        </div>
        {podeEditar && (
          <button type="button" className="botao botao-primario" onClick={abrirNovo}>
            <IconeMais /> Novo cliente
          </button>
        )}
      </header>

      <div className="filtros">
        <label className="busca">
          <IconeBusca />
          <input
            type="search"
            placeholder="Buscar por nome, telefone, e-mail ou CPF"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            aria-label="Buscar clientes"
          />
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={incluirInativos} onChange={(e) => setIncluirInativos(e.target.checked)} />
          Mostrar inativos
        </label>
      </div>

      <div className="cartao">
        {erro && <p className="mensagem-erro">{erro}</p>}
        {!erro && carregando && clientes.length === 0 && <p className="texto-suave preenchimento">Carregando…</p>}
        {!erro && !carregando && clientes.length === 0 && (
          <p className="texto-suave preenchimento">
            {busca ? 'Nenhum cliente encontrado para esta busca.' : 'Nenhum cliente cadastrado ainda.'}
          </p>
        )}

        {clientes.length > 0 && (
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Telefone</th>
                  <th className="ocultar-mobile">E-mail</th>
                  <th className="ocultar-mobile">CPF</th>
                  <th className="ocultar-mobile">Situação</th>
                  <th className="col-acoes"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {clientes.map((c) => (
                  <tr key={c.id} className={c.ativo ? '' : 'inativo'}>
                    <td><strong>{c.nome}</strong></td>
                    <td className="sem-quebra">{formatarTelefone(c.telefone)}</td>
                    <td className="ocultar-mobile">{c.email || <span className="texto-suave">—</span>}</td>
                    <td className="ocultar-mobile sem-quebra">{c.cpf ? formatarCpf(c.cpf) : <span className="texto-suave">—</span>}</td>
                    <td className="ocultar-mobile">
                      <span className={`etiqueta ${c.ativo ? 'etiqueta-ativo' : 'etiqueta-inativo'}`}>
                        {c.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="col-acoes">
                      <button type="button" className="botao-icone" title={podeEditar ? 'Editar' : 'Ver dados'}
                        aria-label={`${podeEditar ? 'Editar' : 'Ver'} ${c.nome}`} onClick={() => abrirEdicao(c)}>
                        {podeEditar ? <IconeEditar /> : <IconeVer />}
                      </button>
                      {pode('logs') && (
                        <button type="button" className="botao-icone" title="Histórico de alterações" aria-label={`Histórico de ${c.nome}`} onClick={() => setHistoricoDe(c)}>
                          <IconeHistorico />
                        </button>
                      )}
                      {podeEditar && (
                      <button
                        type="button"
                        className={`botao-icone ${c.ativo ? 'perigo' : ''}`}
                        title={c.ativo ? 'Inativar' : 'Reativar'}
                        aria-label={`${c.ativo ? 'Inativar' : 'Reativar'} ${c.nome}`}
                        onClick={() => setStatusDe(c)}
                      >
                        {c.ativo ? <IconeBloquear /> : <IconeReativar />}
                      </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ClienteFormModal aberto={formAberto} cliente={emEdicao} somenteLeitura={!podeEditar} aoFechar={() => setFormAberto(false)} aoSalvar={aoSalvar} />

      <HistoricoModal
        entidade="Cliente"
        entidadeId={historicoDe?.id ?? null}
        descricao={historicoDe?.nome ?? ''}
        aoFechar={() => setHistoricoDe(null)}
      />

      <Confirmacao
        aberto={statusDe !== null}
        titulo={statusDe?.ativo ? 'Inativar cliente' : 'Reativar cliente'}
        mensagem={
          statusDe?.ativo
            ? `${statusDe.nome} não aparecerá mais nas buscas nem poderá receber novos pedidos. O histórico é mantido.`
            : `${statusDe?.nome} voltará a aparecer nas buscas e poderá receber novos pedidos.`
        }
        textoConfirmar={statusDe?.ativo ? 'Inativar' : 'Reativar'}
        perigo={statusDe?.ativo}
        carregando={alterandoStatus}
        aoConfirmar={confirmarStatus}
        aoCancelar={() => setStatusDe(null)}
      />
    </>
  );
}
