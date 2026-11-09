import { useState, type ComponentType, type SVGProps } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import type { Recurso } from '../auth/permissoes';
import { usandoMock } from '../api';
import {
  IconeCaixa, IconeClientes, IconeFuncionarios, IconeInicio, IconeMenu, IconePagamentos, IconePedidos, IconeRecebimentos, IconeSair,
  IconeServicos, IconeTesoura,
} from '../components/Icones';

interface ItemMenu {
  rota: string;
  rotulo: string;
  icone: ComponentType<SVGProps<SVGSVGElement>>;
  recurso: Recurso;
  emBreve?: boolean;
}

// Itens do menu. "emBreve: true" mostra o item desabilitado (útil para telas ainda não feitas).
const ITENS: ItemMenu[] = [
  { rota: '/', rotulo: 'Início', icone: IconeInicio, recurso: 'dashboard' },
  { rota: '/pedidos', rotulo: 'Pedidos', icone: IconePedidos, recurso: 'pedidos' },
  { rota: '/recebimentos', rotulo: 'Recebimentos', icone: IconeRecebimentos, recurso: 'financeiro' },
  { rota: '/pagamentos', rotulo: 'Pagamentos', icone: IconePagamentos, recurso: 'financeiro' },
  { rota: '/fluxo-caixa', rotulo: 'Fluxo de caixa', icone: IconeCaixa, recurso: 'financeiro' },
  { rota: '/clientes', rotulo: 'Clientes', icone: IconeClientes, recurso: 'clientes' },
  { rota: '/servicos', rotulo: 'Serviços', icone: IconeServicos, recurso: 'servicos' },
  { rota: '/funcionarios', rotulo: 'Funcionários', icone: IconeFuncionarios, recurso: 'funcionarios' },
];

export function AppLayout() {
  const { usuario, sair, pode } = useAuth();
  const navigate = useNavigate();
  const [menuAberto, setMenuAberto] = useState(false);

  const itensVisiveis = ITENS.filter((i) => pode(i.recurso));
  const iniciais = (usuario?.nome ?? '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  function fazerLogout() {
    sair();
    navigate('/login', { replace: true });
  }

  return (
    <div className={`app ${menuAberto ? 'menu-aberto' : ''}`}>
      <aside className="lateral">
        <div className="marca">
          <span className="marca-icone"><IconeTesoura width={20} height={20} /></span>
          <span className="marca-nome">Ateliê</span>
        </div>

        <nav className="menu" aria-label="Menu principal">
          {itensVisiveis.map(({ rota, rotulo, icone: Icone, emBreve }) =>
            emBreve ? (
              <span key={rota} className="menu-item desabilitado" title="Em breve">
                <Icone /> <span>{rotulo}</span> <small className="em-breve">em breve</small>
              </span>
            ) : (
              <NavLink
                key={rota}
                to={rota}
                end={rota === '/'}
                className={({ isActive }) => `menu-item ${isActive ? 'ativo' : ''}`}
                onClick={() => setMenuAberto(false)}
              >
                <Icone /> <span>{rotulo}</span>
              </NavLink>
            ),
          )}
        </nav>

        <div className="usuario">
          <span className="avatar" aria-hidden="true">{iniciais}</span>
          <div className="usuario-info">
            <strong>{usuario?.nome}</strong>
            <small>{usuario?.perfil}</small>
          </div>
          <button type="button" className="botao-icone" onClick={fazerLogout} title="Sair" aria-label="Sair">
            <IconeSair />
          </button>
        </div>
      </aside>

      <div className="fundo-menu" onClick={() => setMenuAberto(false)} />

      <div className="conteudo">
        <header className="topo-mobile">
          <button type="button" className="botao-icone" onClick={() => setMenuAberto(true)} aria-label="Abrir menu">
            <IconeMenu />
          </button>
          <span className="marca-nome">Ateliê</span>
        </header>
        {usandoMock && (
          <div className="faixa-mock">Modo demonstração: usando API simulada (VITE_USE_MOCK=true)</div>
        )}
        <main className="pagina">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
