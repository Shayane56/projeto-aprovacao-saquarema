import { useEffect, useRef, useState, type ReactNode } from 'react';

/** Largura do contêiner (para desenhar o SVG no tamanho real, sem distorcer). */
function useLargura<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [largura, setLargura] = useState(320);
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    setLargura(el.clientWidth || 320);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setLargura(Math.max(200, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, largura] as const;
}

function Dica({ x, y, largura, children }: { x: number; y: number; largura: number; children: ReactNode }) {
  const esquerda = Math.min(Math.max(x - 80, 0), largura - 160);
  return (
    <div className="pointer-events-none absolute z-10 w-40 rounded-lg border border-borda bg-superficie px-2.5 py-2 text-xs shadow-cartao" style={{ left: esquerda, top: Math.max(0, y - 72) }} role="status">
      {children}
    </div>
  );
}

export interface PontoLinha {
  rotulo: string;
  valor: number;
  detalhe?: ReactNode;
}

/**
 * Linha de uma série (0–100%), com linha de referência (ex.: mínimo de 60%).
 * Cruz e dica no ponto mais próximo ao tocar/passar o mouse.
 */
export function GraficoLinha({ pontos, referencia, rotuloReferencia, titulo }: { pontos: PontoLinha[]; referencia?: number; rotuloReferencia?: string; titulo: string }) {
  const [caixa, largura] = useLargura<HTMLDivElement>();
  const [ativo, setAtivo] = useState<number | null>(null);
  const altura = 200;
  const m = { esq: 34, dir: 44, topo: 12, base: 24 };
  const w = largura - m.esq - m.dir;
  const h = altura - m.topo - m.base;
  const x = (i: number) => m.esq + (pontos.length === 1 ? w / 2 : (i / (pontos.length - 1)) * w);
  const y = (v: number) => m.topo + h - (Math.max(0, Math.min(100, v)) / 100) * h;
  const caminho = pontos.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.valor).toFixed(1)}`).join(' ');
  const ultimo = pontos.length - 1;

  function aoMover(e: React.PointerEvent<SVGRectElement>) {
    const r = (e.currentTarget as SVGRectElement).getBoundingClientRect();
    const px = e.clientX - r.left + m.esq;
    let melhor = 0;
    pontos.forEach((_, i) => { if (Math.abs(x(i) - px) < Math.abs(x(melhor) - px)) melhor = i; });
    setAtivo(melhor);
  }

  return (
    <div ref={caixa} className="relative">
      <svg width={largura} height={altura} role="img" aria-label={titulo} className="block overflow-visible">
        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v}>
            <line x1={m.esq} x2={m.esq + w} y1={y(v)} y2={y(v)} className="stroke-borda" strokeWidth={1} />
            <text x={m.esq - 6} y={y(v)} dy="0.32em" textAnchor="end" className="fill-suave text-[10px]">{v}%</text>
          </g>
        ))}
        {referencia !== undefined && (
          <g>
            <line x1={m.esq} x2={m.esq + w} y1={y(referencia)} y2={y(referencia)} className="stroke-suave" strokeWidth={1.5} />
            <text x={m.esq + w + 4} y={y(referencia)} dy="0.32em" className="fill-suave text-[10px] font-semibold">{rotuloReferencia}</text>
          </g>
        )}
        {pontos.length > 1 && <path d={caminho} fill="none" className="stroke-primaria" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
        {ativo !== null && <line x1={x(ativo)} x2={x(ativo)} y1={m.topo} y2={m.topo + h} className="stroke-suave" strokeWidth={1} />}
        {pontos.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.valor)} r={ativo === i ? 5.5 : 4} className="fill-primaria stroke-superficie" strokeWidth={2} />
        ))}
        {pontos.length > 0 && (
          <text x={x(ultimo) + 8} y={y(pontos[ultimo].valor)} dy={pontos[ultimo].valor > (referencia ?? -10) + 6 || pontos[ultimo].valor < (referencia ?? -10) - 6 ? '0.32em' : '-0.6em'} className="fill-texto text-[11px] font-semibold">
            {pontos[ultimo].valor}%
          </text>
        )}
        {pontos.length > 0 && <text x={x(0)} y={altura - 6} textAnchor={pontos.length === 1 ? 'middle' : 'start'} className="fill-suave text-[10px]">{pontos[0].rotulo}</text>}
        {pontos.length > 1 && <text x={x(ultimo)} y={altura - 6} textAnchor="end" className="fill-suave text-[10px]">{pontos[ultimo].rotulo}</text>}
        <rect x={m.esq - 8} y={0} width={w + 16} height={altura} fill="transparent" onPointerMove={aoMover} onPointerDown={aoMover} onPointerLeave={() => setAtivo(null)} />
      </svg>
      {ativo !== null && (
        <Dica x={x(ativo)} y={y(pontos[ativo].valor)} largura={largura}>
          <p className="font-semibold">{pontos[ativo].rotulo} · {pontos[ativo].valor}%</p>
          {pontos[ativo].detalhe && <div className="mt-0.5 text-suave">{pontos[ativo].detalhe}</div>}
        </Dica>
      )}
    </div>
  );
}

export interface Coluna {
  rotulo: string;
  valor: number;
  rotuloValor: string;
  detalhe?: ReactNode;
}

/** Colunas de uma série (ex.: horas por semana). Valor na última coluna; os demais ao tocar. */
export function GraficoColunas({ colunas, titulo, formatarEixo, minimoEixo = 1 }: { colunas: Coluna[]; titulo: string; formatarEixo: (v: number) => string; minimoEixo?: number }) {
  const [caixa, largura] = useLargura<HTMLDivElement>();
  const [ativa, setAtiva] = useState<number | null>(null);
  const altura = 180;
  const m = { esq: 34, dir: 8, topo: 18, base: 24 };
  const w = largura - m.esq - m.dir;
  const h = altura - m.topo - m.base;
  const maior = Math.max(minimoEixo, ...colunas.map((c) => c.valor));
  const topoEixo = niceMax(maior);
  const faixa = w / Math.max(1, colunas.length);
  const larguraBarra = Math.min(24, faixa * 0.6);
  const y = (v: number) => m.topo + h - (v / topoEixo) * h;
  const passo = faixa < 34 ? 2 : 1;

  return (
    <div ref={caixa} className="relative">
      <svg width={largura} height={altura} role="img" aria-label={titulo} className="block overflow-visible">
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={m.esq} x2={m.esq + w} y1={y(topoEixo * f)} y2={y(topoEixo * f)} className="stroke-borda" strokeWidth={1} />
            <text x={m.esq - 6} y={y(topoEixo * f)} dy="0.32em" textAnchor="end" className="fill-suave text-[10px]">{formatarEixo(topoEixo * f)}</text>
          </g>
        ))}
        {colunas.map((c, i) => {
          const cx = m.esq + faixa * i + faixa / 2;
          const topo = y(c.valor);
          const alturaBarra = m.topo + h - topo;
          const r = Math.min(4, alturaBarra);
          const x0 = cx - larguraBarra / 2;
          const base = m.topo + h;
          return (
            <g key={i}>
              {c.valor > 0 && (
                <path
                  d={`M${x0},${base} V${topo + r} Q${x0},${topo} ${x0 + r},${topo} H${x0 + larguraBarra - r} Q${x0 + larguraBarra},${topo} ${x0 + larguraBarra},${topo + r} V${base} Z`}
                  className={ativa === null || ativa === i ? 'fill-primaria' : 'fill-primaria/40'}
                />
              )}
              {i === colunas.length - 1 && <text x={cx} y={topo - 5} textAnchor="middle" className="fill-texto text-[11px] font-semibold">{c.rotuloValor}</text>}
              {i % passo === (colunas.length - 1) % passo && <text x={cx} y={altura - 6} textAnchor="middle" className="fill-suave text-[10px]">{c.rotulo}</text>}
              <rect x={m.esq + faixa * i} y={0} width={faixa} height={altura} fill="transparent" onPointerEnter={() => setAtiva(i)} onPointerDown={() => setAtiva(i)} onPointerLeave={() => setAtiva(null)}>
                <title>{`${c.rotulo}: ${c.rotuloValor}`}</title>
              </rect>
            </g>
          );
        })}
      </svg>
      {ativa !== null && (
        <Dica x={m.esq + faixa * ativa + faixa / 2} y={y(colunas[ativa].valor)} largura={largura}>
          <p className="font-semibold">{colunas[ativa].rotulo} · {colunas[ativa].rotuloValor}</p>
          {colunas[ativa].detalhe && <div className="mt-0.5 text-suave">{colunas[ativa].detalhe}</div>}
        </Dica>
      )}
    </div>
  );
}

function niceMax(v: number): number {
  const exp = 10 ** Math.floor(Math.log10(v));
  for (const f of [1, 2, 2.5, 5, 10]) if (f * exp >= v) return f * exp;
  return 10 * exp;
}

/** Tabela com os mesmos dados do gráfico (acessibilidade e leitura exata). */
export function TabelaDados({ cabecalho, linhas }: { cabecalho: string[]; linhas: (string | number)[][] }) {
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer text-xs font-semibold text-primaria">Ver em tabela</summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left">
          <thead><tr className="border-b border-borda text-xs text-suave">{cabecalho.map((c) => <th key={c} className="py-1.5 pr-3 font-semibold">{c}</th>)}</tr></thead>
          <tbody className="divide-y divide-borda">{linhas.map((l, i) => <tr key={i}>{l.map((v, j) => <td key={j} className="py-1.5 pr-3">{v}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </details>
  );
}
