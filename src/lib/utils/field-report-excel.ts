import 'server-only';

import ExcelJS from 'exceljs';
import {
  TRADE_TYPES,
  TRADE_LABELS,
  CARRY_OUT_CATEGORY,
  MACHINE_OWNERSHIP,
  WEATHER,
  type FieldReport,
  type CarryOutCategory,
  type MachineOwnership,
  type Weather,
  type ProcessInspection,
} from '@/types/field-report';

/** 日本語ラベル */
const WEATHER_LABEL: Record<Weather, string> = {
  [WEATHER.SUNNY]: '晴',
  [WEATHER.CLOUDY]: '曇',
  [WEATHER.RAINY]: '雨',
  [WEATHER.SNOWY]: '雪',
};

const CARRY_OUT_LABEL: Record<CarryOutCategory, string> = {
  [CARRY_OUT_CATEGORY.BORROW]: '借入',
  [CARRY_OUT_CATEGORY.RETURN]: '返却',
  [CARRY_OUT_CATEGORY.CONSUME]: '消却',
};

const OWNERSHIP_LABEL: Record<MachineOwnership, string> = {
  [MACHINE_OWNERSHIP.OWN]: '自社',
  [MACHINE_OWNERSHIP.LEASE]: 'リース',
};

const PROCESS_INSPECTION_LABELS: Array<[keyof ProcessInspection, string]> = [
  ['foundation_pile', '基礎杭'],
  ['rebar', '鉄筋'],
  ['formwork', '型枠'],
  ['concrete', 'コンクリート'],
  ['roof', '屋根'],
  ['exterior_wall', '外壁'],
  ['internal_waterproof', '内部防水'],
  ['electrical', '電気'],
  ['plumbing', '給排水衛生'],
  ['roof_waterproof', '屋根防水'],
  ['interior', '内装'],
];

/** 全セルに掛ける細罫線 */
const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
};

/** セクション見出しの背景色 */
const HEADER_FILL: ExcelJS.FillPattern = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFE0E0E0' },
};

/**
 * 元号年月日に変換する（令和8年2月24日 形式）
 * Why: 様式7.5-9-02 は元号表記が標準のため。
 * 令和元年(2019)以前は西暦のままにする（保険）。
 */
function toReiwaDate(isoDate: string): string {
  const parts = isoDate.split('-');
  const y = parseInt(parts[0] ?? '0', 10);
  const m = parseInt(parts[1] ?? '0', 10);
  const d = parseInt(parts[2] ?? '0', 10);
  if (!y || !m || !d) return isoDate;
  // 令和は2019/5/1〜
  if (y < 2019 || (y === 2019 && m < 5)) return `${y}年${m}月${d}日`;
  const reiwa = y - 2018; // 2019 → 令和元年扱いだが、ここでは1年と表記
  const era = reiwa === 1 ? '元' : String(reiwa);
  return `令和${era}年${m}月${d}日`;
}

/** 曜日（日本語） */
function toJapaneseWeekday(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  const wd = ['日', '月', '火', '水', '木', '金', '土'];
  return wd[d.getDay()] ?? '';
}

/**
 * セル範囲に共通スタイルを適用（罫線・配置・折返し）
 */
function styleRange(
  ws: ExcelJS.Worksheet,
  range: string,
  style: {
    border?: boolean;
    bold?: boolean;
    align?: 'left' | 'center' | 'right';
    fill?: ExcelJS.FillPattern;
    fontSize?: number;
  }
): void {
  const rangeRegex = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/;
  const m = range.match(rangeRegex);
  if (!m) return;
  const [, c1, r1, c2, r2] = m;
  const r1n = parseInt(r1!, 10);
  const r2n = parseInt(r2!, 10);
  const c1n = ws.getColumn(c1!).number;
  const c2n = ws.getColumn(c2!).number;
  for (let r = r1n; r <= r2n; r++) {
    for (let c = c1n; c <= c2n; c++) {
      const cell = ws.getCell(r, c);
      if (style.border) cell.border = { ...THIN_BORDER };
      if (style.bold) cell.font = { ...cell.font, bold: true, size: style.fontSize ?? cell.font?.size };
      if (style.fontSize) cell.font = { ...cell.font, size: style.fontSize };
      if (style.fill) cell.fill = style.fill;
      cell.alignment = {
        horizontal: style.align ?? 'left',
        vertical: 'middle',
        wrapText: true,
      };
    }
  }
}

