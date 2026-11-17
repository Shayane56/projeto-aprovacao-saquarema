#!/usr/bin/env node
/**
 * Monta a apostila e gera o PDF.
 *
 *   node scripts/build.cjs              → saida/apostila.html + saida/Apostila-ACE-Saquarema.pdf
 *   node scripts/build.cjs --previa 1,5 → também salva PNGs dessas páginas em saida/previa/
 *
 * Convenções nas páginas (paginas/*.html, em ordem alfabética):
 *   <section class="pagina" data-capitulo="1" data-titulo-capitulo="Leishmanioses"> … </section>
 *   data-sumario="Título" data-nivel="1|2"  → entrada no sumário (página onde a seção começa)
 *   class="sem-cabecalho"                   → sem faixa de topo e rodapé (capa, aberturas)
 *   <span data-icone="nome"></span>         → ícone (ilustracoes/icones/nome.svg)
 *   <div data-svg="ilustracoes/x.svg"></div>→ ilustração SVG embutida (usa as fontes da apostila)
 *   <!-- SUMARIO -->                        → lugar onde o sumário é inserido
 * Requer o Playwright (já instalado no ambiente): require('playwright').
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const SAIDA = path.join(RAIZ, 'saida');
const NOME_PDF = 'Apostila-ACE-Saquarema.pdf';
const TITULO_OBRA = 'Apostila ACE · Saquarema 2027';
const ENTRADAS_POR_PAGINA = 30;

const ler = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');

function inlinarSvg(arquivo) {
  const svg = ler(arquivo).replace(/<\?xml[^>]*>/, '').replace(/<!--[\s\S]*?-->/g, '');
  return svg;
}

function icone(nome) {
  const arquivo = `ilustracoes/icones/${nome}.svg`;
  if (!fs.existsSync(path.join(RAIZ, arquivo))) throw new Error(`Ícone não encontrado: ${nome}`);
  const svg = inlinarSvg(arquivo).replace(/class="[^"]*"/, '').replace(/width="24"/, '').replace(/height="24"/, '');
  return `<span class="icone">${svg}</span>`;
}

function montar() {
  const arquivos = fs.readdirSync(path.join(RAIZ, 'paginas')).filter((f) => f.endsWith('.html')).sort();
  let corpo = arquivos.map((f) => `\n<!-- ===== ${f} ===== -->\n` + ler(`paginas/${f}`)).join('\n');
  corpo = corpo.replace(/<span data-icone="([\w-]+)"><\/span>/g, (_, n) => icone(n));
  corpo = corpo.replace(/<div([^>]*?) data-svg="([^"]+)"([^>]*)><\/div>/g, (_, a, arq, b) => `<div${a}${b}>${inlinarSvg(arq)}</div>`);

  // Sumário: entradas a partir dos atributos das seções (a página é calculada depois).
  const secoes = [...corpo.matchAll(/<section class="pagina[^"]*"[^>]*>/g)];
  const entradas = [];
  secoes.forEach((m) => {
    const tag = m[0];
    const t = tag.match(/data-sumario="([^"]+)"/);
    if (t) entradas.push({ titulo: t[1], nivel: Number((tag.match(/data-nivel="(\d)"/) || [])[1] || 2), cap: (tag.match(/data-capitulo="([^"]+)"/) || [])[1] || '' });
  });
  const nSumario = Math.max(1, Math.ceil(entradas.reduce((s, e) => s + (e.nivel === 1 ? 1.6 : 1), 0) / ENTRADAS_POR_PAGINA));
  const paginasSumario = Array.from({ length: nSumario }, (_, i) => `
<section class="pagina" data-pagina-sumario="${i}" data-cabecalho="Sumário">
  <div class="conteudo">
    ${i === 0 ? '<span class="sobretitulo">Organização do material</span><h2 class="titulo-secao">Sumário</h2><div class="linha-fina"></div>' : ''}
    <ol class="sumario-lista" data-sumario-lista="${i}"></ol>
  </div>
</section>`).join('\n');
  corpo = corpo.replace('<!-- SUMARIO -->', paginasSumario);

  return { corpo, entradas, nSumario };
}

function documento(corpo) {
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>${TITULO_OBRA}</title>
<link rel="stylesheet" href="../estilos/apostila.css"></head>
<body>${corpo}
<script>
(() => {
  const paginas = [...document.querySelectorAll('section.pagina')];
  const entradas = [];
  paginas.forEach((p, i) => {
    const n = i + 1;
    p.dataset.numero = n;
    if (p.dataset.sumario) entradas.push({ titulo: p.dataset.sumario, nivel: Number(p.dataset.nivel || 2), cap: p.dataset.capitulo || '', pagina: n });
    if (p.classList.contains('sem-cabecalho')) return;
    const cap = p.dataset.capitulo ? 'Capítulo ' + p.dataset.capitulo + ' · ' + (p.dataset.tituloCapitulo || '') : (p.dataset.cabecalho || 'Apostila ACE');
    p.insertAdjacentHTML('afterbegin', '<div class="faixa-topo"><span>' + cap + '</span><span class="marca">Agente de Combate às Endemias</span></div>');
    p.insertAdjacentHTML('beforeend', '<div class="rodape"><span>${TITULO_OBRA}</span><span class="num">' + n + '</span></div>');
  });
  // Distribui as entradas do sumário pelas páginas reservadas.
  const listas = [...document.querySelectorAll('[data-sumario-lista]')];
  let pagina = 0, peso = 0;
  for (const e of entradas) {
    const w = e.nivel === 1 ? 1.6 : 1;
    if (peso + w > ${ENTRADAS_POR_PAGINA} && pagina < listas.length - 1) { pagina++; peso = 0; }
    peso += w;
    const cap = e.nivel === 1 && e.cap ? '<span class="cap">' + e.cap + '</span>' : '';
    listas[pagina].insertAdjacentHTML('beforeend', '<li class="nivel-' + e.nivel + '">' + cap + '<span>' + e.titulo + '</span><span class="pontos"></span><span class="pg">' + e.pagina + '</span></li>');
  }
})();
</script></body></html>`;
}

(async () => {
  const args = process.argv.slice(2);
  const previa = args.includes('--previa') ? args[args.indexOf('--previa') + 1].split(',').map(Number) : [];
  fs.mkdirSync(SAIDA, { recursive: true });
  const { corpo } = montar();
  const htmlPath = path.join(SAIDA, 'apostila.html');
  fs.writeFileSync(htmlPath, documento(corpo));

  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 1200 }, deviceScaleFactor: 2 });
  const erros = [];
  page.on('pageerror', (e) => erros.push('Erro de script: ' + e.message));
  page.on('requestfailed', (r) => erros.push('Arquivo não carregado: ' + r.url()));
  await page.goto('file://' + htmlPath);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);

  // Verificação: conteúdo que passou do limite da página (vertical ou horizontal).
  const vazamentos = await page.evaluate(() => {
    const r = [];
    document.querySelectorAll('section.pagina').forEach((p) => {
      const c = p.querySelector(':scope > .conteudo');
      if (!c) return;
      const caixa = c.getBoundingClientRect();
      let maxBaixo = caixa.top, maxDireita = caixa.left;
      c.querySelectorAll('*').forEach((el) => {
        const b = el.getBoundingClientRect();
        if (!b.width && !b.height) return;
        if (getComputedStyle(el).position === 'absolute' && el.closest('.livre')) return;
        maxBaixo = Math.max(maxBaixo, b.bottom);
        maxDireita = Math.max(maxDireita, b.right);
      });
      const sobraV = maxBaixo - caixa.bottom, sobraH = maxDireita - caixa.right;
      if (sobraV > 1.5 || sobraH > 1.5) r.push({ pagina: p.dataset.numero, titulo: p.dataset.sumario || p.querySelector('h2,h1')?.textContent?.trim()?.slice(0, 50) || '', sobraV: Math.round(sobraV), sobraH: Math.round(sobraH) });
    });
    return r;
  });
  const total = await page.evaluate(() => document.querySelectorAll('section.pagina').length);

  for (const n of previa) {
    fs.mkdirSync(path.join(SAIDA, 'previa'), { recursive: true });
    const el = page.locator(`section.pagina[data-numero="${n}"]`);
    await el.screenshot({ path: path.join(SAIDA, 'previa', `pagina-${String(n).padStart(2, '0')}.png`) });
  }

  await page.emulateMedia({ media: 'print' });
  await page.pdf({ path: path.join(SAIDA, NOME_PDF), preferCSSPageSize: true, printBackground: true });
  await browser.close();

  console.log(`${total} páginas → saida/${NOME_PDF}`);
  if (vazamentos.length) {
    console.log('ATENÇÃO — conteúdo passando do limite da página:');
    for (const v of vazamentos) console.log(`  página ${v.pagina} (${v.titulo}): ${v.sobraV}px abaixo, ${v.sobraH}px à direita`);
  }
  if (erros.length) console.log(erros.join('\n'));
  process.exitCode = vazamentos.length || erros.length ? 2 : 0;
})().catch((e) => { console.error('FALHOU:', e); process.exit(1); });
