import { Navigate, Route, Routes } from 'react-router-dom';
import { EntrarPage } from '@/features/auth/EntrarPage';
import { RedefinirSenhaPage } from '@/features/auth/RedefinirSenhaPage';
import { RotaProtegida } from '@/features/auth/RotaProtegida';
import { ConcursoPage } from '@/features/concurso/ConcursoPage';
import { AjustesPage } from '@/features/configuracoes/AjustesPage';
import { EditalPage } from '@/features/edital/EditalPage';
import { InicioPage } from '@/features/inicio/InicioPage';
import { AppLayout } from './layout/AppLayout';

export function Rotas() {
  return (
    <Routes>
      <Route path="/entrar" element={<EntrarPage />} />
      <Route path="/redefinir-senha" element={<RedefinirSenhaPage />} />
      <Route element={<RotaProtegida />}>
        <Route element={<AppLayout />}>
          <Route index element={<InicioPage />} />
          <Route path="/edital" element={<EditalPage />} />
          <Route path="/concurso" element={<ConcursoPage />} />
          <Route path="/ajustes" element={<AjustesPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
