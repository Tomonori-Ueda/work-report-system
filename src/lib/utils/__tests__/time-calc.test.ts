import {
  calculateWorkingHours,
  calculateBlockHours,
  calculateTotalHours,
  calculateNightHours,
  hasOverlappingBlocks,
  timeToMinutes,
  minutesToHours,
  formatMinutesToDisplay,
} from '../time-calc';

describe('timeToMinutes', () => {
  it('08:00 → 480分', () => {
    expect(timeToMinutes('08:00')).toBe(480);
  });

  it('12:30 → 750分', () => {
    expect(timeToMinutes('12:30')).toBe(750);
  });

  it('00:00 → 0分', () => {
    expect(timeToMinutes('00:00')).toBe(0);
  });

  it('23:59 → 1439分', () => {
    expect(timeToMinutes('23:59')).toBe(1439);
  });
});

describe('minutesToHours', () => {
  it('480分 → 8.0時間', () => {
    expect(minutesToHours(480)).toBe(8);
  });

  it('150分 → 2.5時間', () => {
    expect(minutesToHours(150)).toBe(2.5);
  });
});

describe('calculateWorkingHours（後方互換）', () => {
  // --- 設計書テストケース ---

  it('定時ぴったり: 08:00-17:00 → 実労働8h, 残業0h', () => {
    const result = calculateWorkingHours({
      startTime: '08:00',
      endTime: '17:00',
    });
    expect(result.regularHours).toBe(8);
    expect(result.overtimeHours).toBe(0);
  });

  it('定時前退社: 08:00-15:00 → 実労働6h, 残業0h', () => {
    const result = calculateWorkingHours({
      startTime: '08:00',
      endTime: '15:00',
    });
    expect(result.regularHours).toBe(6);
    expect(result.overtimeHours).toBe(0);
  });

  it('残業1時間: 08:00-18:00 → 実労働9h, 残業1h', () => {
    const result = calculateWorkingHours({
      startTime: '08:00',
      endTime: '18:00',
    });
    expect(result.regularHours).toBe(8);
    expect(result.overtimeHours).toBe(1);
  });

  it('残業2時間30分: 08:00-19:30 → 実労働10.5h, 残業2.5h', () => {
    const result = calculateWorkingHours({
      startTime: '08:00',
      endTime: '19:30',
    });
    expect(result.regularHours).toBe(8);
    expect(result.overtimeHours).toBe(2.5);
  });

  it('残業14分（切り捨て）: 08:00-17:14 → 残業0h', () => {
    const result = calculateWorkingHours({
      startTime: '08:00',
      endTime: '17:14',
    });
    expect(result.regularHours).toBe(8);
    expect(result.overtimeHours).toBe(0);
  });

  it('残業15分ちょうど: 08:00-17:15 → 残業0.25h', () => {
    const result = calculateWorkingHours({
      startTime: '08:00',
      endTime: '17:15',
    });
    expect(result.regularHours).toBe(8);
    expect(result.overtimeHours).toBe(0.25);
  });

  it('残業29分（切り捨て）: 08:00-17:29 → 残業0.25h', () => {
    const result = calculateWorkingHours({
      startTime: '08:00',
      endTime: '17:29',
    });
    expect(result.regularHours).toBe(8);
    expect(result.overtimeHours).toBe(0.25);
  });

  it('8時前出社: 07:30-17:00 → 実労働8.5h, 残業0.5h', () => {
    // 07:30-17:00 = 9.5h - 1h休憩 = 8.5h実労働
    // 実労働8.5hのうち、所定8hを超えた0.5h = 30分 → 15分刻みで30分 = 0.5h残業
    const result = calculateWorkingHours({
      startTime: '07:30',
      endTime: '17:00',
    });
    expect(result.regularHours).toBe(8);
    expect(result.overtimeHours).toBe(0.5);
  });

  it('休憩またぎなし: 13:00-17:00 → 実労働4h, 残業0h', () => {
    const result = calculateWorkingHours({
      startTime: '13:00',
      endTime: '17:00',
    });
    expect(result.regularHours).toBe(4);
    expect(result.overtimeHours).toBe(0);
    expect(result.breakMinutes).toBe(0);
  });

  // --- 追加テストケース ---

  it('午前のみ勤務: 08:00-12:00 → 実労働4h, 残業0h, 休憩0分', () => {
    const result = calculateWorkingHours({
      startTime: '08:00',
      endTime: '12:00',
    });
    expect(result.regularHours).toBe(4);
    expect(result.overtimeHours).toBe(0);
    expect(result.breakMinutes).toBe(0);
  });

  it('休憩時間の一部のみ含む: 11:00-12:30 → 休憩30分除外', () => {
    const result = calculateWorkingHours({
      startTime: '11:00',
      endTime: '12:30',
    });
    // 1.5h - 0.5h休憩 = 1h
    expect(result.regularHours).toBe(1);
    expect(result.breakMinutes).toBe(30);
  });

  it('長時間残業: 08:00-22:00 → 実労働13h, 残業5h', () => {
    const result = calculateWorkingHours({
      startTime: '08:00',
      endTime: '22:00',
    });
    expect(result.regularHours).toBe(8);
    expect(result.overtimeHours).toBe(5);
  });

  it('残業44分: 08:00-17:44 → 残業0.5h（44分→30分切り捨て）', () => {
    const result = calculateWorkingHours({
      startTime: '08:00',
      endTime: '17:44',
    });
    expect(result.regularHours).toBe(8);
    expect(result.overtimeHours).toBe(0.5);
  });
});

