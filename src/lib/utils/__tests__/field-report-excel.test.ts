/**
 * @jest-environment node
 */
import { Timestamp } from 'firebase/firestore';
import {
  generateFieldReportExcel,
  buildFieldReportFileName,
} from '@/lib/utils/field-report-excel';
import {
  WEATHER,
  EXPENSE_CATEGORY,
  CARRY_OUT_CATEGORY,
  MACHINE_OWNERSHIP,
  createEmptyProcessInspection,
  type FieldReport,
} from '@/types/field-report';

/**
 * テスト用の最小限 FieldReport を生成。
 * Phase 2 で追加された optional フィールドはテストごとに上書きする。
 */
function buildMinimalReport(over: Partial<FieldReport> = {}): FieldReport {
  const now = Timestamp.fromDate(new Date('2026-02-24T08:00:00Z'));
  return {
    id: 'test-report-1',
    supervisorId: 'sup-1',
    siteId: 'site-1',
    siteName: '小峯様別荘新築工事',
    reportDate: '2026-02-24',
    weather: WEATHER.SUNNY,
    subcontractorWorks: [
      {
        subcontractorId: null,
        companyName: '井出建設興業㈱',
        workerCount: 4,
        workContent: '軒天張り 天井下地',
        expenseCategory: EXPENSE_CATEGORY.LABOR,
        startTime: '08:00',
        endTime: '17:00',
        workerNames: ['山田 太郎', '佐藤 次郎'],
      },
    ],
    materialDeliveries: [],
    notes: 'テスト備考',
    totalWorkerCount: 4,
    createdAt: now,
    updatedAt: now,
    ...over,
  };
}

describe('buildFieldReportFileName', () => {
  it('ファイル名にreportDateと現場名が含まれる', () => {
    const r = buildMinimalReport();
    const name = buildFieldReportFileName(r);
    expect(name).toContain('2026-02-24');
    expect(name).toContain('小峯様別荘新築工事');
    expect(name.endsWith('.xlsx')).toBe(true);
  });

  it('Windowsで使えない文字が _ に置換される', () => {
    const r = buildMinimalReport({ siteName: '工事/A:B*C?' });
    const name = buildFieldReportFileName(r);
    expect(name).not.toMatch(/[\\/:*?"<>|]/);
  });
});

describe('generateFieldReportExcel', () => {
  it('最小データでも Buffer を生成できる（xlsx シグネチャを含む）', async () => {
    const r = buildMinimalReport();
    const buf = await generateFieldReportExcel(r, '小林 紀之');
    expect(Buffer.isBuffer(buf)).toBe(true);
    // xlsx は ZIP なので 'PK' (0x50, 0x4B) で始まる
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
    // ある程度のサイズがあること
    expect(buf.length).toBeGreaterThan(2000);
  });

  it('Phase 2 拡張フィールド全部入りでも例外なく生成できる', async () => {
    const r = buildMinimalReport({
      projectName: '(軽井沢)小峯様別荘新築工事',
      siteResponsible: '小林 紀之',
      supervisorWorkStart: '08:00',
      supervisorWorkEnd: '20:30',
      workTimeStart: '08:00',
      processInspection: {
        ...createEmptyProcessInspection(),
        rebar: true,
        formwork: true,
        notes: '配筋検査済み',
      },
      receiveItems: [
        { receiver: '㈱カネト', itemName: 'ガラス', quantity: '1', unit: '式' },
      ],
      carryOutItems: [
        {
          itemName: '電動ドリル',
          quantity: '1台',
          category: CARRY_OUT_CATEGORY.BORROW,
        },
      ],
      meetingRecords: [
        { partner: '建主', topic: '色決め打合せ' },
      ],
      machineUsages: [
        {
          machineName: 'クレーン',
          ownership: MACHINE_OWNERSHIP.LEASE,
          spec: '4t',
          operator: '田中',
          usageHours: '4',
        },
      ],
      individualWorkTimes: [
        {
          name: '小林 紀之',
          startTime: '08:00',
          endTime: '20:30',
          workContent: '現場管理',
        },
      ],
      ownEmployees: [
        {
          userId: null,
          displayName: '伊藤 太郎',
          workContent: '現場管理補助',
          startTime: '08:00',
          endTime: '17:00',
        },
      ],
      tradeWorkers: {
        tobi: { today: 0, cumulative: 19 },
        zosaku: { today: 4, cumulative: 183 },
        shokuin: { today: 1, cumulative: 235 },
      },
      laborHoursToday: 104,
      laborHoursCumulative: 6248,
    });
    const buf = await generateFieldReportExcel(r, '小林 紀之');
    expect(buf.length).toBeGreaterThan(3000);
  });

  it('協力会社が空配列でも例外を投げない', async () => {
    const r = buildMinimalReport({ subcontractorWorks: [] });
    const buf = await generateFieldReportExcel(r, '監督');
    expect(buf.length).toBeGreaterThan(2000);
  });
});
