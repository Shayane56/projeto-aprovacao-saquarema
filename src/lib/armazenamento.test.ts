import { afterEach, describe, expect, it, vi } from 'vitest';
import { pedirArmazenamentoPersistente } from './armazenamento';

describe('armazenamento persistente', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('pede persistência quando ainda não foi concedida', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('navigator', { storage: { persisted: vi.fn().mockResolvedValue(false), persist } });
    expect(await pedirArmazenamentoPersistente()).toBe(true);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('não pede de novo se já é persistente', async () => {
    const persist = vi.fn();
    vi.stubGlobal('navigator', { storage: { persisted: vi.fn().mockResolvedValue(true), persist } });
    expect(await pedirArmazenamentoPersistente()).toBe(true);
    expect(persist).not.toHaveBeenCalled();
  });

  it('não quebra em navegadores sem suporte', async () => {
    vi.stubGlobal('navigator', {});
    expect(await pedirArmazenamentoPersistente()).toBe(false);
  });
});