describe('calculateBlockHours', () => {
  it('定時ぴったり: 08:00-16:00（休憩なし）→ regularHours 8h, overtimeHours 0h', () => {
    const result = calculateBlockHours({ startTime: '08:00', endTime: '16:00' });
    expect(result.regularHours).toBe(8);
    expect(result.overtimeHours).toBe(0);
    expect(result.nightHours).toBe(0);
  });

  it('残業2時間: 08:00-18:00 → regularHours 8h, overtimeHours 2h', () => {
    const result = calculateBlockHours({ startTime: '08:00', endTime: '18:00' });
    expect(result.regularHours).toBe(8);
    expect(result.overtimeHours).toBe(2);
    expect(result.nightHours).toBe(0);
  });

  it('残業14分（切り捨て）: 08:00-16:14 → overtimeHours 0h', () => {
    const result = calculateBlockHours({ startTime: '08:00', endTime: '16:14' });
    expect(result.overtimeHours).toBe(0);
  });

  it('残業15分: 08:00-16:15 → overtimeHours 0.25h', () => {
    const result = calculateBlockHours({ startTime: '08:00', endTime: '16:15' });
    expect(result.overtimeHours).toBe(0.25);
  });

  it('夜間残業あり: 20:00-23:00 → nightHours 1h', () => {
    const result = calculateBlockHours({ startTime: '20:00', endTime: '23:00' });
    // 20:00-22:00 = 2h（通常）、22:00-23:00 = 1h（夜間）
    expect(result.nightHours).toBe(1);
  });

  it('全て夜間: 22:00-23:30 → nightHours 1.5h', () => {
    const result = calculateBlockHours({ startTime: '22:00', endTime: '23:30' });
    expect(result.nightHours).toBe(1.5);
  });

  it('夜間なし: 08:00-17:00 → nightHours 0h', () => {
    const result = calculateBlockHours({ startTime: '08:00', endTime: '17:00' });
    expect(result.nightHours).toBe(0);
  });

  it('終了が開始と同時刻: 全て0h', () => {
    const result = calculateBlockHours({ startTime: '08:00', endTime: '08:00' });
    expect(result.regularHours).toBe(0);
    expect(result.overtimeHours).toBe(0);
    expect(result.nightHours).toBe(0);
  });
});

describe('calculateTotalHours', () => {
  it('空配列 → 全て0h', () => {
    const result = calculateTotalHours([]);
    expect(result.totalRegularHours).toBe(0);
    expect(result.totalOvertimeHours).toBe(0);
    expect(result.totalNightHours).toBe(0);
  });

  it('単一ブロック8時間: 合計regularHours 8h, overtimeHours 0h', () => {
    const result = calculateTotalHours([{ startTime: '08:00', endTime: '16:00' }]);
    expect(result.totalRegularHours).toBe(8);
    expect(result.totalOvertimeHours).toBe(0);
  });

  it('2ブロック合計10時間 → regularHours 8h, overtimeHours 2h', () => {
    // 午前 4h + 午後 6h = 合計 10h → 残業2h
    const result = calculateTotalHours([
      { startTime: '08:00', endTime: '12:00' },
      { startTime: '13:00', endTime: '19:00' },
    ]);
    expect(result.totalRegularHours).toBe(8);
    expect(result.totalOvertimeHours).toBe(2);
  });

  it('2ブロック合計で8h未満 → overtimeHours 0h', () => {
    const result = calculateTotalHours([
      { startTime: '08:00', endTime: '12:00' }, // 4h
      { startTime: '13:00', endTime: '16:00' }, // 3h
    ]);
    expect(result.totalRegularHours).toBe(7);
    expect(result.totalOvertimeHours).toBe(0);
  });

  it('夜間ブロック込み: totalNightHours が合算される', () => {
    const result = calculateTotalHours([
      { startTime: '08:00', endTime: '17:00' }, // 9h（夜間なし）
      { startTime: '22:00', endTime: '23:00' }, // 1h（全部夜間）
    ]);
    // 合計10h → 残業2h（15分刻み）
    expect(result.totalOvertimeHours).toBe(2);
    expect(result.totalNightHours).toBe(1);
  });

  it('残業14分（切り捨て）: 2ブロック合計8h14m → overtimeHours 0h', () => {
    const result = calculateTotalHours([
      { startTime: '08:00', endTime: '12:00' }, // 4h
      { startTime: '13:00', endTime: '17:14' }, // 4h14m
    ]);
    expect(result.totalOvertimeHours).toBe(0);
  });

  it('残業15分: 2ブロック合計8h15m → overtimeHours 0.25h', () => {
    const result = calculateTotalHours([
      { startTime: '08:00', endTime: '12:00' }, // 4h
      { startTime: '13:00', endTime: '17:15' }, // 4h15m
    ]);
    expect(result.totalOvertimeHours).toBe(0.25);
  });
});

