import { ArrowRight, CalendarDays, Clock, PencilLine, Target } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { proximosPrazos } from '@/features/concurso/etapas';
import { useEtapas } from '@/features/concurso/hooks';
import { ItemEtapa } from '@/features/concurso/ItemEtapa';
import { useResumoProgresso } from '@/features/edital/hooks';
import { useCaderno, useRespostas } from '@/features/questoes/hooks';
import { useSimulados } from '@/features/simulados/hooks';
import { blocoPrioritario, pct } from '@/features/edital/progresso';
import { contagemAte, dataLocal, dataPorExtenso, horaLocal, maiuscula, plural } from '@/lib/datas';
import { corDe } from '@/shared/cores';
import { useAgora } from '@/shared/hooks/useAgora';
import { AnelProgresso, BarraProgresso, Carregando, ErroCarga } from '@/shared/ui';

function saudacao(d: Date): string {
  const h = Number(new Intl.DateTimeFormat('pt-BR', { hour: 'numeric', hour12: false, timeZone: 'America/Sao_Paulo' }).format(d));
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

export function InicioPage() {
  const { usuario } = useAuth();
  const agora = useAgora(30_000);
  const { edital, resumo, carregando, erro } = useResumoProgresso();
  const etapas = useEtapas();
  const respostas = useRespostas();
  const caderno = useCaderno();
  const simulados = useSimulados();

  if (carregando) return <Carregando />;
  if (erro || !edital.data || !resumo) return <ErroCarga erro={erro} tentarDeNovo={() => void edital.refetch()} />;

  const c = edital.data.concurso;
  const nome = (usuario?.user_metadata?.nome as string | undefined)?.split(' ')[0];
  const prova = c.prova_inicio ? new Date(c.prova_inicio) : null;
  const contagem = prova ? contagemAte(prova, agora) : null;
  const foco = blocoPrioritario(resumo);
  const prazos = etapas.etapas ? proximosPrazos(etapas.etapas, etapas.concluidas, 4) : [];
  const disciplinaDoFoco = edital.data.disciplinas.find((d) => d.bloco_id === foco?.bloco.id);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-suave">{saudacao(agora)}{nome ? `, ${nome}` : ''}!</p>
        <h1 className="text-2xl font-bold tracking-tight">Rumo à aprovação</h1>
      </div>

      {/* Contagem regressiva */}
      {prova && contagem && (
        <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-blue-900 p-5 text-white shadow-cartao sm:p-6" aria-label="Contagem regressiva para a prova">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-blue-100">{contagem.encerrada ? 'Prova realizada' : 'Faltam'}</p>
              {!contagem.encerrada && (
                <p className="mt-1 flex items-baseline gap-2">
                  <span className="text-5xl font-bold tabular-nums sm:text-6xl">{contagem.diasCalendario}</span>
                  <span className="text-xl font-semibold">{contagem.diasCalendario === 1 ? 'dia' : 'dias'}</span>
                </p>
              )}
              <p className="mt-2 text-sm text-blue-100">para a prova objetiva · {c.cargo}</p>
            </div>
            <div className="space-y-1.5 text-sm text-blue-50">
              <p className="flex items-center gap-2"><CalendarDays className="h-4 w-4" aria-hidden /> {maiuscula(dataPorExtenso(dataLocal(prova)))}</p>
              <p className="flex items-center gap-2"><Clock className="h-4 w-4" aria-hidden /> Portão fecha às {c.portao_fecha ? horaLocal(new Date(c.portao_fecha)) : '15:00'} · {c.duracao_min ? c.duracao_min / 60 : 3}h de prova</p>
            </div>
          </div>
          {!contagem.encerrada && (
            <p className="mt-4 border-t border-white/15 pt-3 text-xs text-blue-100">
              {plural(Math.max(1, Math.round(contagem.diasCalendario / 7)), 'semana')} de estudo · {contagem.dias}d {contagem.horas}h {contagem.minutos}min até o início
            </p>
          )}
        </section>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        {/* Progresso */}
        <section className="cartao p-5 lg:col-span-3" aria-labelledby="titulo-progresso">
          <div className="flex items-center justify-between">
            <h2 id="titulo-progresso" className="font-semibold">Progresso no edital</h2>
            <Link to="/edital" className="inline-flex items-center gap-1 text-sm font-medium text-primaria hover:underline">
              Abrir edital <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-center">
            <AnelProgresso valor={resumo.geral}>
              <span className="text-2xl font-bold">{pct(resumo.geral)}%</span>
              <span className="text-[11px] text-suave">ponderado</span>
            </AnelProgresso>
            <div className="flex-1 space-y-3.5">
              {resumo.porBloco.map(({ bloco, pontos, conclusao }) => {
                const d = edital.data.disciplinas.find((x) => x.bloco_id === bloco.id);
                return (
                  <div key={bloco.id}>
                    <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate font-medium">{bloco.nome}</span>
                      <span className="shrink-0 text-xs text-suave">{pontos} pts · <strong className="text-texto">{pct(conclusao)}%</strong></span>
                    </div>
                    <BarraProgresso valor={conclusao} cor={corDe(d?.cor ?? 'blue').barra} rotulo={bloco.nome} />
                  </div>
                );
              })}
            </div>
          </div>
          <dl className="mt-5 grid grid-cols-4 gap-2 border-t border-borda pt-4 text-center">
            {([['nao_iniciado', 'A estudar'], ['estudando', 'Estudando'], ['revisando', 'Revisando'], ['dominado', 'Dominados']] as const).map(([k, r]) => (
              <div key={k}>
                <dd className="text-lg font-bold">{resumo.contagem[k]}</dd>
                <dt className="text-[11px] text-suave">{r}</dt>
              </div>
            ))}
          </dl>
        </section>

        {/* Onde focar */}
        <section className="cartao flex flex-col p-5 lg:col-span-2" aria-labelledby="titulo-foco">
          <h2 id="titulo-foco" className="flex items-center gap-2 font-semibold"><Target className="h-5 w-5 text-primaria" aria-hidden /> Onde focar</h2>
          {foco && foco.pontosAFazer > 0.5 ? (
            <>
              <p className="mt-3 text-sm text-suave">Bloco com mais pontos ainda em aberto:</p>
              <p className="mt-1 text-lg font-semibold leading-snug">{foco.bloco.nome}</p>
              <p className="mt-1 text-sm">
                <strong className="text-primaria">{Math.round(foco.pontosAFazer)} de {foco.pontos} pontos</strong> para conquistar
                {' '}({foco.bloco.num_questoes} questões × {foco.bloco.valor_questao} {foco.bloco.valor_questao === 1 ? 'ponto' : 'pontos'}).
              </p>
              <p className="mt-3 text-xs text-suave">Para passar: mínimo de {c.nota_minima} de {c.pontuacao_total} pontos, sem zerar nenhuma disciplina.</p>
              <Link
                to={`/edital?disciplina=${disciplinaDoFoco?.id ?? ''}&status=nao_iniciado`}
                className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-semibold text-primaria hover:underline"
              >
                Ver tópicos a estudar <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </>
          ) : (
            <p className="mt-3 text-sm text-suave">Edital praticamente todo dominado. Hora de revisar e treinar questões!</p>
          )}
        </section>
      </div>

      {/* Prática */}
      <section className="cartao p-5" aria-labelledby="titulo-pratica">
        <div className="flex items-center justify-between">
          <h2 id="titulo-pratica" className="flex items-center gap-2 font-semibold"><PencilLine className="h-5 w-5 text-primaria" aria-hidden /> Prática</h2>
          <Link to="/praticar" className="inline-flex items-center gap-1 text-sm font-medium text-primaria hover:underline">
            Praticar <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
        {(() => {
          const lista = respostas.data ?? [];
          const hoje = dataLocal(agora);
          const deHoje = lista.filter((r) => dataLocal(new Date(r.respondida_em)) === hoje);
          const acertos = lista.filter((r) => r.correta).length;
          const ultimo = simulados.data?.find((s) => s.status === 'finalizado')?.resultado;
          const pendentes = (caderno.data ?? []).filter((c) => !c.resolvido).length;
          return (
            <dl className="mt-4 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
              <Indicador valor={String(deHoje.length)} rotulo="questões hoje" />
              <Indicador valor={lista.length ? `${Math.round((acertos / lista.length) * 100)}%` : '—'} rotulo="de acerto geral" />
              <Indicador valor={ultimo ? `${ultimo.pontos}/${ultimo.pontos_max}` : '—'} rotulo="último simulado" />
              <Indicador valor={String(pendentes)} rotulo="erros pendentes" destaque={pendentes > 0} />
            </dl>
          );
        })()}
      </section>

      {/* Próximos prazos */}
      <section className="cartao p-5" aria-labelledby="titulo-prazos">
        <div className="flex items-center justify-between">
          <h2 id="titulo-prazos" className="font-semibold">Próximos prazos</h2>
          <Link to="/concurso" className="inline-flex items-center gap-1 text-sm font-medium text-primaria hover:underline">
            Cronograma completo <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
        <div className="mt-4 space-y-4">
          {etapas.carregando ? (
            <Carregando />
          ) : prazos.length ? (
            prazos.map((e) => <ItemEtapa key={e.id} etapa={e} concluida={etapas.concluidas.has(e.id)} compacto />)
          ) : (
            <p className="text-sm text-suave">Nenhum prazo pendente.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function Indicador({ valor, rotulo, destaque }: { valor: string; rotulo: string; destaque?: boolean }) {
  return (
    <div className="rounded-xl bg-superficie-2/70 px-2 py-3">
      <dd className={`text-xl font-bold tabular-nums ${destaque ? 'text-perigo' : ''}`}>{valor}</dd>
      <dt className="mt-0.5 text-[11px] text-suave">{rotulo}</dt>
    </div>
  );
}
