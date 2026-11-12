import { BookOpen, Check, ChevronDown, X } from 'lucide-react';
import { useState } from 'react';
import { useEdital } from '@/features/edital/hooks';
import { cn } from '@/lib/cn';
import { corDe } from '@/shared/cores';
import { LETRAS, type Questao, type TextoApoio } from './tipos';

interface Props {
  questao: Questao;
  texto?: TextoApoio;
  numero?: number;
  escolha: number | null;
  aoEscolher?: (i: number) => void;
  /** Mostra certo/errado e a explicação. */
  corrigida?: boolean;
  bloqueada?: boolean;
}

export function QuestaoCard({ questao, texto, numero, escolha, aoEscolher, corrigida, bloqueada }: Props) {
  const edital = useEdital();
  const disciplina = edital.data?.disciplinas.find((d) => d.id === questao.disciplina_id);
  const topico = edital.data?.topicos.find((t) => t.id === questao.topico_id);
  const [textoAberto, setTextoAberto] = useState(true);

  return (
    <article className="cartao p-4 sm:p-6" aria-label={numero ? `Questão ${numero}` : 'Questão'}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {numero !== undefined && <span className="rounded-md bg-primaria px-2 py-0.5 font-bold text-primaria-texto">{numero}</span>}
        {disciplina && <span className={cn('rounded-md px-2 py-0.5 font-bold', corDe(disciplina.cor).chip)}>{disciplina.sigla}</span>}
        {topico && <span className="min-w-0 truncate text-suave" title={topico.titulo}>{topico.numero}. {topico.titulo}</span>}
      </div>

      {texto && (
        <div className="mt-4 rounded-xl border border-borda bg-superficie-2/60">
          <button type="button" onClick={() => setTextoAberto((a) => !a)} aria-expanded={textoAberto} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold">
            <BookOpen className="h-4 w-4 text-primaria" aria-hidden /> {texto.titulo || 'Texto de apoio'}
            <ChevronDown className={cn('ml-auto h-4 w-4 text-suave transition-transform', textoAberto && 'rotate-180')} aria-hidden />
          </button>
          {textoAberto && <p className="whitespace-pre-line px-4 pb-4 text-[15px] leading-relaxed">{texto.conteudo}</p>}
        </div>
      )}

      <p className="mt-4 whitespace-pre-line text-[16px] leading-relaxed">{questao.enunciado}</p>

      <div className="mt-4 space-y-2.5" role="radiogroup" aria-label="Alternativas">
        {questao.alternativas.map((alt, i) => {
          const marcada = escolha === i;
          const certa = corrigida && (questao.anulada || questao.gabarito === i);
          const errada = corrigida && marcada && !certa;
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={marcada}
              aria-label={`Alternativa ${LETRAS[i]}: ${alt}`}
              disabled={bloqueada || corrigida || !aoEscolher}
              onClick={() => aoEscolher?.(i)}
              className={cn(
                'flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left text-[15px] leading-snug transition-colors disabled:cursor-default',
                certa ? 'border-sucesso bg-sucesso/10' : errada ? 'border-perigo bg-perigo/10' : marcada ? 'border-primaria bg-primaria-suave' : 'border-borda hover:bg-superficie-2',
              )}
            >
              <span
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm font-bold',
                  certa ? 'border-sucesso bg-sucesso text-white' : errada ? 'border-perigo bg-perigo text-white' : marcada ? 'border-primaria bg-primaria text-primaria-texto' : 'border-borda text-suave',
                )}
                aria-hidden
              >
                {certa ? <Check className="h-4 w-4" /> : errada ? <X className="h-4 w-4" /> : LETRAS[i]}
              </span>
              <span className="pt-0.5">{alt}</span>
            </button>
          );
        })}
      </div>

      {corrigida && (
        <div className="mt-4 space-y-2">
          {questao.anulada && <p className="text-sm font-semibold text-alerta">Questão anulada pela banca — conta como acerto.</p>}
          {questao.explicacao && (
            <div className="rounded-xl border border-primaria/20 bg-primaria-suave/50 p-3.5 text-sm leading-relaxed">
              <p className="font-semibold text-primaria">Comentário</p>
              <p className="mt-1 whitespace-pre-line">{questao.explicacao}</p>
            </div>
          )}
          {questao.fonte && <p className="text-xs text-suave">Fonte: {questao.fonte}{questao.numero_original ? ` · questão ${questao.numero_original}` : ''}</p>}
        </div>
      )}
    </article>
  );
}
