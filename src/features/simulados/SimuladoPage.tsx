import { ArrowLeft, ArrowRight, CheckCircle2, Flag, Grid3x3, Timer, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMapaQuestoes, useQuestoes, useTextos } from '@/features/questoes/hooks';
import { QuestaoCard } from '@/features/questoes/QuestaoCard';
import { cn } from '@/lib/cn';
import { mensagemDeErro } from '@/lib/supabase';
import { useAgora } from '@/shared/hooks/useAgora';
import { Aviso, BarraProgresso, Botao, Carregando, ErroCarga } from '@/shared/ui';
import { useFinalizarSimulado, useMarcarItem, useSimulado } from './hooks';
import { formatarDuracao, segundosRestantes, type ResultadoSimulado, type SimuladoDetalhado } from './tipos';

export function SimuladoPage() {
  const { id } = useParams();
  const simulado = useSimulado(id);
  const questoes = useQuestoes();

  if (simulado.isPending || questoes.isPending) return <div className="min-h-dvh bg-fundo"><Carregando /></div>;
  if (!simulado.data || !questoes.data) {
    return <div className="min-h-dvh bg-fundo px-4"><ErroCarga erro={simulado.error ?? questoes.error} tentarDeNovo={() => void simulado.refetch()} /></div>;
  }
  return simulado.data.status === 'finalizado' ? <Resultado simulado={simulado.data} /> : <Execucao simulado={simulado.data} />;
}

