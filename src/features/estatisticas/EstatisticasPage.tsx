import { AlertTriangle, ArrowRight, CheckCircle2, TrendingUp, XCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { useEdital } from '@/features/edital/hooks';
import { buscarRevisoesDesde } from '@/features/flashcards/api';
import { inicioDoDia } from '@/features/flashcards/hooks';
import { useSessoes } from '@/features/plano/hooks';
import { somarDias } from '@/features/plano/gerador';
import { useQuestoes, useRespostas } from '@/features/questoes/hooks';
import { useSimulados } from '@/features/simulados/hooks';
import { cn } from '@/lib/cn';
import { dataCurta, dataLocal } from '@/lib/datas';
import { GraficoColunas, GraficoLinha, TabelaDados } from '@/shared/graficos';
import { BarraProgresso, Carregando, ErroCarga } from '@/shared/ui';
import { acertoPorDisciplina, evolucaoSimulados, minutosPorSemana, MINIMO_PARA_PREVER, preverNota, topicosFracos } from './calculos';

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const horas = (min: number) => (min >= 60 ? `${(min / 60).toFixed(1).replace('.0', '').replace('.', ',')} h` : `${min} min`);
const dataHora = (iso: string) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(iso));

export function EstatisticasPage() {
  const { usuario } = useAuth();
  const edital = useEdital();
  const questoes = useQuestoes();
  const respostas = useRespostas();
  const simulados = useSimulados();
  const sessoes = useSessoes(56);
  const hoje = dataLocal();
  const desde7 = inicioDoDia(new Date(Date.now() - 6 * 86_400_000));
  const revisoes = useQuery({ queryKey: ['revisoes-flashcard', usuario?.id ?? 'anonimo', 'semana', desde7], queryFn: () => buscarRevisoesDesde(desde7), enabled: Boolean(usuario) });

  if (edital.isPending || questoes.isPending || respostas.isPending || simulados.isPending) return <Carregando />;
  if (!edital.data || !questoes.data || !respostas.data || !simulados.data) {
    return <ErroCarga erro={edital.error ?? questoes.error ?? respostas.error ?? simulados.error} />;
  }

  const prev = preverNota(edital.data, questoes.data, respostas.data);
  const evolucao = evolucaoSimulados(simulados.data);
  const porDisciplina = acertoPorDisciplina(edital.data, questoes.data, respostas.data);
  const fracos = topicosFracos(edital.data, questoes.data, respostas.data);
  const semanas = minutosPorSemana(sessoes.data ?? [], hoje);
  const ultimos7 = (sessoes.data ?? []).filter((s) => s.data > somarDias(hoje, -7)).reduce((t, s) => t + s.minutos, 0);
  const acima = prev.esperado >= prev.minimo;
  const riscos = prev.blocos.filter((b) => (b.chanceDeZerar ?? 0) > 0.01);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Estatísticas</h1>
        <p className="mt-1 text-sm text-suave">{respostas.data.length} questões respondidas · {evolucao.length} simulados · {horas(ultimos7)} de estudo nos últimos 7 dias</p>
      </div>

      {/* Previsão de nota */}
      <section className="cartao p-5" aria-labelledby="titulo-previsao">
        <h2 id="titulo-previsao" className="flex items-center gap-2 font-semibold"><TrendingUp className="h-5 w-5 text-primaria" aria-hidden /> Previsão de nota na prova</h2>
        {prev.completa ? (
          <>
            <p className="mt-3 flex items-baseline gap-2">
              <span className="text-5xl font-bold tabular-nums">{prev.esperado}</span>
              <span className="text-lg font-semibold text-suave">de {prev.maximo} pontos</span>
            </p>
            <p className="mt-1 text-sm text-suave">Faixa provável: {prev.faixa[0]} a {prev.faixa[1]} pontos · mínimo para passar: {prev.minimo}</p>
            <p className={cn('mt-3 flex items-center gap-1.5 text-sm font-semibold', acima && !riscos.length ? 'text-sucesso' : 'text-alerta')}>
              {acima && !riscos.length ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <AlertTriangle className="h-4 w-4" aria-hidden />}
              {acima
                ? riscos.length ? 'Acima do mínimo, mas com risco de zerar um bloco' : `Acima do mínimo, com ${prev.esperado - prev.minimo} pontos de margem`
                : `Faltam cerca de ${prev.minimo - prev.esperado} pontos para o mínimo`}
            </p>
          </>
        ) : (
          <p className="mt-3 text-sm text-suave">Para prever sua nota, responda pelo menos {MINIMO_PARA_PREVER} questões de cada bloco da prova.</p>
        )}
        <ul className="mt-4 space-y-3">
          {prev.blocos.map((b) => (
            <li key={b.bloco.id}>
              <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                <span className="min-w-0 truncate font-medium">{b.bloco.nome}</span>
                <span className="shrink-0 text-xs text-suave">
                  {b.esperado !== null ? <><strong className="text-texto">{b.esperado.toFixed(1).replace('.', ',')}</strong> de {b.bloco.num_questoes * b.bloco.valor_questao} pts · {Math.round(b.taxa! * 100)}% de acerto</> : `${b.respondidas}/${MINIMO_PARA_PREVER} respostas para prever`}
                </span>
              </div>
              <BarraProgresso valor={b.taxa ?? b.respondidas / MINIMO_PARA_PREVER} cor={b.taxa === null ? 'bg-borda' : 'bg-primaria'} rotulo={b.bloco.nome} />
              {(b.chanceDeZerar ?? 0) > 0.01 && <p className="mt-1 flex items-center gap-1 text-xs text-perigo"><XCircle className="h-3.5 w-3.5" aria-hidden /> Risco de zerar este bloco: {Math.round(b.chanceDeZerar! * 100)}%</p>}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-suave">Baseada nas suas últimas 40 respostas de cada bloco, com os pesos da prova (3/2/1). É uma estimativa — melhora quanto mais você pratica.</p>
      </section>

      {/* Simulados */}
      <section className="cartao p-5" aria-labelledby="titulo-sim">
        <h2 id="titulo-sim" className="font-semibold">Evolução nos simulados</h2>
        <p className="mt-0.5 text-xs text-suave">Percentual de pontos em cada simulado finalizado</p>
        {evolucao.length ? (
          <div className="mt-4">
            <GraficoLinha
              titulo="Percentual de pontos por simulado"
              referencia={60}
              rotuloReferencia="mín. 60%"
              pontos={evolucao.map((p) => ({ rotulo: dataHora(p.data), valor: p.percentual, detalhe: <>{p.pontos} de {p.pontosMax} pts · {p.tipo === 'completo' ? 'completo' : 'rápido'} · {p.aprovado ? 'aprovada' : 'abaixo'}</> }))}
            />
            <TabelaDados cabecalho={['Data', 'Tipo', 'Pontos', '%', 'Resultado']} linhas={evolucao.map((p) => [dataHora(p.data), p.tipo === 'completo' ? 'Completo' : 'Rápido', `${p.pontos}/${p.pontosMax}`, `${p.percentual}%`, p.aprovado ? 'Aprovada' : 'Abaixo do mínimo'])} />
          </div>
        ) : (
          <p className="mt-3 text-sm text-suave">Faça um simulado para acompanhar sua evolução. <Link to="/praticar/simulados" className="font-semibold text-primaria hover:underline">Ir para simulados</Link></p>
        )}
      </section>

      {/* Acerto por disciplina */}
      <section className="cartao p-5" aria-labelledby="titulo-disc">
        <h2 id="titulo-disc" className="font-semibold">Acerto por disciplina</h2>
        <ul className="mt-4 space-y-3">
          {porDisciplina.map((d) => (
            <li key={d.id}>
              <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                <span className="min-w-0 truncate font-medium">{d.rotulo}</span>
                <span className="shrink-0 text-xs text-suave">{d.respondidas ? <><strong className="text-texto">{pct(d.acertos, d.respondidas)}%</strong> · {d.acertos}/{d.respondidas}</> : 'sem respostas'}</span>
              </div>
              <BarraProgresso valor={d.respondidas ? d.acertos / d.respondidas : 0} rotulo={`Acerto em ${d.rotulo}`} />
            </li>
          ))}
        </ul>
      </section>

      {/* Tópicos para reforçar */}
      <section className="cartao p-5" aria-labelledby="titulo-fracos">
        <h2 id="titulo-fracos" className="font-semibold">Tópicos para reforçar</h2>
        {fracos.length ? (
          <ul className="mt-3 divide-y divide-borda">
            {fracos.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-2.5">
                <span className={cn('w-12 shrink-0 text-right text-sm font-bold tabular-nums', t.acertos / t.respondidas < 0.6 ? 'text-perigo' : 'text-texto')}>{pct(t.acertos, t.respondidas)}%</span>
                <span className="min-w-0 flex-1 text-sm">{t.topico.numero}. {t.rotulo} <span className="text-xs text-suave">({t.acertos}/{t.respondidas})</span></span>
                <Link to={`/praticar/questoes?disciplina=${t.topico.disciplina_id}&topico=${t.id}&modo=todas`} className="shrink-0 rounded-lg p-1.5 text-primaria hover:bg-primaria-suave" aria-label={`Treinar ${t.rotulo}`}><ArrowRight className="h-4 w-4" /></Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-suave">Aparecem aqui os tópicos com pelo menos 3 respostas, do menor para o maior acerto.</p>
        )}
      </section>

      {/* Tempo de estudo */}
      <section className="cartao p-5" aria-labelledby="titulo-horas">
        <h2 id="titulo-horas" className="font-semibold">Tempo de estudo por semana</h2>
        <p className="mt-0.5 text-xs text-suave">Sessões do plano marcadas como concluídas · {revisoes.data ? `${revisoes.data.length} revisões de flashcards nos últimos 7 dias` : ''}</p>
        <div className="mt-4">
          <GraficoColunas
            titulo="Horas de estudo nas últimas 8 semanas"
            formatarEixo={(v) => `${Math.round((v / 60) * 10) / 10}h`.replace('.', ',')}
            minimoEixo={60}
            colunas={semanas.map((s) => ({ rotulo: dataCurta(s.inicio), valor: s.minutos, rotuloValor: horas(s.minutos), detalhe: <>semana de {dataCurta(s.inicio)}</> }))}
          />
          <TabelaDados cabecalho={['Semana (início)', 'Tempo']} linhas={semanas.map((s) => [dataCurta(s.inicio, true), horas(s.minutos)])} />
        </div>
      </section>
    </div>
  );
}
