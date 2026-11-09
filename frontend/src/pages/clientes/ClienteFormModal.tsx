import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { api, ApiError } from '../../api';
import { Modal } from '../../components/Modal';
import type { Cliente, ClienteInput } from '../../types';
import { formatarCpf, formatarTelefone, soDigitos } from '../../utils/formatos';

interface Props {
  aberto: boolean;
  /** null = novo cliente; preenchido = edição */
  cliente: Cliente | null;
  /** true = só mostra os dados (perfil Visualizador) */
  somenteLeitura?: boolean;
  aoFechar(): void;
  aoSalvar(cliente: Cliente, novo: boolean): void;
}

const VAZIO: ClienteInput = { nome: '', telefone: '', email: '', cpf: '', endereco: '', observacoes: '' };

type Erros = Partial<Record<keyof ClienteInput, string>>;

function validar(d: ClienteInput): Erros {
  const erros: Erros = {};
  if (!d.nome.trim()) erros.nome = 'Informe o nome.';
  const tel = soDigitos(d.telefone);
  if (tel.length < 10) erros.telefone = 'Informe o telefone com DDD.';
  if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) erros.email = 'E-mail inválido.';
  const cpf = soDigitos(d.cpf);
  if (cpf && cpf.length !== 11) erros.cpf = 'O CPF deve ter 11 dígitos.';
  return erros;
}

export function ClienteFormModal({ aberto, cliente, somenteLeitura = false, aoFechar, aoSalvar }: Props) {
  const [dados, setDados] = useState<ClienteInput>(VAZIO);
  const [erros, setErros] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Ao abrir, carrega os dados do cliente (edição) ou limpa (novo).
  useEffect(() => {
    if (!aberto) return;
    setDados(
      cliente
        ? {
            nome: cliente.nome,
            telefone: formatarTelefone(cliente.telefone),
            email: cliente.email,
            cpf: formatarCpf(cliente.cpf),
            endereco: cliente.endereco,
            observacoes: cliente.observacoes,
          }
        : VAZIO,
    );
    setErros({});
    setErroGeral(null);
  }, [aberto, cliente]);

  function alterar<K extends keyof ClienteInput>(campo: K, valor: string) {
    setDados((d) => ({ ...d, [campo]: valor }));
    if (erros[campo]) setErros((e) => ({ ...e, [campo]: undefined }));
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const encontrados = validar(dados);
    setErros(encontrados);
    if (Object.keys(encontrados).length > 0) return;

    // Envia só os dígitos de telefone e CPF
    const payload: ClienteInput = { ...dados, telefone: soDigitos(dados.telefone), cpf: soDigitos(dados.cpf) };

    setSalvando(true);
    setErroGeral(null);
    try {
      const salvo = cliente ? await api.clientes.atualizar(cliente.id, payload) : await api.clientes.criar(payload);
      aoSalvar(salvo, !cliente);
    } catch (ex) {
      setErroGeral(ex instanceof ApiError ? ex.message : 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      aberto={aberto}
      titulo={somenteLeitura ? 'Dados do cliente' : cliente ? 'Editar cliente' : 'Novo cliente'}
      aoFechar={aoFechar}
      rodape={somenteLeitura ? (
        <button type="button" className="botao botao-secundario" onClick={aoFechar}>Fechar</button>
      ) : (
        <>
          <button type="button" className="botao botao-secundario" onClick={aoFechar} disabled={salvando}>Cancelar</button>
          <button type="submit" form="form-cliente" className="botao botao-primario" disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </>
      )}
    >
      <form id="form-cliente" className="grade-form" onSubmit={salvar} noValidate>
        {/* fieldset desabilitado = todos os campos ficam somente leitura */}
        <fieldset className="grade-form campos-agrupados largo" disabled={somenteLeitura}>
        <Campo rotulo="Nome *" erro={erros.nome} largo>
          <input value={dados.nome} onChange={(e) => alterar('nome', e.target.value)} maxLength={150} autoFocus={!somenteLeitura} />
        </Campo>
        <Campo rotulo="Telefone *" erro={erros.telefone}>
          <input value={dados.telefone} inputMode="tel" placeholder="(31) 99999-9999"
            onChange={(e) => alterar('telefone', formatarTelefone(e.target.value))} />
        </Campo>
        <Campo rotulo="CPF" erro={erros.cpf}>
          <input value={dados.cpf} inputMode="numeric" placeholder="000.000.000-00"
            onChange={(e) => alterar('cpf', formatarCpf(e.target.value))} />
        </Campo>
        <Campo rotulo="E-mail" erro={erros.email} largo>
          <input type="email" value={dados.email} onChange={(e) => alterar('email', e.target.value)} maxLength={150} />
        </Campo>
        <Campo rotulo="Endereço" largo>
          <input value={dados.endereco} onChange={(e) => alterar('endereco', e.target.value)} maxLength={250} />
        </Campo>
        <Campo rotulo="Observações" largo>
          <textarea rows={3} value={dados.observacoes} onChange={(e) => alterar('observacoes', e.target.value)} maxLength={500} />
        </Campo>
        </fieldset>
        {erroGeral && <p className="mensagem-erro largo" role="alert">{erroGeral}</p>}
      </form>
    </Modal>
  );
}

function Campo({ rotulo, erro, largo, children }: { rotulo: string; erro?: string; largo?: boolean; children: ReactNode }) {
  return (
    <label className={`campo ${largo ? 'largo' : ''} ${erro ? 'com-erro' : ''}`}>
      <span>{rotulo}</span>
      {children}
      {erro && <small className="erro-campo">{erro}</small>}
    </label>
  );
}
