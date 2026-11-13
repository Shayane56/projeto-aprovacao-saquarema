import { ExternalLink, FileText, Link2, Loader2, NotebookPen, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { useEdital } from '@/features/edital/hooks';
import type { Edital } from '@/features/edital/tipos';
import { cn } from '@/lib/cn';
import { mensagemDeErro } from '@/lib/supabase';
import { useOnline } from '@/shared/hooks/useOnline';
import { Aviso, Botao, Campo, Carregando, ErroCarga } from '@/shared/ui';
import { useAnotacoes, useBuscaMateriais, useCriarLink, useEnviarPdf, useExcluirMaterial, useMateriais } from './hooks';
import { formatarTamanho, partesDoTrecho, TAMANHO_MAXIMO, type Material } from './tipos';

type Aba = 'materiais' | 'anotacoes';

export function MateriaisPage() {
  const edital = useEdital();
  const materiais = useMateriais();
  const notas = useAnotacoes();
  const [params, setParams] = useSearchParams();
  const topicoFiltro = params.get('topico');
  const aba = (params.get('aba') as Aba | null) ?? 'materiais';
  const [busca, setBusca] = useState('');
  const [adicionando, setAdicionando] = useState(false);

  if (edital.isPending || materiais.isPending) return <Carregando />;
  if (!edital.data || !materiais.data) return <ErroCarga erro={edital.error ?? materiais.error} tentarDeNovo={() => void materiais.refetch()} />;

  const topico = topicoFiltro ? edital.data.topicos.find((t) => t.id === topicoFiltro) : undefined;
  const mudarAba = (a: Aba) => setParams(a === 'materiais' ? {} : { aba: a }, { replace: true });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Materiais</h1>
          <p className="mt-1 text-sm text-suave">Seus PDFs, links e anotações, ligados ao edital. A busca procura dentro de todos os PDFs.</p>
        </div>
        {aba === 'materiais' && <Botao onClick={() => setAdicionando((a) => !a)} aria-expanded={adicionando}><Plus className="h-4 w-4" aria-hidden /> Adicionar</Botao>}
      </div>

      <div className="flex gap-2" role="tablist" aria-label="Seções">
        {([['materiais', 'Materiais', FileText], ['anotacoes', 'Anotações', NotebookPen]] as const).map(([v, r, Icone]) => (
          <button key={v} type="button" role="tab" aria-selected={aba === v} onClick={() => mudarAba(v)}
            className={cn('inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium', aba === v ? 'border-primaria bg-primaria-suave text-primaria' : 'border-borda bg-superficie')}>
            <Icone className="h-4 w-4" aria-hidden /> {r}
            {v === 'anotacoes' && notas.data ? <span className="text-suave">{notas.data.length}</span> : null}
          </button>
        ))}
      </div>

      {aba === 'anotacoes' ? <ListaAnotacoes edital={edital.data} /> : (
        <>
          {adicionando && <Adicionar edital={edital.data} topicoInicial={topicoFiltro} aoConcluir={() => setAdicionando(false)} />}

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-suave" aria-hidden />
            <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} className="campo pl-9" placeholder="Buscar dentro dos PDFs (ex.: vereadores, Aedes, PNAB)" aria-label="Buscar dentro dos materiais" />
          </div>

          {busca.trim().length >= 3 ? <ResultadosBusca consulta={busca} /> : (
            <>
              {topico && (
                <div className="flex items-center justify-between gap-2 rounded-xl bg-primaria-suave/60 px-4 py-2.5 text-sm">
                  <span className="min-w-0 truncate">Tópico: <strong>{topico.numero}. {topico.titulo}</strong></span>
                  <button type="button" onClick={() => setParams({}, { replace: true })} className="shrink-0 rounded-lg p-1 hover:bg-superficie" aria-label="Mostrar todos os materiais"><X className="h-4 w-4" /></button>
                </div>
              )}
              <ListaMateriais edital={edital.data} materiais={materiais.data.filter((m) => !topicoFiltro || m.topico_id === topicoFiltro || m.topico_id?.startsWith(`${topicoFiltro}-`))} />
            </>
          )}
        </>
      )}
    </div>
  );
}

