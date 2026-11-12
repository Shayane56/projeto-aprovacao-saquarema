import { AlertTriangle, BookOpen, CalendarClock, Check, ChevronDown, ClipboardList, Layers, ListChecks, Repeat, Settings2, Timer, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { useDefinirStatus, useProgresso } from '@/features/edital/hooks';
import { usePreferencias, useSalvarPreferencias, type PreferenciasEstudo } from '@/features/perfil/preferencias';
import { cn } from '@/lib/cn';
import { dataCurta, diasEntre } from '@/lib/datas';
import { Aviso, BarraProgresso, Botao, Carregando, ErroCarga } from '@/shared/ui';
import type { DiaPlano, SessaoPlano, TipoSessao } from './gerador';
import { somarDias } from './gerador';
import { useAlternarSessao, usePlano, useSessoes } from './hooks';

const ICONES: Record<TipoSessao, LucideIcon> = {
  teoria: BookOpen, questoes: ListChecks, revisao: Repeat, flashcards: Layers, simulado: Timer, erros: ClipboardList,
};
const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const horas = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}h${min % 60 ? String(min % 60).padStart(2, '0') : ''}` : `${min} min`);

export function PlanoPage() {
  const { plano, hoje, carregando, erro } = usePlano();
  const sessoes = useSessoes();
  const [ajustes, setAjustes] = useState(false);

  if (carregando || sessoes.isPending) return <Carregando texto="Montando seu plano…" />;
  if (!plano || !sessoes.data) return <ErroCarga erro={erro ?? sessoes.error} />;

  const diaHoje = plano.dias.find((d) => d.data === hoje);
  const proximos = plano.dias.filter((d) => d.data > hoje).slice(0, 7);
  const prova = plano.dias.at(-1);
  const faltam = prova ? diasEntre(hoje, prova.data) : 0;
  const ultimaSemana = sessoes.data.filter((s) => s.data > somarDias(hoje, -7));
  const minutosSemana = ultimaSemana.reduce((s, x) => s + x.minutos, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Plano de estudos</h1>
          <p className="mt-1 text-sm text-suave">
            {faltam} dias até a prova · {horas(plano.minutosPlanejados)} planejadas · {horas(minutosSemana)} estudadas nos últimos 7 dias
          </p>
        </div>
        <Botao variante="secundario" pequeno onClick={() => setAjustes((a) => !a)} aria-expanded={ajustes}>
          <Settings2 className="h-4 w-4" aria-hidden /> Disponibilidade
        </Botao>
      </div>

      {ajustes && <Disponibilidade aoFechar={() => setAjustes(false)} />}

      {plano.minutosPendentes > 0 && (
        <Aviso tipo="alerta">
          <strong>O tempo disponível não cobre todo o edital.</strong> Ficaram de fora cerca de {horas(plano.minutosPendentes)} de estudo
          ({plano.pendentes.length} tarefas, as de menor peso na prova). Aumente sua disponibilidade em <strong>Disponibilidade</strong> ou marque no edital os tópicos que você já domina.
        </Aviso>
      )}

      {diaHoje ? <CartaoHoje dia={diaHoje} concluidas={sessoes.data.filter((s) => s.data === hoje)} /> : (
        <div className="cartao p-6 text-center text-sm text-suave">A prova já passou. Boa sorte no resultado! 🍀</div>
      )}

      {proximos.length > 0 && (
        <section aria-labelledby="titulo-proximos">
          <h2 id="titulo-proximos" className="mb-2 font-semibold">Próximos dias</h2>
          <div className="space-y-2">{proximos.map((d) => <DiaResumo key={d.data} dia={d} />)}</div>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <Link to="/concurso" className="inline-flex items-center gap-1.5 font-medium text-primaria hover:underline"><CalendarClock className="h-4 w-4" aria-hidden /> Cronograma do concurso</Link>
        {plano.fimDaTeoria && <span className="text-suave">Teoria de todo o edital prevista até {dataCurta(plano.fimDaTeoria, true)}</span>}
      </div>
      <p className="text-xs text-suave">
        O plano é recalculado todos os dias a partir do seu progresso no edital, do seu desempenho nas questões e da sua disponibilidade —
        se um dia não der, nada fica “atrasado”: o restante é redistribuído. A última semana é só revisão e simulados.
      </p>
    </div>
  );
}

function CartaoHoje({ dia, concluidas }: { dia: DiaPlano; concluidas: { chave: string; titulo: string; tipo: TipoSessao; minutos: number }[] }) {
  const { usuario } = useAuth();
  const alternar = useAlternarSessao();
  const progresso = useProgresso();
  const definirStatus = useDefinirStatus();
  const feitas = new Set(concluidas.map((s) => s.chave));
  // Sessões concluídas hoje que saíram do plano recalculado continuam aparecendo.
  const extras = concluidas.filter((c) => !dia.sessoes.some((s) => s.chave === c.chave));
  const total = dia.sessoes.reduce((s, x) => s + x.minutos, 0) + extras.reduce((s, x) => s + x.minutos, 0);
  const feito = concluidas.reduce((s, x) => s + x.minutos, 0);

  function alternarSessao(s: SessaoPlano, concluir: boolean) {
    if (!usuario) return;
    alternar.mutate({ userId: usuario.id, concluir, sessao: { chave: s.chave, data: dia.data, tipo: s.tipo, disciplina_id: s.disciplina_id, topico_id: s.topico_id, titulo: s.titulo, minutos: s.minutos } });
    // Concluir a teoria de um tópico avança o status no edital (nunca volta).
    const status = s.topico_id ? progresso.data?.[s.topico_id] ?? 'nao_iniciado' : null;
    if (concluir && s.tipo === 'teoria' && s.topico_id && (status === 'nao_iniciado' || status === 'estudando')) {
      definirStatus.mutate({ userId: usuario.id, topicoId: s.topico_id, status: 'revisando' });
    }
  }

  return (
    <section className="cartao p-5" aria-labelledby="titulo-hoje">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="titulo-hoje" className="text-lg font-semibold">Hoje · {DIAS[dia.diaSemana]}</h2>
        <span className="text-sm text-suave">{horas(feito)} de {horas(total)}</span>
      </div>
      <BarraProgresso valor={total ? feito / total : 0} className="mt-2" rotulo="Progresso de hoje" />
      {dia.fase === 'folga' ? (
        <p className="mt-4 text-sm text-suave">Dia de folga na sua disponibilidade. Descansar também faz parte! 😌</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {dia.sessoes.map((s) => <ItemSessao key={s.chave} sessao={s} feita={feitas.has(s.chave)} aoAlternar={(c) => alternarSessao(s, c)} />)}
          {extras.map((c) => (
            <li key={c.chave} className="flex items-center gap-3 rounded-xl border border-borda p-3 opacity-70">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sucesso text-white"><Check className="h-4 w-4" aria-hidden /></span>
              <span className="min-w-0 flex-1 text-sm line-through">{c.titulo}</span>
              <span className="text-xs text-suave">{c.minutos} min</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ItemSessao({ sessao: s, feita, aoAlternar }: { sessao: SessaoPlano; feita: boolean; aoAlternar: (concluir: boolean) => void }) {
  const Icone = ICONES[s.tipo];
  return (
    <li className={cn('flex items-start gap-3 rounded-xl border p-3', feita ? 'border-sucesso/30 bg-sucesso/5' : 'border-borda')}>
      <button
        type="button"
        onClick={() => aoAlternar(!feita)}
        aria-pressed={feita}
        aria-label={feita ? `Desmarcar “${s.titulo}”` : `Concluir “${s.titulo}”`}
        className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border', feita ? 'border-sucesso bg-sucesso text-white' : 'border-borda hover:border-primaria')}
      >
        {feita && <Check className="h-4 w-4" aria-hidden />}
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn('flex items-start gap-1.5 text-[15px] font-medium leading-snug', feita && 'text-suave line-through')}>
          <Icone className="mt-0.5 h-4 w-4 shrink-0 text-primaria" aria-hidden /> <span className="min-w-0">{s.titulo}</span>
        </p>
        <p className="mt-0.5 text-xs text-suave">{s.minutos ? `${s.minutos} min · ` : ''}{s.detalhe}</p>
      </div>
      {!feita && s.link && (
        <Link to={s.link} className="shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-primaria hover:bg-primaria-suave">Abrir</Link>
      )}
    </li>
  );
}

function DiaResumo({ dia }: { dia: DiaPlano }) {
  const [aberto, setAberto] = useState(false);
  const total = dia.sessoes.reduce((s, x) => s + x.minutos, 0);
  const rotuloFase = dia.fase === 'prova' ? 'Dia da prova' : dia.fase === 'vespera' ? 'Véspera — leve' : dia.fase === 'revisao_final' ? 'Semana final' : dia.fase === 'folga' ? 'Folga' : `${dia.sessoes.length} sessões · ${horas(total)}`;
  return (
    <div className="cartao overflow-hidden">
      <button type="button" onClick={() => setAberto((a) => !a)} aria-expanded={aberto} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className="w-24 shrink-0 text-sm font-semibold">{DIAS[dia.diaSemana].slice(0, 3)} {dataCurta(dia.data)}</span>
        <span className={cn('min-w-0 flex-1 truncate text-sm', dia.fase === 'prova' ? 'font-semibold text-primaria' : 'text-suave')}>{rotuloFase}</span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-suave transition-transform', aberto && 'rotate-180')} aria-hidden />
      </button>
      {aberto && (
        <ul className="space-y-1.5 border-t border-borda px-4 py-3 text-sm">
          {dia.sessoes.length === 0 && <li className="text-suave">Sem estudo planejado.</li>}
          {dia.sessoes.map((s) => {
            const Icone = ICONES[s.tipo];
            return (
              <li key={s.chave} className="flex items-start gap-2">
                <Icone className="mt-0.5 h-4 w-4 shrink-0 text-primaria" aria-hidden />
                <span className="min-w-0 flex-1">{s.titulo}</span>
                {s.minutos > 0 && <span className="shrink-0 text-xs text-suave">{s.minutos} min</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const OPCOES_MIN = [0, 30, 45, 60, 90, 120, 150, 180, 240, 300, 360, 420, 480];

function Disponibilidade({ aoFechar }: { aoFechar: () => void }) {
  const { estudo } = usePreferencias();
  const salvar = useSalvarPreferencias();
  const [p, setP] = useState<PreferenciasEstudo>(estudo);
  const semana = p.minutosPorDia.reduce((s, m) => s + m, 0);

  return (
    <section className="cartao space-y-4 p-5" aria-labelledby="titulo-disp">
      <div>
        <h2 id="titulo-disp" className="font-semibold">Quanto tempo você tem para estudar?</h2>
        <p className="mt-1 text-sm text-suave">Total: {horas(semana)} por semana. O plano se ajusta na hora.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {DIAS.map((nome, i) => (
          <label key={nome} className="text-sm">
            <span className="font-medium">{nome}</span>
            <select className="campo mt-1" value={p.minutosPorDia[i]} onChange={(e) => setP({ ...p, minutosPorDia: p.minutosPorDia.map((m, j) => (j === i ? Number(e.target.value) : m)) })}>
              {OPCOES_MIN.map((m) => <option key={m} value={m}>{m ? horas(m) : 'Folga'}</option>)}
            </select>
          </label>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="font-medium">Dia do simulado semanal</span>
          <select className="campo mt-1" value={p.diaSimulado} onChange={(e) => setP({ ...p, diaSimulado: Number(e.target.value) })}>
            {DIAS.map((nome, i) => <option key={nome} value={i}>{nome}</option>)}
          </select>
          <span className="mt-1 block text-xs text-suave">Nas 6 últimas semanas vira simulado completo (3h) se houver tempo.</span>
        </label>
        <label className="text-sm">
          <span className="font-medium">Flashcards novos por dia</span>
          <select className="campo mt-1" value={p.novosPorDia} onChange={(e) => setP({ ...p, novosPorDia: Number(e.target.value) })}>
            {[0, 5, 10, 15, 20, 30, 40].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>
      {semana < 300 && <p className="flex items-center gap-1.5 text-xs text-alerta"><AlertTriangle className="h-3.5 w-3.5" aria-hidden /> Com menos de 5h por semana, dificilmente o edital todo cabe até a prova.</p>}
      <div className="flex gap-2">
        <Botao onClick={() => { salvar.mutate(p); aoFechar(); }} carregando={salvar.isPending}>Salvar</Botao>
        <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
      </div>
    </section>
  );
}
