/**
 * Gera a migração SQL com os dados do edital a partir de
 * supabase/seed/edital-ace-2026.json (fonte única do conteúdo).
 *
 * Uso: npm run seed:gerar
 * Os IDs são estáveis (ace26-ce-08-03 = disciplina CE, item 8, subitem 3),
 * então rodar de novo apenas atualiza os textos, sem perder o progresso.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const fonte = path.join(root, 'supabase/seed/edital-ace-2026.json');
const destino = path.join(root, 'supabase/migrations/20261112120100_fase_a_edital_ace.sql');

const dados = JSON.parse(await readFile(fonte, 'utf8'));

const q = (v) => {
  if (v === undefined || v === null) return 'null';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'object') return `${q(JSON.stringify(v))}::jsonb`;
  return `'${String(v).replaceAll("'", "''")}'`;
};
const pad = (n) => String(n).padStart(2, '0');

function upsert(tabela, colunas, linhas) {
  if (linhas.length === 0) return '';
  const valores = linhas.map((l) => `  (${colunas.map((c) => q(l[c])).join(', ')})`).join(',\n');
  const atualiza = colunas.filter((c) => c !== 'id').map((c) => `${c} = excluded.${c}`).join(', ');
  return `insert into public.${tabela} (${colunas.join(', ')}) values\n${valores}\non conflict (id) do update set ${atualiza};\n`;
}

const c = dados.concurso;
const blocos = dados.blocos.map((b) => ({ ...b, concurso_id: c.id }));
const disciplinas = dados.disciplinas.map(({ topicos: _t, ...d }) => ({ ...d, concurso_id: c.id }));

const topicos = [];
for (const d of dados.disciplinas) {
  d.topicos.forEach((t, i) => {
    const id = `${d.id}-${pad(i + 1)}`;
    topicos.push({
      id, disciplina_id: d.id, parent_id: null, numero: String(i + 1),
      titulo: t.titulo, referencia: t.referencia ?? null, link: t.link ?? null, ordem: i + 1,
    });
    (t.subtopicos ?? []).forEach((s, j) => {
      topicos.push({
        id: `${id}-${pad(j + 1)}`, disciplina_id: d.id, parent_id: id, numero: `${i + 1}.${j + 1}`,
        titulo: s, referencia: null, link: null, ordem: j + 1,
      });
    });
  });
}

const etapas = dados.etapas.map((e, i) => ({
  id: `ace26-etapa-${pad(i + 1)}`, concurso_id: c.id, titulo: e.titulo, descricao: e.descricao ?? null,
  categoria: e.categoria, data_inicio: e.inicio ?? null, data_fim: e.fim ?? null, acao: e.acao ?? false, ordem: i + 1,
}));

const colsConcurso = Object.keys(c);
const COLS_TOPICO = ['id', 'disciplina_id', 'parent_id', 'numero', 'titulo', 'referencia', 'link', 'ordem'];
const blocosSql = {
  concurso: [
    upsert('concursos', colsConcurso, [c]),
    upsert('blocos_prova', ['id', 'concurso_id', 'nome', 'num_questoes', 'valor_questao', 'ordem'], blocos),
    upsert('disciplinas', ['id', 'concurso_id', 'bloco_id', 'nome', 'sigla', 'cor', 'ordem'], disciplinas),
    upsert('etapas_concurso', ['id', 'concurso_id', 'titulo', 'descricao', 'categoria', 'data_inicio', 'data_fim', 'acao', 'ordem'], etapas),
  ].join('\n'),
  itens: upsert('topicos', COLS_TOPICO, topicos.filter((t) => !t.parent_id)),
  subitens: upsert('topicos', COLS_TOPICO, topicos.filter((t) => t.parent_id)),
};
const sql = `-- =====================================================================
-- GERADO AUTOMATICAMENTE por scripts/gerar-seed.mjs — não edite à mão.
-- Fonte: supabase/seed/edital-ace-2026.json
-- Edital nº 001/2026 — Prefeitura de Saquarema/RJ (IBAM) — cargo 022 ACE
-- ${topicos.length} tópicos, ${etapas.length} etapas.
-- =====================================================================

${upsert('concursos', colsConcurso, [c])}
${upsert('blocos_prova', ['id', 'concurso_id', 'nome', 'num_questoes', 'valor_questao', 'ordem'], blocos)}
${upsert('disciplinas', ['id', 'concurso_id', 'bloco_id', 'nome', 'sigla', 'cor', 'ordem'], disciplinas)}
${upsert('topicos', ['id', 'disciplina_id', 'parent_id', 'numero', 'titulo', 'referencia', 'link', 'ordem'], topicos.filter((t) => !t.parent_id))}
${upsert('topicos', ['id', 'disciplina_id', 'parent_id', 'numero', 'titulo', 'referencia', 'link', 'ordem'], topicos.filter((t) => t.parent_id))}
${upsert('etapas_concurso', ['id', 'concurso_id', 'titulo', 'descricao', 'categoria', 'data_inicio', 'data_fim', 'acao', 'ordem'], etapas)}`;

await writeFile(destino, sql);
console.log(`✓ ${path.relative(root, destino)} — ${topicos.length} tópicos, ${etapas.length} etapas`);

// Arquivo único para colar no SQL Editor do Supabase (alternativa à integração com o GitHub).
const pasta = path.join(root, 'supabase/migrations');
const { readdir } = await import('node:fs/promises');
const arquivos = (await readdir(pasta)).filter((f) => f.endsWith('.sql')).sort();
const partes = await Promise.all(arquivos.map(async (f) => `-- >>> ${f}\n${await readFile(path.join(pasta, f), 'utf8')}`));
const unico = path.join(root, 'supabase/sql-editor-completo.sql');
await writeFile(unico, `-- Todas as migrações em ordem. Cole no Supabase: SQL Editor → New query → Run.\n-- Pode ser executado mais de uma vez sem perder dados.\n\n${partes.join('\n')}`);
console.log(`✓ ${path.relative(root, unico)} — ${arquivos.length} migrações`);

// Versão em partes pequenas, para colar pelo celular (o editor trava com textos grandes).
const { mkdir } = await import('node:fs/promises');
const dirPartes = path.join(root, 'supabase/sql-editor-partes');
await mkdir(dirPartes, { recursive: true });
const semComentarios = (t) => t.split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
const estrutura = await readFile(path.join(pasta, '20261112120000_fase_a_estrutura.sql'), 'utf8');
const pratica = await readFile(path.join(pasta, '20261113090000_fase_b_pratica.sql'), 'utf8');
const corte = pratica.indexOf('-- ---------- Funções de simulado');
const partes2 = [
  ['parte-1-estrutura.sql', semComentarios(estrutura)],
  ['parte-2-concurso-e-etapas.sql', blocosSql.concurso],
  ['parte-3-itens-do-edital.sql', blocosSql.itens],
  ['parte-4-subitens-do-edital.sql', blocosSql.subitens],
  ['parte-5-fase-b-tabelas.sql', semComentarios(pratica.slice(0, corte))],
  ['parte-6-fase-b-funcoes-e-seguranca.sql', semComentarios(pratica.slice(corte))],
];
for (const [nome, conteudo] of partes2) {
  const cab = `-- ${nome} — cole no SQL Editor e clique em Run. Rode as partes em ordem.\n`;
  await writeFile(path.join(dirPartes, nome), cab + conteudo);
}
console.log(`✓ supabase/sql-editor-partes — ${partes2.length} partes`);