function ListaMateriais({ edital, materiais }: { edital: Edital; materiais: Material[] }) {
  const excluir = useExcluirMaterial();
  const grupos = useMemo(() => {
    const porDisc = new Map<string, Material[]>();
    for (const m of materiais) porDisc.set(m.disciplina_id ?? '', [...(porDisc.get(m.disciplina_id ?? '') ?? []), m]);
    return [...edital.disciplinas.map((d) => ({ id: d.id, nome: d.nome })), { id: '', nome: 'Geral' }].map((g) => ({ ...g, itens: porDisc.get(g.id) ?? [] })).filter((g) => g.itens.length);
  }, [edital, materiais]);

  if (!materiais.length) {
    return (
      <div className="cartao p-8 text-center">
        <FileText className="mx-auto h-9 w-9 text-suave" aria-hidden />
        <p className="mt-3 font-semibold">Nenhum material ainda</p>
        <p className="mt-1 text-sm text-suave">Toque em <strong>Adicionar</strong> e envie o edital, a Lei Orgânica, o documento do município ou suas apostilas em PDF.</p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {grupos.map((g) => (
        <section key={g.id || 'geral'} aria-label={g.nome}>
          <h2 className="mb-2 text-sm font-semibold text-suave">{g.nome}</h2>
          <ul className="space-y-2">
            {g.itens.map((m) => {
              const topico = edital.topicos.find((t) => t.id === m.topico_id);
              return (
                <li key={m.id} className="cartao flex items-center gap-3 p-3.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primaria-suave text-primaria">
                    {m.tipo === 'pdf' ? <FileText className="h-5 w-5" aria-hidden /> : <Link2 className="h-5 w-5" aria-hidden />}
                  </span>
                  {m.tipo === 'pdf' ? (
                    <Link to={`/materiais/${m.id}`} className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{m.titulo}</span>
                      <span className="block truncate text-xs text-suave">{m.paginas} {m.paginas === 1 ? 'página' : 'páginas'} · {formatarTamanho(m.tamanho_bytes)}{topico ? ` · ${topico.numero}. ${topico.titulo}` : ''}</span>
                    </Link>
                  ) : (
                    <a href={m.url!} target="_blank" rel="noreferrer" className="min-w-0 flex-1">
                      <span className="flex items-center gap-1 font-medium"><span className="truncate">{m.titulo}</span> <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden /></span>
                      <span className="block truncate text-xs text-suave">{m.url}</span>
                    </a>
                  )}
                  <button type="button" className="shrink-0 rounded-lg p-2 text-suave hover:bg-superficie-2 hover:text-perigo" aria-label={`Excluir “${m.titulo}”`}
                    onClick={() => { if (window.confirm(`Excluir “${m.titulo}”?`)) excluir.mutate(m); }}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function ResultadosBusca({ consulta }: { consulta: string }) {
  const busca = useBuscaMateriais(consulta);
  const online = useOnline();
  if (!online) return <Aviso tipo="alerta">A busca dentro dos PDFs precisa de internet.</Aviso>;
  if (busca.isPending) return <Carregando texto="Buscando…" />;
  if (busca.error) return <ErroCarga erro={busca.error} />;
  if (!busca.data?.length) return <p className="py-6 text-center text-sm text-suave">Nada encontrado para “{consulta.trim()}”.</p>;
  return (
    <ul className="space-y-2" aria-label="Resultados da busca">
      {busca.data.map((r) => (
        <li key={`${r.material_id}-${r.pagina}`}>
          <Link to={`/materiais/${r.material_id}?pagina=${r.pagina}`} className="cartao block p-4 transition-colors hover:border-primaria/50">
            <p className="text-xs font-semibold text-primaria">{r.titulo} · página {r.pagina}</p>
            <p className="mt-1 text-sm leading-relaxed">
              …{partesDoTrecho(r.trecho).map((p, i) => (p.destaque ? <mark key={i} className="rounded bg-alerta/25 px-0.5 text-texto">{p.texto}</mark> : <span key={i}>{p.texto}</span>))}…
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function SeletorTopico({ edital, disciplinaId, topicoId, aoMudar }: { edital: Edital; disciplinaId: string; topicoId: string; aoMudar: (d: string, t: string) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm">
        <span className="font-medium">Disciplina <span className="font-normal text-suave">(opcional)</span></span>
        <select className="campo mt-1" value={disciplinaId} onChange={(e) => aoMudar(e.target.value, '')}>
          <option value="">Geral</option>
          {edital.disciplinas.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
        </select>
      </label>
      <label className="text-sm">
        <span className="font-medium">Tópico <span className="font-normal text-suave">(opcional)</span></span>
        <select className="campo mt-1" value={topicoId} onChange={(e) => aoMudar(disciplinaId, e.target.value)} disabled={!disciplinaId}>
          <option value="">Sem tópico</option>
          {edital.topicos.filter((t) => t.disciplina_id === disciplinaId).map((t) => (
            <option key={t.id} value={t.id}>{t.parent_id ? '   ' : ''}{t.numero}. {t.titulo.length > 60 ? `${t.titulo.slice(0, 60)}…` : t.titulo}</option>
          ))}
        </select>
      </label>
    </div>
  );
}

function Adicionar({ edital, topicoInicial, aoConcluir }: { edital: Edital; topicoInicial: string | null; aoConcluir: () => void }) {
  const { usuario } = useAuth();
  const online = useOnline();
  const enviar = useEnviarPdf();
  const criarLink = useCriarLink();
  const t0 = topicoInicial ? edital.topicos.find((t) => t.id === topicoInicial) : undefined;
  const [tipo, setTipo] = useState<'pdf' | 'link'>('pdf');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [titulo, setTitulo] = useState('');
  const [url, setUrl] = useState('');
  const [disc, setDisc] = useState(t0?.disciplina_id ?? '');
  const [top, setTop] = useState(t0?.id ?? '');
  const [progresso, setProgresso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    if (!usuario) return;
    setErro(null);
    try {
      if (tipo === 'pdf') {
        if (!arquivo) return;
        if (arquivo.size > TAMANHO_MAXIMO) throw new Error('O arquivo passa de 25 MB. Divida o PDF em partes menores.');
        setProgresso('Lendo o texto do PDF…');
        const { extrairPaginasDoPdf } = await import('@/features/importar/pdf');
        const paginas = await extrairPaginasDoPdf(await arquivo.arrayBuffer(), (p, t) => setProgresso(`Lendo página ${p} de ${t}…`));
        setProgresso('Enviando…');
        await enviar.mutateAsync({ userId: usuario.id, arquivo, titulo: titulo.trim() || arquivo.name.replace(/\.pdf$/i, ''), disciplinaId: disc || null, topicoId: top || null, paginas });
      } else {
        const endereco = url.trim().match(/^https?:\/\//i) ? url.trim() : `https://${url.trim()}`;
        await criarLink.mutateAsync({ userId: usuario.id, titulo: titulo.trim() || endereco, url: endereco, disciplinaId: disc || null, topicoId: top || null });
      }
      aoConcluir();
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setProgresso(null);
    }
  }

  return (
    <section className="cartao space-y-4 p-5" aria-label="Adicionar material">
      <div className="flex gap-2" role="radiogroup" aria-label="Tipo de material">
        {([['pdf', 'PDF', Upload], ['link', 'Link', Link2]] as const).map(([v, r, Icone]) => (
          <button key={v} type="button" role="radio" aria-checked={tipo === v} onClick={() => setTipo(v)}
            className={cn('inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-medium', tipo === v ? 'border-primaria bg-primaria-suave text-primaria' : 'border-borda')}>
            <Icone className="h-4 w-4" aria-hidden /> {r}
          </button>
        ))}
      </div>
      {tipo === 'pdf' ? (
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-borda px-4 py-5 text-sm font-medium text-primaria hover:bg-superficie-2">
          <Upload className="h-5 w-5" aria-hidden /> {arquivo ? arquivo.name : 'Escolher PDF (até 25 MB)'}
          <input type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(e) => { const f = e.target.files?.[0] ?? null; setArquivo(f); if (f && !titulo) setTitulo(f.name.replace(/\.pdf$/i, '').replace(/[-_]+/g, ' ')); }} />
        </label>
      ) : (
        <Campo rotulo="Endereço (URL)" value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" placeholder="https://…" />
      )}
      <Campo rotulo="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder={tipo === 'pdf' ? 'Ex.: Lei Orgânica de Saquarema' : 'Ex.: Biografia de Alberto de Oliveira (ABL)'} />
      <SeletorTopico edital={edital} disciplinaId={disc} topicoId={top} aoMudar={(d, t) => { setDisc(d); setTop(t); }} />
      {!online && <Aviso tipo="alerta">Para enviar materiais é preciso estar conectada.</Aviso>}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <div className="flex gap-2">
        <Botao onClick={() => void salvar()} disabled={!online || (tipo === 'pdf' ? !arquivo : !url.trim()) || Boolean(progresso)}>
          {progresso ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {progresso}</> : 'Salvar'}
        </Botao>
        <Botao variante="secundario" onClick={aoConcluir} disabled={Boolean(progresso)}>Cancelar</Botao>
      </div>
    </section>
  );
}

function ListaAnotacoes({ edital }: { edital: Edital }) {
  const notas = useAnotacoes();
  const [filtro, setFiltro] = useState('');
  if (notas.isPending) return <Carregando />;
  if (!notas.data) return <ErroCarga erro={notas.error} />;
  const termo = filtro.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const lista = notas.data.filter((n) => !termo || n.conteudo.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().includes(termo));
  if (!notas.data.length) {
    return (
      <div className="cartao p-8 text-center text-sm text-suave">
        <NotebookPen className="mx-auto h-9 w-9" aria-hidden />
        <p className="mt-3">As anotações são feitas por tópico, no <Link to="/edital" className="font-semibold text-primaria">Edital</Link>: toque no ícone de caderno ao lado de um tópico.</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <input type="search" className="campo" placeholder="Buscar nas anotações" value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Buscar nas anotações" />
      <ul className="space-y-2">
        {lista.map((n) => {
          const t = edital.topicos.find((x) => x.id === n.topico_id);
          const d = t && edital.disciplinas.find((x) => x.id === t.disciplina_id);
          return (
            <li key={n.id} className="cartao p-4">
              <p className="text-xs font-semibold text-primaria">{d ? `${d.sigla} · ` : ''}{t ? `${t.numero}. ${t.titulo}` : 'Anotação livre'}</p>
              <p className="mt-1 whitespace-pre-line text-sm">{n.conteudo}</p>
              {t && <Link to={`/edital?disciplina=${t.disciplina_id}`} className="mt-2 inline-block text-xs font-semibold text-primaria hover:underline">Editar no edital</Link>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
