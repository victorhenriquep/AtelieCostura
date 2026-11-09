import { Link } from 'react-router-dom';

export function AcessoNegado() {
  return (
    <div className="vazio">
      <h2>Acesso não permitido</h2>
      <p>Seu perfil não tem permissão para acessar esta tela.</p>
      <Link to="/" className="botao botao-secundario">Voltar ao início</Link>
    </div>
  );
}
