import { ArrowRight, BarChart3, BookMarked, FilePlus2, FileUp, Layers, ListChecks, Loader2, Timer } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useEdital } from '@/features/edital/hooks';
import { useSimulados } from '@/features/simulados/hooks';
import { dataLocal } from '@/lib/datas';
import { corDe } from '@/shared/cores';
import { BarraProgresso, Carregando, ErroCarga } from '@/shared/ui';
import { useCaderno, useInstalarPacotes, useQuestoes, useRespostas } from './hooks';
import { resumirDesempenho, taxa } from './pratica';

const pct = (v: number) => `${Math.round(v * 100)}%`;

export function PraticarPage() {
  const edital = useEdital();
  const questoes = useQuestoes();
  const respostas = useRespostas();
  const caderno = useCaderno();
  const simulados = useSimulados();
  const instalacao = useInstalarPacotes();

  if (edital.isPending || questoes.isPending || respostas.isPending) return <Carregando />;
  if (!edital.data || !questoes.data || !respostas.data) {
    return <ErroCarga erro={edital.error ?? questoes.error ?? respostas.error} tentarDeNovo={() => { void questoes.refetch(); void respostas.refetch(); }} />;
  }

  const resumo = resumirDesempenho(edital.data, questoes.data, respostas.data, dataLocal());
  const pendentes = (caderno.data ?? []).filter((c) => !c.resolvido).length;
  const ultimo = simulados.data?.find((s) => s.status === 'finalizado');
  const emAndamento = simulados.data?.find((s) => s.status === 'em_andamento');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Praticar</h1>
        <p className="mt-1 text-sm text-suave">
          {questoes.data.length} questões no seu banco · {resumo.respondidasHoje} respondidas hoje
        </p>
      </div>

      {instalacao === 'instalando' && (
        <p className="flex items-center gap-2 rounded-xl bg-primaria-suave/60 px-4 py-3 text-sm" role="status">
          <Loader2 className="h-4 w-4 animate-spin text-primaria" aria-hidden /> Instalando o pacote de questões autorais…
        </p>
      )}

      {emAndamento && (
        <Link to={`/simulado/${emAndamento.id}`} className="flex items-center justify-between gap-3 rounded-2xl border border-alerta/40 bg-alerta/10 p-4">
          <span className="text-sm"><strong>Simulado em andamento.</strong> Toque para continuar de onde parou.</span>
          <ArrowRight className="h-5 w-5 shrink-0 text-alerta" aria-hidden />
        </Link>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Acao para="/praticar/questoes" icone={<ListChecks className="h-6 w-6" aria-hidden />} titulo="Resolver questões" texto="Treine por disciplina ou tópico, com correção e comentário na hora." />
        <Acao para="/praticar/simulados" icone={<Timer className="h-6 w-6" aria-hidden />} titulo="Simulados IBAM" texto={ultimo?.resultado ? `Último: ${ultimo.resultado.pontos} de ${ultimo.resultado.pontos_max} pontos` : '40 questões em 3h, com a pontuação real da prova.'} />
        <Acao para="/praticar/erros" icone={<BookMarked className="h-6 w-6" aria-hidden />} titulo="Caderno de erros" texto={pendentes ? `${pendentes} ${pendentes === 1 ? 'questão pendente' : 'questões pendentes'} para revisar` : 'Seus erros entram aqui automaticamente.'} destaque={pendentes > 0} />
        <Acao para="/flashcards" icone={<Layers className="h-6 w-6" aria-hidden />} titulo="Flashcards" texto="Revisão espaçada (FSRS): poucos minutos por dia para não esquecer." />
        <Acao para="/estatisticas" icone={<BarChart3 className="h-6 w-6" aria-hidden />} titulo="Estatísticas" texto="Previsão de nota, evolução nos simulados e tópicos para reforçar." />
        <Acao para="/praticar/importar" icone={<FileUp className="h-6 w-6" aria-hidden />} titulo="Importar prova" texto="Traga provas anteriores do IBAM em PDF ou texto, com o gabarito." />
      </div>

      <section className="cartao p-5" aria-labelledby="titulo-desempenho">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="titulo-desempenho" className="font-semibold">Desempenho</h2>
          <span className="text-sm text-suave">
            {resumo.geral.respondidas ? <><strong className="text-texto">{pct(taxa(resumo.geral))}</strong> de acerto em {resumo.geral.respondidas}</> : 'Nenhuma questão respondida ainda'}
          </span>
        </div>
        <div className="mt-4 space-y-4">
          {resumo.porBloco.map(({ bloco, desempenho, disponiveis }) => {
            const d = edital.data.disciplinas.find((x) => x.bloco_id === bloco.id);
            return (
              <div key={bloco.id}>
                <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate font-medium">{bloco.nome}</span>
                  <span className="shrink-0 text-xs text-suave">
                    {desempenho.respondidas ? `${desempenho.acertos}/${desempenho.respondidas} · ` : ''}<strong className="text-texto">{desempenho.respondidas ? pct(taxa(desempenho)) : '—'}</strong>
                  </span>
                </div>
                <BarraProgresso valor={taxa(desempenho)} cor={corDe(d?.cor ?? 'blue').barra} rotulo={`Acerto em ${bloco.nome}`} />
                <p className="mt-1 text-[11px] text-suave">{disponiveis} questões disponíveis</p>
              </div>
            );
          })}
        </div>
      </section>

      <Link to="/praticar/nova" className="inline-flex items-center gap-2 text-sm font-semibold text-primaria hover:underline">
        <FilePlus2 className="h-4 w-4" aria-hidden /> Cadastrar uma questão manualmente
      </Link>
    </div>
  );
}

function Acao({ para, icone, titulo, texto, destaque }: { para: string; icone: ReactNode; titulo: string; texto: string; destaque?: boolean }) {
  return (
    <Link to={para} className="cartao group flex items-start gap-3.5 p-4 transition-colors hover:border-primaria/50">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${destaque ? 'bg-perigo/10 text-perigo' : 'bg-primaria-suave text-primaria'}`}>{icone}</span>
      <span className="min-w-0">
        <span className="flex items-center gap-1 font-semibold">{titulo} <ArrowRight className="h-4 w-4 text-suave transition-transform group-hover:translate-x-0.5" aria-hidden /></span>
        <span className="mt-0.5 block text-sm text-suave">{texto}</span>
      </span>
    </Link>
  );
}
