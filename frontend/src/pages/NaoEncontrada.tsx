import { Link } from 'react-router-dom';

export function NaoEncontrada() {
  return (
    <div className="vazio">
      <h2>Página não encontrada</h2>
      <Link to="/" className="botao botao-secundario">Voltar ao início</Link>
    </div>
  );
}
