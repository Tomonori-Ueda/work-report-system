
/**
 * @jest-environment node
 */
import { writeFileSync } from 'node:fs';
import ExcelJS from 'exceljs';
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

  it('様式7.5-9-02 の主要ラベル・職種ラベルがすべてシート内に含まれる', async () => {
    const r = buildMinimalReport({
      projectName: '(軽井沢)小峯様別荘新築工事',
      siteResponsible: '小林 紀之',
      supervisorWorkStart: '08:00',
      supervisorWorkEnd: '20:30',
      tradeWorkers: {
        tobi: { today: 0, cumulative: 19 },
        zosaku: { today: 4, cumulative: 183 },
        shokuin: { today: 1, cumulative: 235 },
      },
    });
    const buf = await generateFieldReportExcel(r, '小林 紀之');

    // 出力したバッファを読み戻してセル値を検証
    const wb = new ExcelJS.Workbook();
    // ExcelJS の型が古い Buffer 型を期待するため as unknown キャスト
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    const ws = wb.getWorksheet('打合せ指示書・日誌');
    expect(ws).toBeDefined();

    // 全セル値を1つの文字列に集約してラベル含有を検証
    const collected: string[] = [];
    ws!.eachRow({ includeEmpty: false }, (rowObj) => {
      rowObj.eachCell({ includeEmpty: false }, (cell) => {
        const v = cell.value;
        if (v !== null && v !== undefined) collected.push(String(v));
      });
    });
    // 縦書き表示用の改行を除去して比較
    const flat = collected.join('|').replace(/\n/g, '');

    // ヘッダ系
    expect(flat).toContain('打合せ指示書・日誌');
    expect(flat).toContain('7.5-9-02');
    expect(flat).toContain('回覧');
    expect(flat).toContain('社長');
    expect(flat).toContain('専務');
    // 基本情報
    expect(flat).toContain('日付');
    expect(flat).toContain('天候');
    expect(flat).toContain('工事名');
    expect(flat).toContain('現場責任者');
    expect(flat).toContain('(軽井沢)小峯様別荘新築工事');
    expect(flat).toContain('小林 紀之');
    // セクションラベル
    expect(flat).toContain('受入先（外注工事含む）');
    expect(flat).toContain('協力会社');
    expect(flat).toContain('安全指示事項');
    expect(flat).toContain('工種');
    expect(flat).toContain('指摘・是正事項');
    expect(flat).toContain('持ち出し品');
    expect(flat).toContain('打合せ');
    expect(flat).toContain('使用機器');
    expect(flat).toContain('機械名');
    expect(flat).toContain('運転者名');
    expect(flat).toContain('個人勤務');
    expect(flat).toContain('稼動人員');
    // 職種27種
    const tradeLabels = [
      '鳶工', '土工', '圧送工', '鉄筋工', '型枠工', '鉄工', '外壁工',
      '防水工', '石・タイル工', '造作大工', '屋根板金工', '金属工',
      '左官工', '家具木建工', '鋼製建具工', 'ガラス工', '塗装工',
      '内装工', '昇降機工', '電工', '設備工', '地盤改良工', '直営',
      'その他', 'クレーン', '解体工', '職員',
    ];
    for (const label of tradeLabels) {
      expect(flat).toContain(label);
    }
    // 注釈
    expect(flat).toContain('記入項目のない箇所は該当なし');
  });
});
