import { Navigate, Route, Routes } from 'react-router-dom';
import { EntrarPage } from '@/features/auth/EntrarPage';
import { RedefinirSenhaPage } from '@/features/auth/RedefinirSenhaPage';
import { RotaProtegida } from '@/features/auth/RotaProtegida';
import { ConcursoPage } from '@/features/concurso/ConcursoPage';
import { AjustesPage } from '@/features/configuracoes/AjustesPage';
import { EditalPage } from '@/features/edital/EditalPage';
import { InicioPage } from '@/features/inicio/InicioPage';
import { ErrosPage } from '@/features/erros/ErrosPage';
import { ImportarPage } from '@/features/importar/ImportarPage';
import { NovaQuestaoPage } from '@/features/importar/NovaQuestaoPage';
import { PraticarPage } from '@/features/questoes/PraticarPage';
import { TreinoPage } from '@/features/questoes/TreinoPage';
import { SimuladoPage } from '@/features/simulados/SimuladoPage';
import { SimuladosPage } from '@/features/simulados/SimuladosPage';
import { AppLayout } from './layout/AppLayout';

export function Rotas() {
  return (
    <Routes>
      <Route path="/entrar" element={<EntrarPage />} />
      <Route path="/redefinir-senha" element={<RedefinirSenhaPage />} />
      <Route element={<RotaProtegida />}>
        {/* Simulado em tela cheia, sem o menu, para evitar saídas acidentais. */}
        <Route path="/simulado/:id" element={<SimuladoPage />} />
        <Route element={<AppLayout />}>
          <Route index element={<InicioPage />} />
          <Route path="/edital" element={<EditalPage />} />
          <Route path="/praticar" element={<PraticarPage />} />
          <Route path="/praticar/questoes" element={<TreinoPage />} />
          <Route path="/praticar/simulados" element={<SimuladosPage />} />
          <Route path="/praticar/erros" element={<ErrosPage />} />
          <Route path="/praticar/importar" element={<ImportarPage />} />
          <Route path="/praticar/nova" element={<NovaQuestaoPage />} />
          <Route path="/concurso" element={<ConcursoPage />} />
          <Route path="/ajustes" element={<AjustesPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
