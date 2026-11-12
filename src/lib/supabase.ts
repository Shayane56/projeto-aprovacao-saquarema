import { createClient } from '@supabase/supabase-js';
import { config } from './config';

export const supabase = createClient(config.supabaseUrl, config.supabaseChave, {
  auth: {
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'pas:sessao',
  },
});

/** Converte erros do Supabase/PostgREST em mensagens em português. */
export function mensagemDeErro(erro: unknown): string {
  const msg = erro instanceof Error ? erro.message : typeof erro === 'object' && erro && 'message' in erro ? String((erro as { message: unknown }).message) : String(erro);
  const mapa: [RegExp, string][] = [
    [/invalid login credentials/i, 'E-mail ou senha incorretos.'],
    [/email not confirmed/i, 'Confirme seu e-mail pelo link que enviamos antes de entrar.'],
    [/user already registered/i, 'Já existe uma conta com este e-mail. Tente entrar.'],
    [/password should be at least/i, 'A senha precisa ter pelo menos 8 caracteres.'],
    [/signups? not allowed|signup is disabled/i, 'Novos cadastros estão desativados neste app.'],
    [/rate limit|too many requests/i, 'Muitas tentativas seguidas. Aguarde um minuto e tente de novo.'],
    [/failed to fetch|network|load failed/i, 'Sem conexão com o servidor. Verifique sua internet.'],
    [/same password|different from the old/i, 'A nova senha precisa ser diferente da anterior.'],
    [/jwt expired|invalid jwt/i, 'Sua sessão expirou. Entre novamente.'],
  ];
  for (const [re, texto] of mapa) if (re.test(msg)) return texto;
  return msg || 'Algo deu errado. Tente novamente.';
}

/** Lança o erro do Supabase (se houver) e devolve os dados tipados. */
export function exigir<T>(resultado: { data: T | null; error: unknown }): T {
  if (resultado.error) throw resultado.error;
  return resultado.data as T;
}
