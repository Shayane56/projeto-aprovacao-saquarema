import { AlertOctagon, AlertTriangle, ArrowRight, CheckCircle2, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { dataCurta } from '@/lib/datas';
import type { Recuperacao, StatusAtraso } from './cronograma';

const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export const horas = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}h${min % 60 ? String(min % 60).padStart(2, '0') : ''}` : `${min} min`);

/** "qui, 13/11" (ou "hoje" / "amanhã"). */
export function diaCurto(data: string, hoje?: string): string {
  if (hoje && data === hoje) return 'hoje';
  if (hoje) {
    const amanha = new Date(`${hoje}T12:00:00Z`);
    amanha.setUTCDate(amanha.getUTCDate() + 1);
    if (amanha.toISOString().slice(0, 10) === data) return 'amanhã';
  }
  return `${DIAS_CURTOS[new Date(`${data}T12:00:00Z`).getUTCDay()]}, ${dataCurta(data)}`;
}

export const ESTILO_STATUS: Record<StatusAtraso, { icone: LucideIcon; rotulo: string; caixa: string; cor: string; chip: string }> = {
  em_dia: { icone: CheckCircle2, rotulo: 'Em dia', caixa: 'border-sucesso/35 bg-sucesso/10', cor: 'text-sucesso', chip: 'bg-sucesso/15 text-sucesso' },
  leve: { icone: AlertTriangle, rotulo: 'Atrasos leves', caixa: 'border-alerta/40 bg-alerta/10', cor: 'text-alerta', chip: 'bg-alerta/15 text-alerta' },
  atencao: { icone: AlertOctagon, rotulo: 'Atenção', caixa: 'border-perigo/40 bg-perigo/10', cor: 'text-perigo', chip: 'bg-perigo/15 text-perigo' },
};

export function ChipStatus({ status }: { status: StatusAtraso }) {
  const e = ESTILO_STATUS[status];
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold', e.chip)}>
      <e.icone className="h-3.5 w-3.5" aria-hidden /> {e.rotulo}
    </span>
  );
}

/** Frase com a previsão de quando a pessoa fica em dia. */
export function textoPrevisao(r: Recuperacao, margem: number, hoje: string): string {
  if (r.status === 'em_dia') return '';
  if (r.previsao === null) return `No ritmo de ${margem} min por dia, os atrasos não zeram antes da semana final (${dataCurta(r.inicioSemanaFinal)}).`;
  if (r.previsao === hoje) return 'Dá para zerar tudo hoje, na recuperação do dia.';
  return `Recuperando até ${margem} min por dia, você fica em dia ${r.previsao === hoje ? 'hoje' : `até ${diaCurto(r.previsao, hoje)}`}.`;
}

/** Cartão de status no Início: verde (em dia), amarelo (atrasos leves) ou vermelho (atenção). */
export function CartaoStatusAtrasos({ recuperacao: r, margem, hoje }: { recuperacao: Recuperacao; margem: number; hoje: string }) {
  const e = ESTILO_STATUS[r.status];
  const tarefas = r.atrasos.length;
  return (
    <section className={cn('rounded-2xl border p-4', e.caixa)} aria-labelledby="titulo-status-atrasos" role="status">
      <div className="flex items-start gap-3">
        <e.icone className={cn('mt-0.5 h-6 w-6 shrink-0', e.cor)} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className={cn('text-xs font-bold uppercase tracking-wide', e.cor)}>{e.rotulo}</p>
          {r.status === 'em_dia' ? (
            <>
              <h2 id="titulo-status-atrasos" className="mt-0.5 font-semibold">Você está em dia com o cronograma</h2>
              <p className="mt-1 text-sm text-suave">
                {r.recuperadas.quantidade > 0
                  ? `Você já recuperou ${horas(r.recuperadas.minutos)} de atrasos. Continue assim! 🎉`
                  : `Nenhuma tarefa atrasada. Os ${margem} min de margem de hoje viram reforço.`}
              </p>
            </>
          ) : (
            <>
              <h2 id="titulo-status-atrasos" className="mt-0.5 font-semibold">
                Você tem {tarefas} {tarefas === 1 ? 'tarefa atrasada' : 'tarefas atrasadas'} ({horas(r.minutosPendentes)})
              </h2>
              <p className="mt-1 text-sm">{textoPrevisao(r, margem, hoje)}</p>
              {r.hoje[0] && <p className="mt-1 truncate text-sm text-suave">Hoje: {r.hoje[0].sessao.titulo}</p>}
              {r.status === 'atencao' && <p className="mt-1 text-sm text-suave">Veja as opções para ajustar no plano de recuperação.</p>}
            </>
          )}
          <Link to={r.status === 'em_dia' ? '/plano' : '/plano#recuperacao'} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primaria hover:underline">
            {r.status === 'em_dia' ? 'Ver o plano de hoje' : 'Ver plano de recuperação'} <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