function Execucao({ simulado }: { simulado: SimuladoDetalhado }) {
  const mapa = useMapaQuestoes();
  const textos = useTextos();
  const marcar = useMarcarItem();
  const finalizar = useFinalizarSimulado();
  const agora = useAgora(1000);
  const [atual, setAtual] = useState(0);
  const [painel, setPainel] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const autoFinalizou = useRef(false);

  const restante = segundosRestantes(simulado, agora);
  const itens = simulado.itens;
  const item = itens[atual];
  const questao = item && mapa.get(item.questao_id);
  const respondidas = itens.filter((i) => i.escolha !== null).length;
  const marcadas = itens.filter((i) => i.marcada).length;

  async function concluir() {
    setErro(null);
    try {
      await finalizar.mutateAsync(simulado.id);
      window.scrollTo({ top: 0 });
    } catch (e) {
      setErro(mensagemDeErro(e));
      autoFinalizou.current = false;
    }
  }

  useEffect(() => {
    if (restante === 0 && !autoFinalizou.current) {
      autoFinalizou.current = true;
      void concluir();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restante]);

  const irPara = (i: number) => {
    setAtual(Math.max(0, Math.min(itens.length - 1, i)));
    setPainel(false);
    window.scrollTo({ top: 0 });
  };

  const escolher = (i: number) =>
    marcar.mutate({ simuladoId: simulado.id, ordem: item.ordem, dados: { escolha: item.escolha === i ? null : i } });

  return (
    <div className="min-h-dvh bg-fundo">
      <header className="sticky top-0 z-20 border-b border-borda bg-superficie/95 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Link to="/praticar/simulados" className="rounded-lg p-1.5 text-suave hover:bg-superficie-2" aria-label="Sair (o tempo continua correndo)"><ArrowLeft className="h-5 w-5" /></Link>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{simulado.tipo === 'completo' ? 'Simulado completo' : 'Simulado rápido'}</p>
            <p className="text-xs text-suave">{respondidas} de {itens.length} respondidas{marcadas ? ` · ${marcadas} para revisar` : ''}</p>
          </div>
          <div className={cn('flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-mono text-sm font-bold tabular-nums', restante < 600 ? 'bg-perigo/10 text-perigo' : 'bg-superficie-2')} role="timer" aria-label="Tempo restante">
            <Timer className="h-4 w-4" aria-hidden /> {formatarDuracao(restante)}
          </div>
        </div>
        <BarraProgresso valor={respondidas / Math.max(1, itens.length)} className="mx-auto mt-2.5 h-1 max-w-3xl" rotulo="Questões respondidas" />
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 pb-32 pt-4">
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        {questao ? (
          <QuestaoCard
            key={item.ordem}
            questao={questao}
            numero={item.ordem}
            texto={questao.texto_id ? textos.mapa.get(questao.texto_id) : undefined}
            escolha={item.escolha}
            aoEscolher={escolher}
            bloqueada={finalizar.isPending}
          />
        ) : (
          <Aviso tipo="alerta">Esta questão foi excluída do seu banco.</Aviso>
        )}
        <button
          type="button"
          onClick={() => marcar.mutate({ simuladoId: simulado.id, ordem: item.ordem, dados: { marcada: !item.marcada } })}
          aria-pressed={item.marcada}
          className={cn('inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium', item.marcada ? 'border-alerta/50 bg-alerta/10 text-alerta' : 'border-borda text-suave')}
        >
          <Flag className="h-4 w-4" aria-hidden /> {item.marcada ? 'Marcada para revisar' : 'Marcar para revisar'}
        </button>

        {painel && (
          <div className="cartao p-4">
            <p className="mb-3 text-sm font-semibold">Ir para a questão</p>
            <div className="grid grid-cols-8 gap-2 sm:grid-cols-10">
              {itens.map((it, i) => (
                <button
                  key={it.ordem}
                  type="button"
                  onClick={() => irPara(i)}
                  aria-label={`Questão ${it.ordem}${it.escolha !== null ? ', respondida' : ''}${it.marcada ? ', marcada' : ''}`}
                  className={cn(
                    'relative h-9 rounded-lg border text-sm font-semibold',
                    it.escolha !== null ? 'border-primaria bg-primaria text-primaria-texto' : 'border-borda',
                    i === atual && 'ring-2 ring-primaria ring-offset-2 ring-offset-superficie',
                  )}
                >
                  {it.ordem}
                  {it.marcada && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-alerta" aria-hidden />}
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-borda bg-superficie/95 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur" aria-label="Navegação do simulado">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4">
          <Botao variante="secundario" onClick={() => irPara(atual - 1)} disabled={atual === 0} aria-label="Questão anterior"><ArrowLeft className="h-4 w-4" /></Botao>
          <Botao variante="secundario" onClick={() => setPainel((p) => !p)} aria-expanded={painel}><Grid3x3 className="h-4 w-4" aria-hidden /> {atual + 1}/{itens.length}</Botao>
          <Botao variante="secundario" onClick={() => irPara(atual + 1)} disabled={atual === itens.length - 1} aria-label="Próxima questão"><ArrowRight className="h-4 w-4" /></Botao>
          <Botao className="ml-auto" onClick={() => setConfirmando(true)} carregando={finalizar.isPending}>Finalizar</Botao>
        </div>
      </nav>

      {confirmando && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="titulo-finalizar">
          <div className="cartao w-full max-w-sm p-5">
            <h2 id="titulo-finalizar" className="text-lg font-semibold">Finalizar o simulado?</h2>
            <p className="mt-2 text-sm text-suave">
              {itens.length - respondidas > 0 ? `Você deixou ${itens.length - respondidas} ${itens.length - respondidas === 1 ? 'questão' : 'questões'} em branco. ` : 'Todas as questões foram respondidas. '}
              Depois de finalizar, não dá para alterar as respostas.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Botao variante="secundario" onClick={() => setConfirmando(false)}>Continuar</Botao>
              <Botao onClick={() => { setConfirmando(false); void concluir(); }}>Finalizar</Botao>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type FiltroRevisao = 'erradas' | 'todas' | 'branco';

function Resultado({ simulado }: { simulado: SimuladoDetalhado }) {
  const mapa = useMapaQuestoes();
  const textos = useTextos();
  const navegar = useNavigate();
  const [filtro, setFiltro] = useState<FiltroRevisao>('erradas');
  const r = simulado.resultado as ResultadoSimulado;

  const itens = simulado.itens
    .map((it) => ({ it, q: mapa.get(it.questao_id) }))
    .filter(({ it, q }) => {
      if (!q) return false;
      const certa = q.anulada || it.escolha === q.gabarito;
      return filtro === 'todas' || (filtro === 'branco' ? it.escolha === null : !certa);
    });

  return (
    <div className="min-h-dvh bg-fundo">
      <header className="sticky top-0 z-20 border-b border-borda bg-superficie/95 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <button type="button" onClick={() => navegar('/praticar/simulados')} className="rounded-lg p-1.5 text-suave hover:bg-superficie-2" aria-label="Voltar aos simulados"><ArrowLeft className="h-5 w-5" /></button>
          <p className="font-semibold">Resultado do simulado</p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 pb-16 pt-4">
        <section className={cn('rounded-2xl p-5 text-white shadow-cartao', r.aprovado ? 'bg-gradient-to-br from-emerald-600 to-emerald-800' : 'bg-gradient-to-br from-blue-700 to-blue-950')} aria-label="Nota">
          <div className="flex items-center gap-2 text-sm font-medium text-white/85">
            {r.aprovado ? <CheckCircle2 className="h-5 w-5" aria-hidden /> : <XCircle className="h-5 w-5" aria-hidden />}
            {r.aprovado ? 'Aprovada neste simulado!' : r.algum_bloco_zerado ? 'Reprovada: um bloco ficou zerado' : 'Abaixo da nota mínima — continue treinando'}
          </div>
          <p className="mt-2 flex items-baseline gap-2">
            <span className="text-5xl font-bold tabular-nums">{r.pontos}</span>
            <span className="text-lg font-semibold text-white/85">de {r.pontos_max} pontos</span>
          </p>
          <p className="mt-2 text-sm text-white/85">
            Mínimo: {r.nota_minima} pontos (60%) · {r.acertos} de {r.total} acertos{r.em_branco ? ` · ${r.em_branco} em branco` : ''} · {formatarDuracao(r.tempo_seg)}
          </p>
        </section>

        <section className="cartao p-5" aria-labelledby="titulo-blocos">
          <h2 id="titulo-blocos" className="font-semibold">Por bloco da prova</h2>
          <div className="mt-4 space-y-4">
            {r.blocos.map((b) => (
              <div key={b.bloco_id}>
                <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate font-medium">{b.nome}</span>
                  <span className={cn('shrink-0 font-semibold', b.acertos === 0 && 'text-perigo')}>{b.pontos}/{b.pontos_max} pts</span>
                </div>
                <BarraProgresso valor={b.pontos_max ? b.pontos / b.pontos_max : 0} cor={b.acertos === 0 ? 'bg-perigo' : 'bg-primaria'} rotulo={b.nome} />
                <p className="mt-1 text-xs text-suave">{b.acertos} de {b.total} acertos{b.acertos === 0 ? ' — bloco zerado elimina na prova real' : ''}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="flex gap-2 overflow-x-auto" role="group" aria-label="Filtrar revisão">
          {([['erradas', 'Erradas'], ['branco', 'Em branco'], ['todas', 'Todas']] as const).map(([v, rot]) => (
            <button key={v} type="button" aria-pressed={filtro === v} onClick={() => setFiltro(v)}
              className={cn('shrink-0 rounded-full border px-3 py-1.5 text-[13px] font-medium', filtro === v ? 'border-primaria bg-primaria-suave text-primaria' : 'border-borda bg-superficie')}>
              {rot}
            </button>
          ))}
        </div>
        {itens.length === 0 ? (
          <p className="py-6 text-center text-sm text-suave">{filtro === 'erradas' ? 'Nenhum erro. Excelente!' : 'Nada por aqui.'}</p>
        ) : (
          itens.map(({ it, q }) => (
            <div key={it.ordem}>
              {it.escolha === null && <p className="mb-1 text-xs font-semibold text-alerta">Deixada em branco</p>}
              <QuestaoCard questao={q!} numero={it.ordem} escolha={it.escolha} corrigida texto={q!.texto_id ? textos.mapa.get(q!.texto_id) : undefined} />
            </div>
          ))
        )}
        <p className="text-center text-xs text-suave">Os erros deste simulado já estão no seu caderno de erros.</p>
      </main>
    </div>
  );
}
