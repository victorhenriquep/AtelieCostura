import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ApiError, usandoMock } from '../api';
import { IconeTesoura } from '../components/Icones';

export function LoginPage() {
  const { usuario, entrar } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const destino = (location.state as { de?: string } | null)?.de ?? '/';

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (usuario) return <Navigate to={destino} replace />;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!email.trim() || !senha) {
      setErro('Informe e-mail e senha.');
      return;
    }
    setEnviando(true);
    try {
      await entrar(email, senha);
      navigate(destino, { replace: true });
    } catch (ex) {
      setErro(ex instanceof ApiError ? ex.message : 'Não foi possível entrar.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="login-formulario">
      <form onSubmit={enviar} noValidate>
        <div className="login-marca">
          <span className="marca-icone"><IconeTesoura width={20} height={20} /></span>
          <span className="marca-nome">Ateliê</span>
        </div>

        <div>
          <h2>Entrar</h2>
        </div>

        <label className="campo">
          <span>E-mail</span>
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </label>

        <label className="campo">
          <span>Senha</span>
          <input type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
        </label>

        {erro && <p className="mensagem-erro" role="alert">{erro}</p>}

        <button type="submit" className="botao botao-primario botao-bloco" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>

        {usandoMock && (
          <div className="dica-mock">
            <strong>Usuários de teste (API simulada)</strong>
            <span>admin@atelie.com / admin123</span>
            <span>visualizador@atelie.com / visualizador123</span>
          </div>
        )}
      </form>
    </div>
  );
}
