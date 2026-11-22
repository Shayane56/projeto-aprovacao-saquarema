#!/usr/bin/env node
/**
 * Gera a versão interativa da apostila (um único arquivo HTML).
 *
 *   node scripts/interativa.cjs   → saida/interativa/index.html
 *
 * Reaproveita o conteúdo de paginas/*.html (mesma ordem do PDF), as ilustrações e os ícones.
 * Cada capítulo vira um <template>; o app (interativa/app.js) monta a navegação, as questões
 * interativas, os mapas mentais em estilo caderno, a busca e o progresso.
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const ler = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');
const SAIDA = path.join(RAIZ, 'saida', 'interativa');

function inlinarSvg(arquivo) {
  return ler(arquivo).replace(/<\?xml[^>]*>/, '').replace(/<!--[\s\S]*?-->/g, '');
}
function icone(nome) {
  const arquivo = `ilustracoes/icones/${nome}.svg`;
  if (!fs.existsSync(path.join(RAIZ, arquivo))) throw new Error(`Ícone não encontrado: ${nome}`);
  const svg = inlinarSvg(arquivo).replace(/class="[^"]*"/, '').replace(/width="24"/, '').replace(/height="24"/, '');
  return `<span class="icone">${svg}</span>`;
}

// SVGs repetidos usam ids iguais (gradientes, marcadores): prefixa os ids por ocorrência.
let nSvg = 0;
function svgUnico(svg) {
  const p = `s${++nSvg}-`;
  const ids = [...svg.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  let out = svg;
  for (const id of ids) {
    const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`id="${esc}"`, 'g'), `id="${p}${id}"`)
      .replace(new RegExp(`url\\(#${esc}\\)`, 'g'), `url(#${p}${id})`)
      .replace(new RegExp(`href="#${esc}"`, 'g'), `href="#${p}${id}"`);
  }
  return out;
}

const MAPAS = {};
for (const f of fs.readdirSync(path.join(RAIZ, 'interativa', 'mapas'))) {
  const d = JSON.parse(ler(`interativa/mapas/${f}`));
  MAPAS[path.basename(d.arquivo, '.svg')] = { centro: d.centro, sub: d.sub, extra: d.extra, ramos: d.ramos };
}

const attr = (tag, nome) => (tag.match(new RegExp(`${nome}="([^"]*)"`)) || [])[1];
const texto = (h) => h.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

function prepararHtml(h) {
  h = h.replace(/<!--[\s\S]*?-->/g, '');
  // na versão web as páginas viram rolagem contínua: some o rótulo "(continuação)"
  h = h.replace(/<span class="sobretitulo[^"]*"[^>]*>[^<]*\(continuação\)<\/span>/g, '');
  // instrução do PDF → instrução do interativo
  h = h.replace(/Resolva sem consultar o texto e anote suas respostas\.[^<]*/g, 'Resolva sem consultar o texto: toque na alternativa e a correção, com o comentário, aparece na hora. O placar do capítulo fica salvo.');
  // mapas mentais → componente caderno
  h = h.replace(/<div[^>]*data-svg="ilustracoes\/(mapa-mental[^"]*)\.svg"[^>]*><\/div>/g, (_, k) => {
    if (!MAPAS[k]) throw new Error('Mapa sem dados: ' + k);
    return `<div class="mapa-caderno" data-mapa="${k}"></div>`;
  });
  h = h.replace(/<span data-icone="([\w-]+)"><\/span>/g, (_, n) => icone(n));
  h = h.replace(/<div([^>]*?) data-svg="([^"]+)"([^>]*)><\/div>/g, (_, a, arq, b) => `<div${a}${b}>${svgUnico(inlinarSvg(arq))}</div>`);
  return h;
}

