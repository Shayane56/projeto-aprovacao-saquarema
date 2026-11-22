/* Apostila ACE interativa — navegação, questões, mapas, treino, busca, progresso e jogos. */
(() => {
  'use strict';
  const D = window.DADOS;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const semMovimento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const escH = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  /* ---------------- estado salvo ---------------- */
  const CHAVE = 'apostila-ace-interativa-v1';
  const E = { estudados: [], respostas: {}, vistas: {}, ultimo: null, recorde: 0 };
  try { Object.assign(E, JSON.parse(localStorage.getItem(CHAVE) || '{}')); } catch (e) { /* sem armazenamento */ }
  const salvar = () => { try { localStorage.setItem(CHAVE, JSON.stringify(E)); } catch (e) { /* ignora */ } };

  const CAPS = D.caps;
  const capPorId = Object.fromEntries(CAPS.map((c) => [c.id, c]));
  const TOTALQ = {};
  CAPS.forEach((c) => { TOTALQ[c.id] = $(`#tpl-cap-${c.id}`).content.querySelectorAll('.questao').length; });
  const totalQ = Object.values(TOTALQ).reduce((a, b) => a + b, 0);
  const rotuloCap = (c) => (c.id === 'R' ? 'Revisão geral' : `Capítulo ${c.num}`);

  function statsCap(id) {
    const r = Object.entries(E.respostas).filter(([k]) => k.startsWith(id + '-')).map(([, v]) => v);
    const vistas = (E.vistas[id] || []).length;
    return { resp: r.length, ok: r.filter((x) => x.ok).length, total: TOTALQ[id], vistas, secoes: capPorId[id].secoes.length };
  }

  /* ---------------- avisos e confete ---------------- */
  let tToast;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('ver');
    clearTimeout(tToast); tToast = setTimeout(() => t.classList.remove('ver'), 2400);
  }
  function confete(n = 46) {
    if (semMovimento()) return;
    const simbolos = ['★', '✓', '✦', '♥', '~', '✿', '!'];
    const cores = ['var(--coral)', 'var(--ambar)', 'var(--verde)', 'var(--azul)', 'var(--roxo)', 'var(--rosa)'];
    for (let i = 0; i < n; i++) {
      const s = document.createElement('span');
      s.className = 'confete';
      s.textContent = simbolos[i % simbolos.length];
      s.style.left = Math.random() * 100 + 'vw';
      s.style.color = cores[i % cores.length];
      s.style.setProperty('--dx', (Math.random() * 160 - 80) + 'px');
      s.style.setProperty('--r', (Math.random() * 720 - 360) + 'deg');
      s.style.setProperty('--t', (1.8 + Math.random() * 1.6) + 's');
      s.style.animationDelay = Math.random() * .5 + 's';
      document.body.appendChild(s);
      setTimeout(() => s.remove(), 4200);
    }
  }

  /* ---------------- rabiscos (doodles) ---------------- */
  const S = 'stroke="var(--tinta)" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"';
  function cicloArcos() {
    const cores = ['--laranja', '--verde', '--azul', '--rosa'];
    let s = '';
    [0, 90, 180, 270].forEach((a, i) => {
      const r = 23, rad = (d) => d * Math.PI / 180;
      const x1 = 40 + r * Math.cos(rad(a)), y1 = 40 + r * Math.sin(rad(a));
      const x2 = 40 + r * Math.cos(rad(a + 66)), y2 = 40 + r * Math.sin(rad(a + 66));
      const tx = -Math.sin(rad(a + 66)), ty = Math.cos(rad(a + 66)), nx = Math.cos(rad(a + 66)), ny = Math.sin(rad(a + 66));
      const p1 = [x2 - 6 * tx + 4 * nx, y2 - 6 * ty + 4 * ny], p2 = [x2 - 6 * tx - 4 * nx, y2 - 6 * ty - 4 * ny];
      const f = (n) => n.toFixed(1);
      s += `<path d="M${f(x1)} ${f(y1)} A${r} ${r} 0 0 1 ${f(x2)} ${f(y2)}" fill="none" stroke="var(${cores[i]})" stroke-width="3.4" stroke-linecap="round"/>`;
      s += `<path d="M${f(p1[0])} ${f(p1[1])} L${f(x2)} ${f(y2)} L${f(p2[0])} ${f(p2[1])}" fill="none" stroke="var(${cores[i]})" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>`;
    });
    return s;
  }
  const DOODLES = {
    virus: `<g transform="rotate(-18 40 40)"><g class="anim gira"><path d="M17 40 H11 M17 51 H11 M63 40 H69 M63 51 H69 M24 22 L19 15 M40 15 V7 M56 22 L61 15" ${S} fill="none"/>
      <path d="M24 58 V34 Q24 16 40 16 Q56 16 56 34 V58 Z" fill="var(--mk-laranja)" ${S}/><path d="M30 31 Q40 36 50 31 M30 40 Q40 45 50 40 M30 49 Q40 54 50 49" fill="none" stroke="var(--tinta)" stroke-width="1.6" stroke-linecap="round"/></g></g>`,
    ciclo: `<g class="anim roda">${cicloArcos()}</g><circle cx="40" cy="40" r="6" fill="var(--mk-roxo)" ${S}/>`,
    mosquito: `<g class="anim voa"><path d="M30 34 C18 18 8 22 12 32 C16 38 26 38 30 36 Z M46 34 C58 18 68 22 64 32 C60 38 50 38 46 36 Z" fill="var(--mk-azul)" ${S}/>
      <ellipse cx="38" cy="42" rx="6" ry="13" fill="var(--tinta)"/><circle cx="38" cy="26" r="5" fill="var(--tinta)"/><path d="M38 21 L36 10 M33 48 L22 62 M43 48 L54 62 M33 42 L20 50 M43 42 L56 50" ${S} fill="none"/>
      <path d="M35 40 H41 M35 45 H41" stroke="var(--papel)" stroke-width="1.5"/></g>`,
    termometro: `<rect x="33" y="10" width="14" height="46" rx="7" fill="var(--papel-2)" ${S}/><rect class="anim sobe" x="37" y="24" width="6" height="34" rx="3" fill="var(--coral)" style="transform-origin:center bottom"/>
      <circle cx="40" cy="62" r="10" fill="var(--coral)" ${S}/><path d="M50 20 H55 M50 30 H55 M50 40 H55" ${S}/>`,
    lupa: `<g class="anim anda"><circle cx="34" cy="34" r="17" fill="var(--mk-azul)" ${S}/><path d="M46 46 L64 64" stroke="var(--tinta)" stroke-width="6" stroke-linecap="round"/>
      <path d="M26 28 Q30 22 37 22" fill="none" stroke="var(--papel)" stroke-width="2.5" stroke-linecap="round"/></g>`,
    pilula: `<g class="anim balanca"><g transform="rotate(-35 40 40)"><rect x="16" y="30" width="48" height="20" rx="10" fill="var(--papel-2)" ${S}/>
      <path d="M40 30 H54 A10 10 0 0 1 54 50 H40 Z" fill="var(--mk-rosa)" ${S}/></g></g>`,
    escudo: `<g class="anim pulsa"><path d="M40 10 L62 18 V38 C62 52 52 62 40 68 C28 62 18 52 18 38 V18 Z" fill="var(--mk-verde)" ${S}/>
      <path d="M30 38 L37 45 L51 30" fill="none" stroke="var(--verde)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></g>`,
    pata: `<g class="anim gira"><ellipse cx="40" cy="50" rx="13" ry="11" fill="var(--mk-laranja)" ${S}/><circle cx="24" cy="34" r="6" fill="var(--mk-laranja)" ${S}/>
      <circle cx="34" cy="24" r="6" fill="var(--mk-laranja)" ${S}/><circle cx="47" cy="24" r="6" fill="var(--mk-laranja)" ${S}/><circle cx="57" cy="34" r="6" fill="var(--mk-laranja)" ${S}/></g>`,
    caramujo: `<g class="anim anda"><path d="M12 58 H58 C64 58 68 54 66 50" fill="var(--mk-verde)" ${S}/><circle cx="38" cy="40" r="17" fill="var(--mk-amarelo)" ${S}/>
      <path d="M38 40 m-3 0 a3 3 0 1 1 6 0 a7 7 0 1 1 -14 0 a11 11 0 1 1 22 0" fill="none" ${S}/><path d="M60 50 L64 38 M64 52 L70 42" ${S}/></g>`,
    relogio: `<circle cx="40" cy="40" r="25" fill="var(--mk-amarelo)" ${S}/><path d="M40 40 V26" ${S}/><g class="anim roda"><path d="M40 40 L52 46" stroke="var(--coral)" stroke-width="3" stroke-linecap="round"/></g>
      <circle cx="40" cy="40" r="2.5" fill="var(--tinta)"/>`,
    seringa: `<g transform="rotate(-25 40 40)"><g class="anim empurra"><path d="M6 33 V49 M6 41 H24" ${S} fill="none"/><rect x="20" y="37" width="8" height="8" fill="var(--tinta)"/></g>
      <rect x="24" y="33" width="34" height="16" rx="3" fill="var(--mk-azul)" ${S}/><path d="M31 33 V39 M38 33 V39 M45 33 V39 M52 33 V39 M58 41 H74" ${S} fill="none"/>
      <circle class="anim pinga" cx="76" cy="45" r="2.4" fill="var(--azul)"/></g>`,
    gato: `<g class="anim balanca"><path d="M18 30 L22 12 L33 24 H47 L58 12 L62 30 C66 48 56 62 40 62 C24 62 14 48 18 30 Z" fill="var(--mk-laranja)" ${S}/>
      <circle cx="32" cy="38" r="2.5" fill="var(--tinta)"/><circle cx="48" cy="38" r="2.5" fill="var(--tinta)"/><path d="M37 46 L40 49 L43 46 M26 48 L14 46 M26 52 L15 54 M54 48 L66 46 M54 52 L65 54" ${S} fill="none"/></g>`,
    prancheta: `<rect x="18" y="14" width="44" height="56" rx="5" fill="var(--mk-amarelo)" ${S}/><rect x="31" y="9" width="18" height="10" rx="3" fill="var(--tinta)"/>
      <path class="anim risca" d="M24 31 L28 35 L35 27" fill="none" stroke="var(--verde)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <path class="anim risca" d="M24 45 L28 49 L35 41" fill="none" stroke="var(--verde)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="--b:.3s"/>
      <path d="M40 31 H55 M40 45 H55 M40 59 H52" ${S} fill="none"/>`,
  };
  function doodlePara(titulo) {
    const t = norm(titulo);
    if (/agente/.test(t)) return 'virus';
    if (/vetor/.test(t)) return 'mosquito';
    if (/hospedeiro/.test(t)) return 'caramujo';
    if (/reservat|macaco/.test(t)) return 'pata';
    if (/gato/.test(t)) return 'gato';
    if (/vacina|profilaxia/.test(t)) return 'seringa';
    if (/periodo/.test(t)) return 'relogio';
    if (/transmiss|ciclo/.test(t)) return 'ciclo';
    if (/diagn|vigil/.test(t)) return 'lupa';
    if (/tratamento|conduta/.test(t)) return 'pilula';
    if (/preven|controle/.test(t)) return 'escudo';
    if (/clin|quadro|forma|fase|humano/.test(t)) return 'termometro';
    return 'prancheta';
  }

  /* ---------------- setas desenhadas à mão ---------------- */
  const NS = 'http://www.w3.org/2000/svg';
  function desenharSetas(caixa, g, origem, alvos, opcoes) {
    const base = caixa.getBoundingClientRect();
    const R = (el) => { const r = el.getBoundingClientRect(); return { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height, cx: r.left - base.left + r.width / 2, cy: r.top - base.top + r.height / 2 }; };
    g.innerHTML = '';
    const ti = R(origem);
    alvos.forEach((a, i) => {
      const alvo = R(a.el);
      let s, e, c;
      if (opcoes.cadeia) {
        const ant = i === 0 ? ti : R(alvos[i - 1].el);
        s = { x: ant.x + (i === 0 ? ant.w * .25 : 6), y: ant.y + ant.h - 2 };
        e = { x: alvo.x - 4, y: alvo.y + 16 };
        c = { x: Math.max(2, Math.min(s.x, e.x) - 20), y: (s.y + e.y) / 2 + 6 };
      } else {
        const dx = alvo.cx - ti.cx, dy = alvo.cy - ti.cy;
        const rx = ti.w / 2 + 6, ry = ti.h / 2 + 4;
        const k = 1 / Math.sqrt((dx / rx) ** 2 + (dy / ry) ** 2);
        s = { x: ti.cx + dx * k, y: ti.cy + dy * k };
        const m = 6, tt = Math.min((alvo.w / 2 + m) / Math.abs(dx || 1e-6), (alvo.h / 2 + m) / Math.abs(dy || 1e-6));
        e = { x: alvo.cx - dx * tt, y: alvo.cy - dy * tt };
        const mx = (s.x + e.x) / 2, my = (s.y + e.y) / 2, len = Math.hypot(e.x - s.x, e.y - s.y) || 1, sinal = i % 2 ? 1 : -1;
        c = { x: mx - (e.y - s.y) / len * len * .18 * sinal, y: my + (e.x - s.x) / len * len * .18 * sinal };
      }
      const tx = e.x - c.x, ty = e.y - c.y, tl = Math.hypot(tx, ty) || 1, ux = tx / tl, uy = ty / tl;
      const p1 = { x: e.x - 11 * ux + 6 * uy, y: e.y - 11 * uy - 6 * ux }, p2 = { x: e.x - 11 * ux - 6 * uy, y: e.y - 11 * uy + 6 * ux };
      const f = (n) => n.toFixed(1);
      const grupo = document.createElementNS(NS, 'g');
      grupo.setAttribute('class', 'sg'); grupo.dataset.i = i; grupo.style.setProperty('--c', a.cor);
      const linha = document.createElementNS(NS, 'path');
      linha.setAttribute('d', `M${f(s.x)} ${f(s.y)} Q${f(c.x)} ${f(c.y)} ${f(e.x)} ${f(e.y)}`);
      const ponta = document.createElementNS(NS, 'path');
      ponta.setAttribute('d', `M${f(p1.x)} ${f(p1.y)} L${f(e.x)} ${f(e.y)} L${f(p2.x)} ${f(p2.y)}`);
      grupo.append(linha, ponta); g.appendChild(grupo);
      if (opcoes.animar) {
        const L = linha.getTotalLength();
        linha.style.strokeDasharray = L; linha.style.setProperty('--len', L);
        linha.classList.add('linha-anim'); ponta.classList.add('ponta-anim');
        linha.style.setProperty('--d', (.15 + i * .14) + 's'); ponta.style.setProperty('--d', (.15 + i * .14) + 's');
      }
    });
  }

  /* ---------------- mapa mental caderno ---------------- */
  const CORES_MAPA = ['var(--laranja)', 'var(--teal)', 'var(--roxo)', 'var(--verde)', 'var(--rosa)', 'var(--azul)'];
  function montarMapa(el) {
    const d = D.mapas[el.dataset.mapa];
    const ramos = d.ramos.map(([titulo, , linhas]) => {
      const itens = [];
      linhas.forEach((l) => { if (l.startsWith('~') && itens.length) itens[itens.length - 1] += ' ' + l.slice(1); else itens.push(l.replace(/^~/, '')); });
      return { titulo, itens };
    });
    el.innerHTML = `<div class="mc">
      <svg class="mc-setas" aria-hidden="true"><g filter="url(#tremido)"></g></svg>
      <div class="mc-centro"><h3 class="mc-titulo sem-marca">${escH(d.centro)}</h3><span class="mc-sub">${escH(d.sub || '')}</span>${d.extra ? `<span class="mc-extra">${escH(d.extra.join(' '))}</span>` : ''}</div>
      ${ramos.map((r, i) => `<div role="button" tabindex="0" class="mc-ramo e${i % 4}" style="--c:${CORES_MAPA[i % 6]};--area:r${i + 1}" aria-pressed="false">
        <svg class="mc-doodle" viewBox="0 0 80 80" aria-hidden="true">${DOODLES[doodlePara(r.titulo)]}</svg>
        <h4>${escH(r.titulo)}</h4><ul>${r.itens.map((x) => `<li>${escH(x)}</li>`).join('')}</ul></div>`).join('')}
    </div><p class="mc-dica">Toque num ramo para destacar. No modo treino, os itens somem: toque em cada um para lembrar.</p>`;
    const mc = $('.mc', el), g = $('.mc-setas g', el), titulo = $('.mc-titulo', el);
    const botoes = $$('.mc-ramo', el);
    const alvos = botoes.map((b, i) => ({ el: b, cor: CORES_MAPA[i % 6] }));
    let primeira = true;
    const desenhar = () => {
      if (!el.isConnected || !el.offsetWidth) return;
      desenharSetas(mc, g, titulo, alvos, { cadeia: el.offsetWidth < 640, animar: primeira && !semMovimento() });
      primeira = false;
      atualizarFoco();
    };
    function atualizarFoco() {
      const i = botoes.findIndex((b) => b.classList.contains('foco'));
      mc.classList.toggle('focado', i >= 0);
      $$('g.sg', g).forEach((x) => x.classList.toggle('acesa', Number(x.dataset.i) === i));
    }
    botoes.forEach((b) => b.addEventListener('click', (ev) => {
      const li = ev.target.closest('li');
      if (document.body.classList.contains('treino') && li) { li.classList.toggle('ver'); return; }
      const ja = b.classList.contains('foco');
      botoes.forEach((x) => { x.classList.remove('foco'); x.setAttribute('aria-pressed', 'false'); });
      if (!ja) { b.classList.add('foco'); b.setAttribute('aria-pressed', 'true'); }
      atualizarFoco();
    }));
    botoes.forEach((b) => b.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); b.click(); } }));
    let t;
    new ResizeObserver(() => { clearTimeout(t); t = setTimeout(desenhar, 60); }).observe(el);
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => requestAnimationFrame(desenhar));
  }

  /* ---------------- questões interativas ---------------- */
  function gabaritoDe(art) {
    const g = {};
    $$('.gabarito-item', art).forEach((it) => {
      const r = $('.resp', it); if (!r) return;
      const m = r.textContent.match(/(\d+)\s*·\s*([A-E])/); if (!m) return;
      const p = (it.querySelector('p') || it).cloneNode(true);
      const rr = p.querySelector('.resp'); if (rr) rr.remove();
      g[m[1]] = { letra: m[2], com: p.innerHTML.trim() };
    });
    return g;
  }
  function prepararQuestoes(art, cap) {
    const gab = gabaritoDe(art);
    $$('.gabarito-tira', art).forEach((x) => x.remove());
    // comentários: agrupa num "ver todos"
    $$('.bloco', art).forEach((b) => {
      const itens = $$('.gabarito-item', b);
      if (!itens.length) return;
      const det = document.createElement('details');
      det.className = 'todos-comentarios';
      det.innerHTML = '<summary>Ver os comentários de todas as questões</summary><div class="gabaritos"></div>';
      const primeiro = itens[0].closest('.gabaritos') || itens[0];
      primeiro.parentNode.insertBefore(det, primeiro);
      const aviso = document.createElement('p');
      aviso.className = 'aviso-gabarito';
      aviso.textContent = 'A correção aparece em cada questão assim que você responde. Se quiser, veja todos os comentários juntos:';
      det.parentNode.insertBefore(aviso, det);
      itens.forEach((it) => $('.gabaritos', det).appendChild(it));
      $$('.gabaritos', b).forEach((x) => { if (!x.closest('details') && !x.querySelector('.gabarito-item')) x.remove(); });
    });
    const qs = $$('.questao', art);
    if (!qs.length) return;
    const placar = document.createElement('div');
    placar.className = 'placar';
    qs[0].parentNode.insertBefore(placar, qs[0]);
    qs.forEach((q) => {
      const n = ($('.nq', q) || {}).textContent;
      const g = gab[(n || '').trim()];
      if (!g) return;
      q.dataset.n = n.trim();
      $$('ol.alt > li', q).forEach((li, i) => {
        const L = 'ABCDE'[i];
        li.dataset.l = L; li.classList.add('alt-i'); li.tabIndex = 0; li.setAttribute('role', 'button');
        li.setAttribute('aria-label', `Alternativa ${L}`);
        const escolher = () => { if (!q.classList.contains('respondida')) responder(q, cap, g, L, true); };
        li.addEventListener('click', escolher);
        li.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); escolher(); } });
      });
      const fb = document.createElement('div'); fb.className = 'feedback'; fb.hidden = true; fb.setAttribute('aria-live', 'polite'); q.appendChild(fb);
      const ant = E.respostas[`${cap}-${q.dataset.n}`];
      if (ant) responder(q, cap, g, ant.r, false);
    });
    atualizarPlacar(art, cap);
  }
  function responder(q, cap, g, L, novo) {
    const ok = L === g.letra;
    q.classList.add('respondida', ok ? 'acertou' : 'errou');
    $$('li.alt-i', q).forEach((li) => {
      li.removeAttribute('tabindex');
      if (li.dataset.l === g.letra) li.classList.add('certa');
      else if (li.dataset.l === L) li.classList.add('errada');
      else li.classList.add('apagada');
    });
    const fb = $('.feedback', q);
    fb.hidden = false; fb.className = 'feedback ' + (ok ? 'ok' : 'no');
    fb.innerHTML = `<span class="fb-tit">${ok ? 'Acertou! ✓' : `Não foi dessa vez — o gabarito é ${g.letra}.`}</span>${g.com}<br><button type="button" class="refazer">Responder de novo</button>`;
    $('.refazer', fb).addEventListener('click', () => {
      delete E.respostas[`${cap}-${q.dataset.n}`]; salvar();
      q.classList.remove('respondida', 'acertou', 'errou');
      $$('li.alt-i', q).forEach((li) => { li.classList.remove('certa', 'errada', 'apagada'); li.tabIndex = 0; });
      fb.hidden = true;
      atualizarPlacar(q.closest('.capitulo'), cap);
    });
    if (novo) {
      E.respostas[`${cap}-${q.dataset.n}`] = { r: L, ok };
      salvar();
      if (!ok && !semMovimento()) { q.classList.add('treme'); setTimeout(() => q.classList.remove('treme'), 450); }
      atualizarPlacar(q.closest('.capitulo'), cap);
      const st = statsCap(cap);
      if (st.resp === st.total) {
        const pct = Math.round(st.ok / st.total * 100);
        toast(`Questões do capítulo concluídas: ${st.ok} de ${st.total} (${pct}%)`);
        if (pct >= 70) confete(30);
      }
    }
  }
  function atualizarPlacar(art, cap) {
    const p = $('.placar', art); if (!p) return;
    const st = statsCap(cap);
    const pctOk = st.total ? st.ok / st.total * 100 : 0, pctNo = st.total ? (st.resp - st.ok) / st.total * 100 : 0;
    p.innerHTML = `<span>Placar</span><span class="pl-num">${st.ok}/${st.total}</span><span class="pl-barra" aria-hidden="true"><i class="ok" style="width:${pctOk}%"></i><i class="no" style="width:${pctNo}%"></i></span>
      <span>${st.resp} de ${st.total} respondidas</span>${st.resp ? '<button type="button">zerar</button>' : ''}`;
    const z = $('button', p);
    if (z) z.addEventListener('click', () => {
      Object.keys(E.respostas).filter((k) => k.startsWith(cap + '-')).forEach((k) => delete E.respostas[k]);
      salvar(); mostrarCapitulo(cap, null, true); toast('Placar zerado. Bons estudos!');
    });
  }

  /* ---------------- outros realces do capítulo ---------------- */
  function prepararCe(art) {
    $$('.ce', art).forEach((ce) => {
      const certo = $('.certo', ce); if (!certo) return;
      ce.classList.add('fechado'); ce.tabIndex = 0; ce.setAttribute('role', 'button');
      ce.setAttribute('aria-label', 'Pegadinha: toque para ver a versão correta');
      const t = document.createElement('span'); t.className = 'toque'; t.textContent = 'pense na versão certa… e toque para ver';
      certo.appendChild(t);
      const alterna = () => {
        const fechar = !ce.classList.contains('fechado');
        ce.classList.toggle('fechado', fechar);
        ce.classList.toggle('abriu', !fechar);
      };
      ce.addEventListener('click', alterna);
      ce.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alterna(); } });
    });
  }
  function prepararTabelas(art) {
    $$('table', art).forEach((t) => {
      if (t.parentElement.classList.contains('tabela-rolagem')) return;
      const w = document.createElement('div'); w.className = 'tabela-rolagem';
      t.parentNode.insertBefore(w, t); w.appendChild(t);
    });
    $$('a[href^="http"]', art).forEach((a) => { a.target = '_blank'; a.rel = 'noopener'; });
  }
  function prepararFiguras(art) {
    $$('.figura', art).forEach((f) => {
      if (!$('svg', f)) return;
      f.tabIndex = 0; f.setAttribute('role', 'button'); f.setAttribute('aria-label', 'Ampliar a ilustração');
      const abrir = () => abrirLupa($('svg', f));
      f.addEventListener('click', abrir);
      f.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(); } });
    });
  }
  function prepararTreino(art) {
    art.addEventListener('click', (e) => {
      if (!document.body.classList.contains('treino')) return;
      const alvo = e.target.closest('.revisao-bloco strong, .revisao-bloco b, .frases-resumo .manuscrito');
      if (alvo) alvo.classList.toggle('ver');
    });
  }

  /* ---------------- lupa ---------------- */
  let zoom = 1;
  function abrirLupa(svg) {
    const folha = $('#lupa-folha');
    folha.innerHTML = '';
    folha.appendChild(svg.cloneNode(true));
    zoom = 1; folha.style.setProperty('--z', zoom);
    $('#lupa').hidden = false;
    $('#lupa-fechar').focus();
  }
  $('#lupa-fechar').addEventListener('click', () => { $('#lupa').hidden = true; });
  $('#lupa-mais').addEventListener('click', () => { zoom = Math.min(3, zoom + .5); $('#lupa-folha').style.setProperty('--z', zoom); });
  $('#lupa-menos').addEventListener('click', () => { zoom = Math.max(1, zoom - .5); $('#lupa-folha').style.setProperty('--z', zoom); });
  $('#lupa').addEventListener('click', (e) => { if (e.target.id === 'lupa-area' || e.target.id === 'lupa') $('#lupa').hidden = true; });

  /* ---------------- simulador da raiva ---------------- */
  function montarSimulador(el) {
    const ICONES = {
      cao: `<svg viewBox="0 0 40 40" aria-hidden="true"><ellipse cx="9" cy="17" rx="5" ry="9" fill="var(--marrom)" ${S}/><ellipse cx="31" cy="17" rx="5" ry="9" fill="var(--marrom)" ${S}/><circle cx="20" cy="21" r="12" fill="var(--mk-laranja)" ${S}/><circle cx="15.5" cy="19" r="1.6" fill="var(--tinta)"/><circle cx="24.5" cy="19" r="1.6" fill="var(--tinta)"/><ellipse cx="20" cy="25" rx="3" ry="2.2" fill="var(--tinta)"/></svg>`,
      caoSusp: `<svg viewBox="0 0 40 40" aria-hidden="true"><ellipse cx="9" cy="19" rx="5" ry="9" fill="var(--marrom)" ${S}/><ellipse cx="31" cy="19" rx="5" ry="9" fill="var(--marrom)" ${S}/><circle cx="20" cy="23" r="12" fill="var(--mk-laranja)" ${S}/><path d="M14 20 L17 22 M26 20 L23 22" ${S}/><path d="M15 29 Q20 26 25 29" fill="none" ${S}/><text x="30" y="11" font-family="Kalam, cursive" font-weight="700" font-size="13" fill="var(--coral)">?</text></svg>`,
      morcego: `<svg viewBox="0 0 80 50" aria-hidden="true"><path d="M34 24 C26 14 14 12 4 18 C10 21 12 26 9 31 C16 28 21 30 23 36 C27 31 31 30 34 30 Z M46 24 C54 14 66 12 76 18 C70 21 68 26 71 31 C64 28 59 30 57 36 C53 31 49 30 46 30 Z" fill="var(--tinta)"/><ellipse cx="40" cy="27" rx="7" ry="10" fill="var(--tinta)"/><path d="M35 19 L34 11 L39 17 Z M45 19 L46 11 L41 17 Z" fill="var(--tinta)"/></svg>`,
      boi: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M9 12 Q4 8 5 4 M31 12 Q36 8 35 4" fill="none" ${S}/><path d="M10 12 Q20 6 30 12 L28 26 Q20 30 12 26 Z" fill="var(--papel-2)" ${S}/><ellipse cx="20" cy="29" rx="8" ry="6" fill="var(--mk-rosa)" ${S}/><circle cx="16" cy="18" r="1.6" fill="var(--tinta)"/><circle cx="24" cy="18" r="1.6" fill="var(--tinta)"/></svg>`,
    };
    const ANIMAIS = [['cao', 'Cão ou gato saudável'], ['caoSusp', 'Cão ou gato suspeito, morto ou sumiu'], ['morcego', 'Morcego ou animal silvestre'], ['boi', 'Boi, cavalo ou porco']];
    const CONTATOS = [['mordida', 'Mordida ou arranhão'], ['mucosa', 'Lambeu olho ou boca'], ['pele', 'Só encostou (pele sem ferida)']];
    const PROFS = [['sup', 'Superficial e única'], ['prof', 'Profunda ou várias']];
    const LOCAIS = { cabeca: 'cabeça, rosto ou pescoço', tronco: 'tronco', bracos: 'braço', maos: 'mão ou dedos', pernas: 'perna', pes: 'pé' };
    const est = { animal: 'cao', contato: 'mordida', prof: 'sup', local: 'maos' };
    el.innerHTML = `<p>Monte a situação: escolha o animal, o tipo de contato e toque no boneco onde foi a ferida. O post-it mostra se a exposição é grave ou leve e qual é a conduta.</p>
    <div class="sim-grade">
      <div>
        <div class="sim-passo"><h4><span class="sim-n">1</span>Qual animal?</h4><div class="sim-opcoes" data-k="animal">${ANIMAIS.map(([v, t]) => `<button type="button" class="sim-op" data-v="${v}">${ICONES[v]}${t}</button>`).join('')}</div></div>
        <div class="sim-passo"><h4><span class="sim-n">2</span>Que tipo de contato?</h4><div class="sim-opcoes" data-k="contato">${CONTATOS.map(([v, t]) => `<button type="button" class="sim-op sem-icone" data-v="${v}">${t}</button>`).join('')}</div></div>
        <div class="sim-passo"><h4><span class="sim-n">3</span>Como é a ferida?</h4><div class="sim-opcoes" data-k="prof">${PROFS.map(([v, t]) => `<button type="button" class="sim-op sem-icone" data-v="${v}">${t}</button>`).join('')}</div></div>
      </div>
      <div class="sim-corpo">
        <h4 style="justify-content:center;display:flex;gap:8px;align-items:center;margin-top:0"><span class="sim-n">4</span>Onde foi?</h4>
        <svg viewBox="0 0 200 290" role="group" aria-label="Boneco: toque no local da ferida">
          <g class="regiao" data-local="bracos" tabindex="0" role="button" aria-label="Braço"><rect x="51" y="82" width="18" height="78" rx="9" transform="rotate(16 60 82)"/><rect x="131" y="82" width="18" height="78" rx="9" transform="rotate(-16 140 82)"/></g>
          <g class="regiao" data-local="pernas" tabindex="0" role="button" aria-label="Perna"><rect x="74" y="166" width="22" height="96" rx="10" transform="rotate(4 85 166)"/><rect x="104" y="166" width="22" height="96" rx="10" transform="rotate(-4 115 166)"/></g>
          <g class="regiao" data-local="tronco" tabindex="0" role="button" aria-label="Tronco"><rect x="68" y="74" width="64" height="98" rx="18"/></g>
          <g class="regiao" data-local="cabeca" tabindex="0" role="button" aria-label="Cabeça, rosto ou pescoço"><rect x="91" y="60" width="18" height="18" rx="4"/><circle cx="100" cy="40" r="24"/></g>
          <g class="regiao" data-local="maos" tabindex="0" role="button" aria-label="Mão ou dedos"><circle cx="37" cy="165" r="11"/><circle cx="163" cy="165" r="11"/></g>
          <g class="regiao" data-local="pes" tabindex="0" role="button" aria-label="Pé"><ellipse cx="74" cy="268" rx="16" ry="8"/><ellipse cx="126" cy="268" rx="16" ry="8"/></g>
          <g fill="var(--tinta)" pointer-events="none"><circle cx="92" cy="38" r="2.4"/><circle cx="108" cy="38" r="2.4"/><path d="M92 49 Q100 55 108 49" fill="none" stroke="var(--tinta)" stroke-width="2" stroke-linecap="round"/></g>
        </svg>
        <p>Local: <b class="sim-local">mão</b></p>
      </div>
      <div class="sim-res" aria-live="polite"></div>
    </div>`;
    $$('.sim-opcoes', el).forEach((box) => box.addEventListener('click', (e) => {
      const b = e.target.closest('.sim-op'); if (!b || b.disabled) return;
      est[box.dataset.k] = b.dataset.v; atualizar();
    }));
    $$('.regiao', el).forEach((r) => {
      const escolher = () => { if (est.contato !== 'mordida') return; est.local = r.dataset.local; atualizar(); };
      r.addEventListener('click', escolher);
      r.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); escolher(); } });
    });
    function avaliar({ animal, contato, prof, local }) {
      const lavar = 'Lavar já com <b>água corrente e sabão</b>, em abundância.';
      if (contato === 'pele') return { rot: 'Não é exposição', cor: 'var(--verde)', porque: 'Saliva em pele íntegra não transmite o vírus.', passos: [lavar, 'Não precisa de vacina nem de soro.'], ace: 'ACE: orienta a lavar e tranquiliza o morador.' };
      const motivos = [];
      if (animal === 'morcego') motivos.push('contato com morcego ou animal silvestre é sempre grave');
      if (contato === 'mucosa') motivos.push('lambedura de mucosa');
      if (contato === 'mordida' && prof === 'prof') motivos.push('ferimento profundo ou múltiplo');
      if (contato === 'mordida' && ['cabeca', 'maos', 'pes'].includes(local)) motivos.push(`ferida em ${LOCAIS[local]}, lugar com muitos nervos`);
      const grave = motivos.length > 0;
      const porque = grave ? 'Por quê: ' + motivos.join('; ') + '.' : `Por quê: ferimento superficial e único em ${LOCAIS[local]}.`;
      const passos = [lavar, 'Procurar a <b>unidade de saúde</b> hoje.'];
      let ace;
      if (animal === 'cao') {
        passos.push('Observar o cão ou gato por <b>10 dias</b>.', 'Continuou saudável? <b>Não precisa</b> de profilaxia.', `Adoeceu, morreu ou sumiu? Iniciar ${grave ? '<b>vacina + soro</b>' : 'a <b>vacina</b>'}.`);
        ace = 'ACE: orienta o tutor a não matar nem soltar o animal.';
      } else if (animal === 'caoSusp') {
        passos.push(grave ? '<b>Vacina</b> (dias 0, 3, 7 e 14) <b>+ soro</b> ou imunoglobulina.' : '<b>Vacina</b> nos dias 0, 3, 7 e 14.');
        ace = 'ACE: comunica a vigilância sobre o animal suspeito.';
      } else if (animal === 'morcego') {
        passos.push('<b>Vacina</b> (dias 0, 3, 7 e 14) <b>+ soro</b> ou imunoglobulina.', 'Morcego e silvestres <b>não são observados</b>.');
        ace = 'ACE: não tocar no morcego, cobrir com balde e chamar zoonoses.';
      } else {
        passos.push(grave ? 'Em geral <b>vacina + soro</b>: o profissional avalia o risco.' : 'Em geral <b>vacina</b>: o profissional avalia o risco.');
        ace = 'ACE: comunica a suspeita de raiva no rebanho (defesa sanitária animal).';
      }
      return { rot: grave ? 'Exposição grave' : 'Exposição leve', cor: grave ? 'var(--coral)' : 'var(--ambar-escuro)', porque, passos, ace };
    }
    function atualizar() {
      if (est.contato === 'mucosa') est.local = 'cabeca';
      $$('.sim-opcoes', el).forEach((box) => $$('.sim-op', box).forEach((b) => {
        const k = box.dataset.k;
        if (k === 'prof') b.disabled = est.contato !== 'mordida';
        b.setAttribute('aria-pressed', String(b.dataset.v === est[k] && !(k === 'prof' && est.contato !== 'mordida')));
      }));
      $$('.regiao', el).forEach((r) => { r.classList.toggle('sel', est.contato !== 'pele' && r.dataset.local === est.local); r.classList.toggle('travada', est.contato !== 'mordida'); });
      $('.sim-local', el).textContent = est.contato === 'pele' ? '—' : est.contato === 'mucosa' ? 'olho ou boca' : LOCAIS[est.local];
      const r = avaliar(est);
      $('.sim-res', el).innerHTML = `<span class="fita" aria-hidden="true"></span><span class="carimbo" style="--cc:${r.cor}">${r.rot}</span><p class="porque">${r.porque}</p>
        <ol>${r.passos.map((p) => `<li>${p}</li>`).join('')}</ol><span class="dica-ace">${r.ace}</span>
        <p class="aviso">Simulação para estudo, com base no capítulo 6. Na vida real, quem decide a profilaxia é o profissional de saúde.</p>`;
    }
    atualizar();
  }

  /* ---------------- jogo: desafio relâmpago ---------------- */
  const DOENCAS = [
    ['Leishmanioses', 'Protozoário', 'Picada da fêmea do flebotomíneo'],
    ['Cólera', 'Bactéria', 'Água e alimentos com fezes (fecal-oral)'],
    ['Dengue', 'Vírus', 'Picada da fêmea do Aedes aegypti'],
    ['Doença de Chagas', 'Protozoário', 'Fezes do barbeiro na pele ou mucosa'],
    ['Esquistossomose', 'Verme', 'Cercária atravessa a pele na água doce'],
    ['Raiva', 'Vírus', 'Saliva de mamífero: mordida, arranhão, lambedura'],
    ['Leptospirose', 'Bactéria', 'Urina de rato na água ou lama, pela pele'],
    ['Peste', 'Bactéria', 'Picada da pulga de roedores'],
    ['Malária', 'Protozoário', 'Picada da fêmea do Anopheles'],
    ['Esporotricose', 'Fungo', 'Arranhão ou mordida de gato doente'],
    ['Febre amarela', 'Vírus', 'Picada de Haemagogus e Sabethes (silvestre)'],
  ];
  const TIPOS = ['Vírus', 'Bactéria', 'Protozoário', 'Verme', 'Fungo'];
  const embaralhar = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  function montarJogo(el) {
    const N = 12, TEMPO = 12;
    let rodada, pontos, acertos, seq, erros, timer, inicio, perguntas;
    function tela(html) { el.innerHTML = `<div class="jogo">${html}</div>`; }
    function abertura() {
      tela(`<h3>Desafio relâmpago</h3><p>${N} perguntas, <b>${TEMPO} segundos</b> cada: qual é o agente da doença e como ela chega à pessoa. Quanto mais rápido, mais pontos; acertos seguidos dão bônus.</p>
        <p class="jogo-msg">Recorde: ${E.recorde || 0} pontos</p><button type="button" class="btn-mao principal">Começar o desafio</button>`);
      $('button', el).addEventListener('click', comecar);
    }
    function comecar() {
      rodada = 0; pontos = 0; acertos = 0; seq = 0; erros = [];
      const ds = embaralhar(DOENCAS);
      perguntas = Array.from({ length: N }, (_, i) => {
        const d = ds[i % ds.length];
        if (i % 2 === 0) return { p: 'Qual é o agente?', d: d[0], certa: d[1], ops: TIPOS };
        const outras = embaralhar(DOENCAS.filter((x) => x[2] !== d[2])).slice(0, 3).map((x) => x[2]);
        return { p: 'Como se pega?', d: d[0], certa: d[2], ops: embaralhar([d[2], ...outras]) };
      });
      proxima();
    }
    function proxima() {
      if (rodada >= N) return fim();
      const q = perguntas[rodada];
      tela(`<div class="jogo-topo"><span>${rodada + 1}/${N}</span><span>${seq >= 2 ? `<span class="sequencia">${seq} seguidas! </span>` : ''}${pontos} pts</span></div>
        <div class="jogo-tempo"><i></i></div><span class="jogo-pergunta">${q.p}</span><span class="jogo-doenca">${q.d}</span>
        <div class="jogo-ops">${q.ops.map((o) => `<button type="button">${o}</button>`).join('')}</div><div class="jogo-msg" aria-live="polite"></div>`);
      const barra = $('.jogo-tempo i', el);
      inicio = performance.now();
      const tick = (t) => {
        const f = Math.max(0, 1 - (t - inicio) / (TEMPO * 1000));
        barra.style.transform = `scaleX(${f})`;
        if (f <= 0) return responder(null);
        timer = requestAnimationFrame(tick);
      };
      timer = requestAnimationFrame(tick);
      $$('.jogo-ops button', el).forEach((b) => b.addEventListener('click', () => responder(b)));
    }
    function responder(b) {
      cancelAnimationFrame(timer);
      const q = perguntas[rodada];
      const restante = Math.max(0, TEMPO - (performance.now() - inicio) / 1000);
      const ok = b && b.textContent === q.certa;
      $$('.jogo-ops button', el).forEach((x) => { x.disabled = true; if (x.textContent === q.certa) x.classList.add('certa'); });
      if (b && !ok) b.classList.add('errada');
      if (ok) { seq++; acertos++; const g = 100 + Math.round(restante * 10) + (seq >= 3 ? 50 : 0); pontos += g; $('.jogo-msg', el).textContent = `+${g} pontos!`; }
      else { seq = 0; erros.push(q); $('.jogo-msg', el).textContent = b ? `Era: ${q.certa}` : `Tempo esgotado! Era: ${q.certa}`; }
      rodada++;
      setTimeout(proxima, ok ? 900 : 1900);
    }
    function fim() {
      const recorde = pontos > (E.recorde || 0);
      if (recorde) { E.recorde = pontos; salvar(); }
      tela(`<div class="jogo-final"><h3>Fim do desafio!</h3><b>${pontos} pts</b><p>${acertos} de ${N} acertos${recorde ? ' — <strong>novo recorde!</strong>' : ` · recorde: ${E.recorde}`}</p>
        ${erros.length ? `<p><b style="font:700 18px var(--f-mao);display:inline;color:var(--tinta)">Para revisar:</b></p><ul>${erros.map((q) => `<li><strong>${q.d}</strong> — ${q.p.toLowerCase()} ${q.certa}</li>`).join('')}</ul>` : '<p>Gabaritou! 🎯</p>'}
        <button type="button" class="btn-mao principal">Jogar de novo</button></div>`);
      $('button.btn-mao', el).addEventListener('click', comecar);
      if (acertos / N >= .8) confete();
    }
    abertura();
  }

  /* ---------------- telas ---------------- */
  const palco = $('#palco');
  let capAtual = null, observador = null;

  function mostrarInicio() {
    capAtual = null;
    if (observador) observador.disconnect();
    $('#b-titulo').textContent = 'Apostila interativa';
    palco.innerHTML = '<div class="folha"></div>';
    const folha = $('.folha', palco);
    folha.appendChild($('#tpl-inicio').content.cloneNode(true));
    // contagem regressiva
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const dias = Math.round((new Date(2027, 0, 31) - hoje) / 864e5);
    $('#dias').textContent = dias > 0 ? dias : '0';
    $('#dias-rotulo').textContent = dias > 1 ? 'dias para a prova' : dias === 1 ? 'dia para a prova' : 'é dia de prova!';
    // estatísticas
    const resp = Object.values(E.respostas);
    $('#st-cap').textContent = `${E.estudados.length}/${CAPS.length}`;
    $('#st-q').textContent = `${resp.length}/${totalQ}`;
    $('#st-acerto').textContent = resp.length ? Math.round(resp.filter((x) => x.ok).length / resp.length * 100) + '%' : '—';
    $('#st-jogo').textContent = E.recorde ? E.recorde + ' pts' : '—';
    // continuar
    if (E.ultimo && capPorId[E.ultimo.cap]) {
      const c = capPorId[E.ultimo.cap];
      const b = $('#b-continuar');
      b.href = '#' + (E.ultimo.secao || 'cap-' + c.id);
      b.textContent = `Continuar: ${c.id === 'R' ? 'Revisão geral' : `Cap. ${c.num} · ${c.titulo}`}`;
    }
    $('#b-buscar2').addEventListener('click', abrirBusca);
    // fichas
    const minis = $('#tpl-miniaturas').content;
    $('#fichas').innerHTML = CAPS.map((c, i) => {
      const st = statsCap(c.id);
      const prog = Math.round(((st.vistas / st.secoes) * .6 + (st.total ? st.resp / st.total : 0) * .4) * 100);
      return `<a class="ficha tema-${c.tema}" href="#cap-${c.id}" style="--rot:${[-1.6, 1.2, -.6, 1.8, -1.2, .8][i % 6]}deg">
        <div class="ficha-arte"><span class="ficha-num">${c.num}</span></div>
        <div class="ficha-corpo"><span class="ficha-sobre">${escH(rotuloCap(c))}</span><span class="ficha-titulo">${escH(c.titulo)}</span>
          <span class="ficha-barra"><i style="width:${prog}%"></i></span>
          <span class="ficha-info"><span>${st.vistas}/${st.secoes} seções</span><span>${st.total ? `${st.ok}/${st.total} acertos` : ''}</span></span></div>
        ${E.estudados.includes(c.id) ? '<span class="ficha-selo">estudado ✓</span>' : ''}</a>`;
    }).join('');
    $$('#fichas .ficha').forEach((f, i) => {
      const m = minis.querySelector(`[data-cap="${CAPS[i].id}"] svg`);
      if (m) $('.ficha-arte', f).appendChild(m.cloneNode(true));
    });
    window.scrollTo(0, 0);
    atualizarProgressoBarra();
  }

  function mostrarCapitulo(id, alvo, forcar) {
    const c = capPorId[id];
    if (!c) return mostrarInicio();
    if (capAtual !== id || forcar) {
      capAtual = id;
      if (observador) observador.disconnect();
      $('#b-titulo').textContent = c.id === 'R' ? 'Revisão geral' : `Cap. ${c.num} · ${c.titulo}`;
      palco.innerHTML = `<div class="folha"><div class="cap-layout"><div class="cap-col"></div><nav class="indice-lateral" aria-label="Seções do capítulo"></nav></div></div>`;
      const col = $('.cap-col', palco);
      col.appendChild($(`#tpl-cap-${id}`).content.cloneNode(true));
      const art = $('.capitulo', col);
      prepararTabelas(art);
      prepararFiguras(art);
      prepararCe(art);
      prepararQuestoes(art, id);
      prepararTreino(art);
      $$('.mapa-caderno', art).forEach(montarMapa);
      $$('.simulador-raiva', art).forEach(montarSimulador);
      $$('.jogo-relampago', art).forEach(montarJogo);
      montarFim(art, c);
      montarIndiceLateral(c);
      observarSecoes(art, c);
      if (!alvo) window.scrollTo(0, 0);
    }
    if (alvo) {
      const s = document.getElementById(alvo);
      if (s) {
        requestAnimationFrame(() => {
          s.scrollIntoView({ behavior: semMovimento() ? 'auto' : 'smooth', block: 'start' });
          s.classList.remove('piscar'); void s.offsetWidth; s.classList.add('piscar');
        });
      }
    }
    E.ultimo = { cap: id, secao: alvo || null }; salvar();
  }

  function montarFim(art, c) {
    const fim = $('.cap-fim', art);
    const i = CAPS.indexOf(c), ant = CAPS[i - 1], prox = CAPS[i + 1];
    const feito = E.estudados.includes(c.id);
    fim.innerHTML = `<button type="button" class="estudado" aria-pressed="${feito}"><span class="caixinha">${feito ? '✓' : ''}</span>
      <span><b>${feito ? 'Capítulo estudado!' : 'Marcar este capítulo como estudado'}</b><span>${feito ? 'Toque de novo se quiser desmarcar.' : 'Depois, refaça as questões e o modo treino na revisão.'}</span></span></button>
      <div class="navega">${ant ? `<a href="#cap-${ant.id}"><small>← anterior</small><b>${escH(ant.titulo)}</b></a>` : ''}${prox ? `<a class="prox" href="#cap-${prox.id}"><small>próximo →</small><b>${escH(prox.titulo)}</b></a>` : '<a class="prox" href="#inicio"><small>fim da apostila →</small><b>Voltar ao início</b></a>'}</div>`;
    $('.estudado', fim).addEventListener('click', () => {
      const k = E.estudados.indexOf(c.id);
      if (k >= 0) E.estudados.splice(k, 1); else { E.estudados.push(c.id); confete(); toast(`${c.titulo}: capítulo estudado!`); }
      salvar(); montarFim(art, c);
    });
  }

  function montarIndiceLateral(c) {
    const nav = $('.indice-lateral', palco);
    const vistas = new Set(E.vistas[c.id] || []);
    nav.innerHTML = `<h3 class="sem-marca">${c.id === 'R' ? 'Revisão geral' : 'Neste capítulo'}</h3><ol>${c.secoes.map((s) => `<li><a href="#${s.id}" data-s="${s.id}" class="${vistas.has(s.id) ? 'vista' : ''}">${escH(s.titulo)}</a></li>`).join('')}</ol>
      <div class="il-prog">${vistas.size}/${c.secoes.length} seções vistas</div>`;
  }

  function observarSecoes(art, c) {
    const secoes = $$('.bloco', art);
    observador = new IntersectionObserver((ents) => {
      ents.forEach((en) => {
        if (!en.isIntersecting) return;
        const id = en.target.id;
        en.target.classList.add('visto');
        $$('.indice-lateral a', palco).forEach((a) => a.classList.toggle('ativa', a.dataset.s === id));
        const lista = E.vistas[c.id] || (E.vistas[c.id] = []);
        if (!lista.includes(id)) {
          lista.push(id); salvar();
          const a = $(`.indice-lateral a[data-s="${id}"]`, palco); if (a) a.classList.add('vista');
          const p = $('.il-prog', palco); if (p) p.textContent = `${lista.length}/${c.secoes.length} seções vistas`;
        }
        E.ultimo = { cap: c.id, secao: id };
        salvarDepois();
      });
    }, { rootMargin: '-20% 0px -55% 0px' });
    secoes.forEach((s) => observador.observe(s));
  }
  let tSalvar;
  const salvarDepois = () => { clearTimeout(tSalvar); tSalvar = setTimeout(salvar, 400); };

  /* ---------------- gaveta ---------------- */
  function abrirGaveta() {
    const lista = $('#gaveta-lista');
    lista.innerHTML = `<a class="g-cap" href="#inicio"><span class="g-num" style="--cor-tema:#c9432c">★</span><span class="g-nome">Início</span></a>` + CAPS.map((c) => {
      const st = statsCap(c.id);
      const prog = Math.round((st.vistas / st.secoes) * 100);
      const atual = c.id === capAtual;
      const vistas = new Set(E.vistas[c.id] || []);
      return `<a class="g-cap tema-${c.tema}${atual ? ' atual' : ''}" href="#cap-${c.id}"><span class="g-num">${c.num}</span><span class="g-nome">${escH(c.titulo)}</span>
        <span class="g-ok">${E.estudados.includes(c.id) ? '✓' : ''}</span><span class="g-barra"><i style="width:${prog}%"></i></span></a>
        ${atual ? `<ul class="g-secoes">${c.secoes.map((s) => `<li><a href="#${s.id}" class="${vistas.has(s.id) ? 'vista' : ''}">${escH(s.titulo)}</a></li>`).join('')}</ul>` : ''}`;
    }).join('');
    $('#gaveta').hidden = false;
    $('#b-menu').setAttribute('aria-expanded', 'true');
    $('#gaveta-fechar').focus();
  }
  const fecharGaveta = () => { $('#gaveta').hidden = true; $('#b-menu').setAttribute('aria-expanded', 'false'); };
  $('#b-menu').addEventListener('click', abrirGaveta);
  $('#gaveta-fechar').addEventListener('click', fecharGaveta);
  $('#gaveta').addEventListener('click', (e) => { if (e.target.id === 'gaveta' || e.target.closest('a')) fecharGaveta(); });

  /* ---------------- busca ---------------- */
  let INDICE = null;
  function construirIndice() {
    INDICE = [];
    CAPS.forEach((c) => {
      const tpl = $(`#tpl-cap-${c.id}`).content;
      $$('.bloco', tpl).forEach((b) => {
        const clone = b.cloneNode(true);
        $$('svg, .gabarito-tira', clone).forEach((x) => x.remove());
        const partes = [];
        const w = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
        while (w.nextNode()) partes.push(w.currentNode.data);
        const txt = partes.join(' ').replace(/\s+/g, ' ').replace(/\s+([.,;:!?)])/g, '$1').trim();
        INDICE.push({ cap: c, id: b.id, titulo: b.dataset.titulo, txt, n: norm(txt), nt: norm(b.dataset.titulo) });
      });
    });
  }
  function buscar(q) {
    const out = $('#busca-resultados');
    const termos = norm(q).split(/\s+/).filter((t) => t.length > 1);
    if (!termos.length) { out.innerHTML = ''; return; }
    if (!INDICE) construirIndice();
    const res = INDICE.map((it) => {
      let score = 0;
      for (const t of termos) {
        const n = it.n.split(t).length - 1;
        if (!n && !it.nt.includes(t)) return null;
        score += n + (it.nt.includes(t) ? 8 : 0);
      }
      return { it, score };
    }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 30);
    if (!res.length) { out.innerHTML = '<li class="busca-vazio">Nada encontrado. Tente outra palavra (por exemplo, sem acento ou no singular).</li>'; return; }
    out.innerHTML = res.map(({ it }) => {
      const pos = it.n.indexOf(termos[0]);
      const ini = Math.max(0, pos - 60);
      let trecho = it.txt.slice(ini, ini + 170);
      let tn = norm(trecho);
      let marcado = '', k = 0;
      const t0 = termos[0];
      while (true) {
        const j = tn.indexOf(t0, k);
        if (j < 0) { marcado += escH(trecho.slice(k)); break; }
        marcado += escH(trecho.slice(k, j)) + '<mark>' + escH(trecho.slice(j, j + t0.length)) + '</mark>';
        k = j + t0.length;
      }
      return `<li><a href="#${it.id}"><small>${escH(rotuloCap(it.cap))} · ${escH(it.cap.titulo)}</small><b>${escH(it.titulo)}</b><span>${ini > 0 ? '…' : ''}${marcado}…</span></a></li>`;
    }).join('');
  }
  function abrirBusca() {
    $('#busca').hidden = false;
    const inp = $('#busca-texto');
    inp.focus(); inp.select();
    const sug = ['morcego', 'LIRAa', 'benznidazol', '10 dias', 'antirratização', 'notificação imediata', 'flebotomíneo', 'hipoclorito'];
    $('#busca-sugestoes').innerHTML = sug.map((s) => `<button type="button">${s}</button>`).join('');
  }
  const fecharBusca = () => { $('#busca').hidden = true; };
  let tBusca;
  $('#busca-texto').addEventListener('input', (e) => { clearTimeout(tBusca); tBusca = setTimeout(() => buscar(e.target.value), 120); });
  $('#busca-sugestoes').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; $('#busca-texto').value = b.textContent; buscar(b.textContent); });
  $('#b-busca').addEventListener('click', abrirBusca);
  $('#busca-fechar').addEventListener('click', fecharBusca);
  $('#busca').addEventListener('click', (e) => { if (e.target.id === 'busca' || e.target.closest('.busca-resultados a')) fecharBusca(); });

  /* ---------------- modo treino ---------------- */
  $('#b-treino').addEventListener('click', (e) => {
    const on = document.body.classList.toggle('treino');
    e.currentTarget.setAttribute('aria-pressed', String(on));
    $$('.ver').forEach((x) => x.classList.remove('ver'));
    toast(on ? 'Modo treino ligado: respostas escondidas nas revisões e nos mapas.' : 'Modo treino desligado.');
  });

  /* ---------------- teclado e rolagem ---------------- */
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { fecharBusca(); fecharGaveta(); $('#lupa').hidden = true; }
    if (e.key === '/' && !/input|textarea/i.test(document.activeElement.tagName)) { e.preventDefault(); abrirBusca(); }
  });
  function atualizarProgressoBarra() {
    const h = document.documentElement.scrollHeight - innerHeight;
    $('#b-prog').style.width = (h > 0 ? Math.min(100, scrollY / h * 100) : 0) + '%';
  }
  addEventListener('scroll', atualizarProgressoBarra, { passive: true });

  /* ---------------- rotas ---------------- */
  function rota() {
    const h = decodeURIComponent(location.hash.slice(1)) || 'inicio';
    let m;
    if ((m = h.match(/^cap-(\w+)$/))) return mostrarCapitulo(m[1], null);
    if ((m = h.match(/^c(\w+)-(\d+)$/))) return mostrarCapitulo(m[1], h);
    return mostrarInicio();
  }
  addEventListener('hashchange', rota);
  rota();
})();