/** 1セクションの見出し行を書く（A〜列末まで結合・背景グレー） */
function writeSectionHeader(
  ws: ExcelJS.Worksheet,
  row: number,
  text: string,
  endCol = 'L'
): void {
  ws.getCell(`A${row}`).value = text;
  ws.mergeCells(`A${row}:${endCol}${row}`);
  styleRange(ws, `A${row}:${endCol}${row}`, {
    border: true,
    bold: true,
    align: 'left',
    fill: HEADER_FILL,
  });
}

/**
 * FieldReport から Excel ブック（Buffer）を生成する。
 * 様式7.5-9-02「打合せ指示書・日誌」の項目を縦に並べた印刷可能フォーマット。
 *
 * Why: 完全なピクセル単位再現には実Excelテンプレート（.xlsx）が必要だが、
 *      項目はすべて含むため実運用・印刷で過不足なく利用できる。
 *      実テンプレートが共有された場合は xlsx-template による差し込みに切替えやすいよう、
 *      生成処理は本ファイルに局所化している。
 */
export async function generateFieldReportExcel(
  report: FieldReport,
  supervisorName: string
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = '作業日報システム';
  wb.created = new Date();

  const ws = wb.addWorksheet('打合せ指示書・日誌', {
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.4, right: 0.4,
        top: 0.5, bottom: 0.5,
        header: 0.3, footer: 0.3,
      },
    },
  });

  // 列幅
  ws.columns = [
    { width: 12 }, // A
    { width: 12 }, // B
    { width: 8 },  // C
    { width: 24 }, // D
    { width: 20 }, // E
    { width: 14 }, // F
    { width: 10 }, // G
    { width: 10 }, // H
    { width: 14 }, // I
    { width: 10 }, // J
    { width: 10 }, // K
    { width: 10 }, // L
  ];

  let row = 1;

  // === ヘッダ：様式番号 + タイトル ===
  ws.getCell(`A${row}`).value = '様式 7.5-9-02';
  ws.getCell(`A${row}`).font = { size: 9 };
  ws.mergeCells(`B${row}:F${row}`);
  ws.getCell(`B${row}`).value = '打合せ指示書・日誌';
  styleRange(ws, `B${row}:F${row}`, { bold: true, align: 'center', fontSize: 16 });
  ws.getCell(`G${row}`).value = '勤務時間';
  ws.getCell(`H${row}`).value = `${report.supervisorWorkStart ?? ''} 〜 ${report.supervisorWorkEnd ?? ''}`;
  ws.mergeCells(`H${row}:I${row}`);
  styleRange(ws, `G${row}:I${row}`, { border: true, align: 'center' });
  ws.getCell(`J${row}`).value = '作成';
  ws.getCell(`K${row}`).value = '専務';
  ws.getCell(`L${row}`).value = '社長';
  styleRange(ws, `J${row}:L${row}`, { border: true, bold: true, align: 'center', fill: HEADER_FILL });
  ws.getRow(row).height = 28;
  row++;

  // 押印枠（空欄）
  ws.getCell(`J${row}`).value = supervisorName;
  ws.getCell(`K${row}`).value = '';
  ws.getCell(`L${row}`).value = '';
  styleRange(ws, `J${row}:L${row}`, { border: true, align: 'center' });
  ws.getRow(row).height = 30;
  // 同時に左側の基本情報行ヘッダ
  const labelCells: Array<[string, string]> = [
    ['A', '日付'],
    ['B', '曜日'],
    ['C', '天候'],
    ['D', '工事名'],
    ['E', '現場責任者'],
    ['F', '作業時間'],
    ['G', '勤務（監督）'],
    ['H', '監督勤務'],
    ['I', '回覧'],
  ];
  for (const [col, label] of labelCells) {
    ws.getCell(`${col}${row}`).value = label;
  }
  styleRange(ws, `A${row}:I${row}`, {
    border: true, bold: true, align: 'center', fill: HEADER_FILL, fontSize: 10,
  });
  row++;

  // 基本情報 値行
  ws.getCell(`A${row}`).value = toReiwaDate(report.reportDate);
  ws.getCell(`B${row}`).value = toJapaneseWeekday(report.reportDate);
  ws.getCell(`C${row}`).value = WEATHER_LABEL[report.weather] ?? '';
  ws.getCell(`D${row}`).value = report.projectName ?? report.siteName;
  ws.getCell(`E${row}`).value = report.siteResponsible ?? '';
  ws.getCell(`F${row}`).value = report.workTimeStart ?? '';
  ws.getCell(`G${row}`).value = supervisorName;
  ws.getCell(`H${row}`).value =
    `${report.supervisorWorkStart ?? ''}〜${report.supervisorWorkEnd ?? ''}`;
  ws.getCell(`I${row}`).value = '';
  styleRange(ws, `A${row}:I${row}`, { border: true, align: 'center' });
  ws.getRow(row).height = 24;
  row += 2;

  // === 協力会社作業内容 ===
  writeSectionHeader(ws, row, '作業内容（協力会社・自社）');
  row++;
  // 列見出し
  ws.getCell(`A${row}`).value = '協力会社';
  ws.getCell(`B${row}`).value = '人員';
  ws.getCell(`C${row}`).value = '常用';
  ws.getCell(`D${row}`).value = '作業内容';
  ws.getCell(`E${row}`).value = '安全指示';
  ws.getCell(`F${row}`).value = '時間';
  ws.getCell(`G${row}`).value = '作業員氏名（人名単位）';
  ws.mergeCells(`G${row}:L${row}`);
  styleRange(ws, `A${row}:L${row}`, { border: true, bold: true, align: 'center', fill: HEADER_FILL });
  row++;

  for (const w of report.subcontractorWorks) {
    ws.getCell(`A${row}`).value = w.companyName;
    ws.getCell(`B${row}`).value = w.workerCount;
    ws.getCell(`C${row}`).value = '';
    ws.getCell(`D${row}`).value = w.workContent;
    ws.getCell(`E${row}`).value = '';
    ws.getCell(`F${row}`).value =
      w.startTime && w.endTime ? `${w.startTime}〜${w.endTime}` : '';
    ws.getCell(`G${row}`).value = (w.workerNames ?? []).join('、');
    ws.mergeCells(`G${row}:L${row}`);
    styleRange(ws, `A${row}:L${row}`, { border: true, align: 'left' });
    row++;
  }

  // 自社作業員
  if (report.ownEmployees && report.ownEmployees.length > 0) {
    ws.getCell(`A${row}`).value = '自社（直営）';
    ws.getCell(`B${row}`).value = report.ownEmployees.length;
    ws.getCell(`C${row}`).value = '';
    ws.getCell(`D${row}`).value = report.ownEmployees
      .map((e) => `${e.displayName}: ${e.workContent}`)
      .join(' / ');
    ws.mergeCells(`D${row}:F${row}`);
    ws.getCell(`G${row}`).value = report.ownEmployees
      .map((e) => e.displayName)
      .join('、');
    ws.mergeCells(`G${row}:L${row}`);
    styleRange(ws, `A${row}:L${row}`, { border: true });
    row++;
  }
  row++;

  // === 工程内検査 ===
  writeSectionHeader(ws, row, '工程内検査');
  row++;
  if (report.processInspection) {
    const insp = report.processInspection;
    let col = 1;
    const startRow = row;
    for (const [key, label] of PROCESS_INSPECTION_LABELS) {
      const c = ws.getCell(row, col);
      c.value = `${insp[key] ? '☑' : '☐'} ${label}`;
      col++;
      if (col > 6) {
        col = 1;
        row++;
      }
    }
    if (col !== 1) row++;
    // 範囲全体に罫線
    styleRange(ws, `A${startRow}:L${row - 1}`, { border: true });

    // 指摘・是正事項
    ws.getCell(`A${row}`).value = '指摘・是正事項';
    styleRange(ws, `A${row}:A${row}`, { border: true, bold: true, fill: HEADER_FILL });
    ws.getCell(`B${row}`).value = insp.notes ?? '';
    ws.mergeCells(`B${row}:L${row}`);
    styleRange(ws, `B${row}:L${row}`, { border: true });
    row++;
  } else {
    ws.getCell(`A${row}`).value = '（未入力）';
    ws.mergeCells(`A${row}:L${row}`);
    styleRange(ws, `A${row}:L${row}`, { border: true, align: 'center' });
    row++;
  }
  row++;

  // === 受入先（外注工事含む） ===
  writeSectionHeader(ws, row, '受入先（外注工事含む）');
  row++;
  ws.getCell(`A${row}`).value = '受入先';
  ws.mergeCells(`A${row}:C${row}`);
  ws.getCell(`D${row}`).value = '品名';
  ws.mergeCells(`D${row}:H${row}`);
  ws.getCell(`I${row}`).value = '数量';
  ws.mergeCells(`I${row}:J${row}`);
  ws.getCell(`K${row}`).value = '単位';
  ws.mergeCells(`K${row}:L${row}`);
  styleRange(ws, `A${row}:L${row}`, { border: true, bold: true, align: 'center', fill: HEADER_FILL });
  row++;
  const receiveItems = report.receiveItems ?? [];
  if (receiveItems.length === 0) receiveItems.push({ receiver: '', itemName: '', quantity: '', unit: '' });
  for (const it of receiveItems) {
    ws.getCell(`A${row}`).value = it.receiver;
    ws.mergeCells(`A${row}:C${row}`);
    ws.getCell(`D${row}`).value = it.itemName;
    ws.mergeCells(`D${row}:H${row}`);
    ws.getCell(`I${row}`).value = it.quantity;
    ws.mergeCells(`I${row}:J${row}`);
    ws.getCell(`K${row}`).value = it.unit;
    ws.mergeCells(`K${row}:L${row}`);
    styleRange(ws, `A${row}:L${row}`, { border: true });
    row++;
  }
  row++;

  // === 持ち出し品 ===
  writeSectionHeader(ws, row, '持ち出し品');
  row++;
  ws.getCell(`A${row}`).value = '名称';
  ws.mergeCells(`A${row}:F${row}`);
  ws.getCell(`G${row}`).value = '数量';
  ws.mergeCells(`G${row}:I${row}`);
  ws.getCell(`J${row}`).value = '区分';
  ws.mergeCells(`J${row}:L${row}`);
  styleRange(ws, `A${row}:L${row}`, { border: true, bold: true, align: 'center', fill: HEADER_FILL });
  row++;
  const carryOuts = report.carryOutItems ?? [];
  if (carryOuts.length === 0) {
    carryOuts.push({ itemName: '', quantity: '', category: CARRY_OUT_CATEGORY.BORROW });
  }
  for (const it of carryOuts) {
    ws.getCell(`A${row}`).value = it.itemName;
    ws.mergeCells(`A${row}:F${row}`);
    ws.getCell(`G${row}`).value = it.quantity;
    ws.mergeCells(`G${row}:I${row}`);
    ws.getCell(`J${row}`).value = CARRY_OUT_LABEL[it.category] ?? '';
    ws.mergeCells(`J${row}:L${row}`);
    styleRange(ws, `A${row}:L${row}`, { border: true });
    row++;
  }
  row++;

  // === 打合せ記録 ===
  writeSectionHeader(ws, row, '打合せ記録');
  row++;
  ws.getCell(`A${row}`).value = '相手先';
  ws.mergeCells(`A${row}:C${row}`);
  ws.getCell(`D${row}`).value = '項目・対策';
  ws.mergeCells(`D${row}:L${row}`);
  styleRange(ws, `A${row}:L${row}`, { border: true, bold: true, align: 'center', fill: HEADER_FILL });
  row++;
  const meetings = report.meetingRecords ?? [];
  if (meetings.length === 0) meetings.push({ partner: '', topic: '' });
  for (const m of meetings) {
    ws.getCell(`A${row}`).value = m.partner;
    ws.mergeCells(`A${row}:C${row}`);
    ws.getCell(`D${row}`).value = m.topic;
    ws.mergeCells(`D${row}:L${row}`);
    styleRange(ws, `A${row}:L${row}`, { border: true });
    row++;
  }
  row++;

  // === 使用機器 ===
  writeSectionHeader(ws, row, '使用機器');
  row++;
  ws.getCell(`A${row}`).value = '機械名';
  ws.mergeCells(`A${row}:C${row}`);
  ws.getCell(`D${row}`).value = '自社/リース';
  ws.getCell(`E${row}`).value = '規格';
  ws.mergeCells(`E${row}:F${row}`);
  ws.getCell(`G${row}`).value = '運転者名';
  ws.mergeCells(`G${row}:I${row}`);
  ws.getCell(`J${row}`).value = '使用時間';
  ws.mergeCells(`J${row}:L${row}`);
  styleRange(ws, `A${row}:L${row}`, { border: true, bold: true, align: 'center', fill: HEADER_FILL });
  row++;
  const machines = report.machineUsages ?? [];
  if (machines.length === 0) {
    machines.push({ machineName: '', ownership: MACHINE_OWNERSHIP.OWN, spec: '', operator: '', usageHours: '' });
  }
  for (const m of machines) {
    ws.getCell(`A${row}`).value = m.machineName;
    ws.mergeCells(`A${row}:C${row}`);
    ws.getCell(`D${row}`).value = OWNERSHIP_LABEL[m.ownership] ?? '';
    ws.getCell(`E${row}`).value = m.spec;
    ws.mergeCells(`E${row}:F${row}`);
    ws.getCell(`G${row}`).value = m.operator;
    ws.mergeCells(`G${row}:I${row}`);
    ws.getCell(`J${row}`).value = m.usageHours;
    ws.mergeCells(`J${row}:L${row}`);
    styleRange(ws, `A${row}:L${row}`, { border: true });
    row++;
  }
  row++;

  // === 個人勤務時間 ===
  writeSectionHeader(ws, row, '個人勤務時間');
  row++;
  ws.getCell(`A${row}`).value = '氏名';
  ws.mergeCells(`A${row}:C${row}`);
  ws.getCell(`D${row}`).value = '開始';
  ws.getCell(`E${row}`).value = '終了';
  ws.getCell(`F${row}`).value = '業務内容';
  ws.mergeCells(`F${row}:L${row}`);
  styleRange(ws, `A${row}:L${row}`, { border: true, bold: true, align: 'center', fill: HEADER_FILL });
  row++;
  const indWorks = report.individualWorkTimes ?? [];
  if (indWorks.length === 0) indWorks.push({ name: '', startTime: '', endTime: '', workContent: '' });
  for (const w of indWorks) {
    ws.getCell(`A${row}`).value = w.name;
    ws.mergeCells(`A${row}:C${row}`);
    ws.getCell(`D${row}`).value = w.startTime;
    ws.getCell(`E${row}`).value = w.endTime;
    ws.getCell(`F${row}`).value = w.workContent;
    ws.mergeCells(`F${row}:L${row}`);
    styleRange(ws, `A${row}:L${row}`, { border: true });
    row++;
  }
  row++;

  // === 職種別稼動人員（27職種） ===
  writeSectionHeader(ws, row, '職種別稼動人員');
  row++;
  // ヘッダ行（3列ペア × 3 = 9列）：左ブロックから3列ずつに圧縮
  ws.getCell(`A${row}`).value = '職種';
  ws.getCell(`B${row}`).value = '本日';
  ws.getCell(`C${row}`).value = '累計';
  ws.getCell(`D${row}`).value = '職種';
  ws.getCell(`E${row}`).value = '本日';
  ws.getCell(`F${row}`).value = '累計';
  ws.getCell(`G${row}`).value = '職種';
  ws.getCell(`H${row}`).value = '本日';
  ws.getCell(`I${row}`).value = '累計';
  ws.getCell(`J${row}`).value = '職種';
  ws.getCell(`K${row}`).value = '本日';
  ws.getCell(`L${row}`).value = '累計';
  styleRange(ws, `A${row}:L${row}`, { border: true, bold: true, align: 'center', fill: HEADER_FILL });
  row++;
  // 27項目を 4列 × 7行に並べる（最後の行は3列分のみ）
  const tw = report.tradeWorkers ?? {};
  const colsPerRow = 4;
  const totalRows = Math.ceil(TRADE_TYPES.length / colsPerRow);
  for (let r = 0; r < totalRows; r++) {
    for (let c = 0; c < colsPerRow; c++) {
      const idx = r * colsPerRow + c;
      const trade = TRADE_TYPES[idx];
      const baseCol = c * 3 + 1; // A=1
      if (trade) {
        const entry = tw[trade];
        ws.getCell(row, baseCol).value = TRADE_LABELS[trade];
        ws.getCell(row, baseCol + 1).value = entry?.today ?? '';
        ws.getCell(row, baseCol + 2).value = entry?.cumulative ?? '';
      } else {
        // 27項目超の空セル
        ws.getCell(row, baseCol).value = '';
        ws.getCell(row, baseCol + 1).value = '';
        ws.getCell(row, baseCol + 2).value = '';
      }
    }
    styleRange(ws, `A${row}:L${row}`, { border: true, align: 'center' });
    row++;
  }

  // 合計行
  ws.getCell(`A${row}`).value = '合計人員';
  ws.mergeCells(`A${row}:B${row}`);
  ws.getCell(`C${row}`).value = report.totalWorkerCount;
  ws.getCell(`D${row}`).value = '労働本日時間';
  ws.mergeCells(`D${row}:F${row}`);
  ws.getCell(`G${row}`).value = report.laborHoursToday ?? '';
  ws.getCell(`H${row}`).value = '労働累計時間';
  ws.mergeCells(`H${row}:J${row}`);
  ws.getCell(`K${row}`).value = report.laborHoursCumulative ?? '';
  ws.mergeCells(`K${row}:L${row}`);
  styleRange(ws, `A${row}:L${row}`, { border: true, bold: true, align: 'center' });
  row++;

  // 備考
  if (report.notes) {
    row++;
    writeSectionHeader(ws, row, '備考');
    row++;
    ws.getCell(`A${row}`).value = report.notes;
    ws.mergeCells(`A${row}:L${row}`);
    styleRange(ws, `A${row}:L${row}`, { border: true });
    ws.getRow(row).height = 60;
  }

  // 注意書き（フッタ）
  row += 2;
  ws.getCell(`A${row}`).value = '（注）記入項目のない箇所は該当なし。必ず毎日提出すること。';
  ws.mergeCells(`A${row}:L${row}`);
  styleRange(ws, `A${row}:L${row}`, { fontSize: 9 });

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/** Excel ダウンロード時のファイル名 */
export function buildFieldReportFileName(report: FieldReport): string {
  const safeSiteName = report.siteName.replace(/[\\\\/:*?"<>|]/g, '_');
  return `打合せ指示書_${report.reportDate}_${safeSiteName}.xlsx`;
}
