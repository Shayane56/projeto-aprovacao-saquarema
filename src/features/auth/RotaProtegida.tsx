import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { TelaCarregando } from '@/shared/ui/Estados';
import { useAuth } from './AuthProvider';

export function RotaProtegida() {
  const { usuario, carregando, recuperandoSenha } = useAuth();
  const local = useLocation();
  if (carregando) return <TelaCarregando />;
  if (!usuario) return <Navigate to="/entrar" replace state={{ de: local.pathname }} />;
  if (recuperandoSenha) return <Navigate to="/redefinir-senha" replace />;
  return <Outlet />;
}
