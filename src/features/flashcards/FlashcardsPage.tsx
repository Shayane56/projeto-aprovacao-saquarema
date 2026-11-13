import { ArrowLeft, ArrowRight, Layers, Loader2, PauseCircle, Pencil, PlayCircle, Plus, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useEdital } from '@/features/edital/hooks';
import { usePreferencias } from '@/features/perfil/preferencias';
import { cn } from '@/lib/cn';
import { corDe } from '@/shared/cores';
import { useAgora } from '@/shared/hooks/useAgora';
import { Botao, Carregando, ErroCarga } from '@/shared/ui';
import { resumirCartoes } from './agendador';
import { useAlterarCartao, useFlashcards, useInstalarCartoes, useRevisoesHoje } from './hooks';
import { TextoCartao } from './TextoCartao';

const semAcento = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const ROTULO_ESTADO = ['Novo', 'Aprendendo', 'Em revisão', 'Reaprendendo'];

export function FlashcardsPage() {
  const edital = useEdital();
  const cartoes = useFlashcards();
  const revisoes = useRevisoesHoje();
  const { estudo } = usePreferencias();
  const instalacao = useInstalarCartoes();
  const alterar = useAlterarCartao();
  const agora = useAgora(60_000);
  const [busca, setBusca] = useState('');
  const [mostrarLista, setMostrarLista] = useState(false);

  const filtrados = useMemo(() => {
    const t = semAcento(busca.trim());
    return (cartoes.data ?? []).filter((c) => !t || semAcento(`${c.frente} ${c.verso}`).includes(t));
  }, [cartoes.data, busca]);

  if (edital.isPending || cartoes.isPending) return <Carregando />;
  if (!edital.data || !cartoes.data) return <ErroCarga erro={edital.error ?? cartoes.error} tentarDeNovo={() => void cartoes.refetch()} />;

  const hoje = revisoes.data ?? [];
  const geral = resumirCartoes(cartoes.data, hoje, estudo.novosPorDia, agora);
  const paraHoje = geral.paraRevisar + geral.novosDisponiveis;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Link to="/praticar" className="rounded-lg p-1.5 text-suave hover:bg-superficie-2" aria-label="Voltar para Praticar"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="text-xl font-bold tracking-tight">Flashcards</h1>
      </div>

      {instalacao === 'instalando' && (
        <p className="flex items-center gap-2 rounded-xl bg-primaria-suave/60 px-4 py-3 text-sm" role="status">
          <Loader2 className="h-4 w-4 animate-spin text-primaria" aria-hidden /> Instalando o pacote de cartões…
        </p>
      )}

      <section className="rounded-2xl bg-gradient-to-br from-blue-600 to-blue-900 p-5 text-white shadow-cartao" aria-label="Revisão de hoje">
        <p className="text-sm text-blue-100">Para hoje</p>
        <p className="mt-1 flex items-baseline gap-2"><span className="text-5xl font-bold tabular-nums">{paraHoje}</span><span className="text-lg font-semibold">{paraHoje === 1 ? 'cartão' : 'cartões'}</span></p>
        <p className="mt-1 text-sm text-blue-100">{geral.paraRevisar} para revisar · {geral.novosDisponiveis} novos · {hoje.length} revisões feitas hoje</p>
        <Link to="/flashcards/estudar" className={cn('mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 font-semibold text-blue-800', !paraHoje && 'pointer-events-none opacity-60')} aria-disabled={!paraHoje}>
          <PlayCircle className="h-5 w-5" aria-hidden /> {paraHoje ? 'Estudar agora' : 'Tudo em dia por hoje'}
        </Link>
        <p className="mt-3 text-xs text-blue-100">A revisão espaçada (FSRS) mostra cada cartão pouco antes de você esquecer. Responder todo dia é o que faz funcionar.</p>
      </section>

      <section className="cartao divide-y divide-borda" aria-label="Por disciplina">
        {edital.data.disciplinas.map((d) => {
          const r = resumirCartoes(cartoes.data, hoje, estudo.novosPorDia, agora, d.id);
          if (!r.total) return null;
          const pendentes = r.paraRevisar + r.novosDisponiveis;
          return (
            <div key={d.id} className="flex items-center gap-3 p-4">
              <span className={cn('rounded-md px-2 py-0.5 text-xs font-bold', corDe(d.cor).chip)}>{d.sigla}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{d.nome}</p>
                <p className="text-xs text-suave">{r.total} cartões · {r.aprendidos} em revisão · {r.paraRevisar} vencidos</p>
              </div>
              <Link to={`/flashcards/estudar?disciplina=${d.id}`} className={cn('inline-flex items-center gap-1 text-sm font-semibold text-primaria', !pendentes && 'pointer-events-none text-suave')}>
                {pendentes ? `Estudar ${pendentes}` : 'Em dia'} {pendentes > 0 && <ArrowRight className="h-4 w-4" aria-hidden />}
              </Link>
            </div>
          );
        })}
      </section>

      <div className="flex flex-wrap gap-2">
        <Link to="/flashcards/novo"><Botao><Plus className="h-4 w-4" aria-hidden /> Novo cartão</Botao></Link>
        <Botao variante="secundario" onClick={() => setMostrarLista((m) => !m)} aria-expanded={mostrarLista}>
          <Layers className="h-4 w-4" aria-hidden /> {mostrarLista ? 'Ocultar cartões' : `Ver todos (${cartoes.data.length})`}
        </Botao>
      </div>
      <p className="text-xs text-suave">Limite de {estudo.novosPorDia} cartões novos por dia — ajuste em Plano → Disponibilidade.</p>

      {mostrarLista && (
        <section className="space-y-3" aria-label="Todos os cartões">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-suave" aria-hidden />
            <input type="search" className="campo pl-9" placeholder="Buscar nos cartões" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar nos cartões" />
          </div>
          <ul className="space-y-2">
            {filtrados.slice(0, 200).map((c) => (
              <li key={c.id} className={cn('cartao p-4', c.suspenso && 'opacity-55')}>
                <p className="font-medium">{c.frente}</p>
                <p className="mt-1 text-sm text-suave"><TextoCartao texto={c.verso} /></p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-suave">
                  <span>{c.suspenso ? 'Suspenso' : ROTULO_ESTADO[c.state]}</span>
                  {c.state !== 0 && <span>próxima: {new Date(c.due).toLocaleDateString('pt-BR')}</span>}
                  <span className="ml-auto flex gap-1">
                    <Link to={`/flashcards/${c.id}`} className="rounded-lg p-1.5 hover:bg-superficie-2" aria-label="Editar cartão"><Pencil className="h-4 w-4" /></Link>
                    <button type="button" className="rounded-lg p-1.5 hover:bg-superficie-2" aria-label={c.suspenso ? 'Reativar cartão' : 'Suspender cartão'} onClick={() => alterar.mutate({ id: c.id, acao: c.suspenso ? 'reativar' : 'suspender' })}>
                      {c.suspenso ? <PlayCircle className="h-4 w-4" /> : <PauseCircle className="h-4 w-4" />}
                    </button>
                    <button type="button" className="rounded-lg p-1.5 hover:bg-superficie-2 hover:text-perigo" aria-label="Excluir cartão" onClick={() => { if (window.confirm('Excluir este cartão?')) alterar.mutate({ id: c.id, acao: 'excluir' }); }}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
          {filtrados.length > 200 && <p className="text-center text-xs text-suave">Mostrando 200 de {filtrados.length}. Use a busca para encontrar outros.</p>}
        </section>
      )}
    </div>
  );
}
