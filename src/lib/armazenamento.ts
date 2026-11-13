/**
 * Pede ao navegador que não apague os dados do app (sessão de login e cache
 * offline) quando o aparelho estiver com pouco espaço. Em apps instalados o
 * pedido costuma ser aceito automaticamente; onde não houver suporte, não faz nada.
 */
export async function pedirArmazenamentoPersistente(): Promise<boolean> {
  try {
    const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined;
    if (!storage?.persist) return false;
    if (await storage.persisted?.()) return true;
    return await storage.persist();
  } catch {
    return false;
  }
}
