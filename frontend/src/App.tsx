import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { RequerLogin, RequerPermissao } from './auth/guards';
import { AvisosProvider } from './components/Avisos';
import { AppLayout } from './layout/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { InicioPage } from './pages/InicioPage';
import { NaoEncontrada } from './pages/NaoEncontrada';
import { ClientesPage } from './pages/clientes/ClientesPage';
import { ServicosPage } from './pages/servicos/ServicosPage';
import { FuncionariosPage } from './pages/funcionarios/FuncionariosPage';
import { PedidosPage } from './pages/pedidos/PedidosPage';
import { RecebimentosPage } from './pages/financeiro/RecebimentosPage';
import { PagamentosPage } from './pages/financeiro/PagamentosPage';
import { FluxoCaixaPage } from './pages/financeiro/FluxoCaixaPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AvisosProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            {/* Tudo daqui para baixo exige login */}
            <Route element={<RequerLogin />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<InicioPage />} />
                <Route path="/pedidos" element={<RequerPermissao recurso="pedidos"><PedidosPage /></RequerPermissao>} />
                <Route path="/clientes" element={<RequerPermissao recurso="clientes"><ClientesPage /></RequerPermissao>} />
                <Route path="/servicos" element={<RequerPermissao recurso="servicos"><ServicosPage /></RequerPermissao>} />
                <Route path="/funcionarios" element={<RequerPermissao recurso="funcionarios"><FuncionariosPage /></RequerPermissao>} />
                <Route path="/recebimentos" element={<RequerPermissao recurso="financeiro"><RecebimentosPage /></RequerPermissao>} />
                <Route path="/pagamentos" element={<RequerPermissao recurso="financeiro"><PagamentosPage /></RequerPermissao>} />
                <Route path="/fluxo-caixa" element={<RequerPermissao recurso="financeiro"><FluxoCaixaPage /></RequerPermissao>} />
                <Route path="*" element={<NaoEncontrada />} />
              </Route>
            </Route>
          </Routes>
        </AvisosProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
