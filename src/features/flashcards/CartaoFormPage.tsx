import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useEdital } from '@/features/edital/hooks';
import { useMapaQuestoes } from '@/features/questoes/hooks';
import { mensagemDeErro } from '@/lib/supabase';
import { Aviso, Botao, Carregando, ErroCarga } from '@/shared/ui';
import { useFlashcards, useSalvarFlashcard } from './hooks';

/** Criar ou editar um cartão. Com ?questao=ID, já vem preenchido a partir da questão. */
export function CartaoFormPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const edital = useEdital();
  const cartoes = useFlashcards();
  const questoes = useMapaQuestoes();
  const salvar = useSalvarFlashcard();
  const navegar = useNavigate();

  if (edital.isPending || cartoes.isPending) return <Carregando />;
  if (!edital.data || !cartoes.data) return <ErroCarga erro={edital.error ?? cartoes.error} />;

  const existente = id ? cartoes.data.find((c) => c.id === id) : undefined;
  if (id && !existente) return <ErroCarga erro={new Error('Cartão não encontrado.')} />;
  const questao = params.get('questao') ? questoes.get(params.get('questao')!) : undefined;
  const inicial = existente
    ? { frente: existente.frente, verso: existente.verso, disciplina_id: existente.disciplina_id, topico_id: existente.topico_id, questao_id: existente.questao_id }
    : questao
      ? {
          frente: questao.enunciado,
          verso: [questao.gabarito !== null ? questao.alternativas[questao.gabarito] : '', questao.explicacao ?? ''].filter(Boolean).join('\n\n'),
          disciplina_id: questao.disciplina_id, topico_id: questao.topico_id, questao_id: questao.id,
        }
      : { frente: '', verso: '', disciplina_id: params.get('disciplina') ?? edital.data.disciplinas[0].id, topico_id: null, questao_id: null };

  return (
    <Formulario
      key={id ?? questao?.id ?? 'novo'}
      titulo={existente ? 'Editar cartão' : questao ? 'Cartão a partir do erro' : 'Novo cartão'}
      inicial={inicial}
      disciplinas={edital.data.disciplinas}
      topicos={edital.data.topicos}
      salvando={salvar.isPending}
      aoSalvar={async (dados) => {
        await salvar.mutateAsync({ id: existente?.id, dados: { ...dados, origem: existente?.origem ?? (questao ? 'erro' : 'manual') } });
        if (questao) navegar(-1);
        else navegar('/flashcards');
      }}
    />
  );
}

interface Dados { frente: string; verso: string; disciplina_id: string; topico_id: string | null; questao_id: string | null }

function Formulario({ titulo, inicial, disciplinas, topicos, salvando, aoSalvar }: {
  titulo: string; inicial: Dados; disciplinas: { id: string; nome: string }[]; topicos: { id: string; disciplina_id: string; numero: string; titulo: string; parent_id: string | null }[];
  salvando: boolean; aoSalvar: (d: Dados) => Promise<void>;
}) {
  const [d, setD] = useState(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const valido = d.frente.trim() && d.verso.trim() && d.disciplina_id;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/flashcards" className="rounded-lg p-1.5 text-suave hover:bg-superficie-2" aria-label="Voltar para Flashcards"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="text-xl font-bold tracking-tight">{titulo}</h1>
      </div>
      <div className="cartao space-y-4 p-5">
        <label className="block text-sm">
          <span className="font-medium">Frente (pergunta)</span>
          <textarea className="campo mt-1 min-h-[96px]" value={d.frente} onChange={(e) => setD({ ...d, frente: e.target.value })} placeholder="Ex.: Vetor da malária?" />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Verso (resposta)</span>
          <textarea className="campo mt-1 min-h-[96px]" value={d.verso} onChange={(e) => setD({ ...d, verso: e.target.value })} placeholder="Ex.: Fêmea do Anopheles, infectada por Plasmodium." />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="font-medium">Disciplina</span>
            <select className="campo mt-1" value={d.disciplina_id} onChange={(e) => setD({ ...d, disciplina_id: e.target.value, topico_id: null })}>
              {disciplinas.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="font-medium">Tópico <span className="font-normal text-suave">(opcional)</span></span>
            <select className="campo mt-1" value={d.topico_id ?? ''} onChange={(e) => setD({ ...d, topico_id: e.target.value || null })}>
              <option value="">Sem tópico</option>
              {topicos.filter((t) => t.disciplina_id === d.disciplina_id).map((t) => (
                <option key={t.id} value={t.id}>{t.parent_id ? '   ' : ''}{t.numero}. {t.titulo.length > 60 ? `${t.titulo.slice(0, 60)}…` : t.titulo}</option>
              ))}
            </select>
          </label>
        </div>
        <p className="text-xs text-suave">Dica: cartões curtos funcionam melhor — uma ideia por cartão.</p>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        <Botao disabled={!valido} carregando={salvando} onClick={async () => {
          setErro(null);
          try { await aoSalvar({ ...d, frente: d.frente.trim(), verso: d.verso.trim() }); } catch (e) { setErro(mensagemDeErro(e)); }
        }}>Salvar cartão</Botao>
      </div>
    </div>
  );
}
