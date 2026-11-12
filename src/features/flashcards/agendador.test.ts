import { criarAgendador, montarFilaEstudo, preverNotas, resumirCartoes, rotuloIntervalo } from './agendador';
import type { Flashcard, RevisaoFlashcard } from './tipos';

const agora = new Date('2026-11-13T15:00:00-03:00');
const novo = (id: string, criado = '2026-11-13T00:00:00Z', extra: Partial<Flashcard> = {}): Flashcard => ({
  id, disciplina_id: 'ace26-ce', topico_id: null, questao_id: null, frente: id, verso: 'v', origem: 'manual', suspenso: false, criado_em: criado,
  due: '2026-11-13T00:00:00Z', stability: 0, difficulty: 0, elapsed_days: 0, scheduled_days: 0, learning_steps: 0, reps: 0, lapses: 0, state: 0, last_review: null, ...extra,
});
const revisao = (id: string, due: string): Flashcard => novo(id, '2026-11-01T00:00:00Z', { state: 2, due, stability: 5, difficulty: 5, reps: 3, scheduled_days: 5, last_review: '2026-11-08T12:00:00Z' });

describe('fila de estudo', () => {
  it('vencidos primeiro, depois novos até o limite do dia', () => {
    const cartoes = [novo('n1'), novo('n2'), novo('n3'), revisao('r1', '2026-11-12T10:00:00Z'), revisao('r2', '2026-11-20T10:00:00Z')];
    const fila = montarFilaEstudo(cartoes, [], 2, agora).map((c) => c.id);
    expect(fila[0]).toBe('r1');
    expect(fila).toHaveLength(3); // 1 vencido + 2 novos (o limite do dia)
    expect(fila).not.toContain('r2');
    // Criados no mesmo instante (pacote), os novos saem numa ordem embaralhada estável.
    expect(montarFilaEstudo(cartoes, [], 2, agora).map((c) => c.id)).toEqual(fila);
  });

  it('desconta os novos já estudados hoje e ignora suspensos', () => {
    const hoje: RevisaoFlashcard[] = [{ flashcard_id: 'x', rating: 3, state: 0, review: agora.toISOString() }];
    const cartoes = [novo('n1'), novo('n2', undefined, { suspenso: true }), novo('n3')];
    expect(montarFilaEstudo(cartoes, hoje, 2, agora).map((c) => c.id)).toEqual(['n1']);
    expect(resumirCartoes(cartoes, hoje, 2, agora)).toMatchObject({ total: 2, novosDisponiveis: 1, novosHoje: 1 });
  });

  it('filtra por disciplina', () => {
    const cartoes = [novo('a'), novo('b', undefined, { disciplina_id: 'ace26-pt' })];
    expect(montarFilaEstudo(cartoes, [], 10, agora, 'ace26-pt').map((c) => c.id)).toEqual(['b']);
  });
});

describe('agendamento FSRS', () => {
  const prova = new Date('2027-01-31T15:10:00-03:00');

  it('intervalos crescem de Errei a Fácil num cartão em revisão', () => {
    const p = preverNotas(criarAgendador(prova, agora), revisao('r', '2026-11-13T10:00:00Z'), agora);
    const dias = p.map((x) => new Date(x.estado.due).getTime());
    expect(dias[0]).toBeLessThan(dias[1]);
    expect(dias[1]).toBeLessThanOrEqual(dias[2]);
    expect(dias[2]).toBeLessThan(dias[3]);
    expect(p[0].estado.lapses).toBe(1);
  });

  it('cartão novo: "Errei" volta em minutos, e o registro guarda o estado anterior', () => {
    const p = preverNotas(criarAgendador(prova, agora), novo('n'), agora);
    expect(p[0].intervalo).toMatch(/min$/);
    expect(p[0].log.state).toBe(0);
    expect(p[2].estado.reps).toBe(1);
  });

  it('nenhum intervalo passa da data da prova', () => {
    const antigo = novo('x', '2026-01-01T00:00:00Z', { state: 2, stability: 400, difficulty: 2, reps: 20, scheduled_days: 300, due: '2026-11-13T00:00:00Z', last_review: '2026-01-17T00:00:00Z' });
    const p = preverNotas(criarAgendador(prova, agora), antigo, agora);
    for (const x of p) expect(new Date(x.estado.due).getTime()).toBeLessThanOrEqual(prova.getTime() + 86_400_000);
  });

  it('rótulos de intervalo', () => {
    const t0 = new Date('2026-11-13T00:00:00Z');
    expect(rotuloIntervalo(t0, new Date(t0.getTime() + 10 * 60_000))).toBe('10 min');
    expect(rotuloIntervalo(t0, new Date(t0.getTime() + 86_400_000))).toBe('1 dia');
    expect(rotuloIntervalo(t0, new Date(t0.getTime() + 12 * 86_400_000))).toBe('12 dias');
    expect(rotuloIntervalo(t0, new Date(t0.getTime() + 62 * 86_400_000))).toBe('2 meses');
  });
});
