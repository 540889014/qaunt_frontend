/**
 * Base symbol -> Binance USDT perpetual contract alias.
 * Used when external ranking sources (e.g. CoinGecko symbol) don't match Binance contract naming.
 */
export const BINANCE_USDT_CONTRACT_ALIAS = {
  BONK: '1000BONKUSDT',
  SHIB: '1000SHIBUSDT',
  XEC: '1000XECUSDT',
  LUNC: '1000LUNCUSDT',
}

/**
 * Resolve a base symbol to Binance USDT perpetual contract code.
 * - If input already ends with USDT, return it directly.
 * - Prefer alias when present (and available in contractSet if provided).
 * - Fallback to <BASE>USDT.
 */
export function resolveBinanceUsdtContract(baseSymbol, contractSet) {
  const base = String(baseSymbol || '').trim().toUpperCase()
  if (!base) return ''
  if (base.endsWith('USDT')) return base

  const alias = BINANCE_USDT_CONTRACT_ALIAS[base] || ''
  const fallback = `${base}USDT`

  if (contractSet instanceof Set) {
    if (alias && contractSet.has(alias)) return alias
    if (contractSet.has(fallback)) return fallback
  }

  return alias || fallback
}

