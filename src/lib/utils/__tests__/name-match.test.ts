import {
  normalizeName,
  isSameName,
  indexUsersByNormalizedName,
} from '@/lib/utils/name-match';

describe('normalizeName', () => {
  it('null/undefined/空文字 → 空文字', () => {
    expect(normalizeName(null)).toBe('');
    expect(normalizeName(undefined)).toBe('');
    expect(normalizeName('')).toBe('');
  });

  it('全角スペース・半角スペース・タブを除去', () => {
    expect(normalizeName('山田 太郎')).toBe('山田太郎');
    expect(normalizeName('山田　太郎')).toBe('山田太郎');
    expect(normalizeName('山田\t太郎')).toBe('山田太郎');
    expect(normalizeName('  山田  太郎  ')).toBe('山田太郎');
    expect(normalizeName('山\n田\n太郎')).toBe('山田太郎');
  });

  it('NFKC で全角英数を半角に統一', () => {
    expect(normalizeName('ABC１２３')).toBe('abc123');
    expect(normalizeName('Yamada Taro')).toBe('yamadataro');
    expect(normalizeName('Ｙａｍａｄａ Ｔａｒｏ')).toBe('yamadataro');
  });

  it('大文字小文字を統一', () => {
    expect(normalizeName('Yamada')).toBe('yamada');
    expect(normalizeName('YAMADA')).toBe('yamada');
  });

  it('半角カナは NFKC で全角化される（副作用として許容）', () => {
    expect(normalizeName('ﾔﾏﾀﾞ')).toBe('ヤマダ');
  });
});

describe('isSameName', () => {
  it('同一は true', () => {
    expect(isSameName('山田 太郎', '山田太郎')).toBe(true);
    expect(isSameName('山田　太郎', '山田 太郎')).toBe(true);
    expect(isSameName('Yamada Taro', 'YAMADATARO')).toBe(true);
  });

  it('別人は false', () => {
    expect(isSameName('山田 太郎', '田中 太郎')).toBe(false);
    expect(isSameName('山田', '山田 太郎')).toBe(false);
  });

  it('片方が空なら false（誤マッチ防止）', () => {
    expect(isSameName('', '山田 太郎')).toBe(false);
    expect(isSameName('山田 太郎', null)).toBe(false);
    expect(isSameName(undefined, undefined)).toBe(false);
  });
});

describe('indexUsersByNormalizedName', () => {
  it('正規化名で users をグルーピングできる', () => {
    const users = [
      { id: 'u1', displayName: '山田 太郎' },
      { id: 'u2', displayName: '田中 次郎' },
      { id: 'u3', displayName: '山田　太郎' }, // 同名（全角スペース）
      { id: 'u4', displayName: '' }, // 空名はスキップ
    ];
    const map = indexUsersByNormalizedName(users);
    expect(map.size).toBe(2);
    expect(map.get('山田太郎')).toHaveLength(2);
    expect(map.get('山田太郎')?.map((u) => u.id)).toEqual(['u1', 'u3']);
    expect(map.get('田中次郎')).toHaveLength(1);
    expect(map.get('田中次郎')?.[0]?.id).toBe('u2');
  });
});
