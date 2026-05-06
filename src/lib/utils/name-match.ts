/**
 * 名前の表記ゆれを吸収する正規化関数。
 *
 * 正規化規則:
 * - Unicode NFKC で全角英数・カタカナ→半角に統一（ﾔﾏﾀﾞ → ヤマタダ等の半角カナは全角化される副作用は許容）
 * - 全角スペース・タブ・改行・連続スペースをすべて削除
 * - 大文字小文字統一（小文字化）
 *
 * Why: 「山田 太郎」「山田　太郎」「山田太郎」「ヤマダ タロウ」など、
 *      入力ゆらぎを吸収して同一人物として扱うため。
 */
export function normalizeName(input: string | null | undefined): string {
  if (!input) return '';
  return (
    input
      .normalize('NFKC')
      // 全角スペース U+3000 / 半角スペース / タブ / 改行をすべて除去
      .replace(/[\s　]+/g, '')
      .toLowerCase()
  );
}

/**
 * 2つの名前が同一人物と見なせるか判定する。
 * 完全一致（正規化後）のみ true。部分一致は採用しない（誤検出を避けるため）。
 */
export function isSameName(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  return na === nb;
}

/**
 * 表記ゆれ吸収用に「正規化済み名前 → users[]」のマップを作る。
 * 同名同士は配列に積まれる（同名異人を区別するため）。
 */
export function indexUsersByNormalizedName<U extends { id: string; displayName: string }>(
  users: U[]
): Map<string, U[]> {
  const map = new Map<string, U[]>();
  for (const u of users) {
    const key = normalizeName(u.displayName);
    if (!key) continue;
    const arr = map.get(key) ?? [];
    arr.push(u);
    map.set(key, arr);
  }
  return map;
}
