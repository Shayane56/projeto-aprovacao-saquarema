import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, CheckCircle2, ChevronDown, FileText, Loader2, Upload } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { useEdital } from '@/features/edital/hooks';
import type { Edital } from '@/features/edital/tipos';
import { chavesPratica } from '@/features/questoes/hooks';
import { letra } from '@/features/questoes/tipos';
import { cn } from '@/lib/cn';
import { mensagemDeErro } from '@/lib/supabase';
import { Aviso, Botao, Campo, Carregando, ErroCarga } from '@/shared/ui';
import { disciplinaPorSecao, sugerirTopico } from './classificar';
import { EditorQuestao, rascunhoValido, type Rascunho } from './EditorQuestao';
import { lerGabarito } from './gabarito';
import { avisosDaQuestao, extrairQuestoes, type TextoExtraido } from './parser';
import { salvarRascunhos, type ResultadoSalvar } from './salvar';

type Etapa = 'entrada' | 'revisao' | 'concluido';

export function ImportarPage() {
  const edital = useEdital();
  if (edital.isPending) return <Carregando />;
  if (!edital.data) return <ErroCarga erro={edital.error} />;
  return <Importador edital={edital.data} />;
}

function Importador({ edital }: { edital: Edital }) {
  const { usuario } = useAuth();
  const qc = useQueryClient();
  const [etapa, setEtapa] = useState<Etapa>('entrada');
  const [fonte, setFonte] = useState('');
  const [texto, setTexto] = useState('');
  const [gabarito, setGabarito] = useState('');
  const [lendoPdf, setLendoPdf] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [rascunhos, setRascunhos] = useState<Rascunho[]>([]);
  const [textos, setTextos] = useState<TextoExtraido[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoSalvar | null>(null);

  async function abrirPdf(arquivo: File | undefined) {
    if (!arquivo) return;
    setErro(null);
    setLendoPdf('Abrindo o PDF…');
    try {
      const { extrairTextoDoPdf } = await import('./pdf');
      const conteudo = await extrairTextoDoPdf(arquivo, (p, t) => setLendoPdf(`Lendo página ${p} de ${t}…`));
      if (conteudo.replace(/\s/g, '').length < 50) {
        setErro('Não encontrei texto neste PDF — ele pode ser uma imagem escaneada. Copie e cole o texto, se possível.');
      } else {
        setTexto(conteudo);
        if (!fonte) setFonte(arquivo.name.replace(/\.pdf$/i, '').replace(/[-_]+/g, ' '));
      }
    } catch (e) {
      setErro(`Não foi possível ler o PDF: ${mensagemDeErro(e)}`);
    } finally {
      setLendoPdf(null);
    }
  }

  function ler() {
    setErro(null);
    const prova = extrairQuestoes(texto);
    if (prova.questoes.length === 0) {
      return setErro('Não encontrei questões numeradas. Confira se o texto tem o formato “01. Enunciado” seguido de “(A) …”.');
    }
    const gab = lerGabarito(gabarito);
    const padrao = edital.disciplinas[0]?.id ?? null;
    let ultimaDisciplina: string | null = null;
    setTextos(prova.textos);
    setRascunhos(
      prova.questoes.map((q) => {
        const disciplina = disciplinaPorSecao(q.secao, edital) ?? ultimaDisciplina ?? null;
        ultimaDisciplina = disciplina;
        const g = gab.get(q.numero);
        return {
          chave: `q${q.numero}`,
          numero: q.numero,
          enunciado: q.enunciado,
          alternativas: q.alternativas.length ? q.alternativas : ['', '', '', ''],
          gabarito: typeof g === 'number' ? g : null,
          anulada: g === 'anulada',
          disciplina_id: disciplina ?? padrao,
          topico_id: sugerirTopico(`${q.enunciado} ${q.alternativas.join(' ')}`, disciplina ?? padrao, edital)?.id ?? null,
          explicacao: '',
          texto: q.texto,
          incluir: true,
        };
      }),
    );
    setEtapa('revisao');
    window.scrollTo({ top: 0 });
  }

  async function salvar() {
    if (!usuario) return;
    setSalvando(true);
    setErro(null);
    try {
      const r = await salvarRascunhos(usuario.id, rascunhos, textos, 'importada', fonte);
      await Promise.all([
        qc.invalidateQueries({ queryKey: chavesPratica.questoes(usuario.id) }),
        qc.invalidateQueries({ queryKey: chavesPratica.textos(usuario.id) }),
      ]);
      setResultado(r);
      setEtapa('concluido');
      window.scrollTo({ top: 0 });
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/praticar" className="rounded-lg p-1.5 text-suave hover:bg-superficie-2" aria-label="Voltar para Praticar"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="text-xl font-bold tracking-tight">Importar prova</h1>
      </div>

      <ol className="flex gap-2 text-xs font-medium" aria-label="Etapas">
        {(['entrada', 'revisao', 'concluido'] as const).map((e, i) => (
          <li key={e} className={cn('flex-1 rounded-full px-3 py-1.5 text-center', etapa === e ? 'bg-primaria text-primaria-texto' : 'bg-superficie-2 text-suave')}>
            {i + 1}. {e === 'entrada' ? 'Prova e gabarito' : e === 'revisao' ? 'Revisão' : 'Pronto'}
          </li>
        ))}
      </ol>

      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      {etapa === 'entrada' && (
        <div className="space-y-4">
          <section className="cartao space-y-4 p-5">
            <Campo rotulo="De onde é a prova?" value={fonte} onChange={(e) => setFonte(e.target.value)} placeholder="Ex.: IBAM · Prefeitura de Maricá · 2023 · Agente de Combate às Endemias" />
            <div>
              <p className="text-sm font-medium">Prova</p>
              <label className="mt-1 flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-borda px-4 py-6 text-sm font-medium text-primaria hover:bg-superficie-2">
                {lendoPdf ? <><Loader2 className="h-5 w-5 animate-spin" aria-hidden /> {lendoPdf}</> : <><Upload className="h-5 w-5" aria-hidden /> Escolher o PDF da prova</>}
                <input type="file" accept="application/pdf,.pdf" className="sr-only" disabled={Boolean(lendoPdf)} onChange={(e) => void abrirPdf(e.target.files?.[0])} />
              </label>
              <p className="mt-1.5 text-xs text-suave">O PDF é lido aqui no aparelho. Também dá para colar o texto da prova abaixo.</p>
            </div>
            <label className="block text-sm">
              <span className="font-medium">Texto da prova</span>
              <textarea className="campo mt-1 min-h-[180px] font-mono text-[13px]" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={'01. Enunciado da questão…\n(A) alternativa\n(B) alternativa\n(C) alternativa\n(D) alternativa'} />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Gabarito definitivo</span>
              <textarea className="campo mt-1 min-h-[80px] font-mono text-[13px]" value={gabarito} onChange={(e) => setGabarito(e.target.value)} placeholder="Ex.: 01-A 02-C 03-B 04-X (X = anulada) — ou só as letras em ordem: ACBD…" />
              <span className="mt-1 block text-xs text-suave">Cole como estiver no PDF do gabarito: número e letra, ou só as letras em sequência.</span>
            </label>
          </section>
          <Botao onClick={ler} disabled={!texto.trim()}><FileText className="h-4 w-4" aria-hidden /> Ler questões</Botao>
        </div>
      )}

      {etapa === 'revisao' && (
        <Revisao
          edital={edital}
          rascunhos={rascunhos}
          setRascunhos={setRascunhos}
          textos={textos}
          setTextos={setTextos}
          voltar={() => setEtapa('entrada')}
          salvar={() => void salvar()}
          salvando={salvando}
          temGabarito={Boolean(gabarito.trim())}
        />
      )}

      {etapa === 'concluido' && resultado && (
        <div className="cartao p-6 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-sucesso" aria-hidden />
          <h2 className="mt-3 text-lg font-semibold">{resultado.novas} {resultado.novas === 1 ? 'questão importada' : 'questões importadas'}</h2>
          {resultado.repetidas > 0 && <p className="mt-1 text-sm text-suave">{resultado.repetidas} já estavam no seu banco e foram ignoradas.</p>}
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link to="/praticar/questoes?modo=novas"><Botao>Treinar agora</Botao></Link>
            <Botao variante="secundario" onClick={() => { setTexto(''); setGabarito(''); setFonte(''); setRascunhos([]); setEtapa('entrada'); }}>Importar outra prova</Botao>
          </div>
        </div>
      )}
    </div>
  );
}

interface RevisaoProps {
  edital: Edital;
  rascunhos: Rascunho[];
  setRascunhos: (f: (r: Rascunho[]) => Rascunho[]) => void;
  textos: TextoExtraido[];
  setTextos: (f: (t: TextoExtraido[]) => TextoExtraido[]) => void;
  voltar: () => void;
  salvar: () => void;
  salvando: boolean;
  temGabarito: boolean;
}

function Revisao({ edital, rascunhos, setRascunhos, textos, setTextos, voltar, salvar, salvando, temGabarito }: RevisaoProps) {
  const [aberta, setAberta] = useState<string | null>(null);
  const [lote, setLote] = useState({ de: '', ate: '', disciplina: '' });
  const incluidas = rascunhos.filter((r) => r.incluir);
  const validas = incluidas.filter(rascunhoValido);
  const comAviso = useMemo(() => rascunhos.filter((r) => r.incluir && avisosDaQuestao(r).length > 0).length, [rascunhos]);

  const atualizar = (chave: string, r: Rascunho) => setRascunhos((lista) => lista.map((x) => (x.chave === chave ? r : x)));

  function aplicarLote() {
    const de = Number(lote.de), ate = Number(lote.ate);
    if (!lote.disciplina || !de || !ate) return;
    setRascunhos((lista) =>
      lista.map((r) =>
        r.numero !== null && r.numero >= de && r.numero <= ate
          ? { ...r, disciplina_id: lote.disciplina, topico_id: sugerirTopico(`${r.enunciado} ${r.alternativas.join(' ')}`, lote.disciplina, edital)?.id ?? null }
          : r,
      ),
    );
  }

  return (
    <div className="space-y-4">
      <div className="cartao p-4 text-sm">
        <p><strong>{rascunhos.length}</strong> questões encontradas · <strong>{validas.length}</strong> prontas para salvar{comAviso ? <> · <span className="text-alerta">{comAviso} com avisos</span></> : null}</p>
        {!temGabarito && <p className="mt-1 text-alerta">Sem gabarito: marque a alternativa correta de cada questão, ou volte e cole o gabarito.</p>}
        {textos.length > 0 && <p className="mt-1 text-suave">{textos.length} {textos.length === 1 ? 'texto de apoio encontrado' : 'textos de apoio encontrados'}.</p>}
      </div>

      <details className="cartao p-4">
        <summary className="cursor-pointer text-sm font-semibold">Definir a disciplina de várias questões de uma vez</summary>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <input className="campo" inputMode="numeric" placeholder="Da questão" value={lote.de} onChange={(e) => setLote({ ...lote, de: e.target.value })} aria-label="Da questão" />
          <input className="campo" inputMode="numeric" placeholder="Até a questão" value={lote.ate} onChange={(e) => setLote({ ...lote, ate: e.target.value })} aria-label="Até a questão" />
          <select className="campo col-span-2 sm:col-span-1" value={lote.disciplina} onChange={(e) => setLote({ ...lote, disciplina: e.target.value })} aria-label="Disciplina">
            <option value="">Disciplina…</option>
            {edital.disciplinas.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
          </select>
          <Botao variante="secundario" className="col-span-2 sm:col-span-1" onClick={aplicarLote}>Aplicar</Botao>
        </div>
      </details>

      {textos.length > 0 && (
        <details className="cartao p-4">
          <summary className="cursor-pointer text-sm font-semibold">Textos de apoio ({textos.length})</summary>
          <div className="mt-3 space-y-3">
            {textos.map((t, i) => (
              <label key={i} className="block text-sm">
                <span className="font-medium">{t.titulo || `Texto ${i + 1}`} — usado nas questões {rascunhos.filter((r) => r.texto === i).map((r) => r.numero).join(', ') || 'nenhuma'}</span>
                <textarea className="campo mt-1 min-h-[120px]" value={t.conteudo} onChange={(e) => setTextos((lista) => lista.map((x, j) => (j === i ? { ...x, conteudo: e.target.value } : x)))} />
              </label>
            ))}
          </div>
        </details>
      )}

      <ul className="space-y-2">
        {rascunhos.map((r) => {
          const avisos = avisosDaQuestao(r);
          const disciplina = edital.disciplinas.find((d) => d.id === r.disciplina_id);
          const expandida = aberta === r.chave;
          return (
            <li key={r.chave} className={cn('cartao overflow-hidden', !r.incluir && 'opacity-55')}>
              <div className="flex items-start gap-3 p-3.5">
                <input type="checkbox" checked={r.incluir} onChange={(e) => atualizar(r.chave, { ...r, incluir: e.target.checked })} className="mt-1 h-4 w-4 accent-[rgb(var(--primaria))]" aria-label={`Incluir questão ${r.numero}`} />
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setAberta(expandida ? null : r.chave)} aria-expanded={expandida}>
                  <p className="text-xs text-suave">
                    <strong className="text-texto">Questão {r.numero}</strong> · {disciplina?.sigla ?? 'sem disciplina'} · gabarito {r.anulada ? 'anulada' : letra(r.gabarito)}
                    {r.texto !== null && ' · com texto'}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-sm">{r.enunciado || <em className="text-suave">sem enunciado</em>}</p>
                  {avisos.length > 0 && <p className="mt-1 flex items-center gap-1 text-xs text-alerta"><AlertTriangle className="h-3.5 w-3.5" aria-hidden /> {avisos.join(' · ')}</p>}
                </button>
                <ChevronDown className={cn('mt-1 h-4 w-4 shrink-0 text-suave transition-transform', expandida && 'rotate-180')} aria-hidden />
              </div>
              {expandida && (
                <div className="border-t border-borda p-4">
                  <EditorQuestao valor={r} aoMudar={(novo) => atualizar(r.chave, novo)} edital={edital} />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="sticky bottom-20 z-10 flex flex-wrap justify-end gap-2 lg:bottom-4">
        <Botao variante="secundario" onClick={voltar} className="shadow-cartao">Voltar</Botao>
        <Botao onClick={salvar} carregando={salvando} disabled={validas.length === 0} className="shadow-cartao">
          Salvar {validas.length} {validas.length === 1 ? 'questão' : 'questões'}
        </Botao>
      </div>
      {incluidas.length > validas.length && (
        <p className="text-right text-xs text-suave">{incluidas.length - validas.length} incluídas ainda não estão completas (disciplina, enunciado, alternativas e gabarito) e não serão salvas.</p>
      )}
    </div>
  );
}