// ---------- lê e agrupa as páginas ----------
const arquivos = fs.readdirSync(path.join(RAIZ, 'paginas')).filter((f) => f.endsWith('.html')).sort();
const caps = [];
let atual = null;
for (const f of arquivos) {
  if (f.startsWith('00-') || f.startsWith('01-')) continue;
  const html = ler(`paginas/${f}`);
  for (const m of html.matchAll(/<section([^>]*)>([\s\S]*?)<\/section>/g)) {
    const tag = m[1];
    const corpo = m[2];
    const capId = attr(tag, 'data-capitulo') || (/Revisão geral/.test(tag) ? 'R' : null);
    if (!capId) continue;
    if (/class="abertura/.test(corpo)) {
      const ab = corpo;
      atual = {
        id: capId,
        num: capId === 'R' ? '★' : capId,
        titulo: texto((ab.match(/<h1>([\s\S]*?)<\/h1>/) || [])[1] || ''),
        sobre: texto((ab.match(/<span class="sobretitulo">([\s\S]*?)<\/span>/) || [])[1] || ''),
        sub: (ab.match(/<p class="sub">([\s\S]*?)<\/p>/) || [])[1] || '',
        tema: ((ab.match(/class="abertura ?([^"]*)"/) || [])[1] || '').trim() || 'mar',
        ilustra: attr((ab.match(/<div class="ilustra"[^>]*>/) || [''])[0], 'data-svg'),
        chips: [...((ab.match(/<div class="chips-abertura[^"]*">([\s\S]*?)<\/div>/) || [])[1] || '').matchAll(/<span>([\s\S]*?)<\/span>/g)].map((x) => x[1]),
        aprender: [...((ab.match(/<ul class="check">([\s\S]*?)<\/ul>/) || [])[1] || '').matchAll(/<li>([\s\S]*?)<\/li>/g)].map((x) => x[1]),
        blocos: [],
      };
      caps.push(atual);
      continue;
    }
    const conteudo = (corpo.match(/^\s*<div class="conteudo">([\s\S]*)<\/div>\s*$/) || [])[1];
    if (conteudo == null) throw new Error('Seção sem .conteudo em ' + f);
    const sum = attr(tag, 'data-sumario');
    const sum2 = attr(tag, 'data-sumario-2');
    if (!sum && atual.blocos.length) {
      atual.blocos[atual.blocos.length - 1].html += '\n' + conteudo; // continuação da seção anterior
    } else {
      atual.blocos.push({ titulo: sum || texto((conteudo.match(/<h2[^>]*>([\s\S]*?)<\/h2>/) || [])[1] || ''), titulo2: sum2, html: conteudo });
    }
  }
}

// ---------- extras interativos ----------
const cap6 = caps.find((c) => c.id === '6');
const iProf = cap6.blocos.findIndex((b) => b.titulo.startsWith('6.5'));
cap6.blocos.splice(iProf + 1, 0, { titulo: 'Simulador: mordeu, e agora?', extra: true,
  html: '<span class="sobretitulo">Interativo · Profilaxia na prática</span><h2 class="titulo-secao">Mordeu… e agora?</h2><div class="linha-fina"></div><div class="simulador-raiva"></div>' });
const capR = caps.find((c) => c.id === 'R');
const iQuadro = capR.blocos.findIndex((b) => b.titulo.startsWith('R.2'));
capR.blocos.splice(iQuadro + 1, 0, { titulo: 'Jogo: desafio relâmpago', extra: true,
  html: '<span class="sobretitulo">Interativo · Teste-se</span><h2 class="titulo-secao">Desafio relâmpago</h2><div class="linha-fina"></div><div class="jogo-relampago"></div>' });

// ---------- monta o HTML ----------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const indice = [];
const templates = caps.map((c) => {
  const hid = (i) => `c${c.id}-${i + 1}`;
  const ilustra = c.ilustra ? svgUnico(inlinarSvg(c.ilustra)) : '';
  const hero = `
<header class="cap-hero tema-${c.tema}">
  <div class="hero-foto"><span class="fita" aria-hidden="true"></span><div class="hero-arte">${ilustra}</div><span class="hero-num" aria-hidden="true">${c.num}</span></div>
  <div class="hero-texto">
    <span class="hero-sobre">${c.sobre}</span>
    <h1 class="hero-titulo">${c.titulo}</h1>
    <p class="hero-sub">${c.sub}</p>
    <div class="hero-chips">${c.chips.map((x) => `<span>${x}</span>`).join('')}</div>
  </div>
  <div class="hero-aprender"><h2>${c.id === 'R' ? 'Nesta revisão' : 'Neste capítulo você vai aprender'}</h2><ul class="check">${c.aprender.map((x) => `<li>${x}</li>`).join('')}</ul></div>
</header>`;
  const blocos = c.blocos.map((b, i) => `
<section class="bloco${b.extra ? ' extra' : ''}" id="${hid(i)}" data-titulo="${esc(b.titulo)}">
${prepararHtml(b.html)}
</section>`).join('\n');
  indice.push({ id: c.id, num: c.num, titulo: c.titulo, sobre: c.sobre, tema: c.tema,
    secoes: c.blocos.map((b, i) => ({ id: hid(i), titulo: b.titulo, titulo2: b.titulo2 || null, extra: !!b.extra })) });
  return `<template id="tpl-cap-${c.id}">
<article class="capitulo" data-cap="${c.id}">${hero}${blocos}
<footer class="cap-fim"></footer>
</article></template>`;
}).join('\n');

// miniaturas das aberturas para a capa (fichas)
const miniaturas = Object.fromEntries(caps.filter((c) => c.ilustra).map((c) => [c.id, svgUnico(inlinarSvg(c.ilustra))]));

const css = ler('interativa/estilo.css');
const js = ler('interativa/app.js');
const casca = ler('interativa/casca.html');
const capaArte = svgUnico(inlinarSvg('ilustracoes/capa-arte.svg'));

const html = `<title>Apostila ACE Interativa</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Caveat:wght@700&family=Inter:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Kalam:wght@300;400;700&family=Kaushan+Script&family=Nunito:ital,wght@0,400;0,600;0,700;0,800;1,400&family=Poppins:wght@500;600;700;800&display=swap">
<style>
${css}
</style>
${casca.replace('<!-- CAPA-ARTE -->', capaArte)}
${templates}
<template id="tpl-miniaturas">${Object.entries(miniaturas).map(([k, v]) => `<div data-cap="${k}">${v}</div>`).join('')}</template>
<script>
window.DADOS = ${JSON.stringify({ caps: indice, mapas: MAPAS })};
</script>
<script>
${js}
</script>
`;
fs.mkdirSync(SAIDA, { recursive: true });
fs.writeFileSync(path.join(SAIDA, 'index.html'), html);
console.log(`${caps.length} capítulos, ${indice.reduce((s, c) => s + c.secoes.length, 0)} seções → saida/interativa/index.html (${(html.length / 1024).toFixed(0)} KB)`);
