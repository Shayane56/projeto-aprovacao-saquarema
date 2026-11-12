import { ChevronDown, ExternalLink, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { cn } from '@/lib/cn';
import { corDe } from '@/shared/cores';
import { BarraProgresso, Carregando, ErroCarga } from '@/shared/ui';
import { useDefinirStatus, useResumoProgresso } from './hooks';
import { conclusaoDisciplina, conclusaoTopico, indexar, pct, pontosDoBloco, statusDe, type IndiceEdital } from './progresso';
import { pontoStatus, StatusSelect } from './StatusSelect';
import { STATUS, type Disciplina, type Edital, type MapaProgresso, type StatusTopico, type Topico } from './tipos';

type Filtro = StatusTopico | 'todos';

const semAcento = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export function EditalPage() {
  const { edital, progresso, resumo, carregando, erro } = useResumoProgresso();
  const [params, setParams] = useSearchParams();
  const [busca, setBusca] = useState('');
  const filtro = (params.get('status') as Filtro | null) ?? 'todos';
  const indice = useMemo(() => (edital.data ? indexar(edital.data.topicos) : undefined), [edital.data]);

  if (carregando) return <Carregando texto="Carregando o edital…" />;
  if (erro || !edital.data || !progresso.data || !resumo || !indice) {
    return <ErroCarga erro={erro} tentarDeNovo={() => { void edital.refetch(); void progresso.refetch(); }} />;
  }

  const mudarFiltro = (f: Filtro) => {
    const p = new URLSearchParams(params);
    if (f === 'todos') p.delete('status'); else p.set('status', f);
    setParams(p, { replace: true });
  };

  const termo = semAcento(busca.trim());
  const filtrar = (t: Topico) =>
    (filtro === 'todos' || statusDe(progresso.data, t.id) === filtro) && (!termo || semAcento(t.titulo).includes(termo));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Edital verticalizado</h1>
          <p className="mt-1 text-sm text-suave">Marque o status de cada tópico. O progresso considera o peso de cada disciplina na prova.</p>
        </div>
        <div className="sm:text-right">
          <div className="text-3xl font-bold text-primaria">{pct(resumo.geral)}%</div>
          <div className="text-xs text-suave">progresso ponderado</div>
        </div>
      </div>

      <div className="sticky top-[60px] z-10 -mx-4 mt-5 border-b border-borda bg-fundo/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:top-0">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-suave" aria-hidden />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar tópico (ex.: dengue, crase, PNAB)"
            className="campo pl-9"
            aria-label="Buscar tópico"
          />
        </div>
        <div className="mt-2.5 flex gap-2 overflow-x-auto pb-0.5" role="group" aria-label="Filtrar por status">
          <ChipFiltro ativo={filtro === 'todos'} onClick={() => mudarFiltro('todos')}>
            Todos <span className="text-suave">{resumo.totalEstudavel}</span>
          </ChipFiltro>
          {STATUS.map((s) => (
            <ChipFiltro key={s.valor} ativo={filtro === s.valor} onClick={() => mudarFiltro(s.valor)}>
              <span className={cn('h-2 w-2 rounded-full', pontoStatus[s.valor])} aria-hidden />
              {s.rotulo} <span className="text-suave">{resumo.contagem[s.valor]}</span>
            </ChipFiltro>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {edital.data.disciplinas.map((d) => (
          <SecaoDisciplina
            key={d.id}
            edital={edital.data}
            disciplina={d}
            indice={indice}
            progresso={progresso.data}
            filtrar={filtrar}
            filtrando={filtro !== 'todos' || Boolean(termo)}
            abertaInicial={params.get('disciplina') ? params.get('disciplina') === d.id : true}
          />
        ))}
      </div>
    </div>
  );
}

function ChipFiltro({ ativo, children, onClick }: { ativo: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors',
        ativo ? 'border-primaria bg-primaria-suave text-primaria' : 'border-borda bg-superficie text-texto hover:bg-superficie-2',
      )}
    >
      {children}
    </button>
  );
}

interface SecaoProps {
  edital: Edital;
  disciplina: Disciplina;
  indice: IndiceEdital;
  progresso: MapaProgresso;
  filtrar: (t: Topico) => boolean;
  filtrando: boolean;
  abertaInicial: boolean;
}

function SecaoDisciplina({ edital, disciplina, indice, progresso, filtrar, filtrando, abertaInicial }: SecaoProps) {
  const [aberta, setAberta] = useState(abertaInicial);
  const cor = corDe(disciplina.cor);
  const bloco = edital.blocos.find((b) => b.id === disciplina.bloco_id);
  const compartilhado = edital.disciplinas.filter((d) => d.bloco_id === disciplina.bloco_id).length > 1;
  const itens = indice.raiz.get(disciplina.id) ?? [];
  const visiveis = itens.filter((t) => filtrar(t) || (indice.filhos.get(t.id) ?? []).some(filtrar));
  const conclusao = conclusaoDisciplina(disciplina, indice, progresso);

  if (filtrando && visiveis.length === 0) return null;
  const expandida = aberta || filtrando;

  return (
    <section className="cartao overflow-hidden" aria-labelledby={`disc-${disciplina.id}`}>
      <button type="button" onClick={() => setAberta((a) => !a)} aria-expanded={expandida} className="flex w-full items-start gap-3 p-4 text-left sm:p-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('rounded-md px-2 py-0.5 text-xs font-bold', cor.chip)}>{disciplina.sigla}</span>
            <h2 id={`disc-${disciplina.id}`} className="font-semibold">{disciplina.nome}</h2>
          </div>
          {bloco && (
            <p className="mt-1 text-xs text-suave">
              {compartilhado
                ? `Bloco “${bloco.nome}”: ${bloco.num_questoes} questões × ${bloco.valor_questao} pt = ${pontosDoBloco(bloco)} pts no total`
                : `${bloco.num_questoes} questões × ${bloco.valor_questao} pts = ${pontosDoBloco(bloco)} pts`}
              {' · '}{itens.length} itens
            </p>
          )}
          <div className="mt-3 flex items-center gap-3">
            <BarraProgresso valor={conclusao} cor={cor.barra} rotulo={`Progresso em ${disciplina.nome}`} />
            <span className="w-10 shrink-0 text-right text-sm font-semibold">{pct(conclusao)}%</span>
          </div>
        </div>
        <ChevronDown className={cn('mt-1 h-5 w-5 shrink-0 text-suave transition-transform', expandida && 'rotate-180')} aria-hidden />
      </button>

      {expandida && (
        <ul className="divide-y divide-borda border-t border-borda">
          {visiveis.map((t) => (
            <ItemTopico key={t.id} topico={t} indice={indice} progresso={progresso} filtrar={filtrar} filtrando={filtrando} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ItemTopico({ topico, indice, progresso, filtrar, filtrando }: { topico: Topico; indice: IndiceEdital; progresso: MapaProgresso; filtrar: (t: Topico) => boolean; filtrando: boolean }) {
  const { usuario } = useAuth();
  const definir = useDefinirStatus();
  const subitens = indice.filhos.get(topico.id) ?? [];
  const [aberto, setAberto] = useState(false);
  const mudar = (t: Topico, status: StatusTopico) => usuario && definir.mutate({ userId: usuario.id, topicoId: t.id, status });

  if (subitens.length === 0) {
    return (
      <li className="flex items-start gap-3 px-4 py-3 sm:px-5">
        <Numero n={topico.numero} />
        <div className="min-w-0 flex-1 pt-1.5">
          <p className="text-[15px] leading-snug">{topico.titulo}</p>
          <Referencia topico={topico} />
        </div>
        <StatusSelect valor={statusDe(progresso, topico.id)} aoMudar={(s) => mudar(topico, s)} rotulo={topico.titulo} />
      </li>
    );
  }

  const conclusao = conclusaoTopico(topico, indice, progresso);
  const mostrar = filtrando ? subitens.filter(filtrar) : subitens;
  const expandido = aberto || filtrando;
  return (
    <li className="px-4 py-3 sm:px-5">
      <button type="button" onClick={() => setAberto((a) => !a)} aria-expanded={expandido} className="flex w-full items-start gap-3 text-left">
        <Numero n={topico.numero} />
        <div className="min-w-0 flex-1 pt-1.5">
          <p className="text-[15px] leading-snug">{topico.titulo}</p>
          <div className="mt-2 flex items-center gap-2 text-xs text-suave">
            <BarraProgresso valor={conclusao} className="h-1.5 max-w-40" rotulo={`Progresso do item ${topico.numero}`} />
            <span>{pct(conclusao)}% · {subitens.length} subitens</span>
          </div>
        </div>
        <ChevronDown className={cn('mt-2 h-4 w-4 shrink-0 text-suave transition-transform', expandido && 'rotate-180')} aria-hidden />
      </button>
      {expandido && (
        <ul className="ml-4 mt-3 space-y-1 border-l-2 border-borda pl-4 sm:ml-12">
          {mostrar.map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-1">
              <span className="w-8 shrink-0 text-xs font-semibold text-suave">{s.numero}</span>
              <p className="min-w-0 flex-1 text-sm">{s.titulo}</p>
              <StatusSelect valor={statusDe(progresso, s.id)} aoMudar={(st) => mudar(s, st)} rotulo={s.titulo} />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function Numero({ n }: { n: string }) {
  return <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-superficie-2 text-xs font-bold text-suave">{n}</span>;
}

function Referencia({ topico }: { topico: Topico }) {
  if (!topico.referencia && !topico.link) return null;
  return (
    <p className="mt-1 text-xs text-suave">
      {topico.referencia}{' '}
      {topico.link && (
        <a href={topico.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-medium text-primaria hover:underline">
          Abrir fonte <ExternalLink className="h-3 w-3" aria-hidden />
        </a>
      )}
    </p>
  );
}
