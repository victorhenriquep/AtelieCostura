import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '../../api';
import { Campo } from '../../components/Campo';
import { Modal } from '../../components/Modal';
import type { Funcionario, FuncionarioInput, Perfil } from '../../types';

interface Props {
  aberto: boolean;
  funcionario: Funcionario | null; // null = novo
  aoFechar(): void;
  aoSalvar(funcionario: Funcionario, novo: boolean): void;
}

const VAZIO: FuncionarioInput = { nome: '', email: '', perfil: 'Visualizador', senha: '' };
type Erros = Partial<Record<keyof FuncionarioInput, string>>;

function validar(d: FuncionarioInput, novo: boolean): Erros {
  const erros: Erros = {};
  if (!d.nome.trim()) erros.nome = 'Informe o nome.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) erros.email = 'Informe um e-mail válido.';
  if (novo && !d.senha) erros.senha = 'Informe a senha.';
  if (d.senha && d.senha.length < 6) erros.senha = 'Mínimo de 6 caracteres.';
  return erros;
}

export function FuncionarioFormModal({ aberto, funcionario, aoFechar, aoSalvar }: Props) {
  const [dados, setDados] = useState<FuncionarioInput>(VAZIO);
  const [erros, setErros] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const novo = !funcionario;

  useEffect(() => {
    if (!aberto) return;
    setDados(funcionario ? { nome: funcionario.nome, email: funcionario.email, perfil: funcionario.perfil, senha: '' } : VAZIO);
    setErros({});
    setErroGeral(null);
  }, [aberto, funcionario]);

  function alterar<K extends keyof FuncionarioInput>(campo: K, valor: FuncionarioInput[K]) {
    setDados((d) => ({ ...d, [campo]: valor }));
    if (erros[campo]) setErros((e) => ({ ...e, [campo]: undefined }));
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const encontrados = validar(dados, novo);
    setErros(encontrados);
    if (Object.keys(encontrados).length > 0) return;

    setSalvando(true);
    setErroGeral(null);
    try {
      const salvo = funcionario ? await api.funcionarios.atualizar(funcionario.id, dados) : await api.funcionarios.criar(dados);
      aoSalvar(salvo, novo);
    } catch (ex) {
      setErroGeral(ex instanceof ApiError ? ex.message : 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      aberto={aberto}
      titulo={novo ? 'Novo funcionário' : 'Editar funcionário'}
      aoFechar={aoFechar}
      rodape={
        <>
          <button type="button" className="botao botao-secundario" onClick={aoFechar} disabled={salvando}>Cancelar</button>
          <button type="submit" form="form-funcionario" className="botao botao-primario" disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </>
      }
    >
      <form id="form-funcionario" className="grade-form" onSubmit={salvar} noValidate autoComplete="off">
        <Campo rotulo="Nome *" erro={erros.nome} largo>
          <input value={dados.nome} onChange={(e) => alterar('nome', e.target.value)} maxLength={150} autoFocus />
        </Campo>
        <Campo rotulo="E-mail (usado no login) *" erro={erros.email} largo>
          <input type="email" value={dados.email} onChange={(e) => alterar('email', e.target.value)} maxLength={150} />
        </Campo>
        <Campo rotulo="Perfil *" dica={dados.perfil === 'Administrador' ? 'Acesso a todas as telas.' : 'Somente consulta pedidos e clientes.'}>
          <select value={dados.perfil} onChange={(e) => alterar('perfil', e.target.value as Perfil)}>
            <option value="Visualizador">Visualizador</option>
            <option value="Administrador">Administrador</option>
          </select>
        </Campo>
        <Campo rotulo={novo ? 'Senha *' : 'Nova senha'} erro={erros.senha} dica={novo ? 'Mínimo de 6 caracteres.' : 'Deixe em branco para manter a atual.'}>
          <input type="password" value={dados.senha} onChange={(e) => alterar('senha', e.target.value)} autoComplete="new-password" />
        </Campo>
        {erroGeral && <p className="mensagem-erro largo" role="alert">{erroGeral}</p>}
      </form>
    </Modal>
  );
}
