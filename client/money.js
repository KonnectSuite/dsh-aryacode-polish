/**
 * The two pure decisions behind the balance line: which wallet to show, and how
 * to render it.
 *
 * They live in their own file because the browser face bundle is only ever run
 * inside the Shell, where nothing can be imported and asserted — so the build
 * inlines this module into `lib/client.js` (with the `export` keywords dropped)
 * while `test/money.spec.mjs` imports it directly. What the test covers is
 * therefore the same source the browser runs, not a copy of it.
 */

/**
 * Pick the wallet a balance line should show.
 * @param view - the balance view the account Remote returned.
 * @returns the first wallet carrying a balance, or undefined when the view has none.
 */
export function walletOf(view) {
  if (view === undefined || view === null || view.status !== 'ready' || !Array.isArray(view.value)) return undefined
  return view.value.find(wallet => wallet !== null && typeof wallet === 'object' && typeof wallet.balance === 'string')
}

/**
 * Format one wallet as money.
 * @param wallet - a wallet with `currency` and `balance`.
 * @returns the amount with its currency symbol, at two decimals.
 */
export function formatBalance(wallet) {
  const symbol = wallet.currency === 'CNY' ? '\u00A5' : '$'
  const amount = Number(wallet.balance)
  return Number.isFinite(amount) ? symbol + amount.toFixed(2) : symbol + String(wallet.balance)
}
