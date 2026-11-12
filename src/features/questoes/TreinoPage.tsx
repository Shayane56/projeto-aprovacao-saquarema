import { ArrowLeft, ArrowRight, Layers, PartyPopper, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { useEdital } from '@/features/edital/hooks';
import { Botao, Carregando, ErroCarga } from '@/shared/ui';
import { useAtualizarCaderno, useCaderno, useQuestoes, useResponder, useRespostas, useTextos } from './hooks';
import { SeletorMotivo } from './MotivoErro';
import { montarFila, type ModoTreino } from './pratica';
import { QuestaoCard } from './QuestaoCard';
import type { MotivoErro, Questao } from './tipos';

const MODOS: { valor: ModoTreino; rotulo: string }[] = [
  { valor: 'novas', rotulo: 'Não respondidas' },
  { valor: 'todas', rotulo: 'Todas' },
  { valor: 'erradas', rotulo: 'Erros pendentes' },
];

export function TreinoPage() {
  const { usuario } = useAuth();
  const edital = useEdital();
  const questoes = useQuestoes();
  const respostas = useRespostas();
  const caderno = useCaderno();
  const textos = useTextos();
  const responder = useResponder();
  const atualizarCaderno = useAtualizarCaderno();
  const [params, setParams] = useSearchParams();

  const disciplinaId = params.get('disciplina') ?? '';
  const topicoId = params.get('topico') ?? '';
  const modo = (params.get('modo') as ModoTreino | null) ?? 'novas';

  const [fila, setFila] = useState<Questao[] | null>(null);
  const [indice, setIndice] = useState(0);
  const [escolha, setEscolha] = useState<number | null>(null);
  const [corrigida, setCorrigida] = useState(false);
  const [motivo, setMotivo] = useState<MotivoErro | null>(null);
  const [placar, setPlacar] = useState({ certas: 0, erradas: 0 });
  const [rodada, setRodada] = useState(0);
  const inicio = useRef(Date.now());

  const prontos = questoes.data && respostas.data && caderno.data;
  const chaveFiltro = `${disciplinaId}|${topicoId}|${modo}|${rodada}`;
  // Monta a fila quando os dados chegam ou o filtro muda (não a cada resposta).
  useEffect(() => {
    if (!prontos) return;
    setFila(montarFila(questoes.data!, respostas.data!, caderno.data!, { disciplinaId: disciplinaId || undefined, topicoId: topicoId || undefined, modo }));
    setIndice(0);
    setEscolha(null);
    setCorrigida(false);
    setPlacar({ certas: 0, erradas: 0 });
    inicio.current = Date.now();
  }, [chaveFiltro, Boolean(prontos)]);

  const topicosDaDisciplina = useMemo(
    () => (edital.data?.topicos ?? []).filter((t) => t.disciplina_id === disciplinaId && !t.parent_id),
    [edital.data, disciplinaId],
  );

  if (edital.isPending || questoes.isPending || respostas.isPending || caderno.isPending) return <Carregando />;
  if (!edital.data || !prontos) return <ErroCarga erro={questoes.error ?? respostas.error ?? caderno.error} />;

  const mudar = (chave: string, valor: string) => {
    const p = new URLSearchParams(params);
    if (valor) p.set(chave, valor); else p.delete(chave);
    if (chave === 'disciplina') p.delete('topico');
    setParams(p, { replace: true });
  };

  const atual = fila?.[indice];

  function confirmar() {
    if (!atual || escolha === null || !usuario) return;
    const correta = atual.gabarito === escolha;
    setCorrigida(true);
    setMotivo(null);
    setPlacar((p) => (correta ? { ...p, certas: p.certas + 1 } : { ...p, erradas: p.erradas + 1 }));
    responder.mutate({
      userId: usuario.id, questaoId: atual.id, escolha, correta, origem: modo === 'erradas' ? 'erros' : 'treino',
      tempoSeg: Math.round((Date.now() - inicio.current) / 1000), respondidaEm: new Date().toISOString(),
    });
  }

  function proxima() {
    setIndice((i) => i + 1);
    setEscolha(null);
    setCorrigida(false);
    inicio.current = Date.now();
    window.scrollTo({ top: 0 });
  }

  function escolherMotivo(m: MotivoErro) {
    if (!atual || !usuario) return;
    setMotivo(m);
    atualizarCaderno.mutate({ userId: usuario.id, questaoId: atual.id, dados: { motivo: m } });
  }

  const acertou = atual && corrigida && atual.gabarito === escolha;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/praticar" className="rounded-lg p-1.5 text-suave hover:bg-superficie-2" aria-label="Voltar para Praticar"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="text-xl font-bold tracking-tight">Resolver questões</h1>
      </div>

      <div className="cartao grid gap-3 p-4 sm:grid-cols-3">
        <label className="text-sm">
          <span className="rotulo">Disciplina</span>
          <select className="campo mt-1" value={disciplinaId} onChange={(e) => mudar('disciplina', e.target.value)}>
            <option value="">Todas</option>
            {edital.data.disciplinas.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="rotulo">Tópico</span>
          <select className="campo mt-1" value={topicoId} onChange={(e) => mudar('topico', e.target.value)} disabled={!disciplinaId}>
            <option value="">Todos</option>
            {topicosDaDisciplina.map((t) => <option key={t.id} value={t.id}>{t.numero}. {t.titulo.length > 60 ? `${t.titulo.slice(0, 60)}…` : t.titulo}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="rotulo">Quais questões</span>
          <select className="campo mt-1" value={modo} onChange={(e) => mudar('modo', e.target.value)}>
            {MODOS.map((m) => <option key={m.valor} value={m.valor}>{m.rotulo}</option>)}
          </select>
        </label>
      </div>

      {fila && fila.length > 0 && (
        <div className="flex items-center justify-between text-sm text-suave" aria-live="polite">
          <span>Questão {Math.min(indice + 1, fila.length)} de {fila.length}</span>
          <span><strong className="text-sucesso">{placar.certas}</strong> certas · <strong className="text-perigo">{placar.erradas}</strong> erradas</span>
        </div>
      )}

      {!fila ? <Carregando /> : !atual ? (
        <div className="cartao p-8 text-center">
          <PartyPopper className="mx-auto h-10 w-10 text-primaria" aria-hidden />
          <h2 className="mt-3 text-lg font-semibold">{fila.length ? 'Você terminou esta lista!' : 'Nenhuma questão com esses filtros'}</h2>
          <p className="mt-1 text-sm text-suave">
            {fila.length ? `${placar.certas} certas e ${placar.erradas} erradas.` : modo === 'novas' ? 'Você já respondeu todas — experimente “Todas” ou importe novas provas.' : 'Experimente mudar a disciplina, o tópico ou o modo.'}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {fila.length > 0 && <Botao variante="secundario" onClick={() => setRodada((r) => r + 1)}><RotateCcw className="h-4 w-4" aria-hidden /> Recomeçar</Botao>}
            <Link to="/praticar/erros"><Botao variante="secundario">Ver caderno de erros</Botao></Link>
          </div>
        </div>
      ) : (
        <>
          <QuestaoCard
            key={atual.id}
            questao={atual}
            texto={atual.texto_id ? textos.mapa.get(atual.texto_id) : undefined}
            escolha={escolha}
            aoEscolher={setEscolha}
            corrigida={corrigida}
          />
          {corrigida && !acertou && (
            <div className="cartao p-4">
              <p className="text-sm font-semibold">Por que você errou? <span className="font-normal text-suave">(vai para o caderno de erros)</span></p>
              <div className="mt-3"><SeletorMotivo valor={motivo} aoMudar={escolherMotivo} /></div>
              <Link to={`/flashcards/novo?questao=${atual.id}`} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primaria hover:underline">
                <Layers className="h-4 w-4" aria-hidden /> Criar flashcard desta questão
              </Link>
            </div>
          )}
          <div className="sticky bottom-20 z-10 flex justify-end gap-2 lg:bottom-4">
            {!corrigida ? (
              <Botao onClick={confirmar} disabled={escolha === null} className="shadow-cartao">Responder</Botao>
            ) : (
              <Botao onClick={proxima} className="shadow-cartao">
                {acertou ? 'Acertou! Próxima' : 'Próxima'} <ArrowRight className="h-4 w-4" aria-hidden />
              </Botao>
            )}
          </div>
        </>
      )}
    </div>
  );
}
