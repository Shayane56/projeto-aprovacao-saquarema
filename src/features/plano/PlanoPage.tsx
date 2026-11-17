import {
  AlertTriangle, BookOpen, CalendarCheck, CalendarClock, Check, ChevronDown, ClipboardList, Layers, ListChecks, Repeat, RotateCcw, Settings2, Timer, type LucideIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { useDefinirStatus, useProgresso } from '@/features/edital/hooks';
import { MARGENS_RECUPERACAO, usePreferencias, useSalvarPreferencias, type PreferenciasEstudo } from '@/features/perfil/preferencias';
import { cn } from '@/lib/cn';
import { dataCurta, dataLocal, diasEntre } from '@/lib/datas';
import { Aviso, BarraProgresso, Botao, Carregando, ErroCarga } from '@/shared/ui';
import type { SessaoConcluida } from './api';
import type { DiaRecuperacao, Recuperacao, TarefaAtrasada } from './cronograma';
import type { DiaPlano, SessaoPlano, TipoSessao } from './gerador';
import { somarDias } from './gerador';
import { useAlternarSessao, usePlano, useRefazerCronograma } from './hooks';
import { ChipStatus, diaCurto, horas, textoPrevisao } from './StatusAtrasos';

const ICONES: Record<TipoSessao, LucideIcon> = {
  teoria: BookOpen, questoes: ListChecks, revisao: Repeat, flashcards: Layers, simulado: Timer, erros: ClipboardList,
};
const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const dataEstudo = (c: SessaoConcluida) => (c.concluida_em ? dataLocal(new Date(c.concluida_em)) : c.data);
const soma = (lista: { minutos: number }[]) => lista.reduce((t, x) => t + x.minutos, 0);

export function PlanoPage() {
  const { plano, recuperacao, margemExtra, concluidas, puxadas, alternarPuxada, hoje, carregando, erro } = usePlano();
  const { estudo } = usePreferencias();
  const [ajustes, setAjustes] = useState(false);
  const location = useLocation();

  const pronto = Boolean(plano && recuperacao && concluidas);
  useEffect(() => {
    if (pronto && location.hash === '#recuperacao') document.getElementById('recuperacao')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [pronto, location.hash]);

  if (carregando) return <Carregando texto="Montando seu plano…" />;
  if (!plano || !recuperacao || !concluidas) return <ErroCarga erro={erro} />;

  const diaHoje = plano.dias.find((d) => d.data === hoje);
  const proximos = plano.dias.filter((d) => d.data > hoje).slice(0, 7);
  const porDia = new Map(recuperacao.plano.map((p) => [p.data, p]));
  const prova = plano.dias.at(-1);
  const faltam = prova ? diasEntre(hoje, prova.data) : 0;
  const minutosSemana = soma(concluidas.filter((s) => dataEstudo(s) > somarDias(hoje, -7)));
  const margem = estudo.margemRecuperacao;

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

      {diaHoje ? (
        <CartaoHoje dia={diaHoje} recuperacao={recuperacao} concluidas={concluidas} hoje={hoje} margemExtra={margemExtra} />
      ) : (
        <div className="cartao p-6 text-center text-sm text-suave">A prova já passou. Boa sorte no resultado! 🍀</div>
      )}

      {(recuperacao.atrasos.length > 0 || recuperacao.recuperadas.quantidade > 0) && (
        <PainelRecuperacao r={recuperacao} hoje={hoje} margem={margem} puxadas={puxadas} alternarPuxada={alternarPuxada} abrirAjustes={() => setAjustes(true)} />
      )}

      {proximos.length > 0 && (
        <section aria-labelledby="titulo-proximos">
          <h2 id="titulo-proximos" className="mb-2 font-semibold">Próximos dias</h2>
          <div className="space-y-2">{proximos.map((d) => <DiaResumo key={d.data} dia={d} recuperacao={porDia.get(d.data)} />)}</div>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <Link to="/concurso" className="inline-flex items-center gap-1.5 font-medium text-primaria hover:underline"><CalendarClock className="h-4 w-4" aria-hidden /> Cronograma do concurso</Link>
        {plano.fimDaTeoria && <span className="text-suave">Teoria de todo o edital prevista até {dataCurta(plano.fimDaTeoria, true)}</span>}
      </div>
      <p className="text-xs text-suave">
        Os próximos 7 dias ficam guardados no seu cronograma. O que passar do dia sem ser feito vira atraso e entra na recuperação,
        {margemExtra ? ` em até ${margem} min por dia além do seu tempo` : ` na margem de ${margem} min reservada em cada dia de estudo`} — o conteúdo novo continua entrando normalmente.
        Os dias mais distantes se ajustam ao seu progresso e desempenho. A última semana é só revisão e simulados.
      </p>
    </div>
  );
}

// ---------- Hoje: cronograma + recuperação ----------

function CartaoHoje({ dia, recuperacao: r, concluidas, hoje, margemExtra }: { dia: DiaPlano; recuperacao: Recuperacao; concluidas: SessaoConcluida[]; hoje: string; margemExtra: boolean }) {
  const { usuario } = useAuth();
  const alternar = useAlternarSessao();
  const progresso = useProgresso();
  const definirStatus = useDefinirStatus();
  const feitas = new Set(concluidas.map((s) => s.chave));
  const doDia = concluidas.filter((c) => c.data === hoje);
  const reforco: SessaoPlano | null = r.status === 'em_dia' && dia.margem > 0
    ? { chave: `${hoje}|reforco|geral`, tipo: 'erros', titulo: 'Reforço: refaça questões que você errou', detalhe: 'Sem atrasos: use a margem do dia no caderno de erros', minutos: dia.margem, disciplina_id: null, topico_id: null, link: '/praticar/erros' }
    : null;
  // Concluídas hoje que não estão no cronograma (nem são o reforço) continuam aparecendo.
  const extras = doDia.filter((c) => !dia.sessoes.some((s) => s.chave === c.chave) && c.chave !== reforco?.chave);
  // Atrasos recuperados hoje (concluídos hoje, de dias anteriores).
  const recuperadasHoje = concluidas.filter((c) => c.data < hoje && c.concluida_em && dataLocal(new Date(c.concluida_em)) === hoje);
  const pendentesRec = r.hoje.filter((t) => !feitas.has(t.sessao.chave));

  const minCronograma = soma(dia.sessoes) + soma(extras);
  const minRecuperacao = soma(pendentesRec.map((t) => t.sessao)) + soma(recuperadasHoje) + (reforco ? reforco.minutos : 0);
  const total = minCronograma + minRecuperacao;
  const feito = soma(doDia) + soma(recuperadasHoje);

  function alternarSessao(s: SessaoPlano, concluir: boolean, data: string) {
    if (!usuario) return;
    alternar.mutate({ userId: usuario.id, concluir, sessao: { chave: s.chave, data, tipo: s.tipo, disciplina_id: s.disciplina_id, topico_id: s.topico_id, titulo: s.titulo, minutos: s.minutos } });
    // Concluir a teoria de um tópico avança o status no edital (nunca volta).
    const status = s.topico_id ? progresso.data?.[s.topico_id] ?? 'nao_iniciado' : null;
    if (concluir && s.tipo === 'teoria' && s.topico_id && (status === 'nao_iniciado' || status === 'estudando')) {
      definirStatus.mutate({ userId: usuario.id, topicoId: s.topico_id, status: 'revisando' });
    }
  }
  const comoSessao = (c: SessaoConcluida): SessaoPlano => ({ chave: c.chave, tipo: c.tipo, titulo: c.titulo, detalhe: '', minutos: c.minutos, disciplina_id: c.disciplina_id, topico_id: c.topico_id, link: '' });

  return (
    <section className="cartao p-5" aria-labelledby="titulo-hoje">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="titulo-hoje" className="text-lg font-semibold">Hoje · {DIAS[dia.diaSemana]}</h2>
        <span className="text-sm text-suave">{horas(feito)} de {horas(total)}</span>
      </div>
      <BarraProgresso valor={total ? Math.min(1, feito / total) : 0} className="mt-2" rotulo="Progresso de hoje" />
      {dia.fase === 'folga' ? (
        <p className="mt-4 text-sm text-suave">Dia de folga na sua disponibilidade. Descansar também faz parte! 😌</p>
      ) : (
        <>
          <div className="mt-4">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold"><CalendarCheck className="h-4 w-4 text-primaria" aria-hidden /> Cronograma de hoje <span className="font-normal text-suave">· {horas(minCronograma)}</span></h3>
            <ul className="mt-2 space-y-2">
              {dia.sessoes.map((s) => <ItemSessao key={s.chave} sessao={s} feita={feitas.has(s.chave)} aoAlternar={(c) => alternarSessao(s, c, dia.data)} />)}
              {extras.map((c) => <ItemSessao key={c.chave} sessao={comoSessao(c)} feita aoAlternar={(v) => alternarSessao(comoSessao(c), v, c.data)} />)}
            </ul>
          </div>
          <div className="mt-5 border-t border-borda pt-4">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              <RotateCcw className="h-4 w-4 text-primaria" aria-hidden /> Recuperação
              <span className="font-normal text-suave">· {dia.margem ? `até ${dia.margem} min${margemExtra ? ' além do seu tempo' : ''}` : 'sem margem hoje'}</span>
            </h3>
            <ul className="mt-2 space-y-2">
              {pendentesRec.map((t) => (
                <ItemSessao key={t.sessao.chave} sessao={t.sessao} feita={false} etiqueta={`atrasada de ${diaCurto(t.origem)}`} aoAlternar={(c) => alternarSessao(t.sessao, c, t.origem)} />
              ))}
              {recuperadasHoje.map((c) => (
                <ItemSessao key={c.chave} sessao={comoSessao(c)} feita etiqueta={`recuperada (era de ${diaCurto(c.data)})`} aoAlternar={(v) => alternarSessao(comoSessao(c), v, c.data)} />
              ))}
              {reforco && <ItemSessao sessao={reforco} feita={feitas.has(reforco.chave)} aoAlternar={(c) => alternarSessao(reforco, c, hoje)} />}
            </ul>
            {!pendentesRec.length && !recuperadasHoje.length && !reforco && (
              <p className="mt-2 text-sm text-suave">
                {r.status === 'em_dia' ? 'Nada para recuperar hoje. 🎉' : 'Hoje não há margem de recuperação; os atrasos entram nos próximos dias de estudo.'}
              </p>
            )}
            {r.status === 'em_dia' && reforco && <p className="mt-2 text-xs text-suave">Você está em dia: a margem de hoje vira reforço.</p>}
          </div>
        </>
      )}
    </section>
  );
}

function ItemSessao({ sessao: s, feita, aoAlternar, etiqueta }: { sessao: SessaoPlano; feita: boolean; aoAlternar: (concluir: boolean) => void; etiqueta?: string }) {
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
        {etiqueta && <span className={cn('mt-1 inline-block rounded-md px-1.5 py-0.5 text-[11px] font-semibold', feita ? 'bg-sucesso/15 text-sucesso' : 'bg-alerta/15 text-alerta')}>{etiqueta}</span>}
        {s.detalhe || s.minutos ? <p className="mt-0.5 text-xs text-suave">{s.minutos ? `${s.minutos} min` : ''}{s.minutos && s.detalhe ? ' · ' : ''}{s.detalhe}</p> : null}
      </div>
      {!feita && s.link && (
        <Link to={s.link} className="shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-primaria hover:bg-primaria-suave">Abrir</Link>
      )}
    </li>
  );
}

// ---------- Recuperação: o que ficou para trás e como recuperar ----------

function PainelRecuperacao({ r, hoje, margem, puxadas, alternarPuxada, abrirAjustes }: {
  r: Recuperacao; hoje: string; margem: number; puxadas: Set<string>; alternarPuxada: (chave: string) => void; abrirAjustes: () => void;
}) {
  const { usuario } = useAuth();
  const definirStatus = useDefinirStatus();
  const { estudo } = usePreferencias();
  const salvar = useSalvarPreferencias();
  const refazer = useRefazerCronograma();
  const total = r.minutosPendentes + r.recuperadas.minutos;
  const naRecuperacaoDeHoje = new Set(r.hoje.map((t) => t.sessao.chave));
  const [verTodas, setVerTodas] = useState(false);
  const LIMITE_LISTA = 6;
  const ordenadas = [...r.atrasos].sort((a, b) => a.origem.localeCompare(b.origem));
  const visiveis = verTodas ? ordenadas : ordenadas.slice(0, LIMITE_LISTA);
  const grupos = new Map<string, TarefaAtrasada[]>();
  for (const t of visiveis) grupos.set(t.origem, [...(grupos.get(t.origem) ?? []), t]);

  return (
    <section id="recuperacao" className="cartao scroll-mt-20 p-5" aria-labelledby="titulo-recuperacao">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="titulo-recuperacao" className="text-lg font-semibold">Recuperação de atrasos</h2>
        <ChipStatus status={r.status} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-superficie-2/70 p-3">
          <dt className="text-xs text-suave">Pendente agora</dt>
          <dd className="mt-0.5 text-xl font-bold tabular-nums">{horas(r.minutosPendentes)}</dd>
          <dd className="text-xs text-suave">{r.atrasos.length} {r.atrasos.length === 1 ? 'tarefa' : 'tarefas'}</dd>
        </div>
        <div className="rounded-xl bg-superficie-2/70 p-3">
          <dt className="text-xs text-suave">Recuperado</dt>
          <dd className="mt-0.5 text-xl font-bold tabular-nums text-sucesso">{horas(r.recuperadas.minutos)}</dd>
          <dd className="text-xs text-suave">{r.recuperadas.quantidade} {r.recuperadas.quantidade === 1 ? 'tarefa' : 'tarefas'}</dd>
        </div>
      </dl>
      {total > 0 && (
        <div className="mt-3">
          <BarraProgresso valor={r.recuperadas.minutos / total} cor="bg-sucesso" rotulo="Atrasos recuperados" />
          <p className="mt-1 text-xs text-suave">{Math.round((r.recuperadas.minutos / total) * 100)}% dos atrasos já recuperados</p>
        </div>
      )}
      <p className="mt-3 text-sm">{r.status === 'em_dia' ? 'Tudo recuperado — você está em dia! 🎉' : textoPrevisao(r, margem, hoje)}</p>

      {r.status === 'atencao' && (
        <Aviso tipo="erro" className="mt-3">
          <p><strong>O atraso está grande.</strong> Para não acumular, escolha um ajuste:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {margem < 45 && (
              <Botao pequeno onClick={() => { salvar.mutate({ ...estudo, margemRecuperacao: 45 }); refazer.mutate(); }}>Recuperar 45 min por dia</Botao>
            )}
            <Botao pequeno variante="secundario" onClick={abrirAjustes}>Aumentar meu tempo de estudo</Botao>
          </div>
          <p className="mt-2 text-xs text-suave">Também dá para marcar como “Já sei isso” o que você já domina — sai da lista na hora.</p>
        </Aviso>
      )}

      {r.plano.length > 0 && (
        <div className="mt-5">
          <h3 className="text-sm font-semibold">Como recuperar</h3>
          <ol className="mt-2 divide-y divide-borda rounded-xl border border-borda">
            {r.plano.slice(0, 7).map((p) => (
              <li key={p.data} className="flex items-start gap-3 px-3 py-2.5 text-sm">
                <span className={cn('w-20 shrink-0 font-semibold', p.data === hoje && 'text-primaria')}>{diaCurto(p.data, hoje)}</span>
                <span className="min-w-0 flex-1">{p.tarefas.map((t) => t.sessao.titulo).join(' · ')}</span>
                <span className="shrink-0 text-xs text-suave">{horas(p.minutos)}</span>
              </li>
            ))}
          </ol>
          {r.plano.length > 7 && <p className="mt-1 text-xs text-suave">E mais {r.plano.length - 7} dias até ficar em dia.</p>}
          {r.naoCabem.length > 0 && <p className="mt-1 text-xs text-perigo">{r.naoCabem.length} {r.naoCabem.length === 1 ? 'tarefa não cabe' : 'tarefas não cabem'} antes da semana final no ritmo atual.</p>}
        </div>
      )}

      {r.atrasos.length > 0 && (
        <div className="mt-5">
          <h3 className="text-sm font-semibold">O que ficou para trás</h3>
          <div className="mt-2 space-y-3">
            {[...grupos].map(([origem, itens]) => (
              <div key={origem}>
                <p className="text-xs font-semibold uppercase tracking-wide text-suave">Previsto para {diaCurto(origem)}</p>
                <ul className="mt-1.5 space-y-2">
                  {itens.map((t) => {
                    const Icone = ICONES[t.sessao.tipo];
                    const puxada = puxadas.has(t.sessao.chave);
                    return (
                      <li key={t.sessao.chave} className="rounded-xl border border-borda p-3">
                        <p className="flex items-start gap-1.5 text-[15px] font-medium leading-snug">
                          <Icone className="mt-0.5 h-4 w-4 shrink-0 text-primaria" aria-hidden /> <span className="min-w-0 flex-1">{t.sessao.titulo}</span>
                          <span className="shrink-0 text-xs font-normal text-suave">{t.sessao.minutos} min</span>
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {t.sessao.link && <Link to={t.sessao.link} className="rounded-lg border border-borda px-2.5 py-1 text-xs font-semibold text-primaria hover:bg-primaria-suave">Abrir</Link>}
                          {naRecuperacaoDeHoje.has(t.sessao.chave) && !puxada ? (
                            <span className="text-xs font-semibold text-sucesso">✓ Na recuperação de hoje</span>
                          ) : (
                            <button type="button" onClick={() => alternarPuxada(t.sessao.chave)} aria-pressed={puxada} className={cn('rounded-lg border px-2.5 py-1 text-xs font-semibold', puxada ? 'border-primaria bg-primaria-suave text-primaria' : 'border-borda hover:bg-superficie-2')}>
                              {puxada ? 'Tirar de hoje' : 'Encaixar hoje'}
                            </button>
                          )}
                          {t.sessao.topico_id && usuario && (
                            <button type="button" onClick={() => definirStatus.mutate({ userId: usuario.id, topicoId: t.sessao.topico_id!, status: 'dominado' })} className="rounded-lg border border-borda px-2.5 py-1 text-xs font-semibold hover:bg-superficie-2">
                              Já sei isso
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
          {ordenadas.length > LIMITE_LISTA && (
            <button type="button" onClick={() => setVerTodas((v) => !v)} aria-expanded={verTodas} className="mt-3 w-full rounded-xl border border-borda px-3 py-2 text-sm font-semibold text-primaria hover:bg-primaria-suave">
              {verTodas ? 'Mostrar menos' : `Ver todas as ${ordenadas.length} tarefas atrasadas`}
            </button>
          )}
          <p className="mt-3 text-xs text-suave">
            Ordem da recuperação: o que vale mais na prova primeiro; no mesmo tópico, teoria antes de questões. “Já sei isso” marca o tópico como dominado no edital.
          </p>
        </div>
      )}
    </section>
  );
}

// ---------- Próximos dias ----------

function DiaResumo({ dia, recuperacao }: { dia: DiaPlano; recuperacao?: DiaRecuperacao }) {
  const [aberto, setAberto] = useState(false);
  const total = soma(dia.sessoes);
  const rec = recuperacao?.tarefas ?? [];
  const rotuloFase = dia.fase === 'prova' ? 'Dia da prova' : dia.fase === 'vespera' ? 'Véspera — leve' : dia.fase === 'revisao_final' ? 'Semana final' : dia.fase === 'folga' ? 'Folga'
    : `${dia.sessoes.length} ${dia.sessoes.length === 1 ? 'sessão' : 'sessões'} · ${horas(total)}`;
  return (
    <div className="cartao overflow-hidden">
      <button type="button" onClick={() => setAberto((a) => !a)} aria-expanded={aberto} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className="w-24 shrink-0 text-sm font-semibold">{DIAS[dia.diaSemana].slice(0, 3)} {dataCurta(dia.data)}</span>
        <span className="min-w-0 flex-1">
          <span className={cn('block truncate text-sm', dia.fase === 'prova' ? 'font-semibold text-primaria' : 'text-suave')}>{rotuloFase}</span>
          {rec.length > 0 && (
            <span className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-alerta">
              <RotateCcw className="h-3 w-3" aria-hidden /> + {horas(recuperacao!.minutos)} de recuperação
            </span>
          )}
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-suave transition-transform', aberto && 'rotate-180')} aria-hidden />
      </button>
      {aberto && (
        <ul className="space-y-1.5 border-t border-borda px-4 py-3 text-sm">
          {dia.sessoes.length === 0 && !rec.length && <li className="text-suave">Sem estudo planejado.</li>}
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
          {rec.map((t) => (
            <li key={t.sessao.chave} className="flex items-start gap-2">
              <RotateCcw className="mt-0.5 h-4 w-4 shrink-0 text-alerta" aria-hidden />
              <span className="min-w-0 flex-1">Recuperar: {t.sessao.titulo} <span className="text-xs text-suave">(de {diaCurto(t.origem)})</span></span>
              <span className="shrink-0 text-xs text-suave">{t.sessao.minutos} min</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------- Disponibilidade ----------

const OPCOES_MIN = [0, 30, 45, 60, 90, 120, 150, 180, 210, 240, 270, 300, 360, 420, 480];

function Disponibilidade({ aoFechar }: { aoFechar: () => void }) {
  const { estudo } = usePreferencias();
  const salvar = useSalvarPreferencias();
  const refazer = useRefazerCronograma();
  const [p, setP] = useState<PreferenciasEstudo>(estudo);
  const semana = p.minutosPorDia.reduce((s, m) => s + m, 0);
  const iguais = p.minutosPorDia.every((m) => m === p.minutosPorDia[0]);

  return (
    <section className="cartao space-y-4 p-5" aria-labelledby="titulo-disp">
      <div>
        <h2 id="titulo-disp" className="font-semibold">Quanto tempo você tem para estudar?</h2>
        <p className="mt-1 text-sm text-suave">Total: {horas(semana)} por semana. O plano se ajusta na hora.</p>
      </div>
      <label className="block text-sm sm:max-w-xs">
        <span className="font-medium">Mesmo tempo em todos os dias</span>
        <select className="campo mt-1" value={iguais ? p.minutosPorDia[0] : ''} onChange={(e) => e.target.value !== '' && setP({ ...p, minutosPorDia: Array(7).fill(Number(e.target.value)) })}>
          {!iguais && <option value="">Personalizado por dia</option>}
          {OPCOES_MIN.map((m) => <option key={m} value={m}>{m ? horas(m) : 'Folga'}</option>)}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {DIAS.map((nome, i) => (
          <label key={nome} className="text-sm">
            <span className="font-medium">{nome}</span>
            <select className="campo mt-1" value={p.minutosPorDia[i]} onChange={(e) => setP({ ...p, minutosPorDia: p.minutosPorDia.map((m, j) => (j === i ? Number(e.target.value) : m)) })}>
              {!OPCOES_MIN.includes(p.minutosPorDia[i]) && <option value={p.minutosPorDia[i]}>{horas(p.minutosPorDia[i])}</option>}
              {OPCOES_MIN.map((m) => <option key={m} value={m}>{m ? horas(m) : 'Folga'}</option>)}
            </select>
          </label>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm">
          <span className="font-medium">Margem para recuperar atrasos</span>
          <select className="campo mt-1" value={p.margemRecuperacao} onChange={(e) => setP({ ...p, margemRecuperacao: Number(e.target.value) })}>
            {MARGENS_RECUPERACAO.map((m) => <option key={m} value={m}>{m} min por dia{m === 15 ? ' (leve)' : m === 30 ? ' (equilibrada)' : ' (intensiva)'}</option>)}
          </select>
          <span className="mt-1 block text-xs text-suave">Reservada em cada dia de estudo. Sem atrasos, vira reforço.</span>
        </label>
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
      <p className="text-xs text-suave">Ao salvar, o cronograma a partir de amanhã é refeito com o novo tempo. O de hoje e o que já ficou para trás continuam como estão.</p>
      <div className="flex gap-2">
        <Botao onClick={() => { salvar.mutate(p); refazer.mutate(); aoFechar(); }} carregando={salvar.isPending}>Salvar</Botao>
        <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
      </div>
    </section>
  );
}