describe('calculateNightHours', () => {
  it('22:00前の勤務 → 0h', () => {
    expect(calculateNightHours('08:00', '17:00')).toBe(0);
  });

  it('22:00ちょうどから23:00 → 1h', () => {
    expect(calculateNightHours('22:00', '23:00')).toBe(1);
  });

  it('22:00ちょうどから翌0:00 → 2h', () => {
    expect(calculateNightHours('22:00', '24:00')).toBe(2);
  });

  it('20:00から23:00 → 夜間1h（22:00-23:00のみ）', () => {
    expect(calculateNightHours('20:00', '23:00')).toBe(1);
  });

  it('21:30から23:30 → 夜間1.5h', () => {
    expect(calculateNightHours('21:30', '23:30')).toBe(1.5);
  });

  it('終了が開始と同時刻 → 0h', () => {
    expect(calculateNightHours('22:00', '22:00')).toBe(0);
  });
});

describe('hasOverlappingBlocks', () => {
  it('空配列 → false', () => {
    expect(hasOverlappingBlocks([])).toBe(false);
  });

  it('1件のみ → false', () => {
    expect(hasOverlappingBlocks([{ startTime: '08:00', endTime: '12:00' }])).toBe(false);
  });

  it('重複なし: 08:00-12:00 と 13:00-17:00 → false', () => {
    expect(
      hasOverlappingBlocks([
        { startTime: '08:00', endTime: '12:00' },
        { startTime: '13:00', endTime: '17:00' },
      ])
    ).toBe(false);
  });

  it('隣接（接触のみ）: 08:00-12:00 と 12:00-16:00 → false', () => {
    // 終了と開始が同じ時刻は重複なし
    expect(
      hasOverlappingBlocks([
        { startTime: '08:00', endTime: '12:00' },
        { startTime: '12:00', endTime: '16:00' },
      ])
    ).toBe(false);
  });

  it('1分重複: 08:00-12:01 と 12:00-16:00 → true', () => {
    expect(
      hasOverlappingBlocks([
        { startTime: '08:00', endTime: '12:01' },
        { startTime: '12:00', endTime: '16:00' },
      ])
    ).toBe(true);
  });

  it('完全に内包: 09:00-10:00 が 08:00-12:00 の中に含まれる → true', () => {
    expect(
      hasOverlappingBlocks([
        { startTime: '08:00', endTime: '12:00' },
        { startTime: '09:00', endTime: '10:00' },
      ])
    ).toBe(true);
  });

  it('3ブロックで一部重複あり → true', () => {
    expect(
      hasOverlappingBlocks([
        { startTime: '08:00', endTime: '12:00' },
        { startTime: '13:00', endTime: '17:00' },
        { startTime: '16:30', endTime: '18:00' }, // 16:30-17:00 が重複
      ])
    ).toBe(true);
  });

  it('3ブロックで全て重複なし → false', () => {
    expect(
      hasOverlappingBlocks([
        { startTime: '08:00', endTime: '10:00' },
        { startTime: '10:00', endTime: '12:00' },
        { startTime: '13:00', endTime: '17:00' },
      ])
    ).toBe(false);
  });

  it('逆順で渡しても正しく判定できる → true', () => {
    // 順序が逆でも重複を検出できること
    expect(
      hasOverlappingBlocks([
        { startTime: '13:00', endTime: '17:00' },
        { startTime: '08:00', endTime: '14:00' }, // 13:00-14:00 が重複
      ])
    ).toBe(true);
  });
});

describe('formatMinutesToDisplay', () => {
  it('480分 → "8h 00m"', () => {
    expect(formatMinutesToDisplay(480)).toBe('8h 00m');
  });

  it('150分 → "2h 30m"', () => {
    expect(formatMinutesToDisplay(150)).toBe('2h 30m');
  });

  it('0分 → "0h 00m"', () => {
    expect(formatMinutesToDisplay(0)).toBe('0h 00m');
  });
});
