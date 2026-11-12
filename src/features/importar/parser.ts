/**
 * Leitura de provas em texto (copiado do PDF ou extraído pelo app).
 * Reconhece questões numeradas em sequência ("01.", "1)", "Questão 01"),
 * alternativas "(A)", "A)", "a." etc., cabeçalhos de seção (disciplinas) e
 * textos de apoio ("Texto I", "Leia o texto a seguir para responder às questões 1 a 5").
 */

export interface QuestaoExtraida {
  numero: number;
  enunciado: string;
  alternativas: string[];
  secao: string | null;
  /** índice em `textos` do texto de apoio desta questão */
  texto: number | null;
}

export interface TextoExtraido {
  titulo: string | null;
  conteudo: string;
}

export interface ProvaExtraida {
  questoes: QuestaoExtraida[];
  textos: TextoExtraido[];
}

const RE_QUESTAO = /^(?:quest[ãa]o\s*(?:n[ºo°.]?\s*)?)?(\d{1,3})\s*(?:[.)\-–—:]\s*|\s+(?=\S)|$)(.*)$/i;
const RE_ALTERNATIVA = /^\(?([a-eA-E])\s*[).\-–—]\s*(.*)$/;
const RE_TEXTO = /^(?:texto(?:\s+(?:[ivx]+|\d+))?\b|leia\b|observe\b|considere o texto\b)/i;
const RE_INTERVALO = /quest(?:ões|oes|ão|ao)\s*(?:de\s*)?(\d{1,3})\s*(?:a|e|até|ate|-|–)\s*(\d{1,3})/i;
const PALAVRAS_SECAO = /(portugu|espec[ií]fic|legisla|\bsus\b|sa[úu]de p[úu]blica|munic[íi]pio|conhecimentos gerais|matem[áa]tica|racioc[íi]nio|inform[áa]tica|atualidades)/i;

export function normalizarTexto(bruto: string): string {
  const linhas = bruto
    .replace(/\r/g, '')
    .replace(/ /g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/(\p{L})-\n(\p{Ll})/gu, '$1$2') // junta palavras hifenizadas na quebra de linha
    .split('\n')
    .map((l) => l.trim());

  // Remove cabeçalhos/rodapés repetidos (aparecem em várias páginas) e números de página.
  const frequencia = new Map<string, number>();
  for (const l of linhas) if (l) frequencia.set(l, (frequencia.get(l) ?? 0) + 1);
  return linhas
    .filter((l) => !/^(?:p[áa]gina\s*)?\d{1,3}(?:\s*(?:de|\/)\s*\d{1,3})?$/i.test(l))
    .filter((l) => !(l.length < 90 && (frequencia.get(l) ?? 0) >= 3 && !RE_ALTERNATIVA.test(l)))
    .join('\n');
}

function ehSecao(linha: string): boolean {
  const letras = linha.replace(/[^\p{L}]/gu, '');
  if (letras.length < 4 || linha.length > 80) return false;
  const maiusculas = letras.replace(/[^\p{Lu}]/gu, '').length / letras.length;
  return maiusculas > 0.8 && PALAVRAS_SECAO.test(linha);
}

const juntar = (a: string, b: string) => (a ? `${a} ${b}` : b).trim();

export function extrairQuestoes(bruto: string): ProvaExtraida {
  const linhas = normalizarTexto(bruto).split('\n').filter(Boolean);
  const questoes: QuestaoExtraida[] = [];
  const textos: TextoExtraido[] = [];
  let secao: string | null = null;
  let atual: QuestaoExtraida | null = null;
  // Estado num objeto: as atribuições dentro de abrirTexto ficam visíveis ao TypeScript.
  const st: { parte: 'enunciado' | number | 'texto' | 'fora'; texto: { indice: number; ate: number | null } | null } = { parte: 'fora', texto: null };

  const proximoNumero = () => (questoes.length ? questoes[questoes.length - 1].numero + 1 : null);

  const abrirTexto = (linha: string) => {
    const intervalo = linha.match(RE_INTERVALO);
    const ehTitulo = /^texto/i.test(linha) && linha.length < 40;
    const ehInstrucao = !/^texto/i.test(linha) && linha.length < 200;
    const atualTexto = st.texto ? textos[st.texto.indice] : null;
    // "TEXTO I" logo depois de "Leia o texto…": só dá título ao texto já aberto.
    if (st.parte === 'texto' && atualTexto && !atualTexto.conteudo && ehTitulo) {
      atualTexto.titulo = linha;
      return;
    }
    textos.push({ titulo: ehTitulo ? linha : null, conteudo: ehTitulo || ehInstrucao ? '' : linha });
    st.texto = { indice: textos.length - 1, ate: intervalo ? Number(intervalo[2]) : st.parte === 'texto' ? st.texto?.ate ?? null : null };
    st.parte = 'texto';
  };

  for (const linha of linhas) {
    if (ehSecao(linha)) {
      secao = linha;
      st.texto = null;
      st.parte = 'fora';
      continue;
    }

    const mQ = linha.match(RE_QUESTAO);
    const esperado = proximoNumero();
    const numero = mQ ? Number(mQ[1]) : NaN;
    const iniciaQuestao =
      mQ &&
      (esperado === null ? numero >= 1 && numero <= 120 : numero === esperado) &&
      ((mQ[2] ?? '').length > 0 || /^quest/i.test(linha)) &&
      !RE_ALTERNATIVA.test(linha);
    if (iniciaQuestao) {
      if (st.texto && st.texto.ate !== null && numero > st.texto.ate) st.texto = null;
      atual = { numero, enunciado: mQ![2].trim(), alternativas: [], secao, texto: st.texto?.indice ?? null };
      questoes.push(atual);
      st.parte = 'enunciado';
      continue;
    }

    const mA = linha.match(RE_ALTERNATIVA);
    if (mA && atual && st.parte !== 'texto' && st.parte !== 'fora') {
      const indice = mA[1].toUpperCase().charCodeAt(0) - 65;
      if (indice === atual.alternativas.length) {
        atual.alternativas.push(mA[2].trim());
        st.parte = indice;
        continue;
      }
    }

    // Início de um texto de apoio (fora de uma questão em andamento ou depois da última alternativa).
    if (RE_TEXTO.test(linha) && (st.parte === 'fora' || st.parte === 'texto' || (typeof st.parte === 'number' && st.parte >= 3))) {
      abrirTexto(linha);
      continue;
    }

    if (st.parte === 'enunciado' && atual) atual.enunciado = juntar(atual.enunciado, linha);
    else if (typeof st.parte === 'number' && atual) atual.alternativas[st.parte] = juntar(atual.alternativas[st.parte], linha);
    else if (st.parte === 'texto' && st.texto) {
      const t = textos[st.texto.indice];
      t.conteudo = t.conteudo ? `${t.conteudo}\n${linha}` : linha;
    }
  }

  return { questoes, textos: textos.map((t) => ({ ...t, conteudo: t.conteudo.trim() })) };
}

/** Problemas que a revisão manual precisa resolver. */
export function avisosDaQuestao(q: { enunciado: string; alternativas: string[]; gabarito: number | null; anulada: boolean }): string[] {
  const avisos: string[] = [];
  if (q.enunciado.trim().length < 10) avisos.push('Enunciado muito curto');
  if (q.alternativas.length !== 4) avisos.push(`${q.alternativas.length} alternativas (a prova do IBAM tem 4)`);
  if (q.alternativas.some((a) => !a.trim())) avisos.push('Alternativa vazia');
  if (q.gabarito === null && !q.anulada) avisos.push('Sem gabarito');
  return avisos;
}
