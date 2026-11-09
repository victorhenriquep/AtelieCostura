import { useEffect, useState } from 'react';
import { api, ApiError } from '../api';
import { Modal } from './Modal';
import type { LogAlteracao } from '../types';
import { formatarDataHora, formatarValorLog, rotuloCampo } from '../utils/formatos';

interface Props {
  /** Nome da entidade como o backend grava: "Cliente", "Servico", "Funcionario", "Pedido" */
  entidade: string;
  entidadeId: number | null;
  /** Texto exibido no cabeçalho, ex.: o nome do cliente */
  descricao: string;
  aoFechar(): void;
}

const ROTULO_ACAO: Record<LogAlteracao['acao'], string> = {
  Criacao: 'Cadastro',
  Alteracao: 'Alteração',
  Exclusao: 'Exclusão',
};

/**
 * Tela de histórico reutilizável: serve para Clientes, Serviços, Funcionários e Pedidos.
 * Basta passar a entidade e o id.
 */
export function HistoricoModal({ entidade, entidadeId, descricao, aoFechar }: Props) {
  const [logs, setLogs] = useState<LogAlteracao[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (entidadeId === null) return;
    let cancelado = false;
    setLogs(null);
    setErro(null);
    api.logs
      .listar(entidade, entidadeId)
      .then((r) => !cancelado && setLogs(r))
      .catch((e) => !cancelado && setErro(e instanceof ApiError ? e.message : 'Erro ao carregar o histórico.'));
    return () => {
      cancelado = true;
    };
  }, [entidade, entidadeId]);

  return (
    <Modal aberto={entidadeId !== null} titulo="Histórico de alterações" subtitulo={descricao} aoFechar={aoFechar} largura="larga">
      {erro && <p className="mensagem-erro">{erro}</p>}
      {!erro && logs === null && <p className="texto-suave">Carregando…</p>}
      {logs?.length === 0 && <p className="texto-suave">Nenhuma alteração registrada.</p>}
      {logs && logs.length > 0 && (
        <div className="tabela-rolagem">
          <table className="tabela tabela-compacta">
            <thead>
              <tr>
                <th>Data/hora</th>
                <th>Usuário</th>
                <th>Ação</th>
                <th>Campo</th>
                <th>Valor anterior</th>
                <th>Valor atual</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="sem-quebra">{formatarDataHora(l.dataHora)}</td>
                  <td>{l.usuarioNome}</td>
                  <td><span className={`etiqueta etiqueta-${l.acao.toLowerCase()}`}>{ROTULO_ACAO[l.acao]}</span></td>
                  <td>{rotuloCampo(l.campo)}</td>
                  <td className="valor-antigo">{l.acao === 'Alteracao' ? formatarValorLog(l.campo, l.valorAnterior) : '—'}</td>
                  <td className="valor-novo">{l.acao === 'Alteracao' ? formatarValorLog(l.campo, l.valorNovo) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
