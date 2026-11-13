import { ArrowLeft, PartyPopper } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { useEdital } from '@/features/edital/hooks';
import { usePreferencias } from '@/features/perfil/preferencias';
import { cn } from '@/lib/cn';
import { corDe } from '@/shared/cores';
import { BarraProgresso, Botao, Carregando, ErroCarga } from '@/shared/ui';
import { criarAgendador, montarFilaEstudo, preverNotas } from './agendador';
import { useFlashcards, useRevisar, useRevisoesHoje } from './hooks';
import { NOTAS } from './tipos';
import { TextoCartao } from './TextoCartao';

export function EstudoPage() {
  const { usuario } = useAuth();
  const edital = useEdital();
  const cartoes = useFlashcards();
  const revisoes = useRevisoesHoje();
  const { estudo } = usePreferencias();
  const revisar = useRevisar();
  const [params] = useSearchParams();
  const disciplinaId = params.get('disciplina') ?? undefined;
  const [verso, setVerso] = useState(false);
  const [feitos, setFeitos] = useState(0);
  const inicio = useRef(Date.now());

  const dataProva = edital.data?.concurso.prova_inicio ? new Date(edital.data.concurso.prova_inicio) : null;
  const agora = new Date();
  const fila = useMemo(
    () => (cartoes.data && revisoes.data ? montarFilaEstudo(cartoes.data, revisoes.data, estudo.novosPorDia, new Date(), disciplinaId) : []),
    [cartoes.data, revisoes.data, estudo.novosPorDia, disciplinaId],
  );

  if (cartoes.isPending || revisoes.isPending || edital.isPending) return <Carregando />;
  if (!cartoes.data || !revisoes.data || !edital.data) return <ErroCarga erro={cartoes.error ?? revisoes.error} />;

  const atual = fila[0];
  const disciplina = atual && edital.data.disciplinas.find((d) => d.id === atual.disciplina_id);
  const previsoes = atual ? preverNotas(criarAgendador(dataProva, agora), atual, agora) : [];

  function responder(nota: 1 | 2 | 3 | 4) {
    if (!atual || !usuario) return;
    const p = previsoes.find((x) => x.nota === nota)!;
    revisar.mutate({ userId: usuario.id, id: atual.id, estado: p.estado, log: { ...p.log, duracao_ms: Date.now() - inicio.current } });
    setFeitos((n) => n + 1);
    setVerso(false);
    inicio.current = Date.now();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/flashcards" className="rounded-lg p-1.5 text-suave hover:bg-superficie-2" aria-label="Voltar para Flashcards"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="text-xl font-bold tracking-tight">Revisão de flashcards</h1>
      </div>
      {fila.length > 0 && (
        <div>
          <div className="mb-1 flex justify-between text-xs text-suave"><span>{feitos} feitos</span><span>{fila.length} na fila</span></div>
          <BarraProgresso valor={feitos / (feitos + fila.length)} rotulo="Progresso da revisão" />
        </div>
      )}

      {!atual ? (
        <div className="cartao p-8 text-center">
          <PartyPopper className="mx-auto h-10 w-10 text-primaria" aria-hidden />
          <h2 className="mt-3 text-lg font-semibold">{feitos ? 'Revisão concluída!' : 'Nada para revisar agora'}</h2>
          <p className="mt-1 text-sm text-suave">{feitos ? `Você revisou ${feitos} ${feitos === 1 ? 'cartão' : 'cartões'}. Volte amanhã para a próxima rodada.` : 'Os próximos cartões aparecem quando chegar a hora certa de revisar.'}</p>
          <Link to="/flashcards"><Botao variante="secundario" className="mt-5">Voltar</Botao></Link>
        </div>
      ) : (
        <>
          <article className="cartao flex min-h-[260px] flex-col p-6" aria-live="polite">
            <div className="flex items-center gap-2 text-xs">
              {disciplina && <span className={cn('rounded-md px-2 py-0.5 font-bold', corDe(disciplina.cor).chip)}>{disciplina.sigla}</span>}
              <span className="text-suave">{atual.state === 0 ? 'Cartão novo' : atual.state === 2 ? 'Revisão' : 'Aprendendo'}</span>
            </div>
            <p className="mt-5 whitespace-pre-line text-lg font-semibold leading-snug">{atual.frente}</p>
            {verso && <p className="mt-5 whitespace-pre-line border-t border-borda pt-5 text-[16px] leading-relaxed"><TextoCartao texto={atual.verso} /></p>}
          </article>

          {!verso ? (
            <Botao className="w-full py-3.5" onClick={() => setVerso(true)}>Mostrar resposta</Botao>
          ) : (
            <div>
              <p className="mb-2 text-center text-xs text-suave">Como foi lembrar?</p>
              <div className="grid grid-cols-4 gap-2">
                {NOTAS.map((n) => (
                  <button key={n.valor} type="button" onClick={() => responder(n.valor)} className={cn('flex flex-col items-center rounded-xl border px-1 py-2.5 text-sm font-semibold', n.classe)}>
                    {n.rotulo}
                    <span className="mt-0.5 text-[11px] font-medium opacity-80">{previsoes.find((p) => p.nota === n.valor)?.intervalo}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
