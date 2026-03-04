import {
  calculateWorkingHours,
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

describe('calculateWorkingHours', () => {
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

  it('8時前出社: 07:30-17:00 → 実労働8.5h, 残業0h（8h超え部分は残業にカウントされる）', () => {
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
