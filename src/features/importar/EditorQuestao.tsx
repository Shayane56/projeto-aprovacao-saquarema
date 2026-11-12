import { Plus, Trash2 } from 'lucide-react';
import { useId } from 'react';
import type { Edital } from '@/features/edital/tipos';
import { LETRAS } from '@/features/questoes/tipos';
import { cn } from '@/lib/cn';

export interface Rascunho {
  chave: string;
  numero: number | null;
  enunciado: string;
  alternativas: string[];
  gabarito: number | null;
  anulada: boolean;
  disciplina_id: string | null;
  topico_id: string | null;
  explicacao: string;
  texto: number | null;
  incluir: boolean;
}

export const rascunhoVazio = (disciplina_id: string | null = null): Rascunho => ({
  chave: crypto.randomUUID?.() ?? String(Math.random()),
  numero: null, enunciado: '', alternativas: ['', '', '', ''], gabarito: null, anulada: false,
  disciplina_id, topico_id: null, explicacao: '', texto: null, incluir: true,
});

/** Questão pronta para salvar? */
export function rascunhoValido(r: Rascunho): boolean {
  return Boolean(r.disciplina_id) && r.enunciado.trim().length > 0 && r.alternativas.filter((a) => a.trim()).length >= 2 && (r.anulada || r.gabarito !== null);
}

export function EditorQuestao({ valor, aoMudar, edital }: { valor: Rascunho; aoMudar: (r: Rascunho) => void; edital: Edital }) {
  const id = useId();
  const set = (parcial: Partial<Rascunho>) => aoMudar({ ...valor, ...parcial });
  const topicos = edital.topicos.filter((t) => t.disciplina_id === valor.disciplina_id);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="font-medium">Disciplina</span>
          <select className="campo mt-1" value={valor.disciplina_id ?? ''} onChange={(e) => set({ disciplina_id: e.target.value || null, topico_id: null })}>
            <option value="">Escolha…</option>
            {edital.disciplinas.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="font-medium">Tópico do edital <span className="font-normal text-suave">(opcional)</span></span>
          <select className="campo mt-1" value={valor.topico_id ?? ''} onChange={(e) => set({ topico_id: e.target.value || null })} disabled={!valor.disciplina_id}>
            <option value="">Sem tópico</option>
            {topicos.map((t) => (
              <option key={t.id} value={t.id}>{t.parent_id ? '   ' : ''}{t.numero}. {t.titulo.length > 70 ? `${t.titulo.slice(0, 70)}…` : t.titulo}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="block text-sm">
        <span className="font-medium">Enunciado</span>
        <textarea className="campo mt-1 min-h-[96px]" value={valor.enunciado} onChange={(e) => set({ enunciado: e.target.value })} />
      </label>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium">Alternativas <span className="font-normal text-suave">— marque a correta</span></legend>
        {valor.alternativas.map((alt, i) => (
          <div key={i} className="flex items-start gap-2">
            <label className={cn('mt-1.5 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border text-sm font-bold', valor.gabarito === i && !valor.anulada ? 'border-sucesso bg-sucesso text-white' : 'border-borda text-suave')}>
              <input type="radio" name={`gab-${id}`} className="sr-only" checked={valor.gabarito === i} onChange={() => set({ gabarito: i })} aria-label={`Alternativa ${LETRAS[i]} é a correta`} />
              {LETRAS[i]}
            </label>
            <textarea
              rows={1}
              className="campo min-h-[44px] flex-1 resize-y"
              value={alt}
              onChange={(e) => set({ alternativas: valor.alternativas.map((a, j) => (j === i ? e.target.value : a)) })}
              aria-label={`Texto da alternativa ${LETRAS[i]}`}
            />
            {valor.alternativas.length > 2 && (
              <button type="button" className="mt-2 rounded-lg p-1.5 text-suave hover:text-perigo" aria-label={`Remover alternativa ${LETRAS[i]}`}
                onClick={() => set({ alternativas: valor.alternativas.filter((_, j) => j !== i), gabarito: valor.gabarito === i ? null : valor.gabarito !== null && valor.gabarito > i ? valor.gabarito - 1 : valor.gabarito })}>
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-4 pt-1">
          {valor.alternativas.length < 5 && (
            <button type="button" className="inline-flex items-center gap-1 text-sm font-medium text-primaria" onClick={() => set({ alternativas: [...valor.alternativas, ''] })}>
              <Plus className="h-4 w-4" aria-hidden /> Alternativa
            </button>
          )}
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={valor.anulada} onChange={(e) => set({ anulada: e.target.checked })} className="h-4 w-4 accent-[rgb(var(--alerta))]" />
            Questão anulada
          </label>
        </div>
      </fieldset>

      <label className="block text-sm">
        <span className="font-medium">Comentário <span className="font-normal text-suave">(opcional)</span></span>
        <textarea className="campo mt-1 min-h-[64px]" value={valor.explicacao} onChange={(e) => set({ explicacao: e.target.value })} placeholder="Por que a resposta é essa?" />
      </label>
    </div>
  );
}
