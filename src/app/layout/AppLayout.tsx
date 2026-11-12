import { CloudOff } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { useOnline } from '@/shared/hooks/useOnline';
import { AvisoAtualizacao } from './AvisoAtualizacao';
import { Marca } from './Marca';
import { NAVEGACAO } from './navegacao';

function SeloOffline() {
  const online = useOnline();
  if (online) return null;
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-alerta/15 px-2.5 py-1 text-xs font-medium text-alerta" role="status">
      <CloudOff className="h-3.5 w-3.5" aria-hidden /> Offline — alterações serão enviadas depois
    </div>
  );
}

export function AppLayout() {
  return (
    <div className="min-h-dvh lg:pl-64">
      {/* Barra lateral (computador) */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-borda bg-superficie px-4 py-5 lg:flex">
        <Marca className="px-2" />
        <nav className="mt-8 flex flex-col gap-1" aria-label="Principal">
          {NAVEGACAO.map(({ para, rotulo, icone: Icone }) => (
            <NavLink
              key={para}
              to={para}
              end={para === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors',
                  isActive ? 'bg-primaria-suave text-primaria' : 'text-suave hover:bg-superficie-2 hover:text-texto',
                )
              }
            >
              <Icone className="h-5 w-5" aria-hidden /> {rotulo}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto px-2 text-xs text-suave">Edital nº 001/2026 · IBAM</div>
      </aside>

      {/* Topo (celular) */}
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-borda bg-superficie/90 px-4 pb-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] backdrop-blur lg:hidden">
        <Marca />
        <SeloOffline />
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-5 sm:px-6 lg:pb-12 lg:pt-8">
        <div className="mb-4 hidden justify-end lg:flex"><SeloOffline /></div>
        <Outlet />
      </main>

      {/* Navegação inferior (celular) */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-borda bg-superficie/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        aria-label="Principal"
      >
        {NAVEGACAO.map(({ para, rotulo, icone: Icone }) => (
          <NavLink
            key={para}
            to={para}
            end={para === '/'}
            className={({ isActive }) =>
              cn('flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium', isActive ? 'text-primaria' : 'text-suave')
            }
          >
            {({ isActive }) => (
              <>
                <span className={cn('rounded-full px-3.5 py-1 transition-colors', isActive && 'bg-primaria-suave')}>
                  <Icone className="h-5 w-5" aria-hidden />
                </span>
                {rotulo}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <AvisoAtualizacao />
    </div>
  );
}
