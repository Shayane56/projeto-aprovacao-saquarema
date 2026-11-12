import { Check } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthProvider';
import { cn } from '@/lib/cn';
import { dataCurta, diaMes } from '@/lib/datas';
import { descreverPrazo, type EtapaComSituacao } from './etapas';
import { useMarcarEtapa } from './hooks';

const estiloSituacao = {
  encerrada: 'text-suave',
  em_andamento: 'text-sucesso',
  hoje: 'text-perigo',
  proxima: 'text-alerta',
  futura: 'text-suave',
  sem_data: 'text-suave',
} as const;

export function ItemEtapa({ etapa, concluida, compacto }: { etapa: EtapaComSituacao; concluida: boolean; compacto?: boolean }) {
  const { usuario } = useAuth();
  const marcar = useMarcarEtapa();
  const passada = etapa.situacao === 'encerrada';
  const data = etapa.data_inicio ? diaMes(etapa.data_inicio) : null;

  return (
    <div className={cn('flex items-start gap-3', passada && !compacto && 'opacity-60')}>
      <div className={cn(
        'flex w-12 shrink-0 flex-col items-center rounded-xl border py-1.5 leading-none',
        etapa.categoria === 'prova' ? 'border-primaria bg-primaria text-primaria-texto' : 'border-borda bg-superficie-2',
      )}>
        {data ? (
          <>
            <span className="text-lg font-bold">{data.dia}</span>
            <span className="mt-0.5 text-[11px] font-medium uppercase">{data.mes}</span>
          </>
        ) : (
          <span className="py-1.5 text-xs font-semibold">—</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn('font-medium leading-snug', concluida && 'text-suave line-through')}>{etapa.titulo}</p>
        <p className="mt-0.5 text-xs">
          {etapa.data_fim && etapa.data_inicio && (
            <span className="text-suave">{dataCurta(etapa.data_inicio)} a {dataCurta(etapa.data_fim)} · </span>
          )}
          <span className={cn('font-semibold', estiloSituacao[etapa.situacao])}>{descreverPrazo(etapa)}</span>
        </p>
        {!compacto && etapa.descricao && <p className="mt-1 text-sm text-suave">{etapa.descricao}</p>}
      </div>
      {etapa.acao && usuario && (
        <button
          type="button"
          onClick={() => marcar.mutate({ userId: usuario.id, etapaId: etapa.id, concluida: !concluida })}
          aria-pressed={concluida}
          aria-label={concluida ? `Desmarcar “${etapa.titulo}”` : `Marcar “${etapa.titulo}” como feito`}
          className={cn(
            'flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors',
            concluida ? 'border-sucesso/40 bg-sucesso/15 text-sucesso' : 'border-borda bg-superficie text-suave hover:text-texto',
          )}
        >
          <Check className="h-4 w-4" aria-hidden /> {concluida ? 'Feito' : 'Fazer'}
        </button>
      )}
    </div>
  );
}
