import { Timestamp } from 'firebase/firestore';
import {
  APPROVAL_ORDER,
  canApproveSlot,
  canCancelSlot,
  createEmptyApprovals,
  isFullyApproved,
  type ReportApprovals,
  type ApprovalEntry,
} from '@/types/report';
import {
  EXECUTIVE_TITLE,
  USER_ROLE,
  getApprovalSlot,
} from '@/types/user';

/** テスト用の押印エントリを生成（Timestampはダミー） */
function entry(uid: string): ApprovalEntry {
  return {
    uid,
    displayName: `${uid}-name`,
    approvedAt: Timestamp.fromDate(new Date('2026-01-01')),
  };
}

/** approvals オブジェクトを slot 集合から生成 */
function approvalsWith(slots: ReadonlyArray<keyof ReportApprovals>): ReportApprovals {
  const a = createEmptyApprovals();
  for (const s of slots) {
    a[s] = entry(s);
  }
  return a;
}

describe('APPROVAL_ORDER', () => {
  it('施工部長 → 社長 → 専務 → 常務 の表示順序', () => {
    expect([...APPROVAL_ORDER]).toEqual([
      EXECUTIVE_TITLE.CONSTRUCTION_MANAGER,
      EXECUTIVE_TITLE.PRESIDENT,
      EXECUTIVE_TITLE.EXECUTIVE,
      EXECUTIVE_TITLE.MANAGING,
    ]);
  });
});

describe('canApproveSlot - 並列承認ガード', () => {
  it('全 slot 未押印なら 施工部長 のみ押印可', () => {
    const a = createEmptyApprovals();
    expect(canApproveSlot(a, 'construction_manager')).toBe(true);
    expect(canApproveSlot(a, 'managing')).toBe(false);
    expect(canApproveSlot(a, 'executive')).toBe(false);
    expect(canApproveSlot(a, 'president')).toBe(false);
  });

  it('施工部長押印済みなら 社長/専務/常務 全て押印可（並列）', () => {
    const a = approvalsWith(['construction_manager']);
    expect(canApproveSlot(a, 'construction_manager')).toBe(false); // 既押印
    expect(canApproveSlot(a, 'managing')).toBe(true);
    expect(canApproveSlot(a, 'executive')).toBe(true);
    expect(canApproveSlot(a, 'president')).toBe(true);
  });

  it('施工部長+社長押印済みでも 専務/常務 は押印可', () => {
    const a = approvalsWith(['construction_manager', 'president']);
    expect(canApproveSlot(a, 'executive')).toBe(true);
    expect(canApproveSlot(a, 'managing')).toBe(true);
    expect(canApproveSlot(a, 'president')).toBe(false); // 既押印
  });

  it('施工部長+専務+常務押印済みなら 社長 のみ残り', () => {
    const a = approvalsWith(['construction_manager', 'executive', 'managing']);
    expect(canApproveSlot(a, 'president')).toBe(true);
    expect(canApproveSlot(a, 'executive')).toBe(false);
    expect(canApproveSlot(a, 'managing')).toBe(false);
  });

  it('全枠押印済みなら全 slot 押印不可', () => {
    const a = approvalsWith([
      'construction_manager',
      'managing',
      'executive',
      'president',
    ]);
    APPROVAL_ORDER.forEach((slot) => {
      expect(canApproveSlot(a, slot)).toBe(false);
    });
  });

  it('施工部長未押印なら社長は押印できない', () => {
    const a = createEmptyApprovals();
    expect(canApproveSlot(a, 'president')).toBe(false);
  });
});

describe('canCancelSlot - 並列取消ガード', () => {
  it('未押印 slot は取消できない', () => {
    expect(canCancelSlot(createEmptyApprovals(), 'construction_manager')).toBe(false);
  });

  it('施工部長は後段に押印がなければ取消可', () => {
    const a = approvalsWith(['construction_manager']);
    expect(canCancelSlot(a, 'construction_manager')).toBe(true);
  });

  it('施工部長は後段に1つでも押印があると取消不可', () => {
    const a = approvalsWith(['construction_manager', 'managing']);
    expect(canCancelSlot(a, 'construction_manager')).toBe(false);
  });

  it('社長/専務/常務は並列なので自由に取消可', () => {
    const a = approvalsWith(['construction_manager', 'managing', 'executive', 'president']);
    // 並列枠はいつでも取消可能
    expect(canCancelSlot(a, 'managing')).toBe(true);
    expect(canCancelSlot(a, 'executive')).toBe(true);
    expect(canCancelSlot(a, 'president')).toBe(true);
    // 施工部長は後段に押印があるので取消不可
    expect(canCancelSlot(a, 'construction_manager')).toBe(false);
  });

  it('社長のみ押印済みでも取消可', () => {
    const a = approvalsWith(['construction_manager', 'president']);
    expect(canCancelSlot(a, 'president')).toBe(true);
  });

  it('専務のみ押印済みでも取消可', () => {
    const a = approvalsWith(['construction_manager', 'executive']);
    expect(canCancelSlot(a, 'executive')).toBe(true);
  });
});

describe('isFullyApproved', () => {
  it('4枠揃ったら true', () => {
    const a = approvalsWith([
      'construction_manager',
      'managing',
      'executive',
      'president',
    ]);
    expect(isFullyApproved(a)).toBe(true);
  });

  it('1枠でも欠けたら false', () => {
    const a = approvalsWith(['construction_manager', 'managing', 'executive']);
    expect(isFullyApproved(a)).toBe(false);
  });
});

describe('getApprovalSlot - ロール+役職から slot を解決', () => {
  it('S → president', () => {
    expect(getApprovalSlot(USER_ROLE.S, EXECUTIVE_TITLE.PRESIDENT)).toBe(
      EXECUTIVE_TITLE.PRESIDENT
    );
    // S で title 未設定でも president
    expect(getApprovalSlot(USER_ROLE.S, null)).toBe(EXECUTIVE_TITLE.PRESIDENT);
  });

  it('B → construction_manager', () => {
    expect(getApprovalSlot(USER_ROLE.B, EXECUTIVE_TITLE.CONSTRUCTION_MANAGER))
      .toBe(EXECUTIVE_TITLE.CONSTRUCTION_MANAGER);
  });

  it('A + executive → executive', () => {
    expect(getApprovalSlot(USER_ROLE.A, EXECUTIVE_TITLE.EXECUTIVE)).toBe(
      EXECUTIVE_TITLE.EXECUTIVE
    );
  });

  it('A + managing → managing', () => {
    expect(getApprovalSlot(USER_ROLE.A, EXECUTIVE_TITLE.MANAGING)).toBe(
      EXECUTIVE_TITLE.MANAGING
    );
  });

  it('A + null（旧データ）→ executive デフォルト', () => {
    expect(getApprovalSlot(USER_ROLE.A, null)).toBe(EXECUTIVE_TITLE.EXECUTIVE);
  });

  it('A_special / G / general は slot なし', () => {
    expect(getApprovalSlot(USER_ROLE.A_SPECIAL, null)).toBe(null);
    expect(getApprovalSlot(USER_ROLE.G, null)).toBe(null);
    expect(getApprovalSlot(USER_ROLE.GENERAL, null)).toBe(null);
  });
});
