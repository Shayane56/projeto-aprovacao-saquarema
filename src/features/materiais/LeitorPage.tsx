import { ArrowLeft, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { carregarPdfjs } from '@/features/importar/pdf';
import { mensagemDeErro } from '@/lib/supabase';
import { Aviso, Botao, Carregando, ErroCarga } from '@/shared/ui';
import { baixarPdf } from './api';
import { useMateriais } from './hooks';

type DocumentoPdf = Awaited<ReturnType<Awaited<ReturnType<typeof carregarPdfjs>>['getDocument']>['promise']>;

/** Leitor de PDF dentro do app: uma página por vez, ajustada à largura da tela. */
export function LeitorPage() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const materiais = useMateriais();
  const material = materiais.data?.find((m) => m.id === id);
  const [doc, setDoc] = useState<DocumentoPdf | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const pagina = Math.max(1, Number(params.get('pagina')) || 1);
  const canvas = useRef<HTMLCanvasElement>(null);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!material?.arquivo_path) return;
    let ativo = true;
    void (async () => {
      try {
        const [pdfjs, dados] = await Promise.all([carregarPdfjs(), baixarPdf(material.arquivo_path!)]);
        const d = await pdfjs.getDocument({ data: dados }).promise;
        if (ativo) setDoc(d);
      } catch (e) {
        if (ativo) setErro(mensagemDeErro(e));
      }
    })();
    return () => { ativo = false; };
  }, [material?.arquivo_path]);

  useEffect(() => {
    if (!doc || !canvas.current || !caixa.current) return;
    let cancelado = false;
    let tarefa: { cancel: () => void } | null = null;
    void (async () => {
      const p = await doc.getPage(Math.min(pagina, doc.numPages));
      if (cancelado || !canvas.current || !caixa.current) return;
      const base = p.getViewport({ scale: 1 });
      const escala = (caixa.current.clientWidth / base.width) * zoom;
      const dpr = window.devicePixelRatio || 1;
      const vp = p.getViewport({ scale: escala * dpr });
      const c = canvas.current;
      c.width = vp.width;
      c.height = vp.height;
      c.style.width = `${vp.width / dpr}px`;
      c.style.height = `${vp.height / dpr}px`;
      const render = p.render({ canvasContext: c.getContext('2d')!, viewport: vp });
      tarefa = render;
      await render.promise.catch(() => {});
    })();
    return () => { cancelado = true; tarefa?.cancel(); };
  }, [doc, pagina, zoom]);

  if (materiais.isPending) return <Carregando />;
  if (!material) return <ErroCarga erro={materiais.error ?? new Error('Material não encontrado.')} />;

  const total = doc?.numPages ?? material.paginas ?? 1;
  const ir = (n: number) => setParams({ pagina: String(Math.max(1, Math.min(total, n))) }, { replace: true });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Link to="/materiais" className="rounded-lg p-1.5 text-suave hover:bg-superficie-2" aria-label="Voltar para Materiais"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="min-w-0 flex-1 truncate text-lg font-bold">{material.titulo}</h1>
      </div>
      <div className="sticky top-[60px] z-10 -mx-4 flex items-center justify-between gap-2 border-b border-borda bg-fundo/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:top-0">
        <div className="flex items-center gap-1">
          <Botao pequeno variante="secundario" onClick={() => ir(pagina - 1)} disabled={pagina <= 1} aria-label="Página anterior"><ChevronLeft className="h-4 w-4" /></Botao>
          <label className="flex items-center gap-1 text-sm">
            <span className="sr-only">Página</span>
            <input type="number" inputMode="numeric" min={1} max={total} value={pagina} onChange={(e) => ir(Number(e.target.value))} className="campo w-16 px-2 py-1.5 text-center" />
            <span className="text-suave">de {total}</span>
          </label>
          <Botao pequeno variante="secundario" onClick={() => ir(pagina + 1)} disabled={pagina >= total} aria-label="Próxima página"><ChevronRight className="h-4 w-4" /></Botao>
        </div>
        <div className="flex items-center gap-1">
          <Botao pequeno variante="fantasma" onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.2).toFixed(1)))} aria-label="Diminuir zoom"><ZoomOut className="h-4 w-4" /></Botao>
          <Botao pequeno variante="fantasma" onClick={() => setZoom((z) => Math.min(3, +(z + 0.2).toFixed(1)))} aria-label="Aumentar zoom"><ZoomIn className="h-4 w-4" /></Botao>
        </div>
      </div>
      {erro && <Aviso tipo="erro">Não foi possível abrir o PDF: {erro}</Aviso>}
      <div ref={caixa} className="overflow-x-auto rounded-xl border border-borda bg-white">
        {!doc && !erro && <Carregando texto="Abrindo o PDF…" />}
        <canvas ref={canvas} className={doc ? 'block' : 'hidden'} aria-label={`Página ${pagina} de ${material.titulo}`} role="img" />
      </div>
    </div>
  );
}
