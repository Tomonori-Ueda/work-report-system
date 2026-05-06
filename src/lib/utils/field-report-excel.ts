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

/**
 * 様式7.5-9-02「打合せ指示書・日誌」を Excel で再現する。
 *
 * レイアウト方針:
 *   3カラム構成（画像参照）
 *   - 左ブロック (A〜G):  日付・工事名・作業内容（協力会社）・打合せ記録・使用機器
 *   - 中央ブロック (H〜M): 受入先・工程内検査・持ち出し品・個人勤務時間
 *   - 右ブロック (N〜P):  稼動人員（27職種＋合計＋労働時間累計）
 *
 *   ピクセル単位の完全一致は元 .xlsx テンプレートが無いと不可能だが、
 *   セル結合・罫線・フォント指定で印刷時の見栄えは画像に近づける。
 */

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

/** ProcessInspection の boolean キーのみ */
type InspectionBoolKey = Exclude<keyof ProcessInspection, 'notes'>;

/** 工程内検査チェックボックス11項目（2列に並べる順序） */
const INSPECTION_LEFT: Array<[InspectionBoolKey, string]> = [
  ['foundation_pile', '基礎杭'],
  ['rebar', '鉄筋'],
  ['formwork', '型枠'],
  ['concrete', 'コンクリート'],
  ['roof', '屋根'],
  ['exterior_wall', '外壁'],
  ['internal_waterproof', '内部防水'],
];
const INSPECTION_RIGHT: Array<[InspectionBoolKey | null, string, string]> = [
  ['electrical', '電気', ''],
  ['plumbing', '給排水衛生', '(絶縁試験等記録を添付の事)'],
  ['roof_waterproof', '屋根防水', ''],
  ['interior', '内装', '(気密試験等記録を添付の事)'],
  [null, '', ''],
  [null, '', ''],
  [null, '', ''],
];

const THIN: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
};

const HEADER_FILL: ExcelJS.FillPattern = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFE7E7E7' },
};

/** 範囲にスタイル一括適用 */
function styleRange(
  ws: ExcelJS.Worksheet,
  range: string,
  opts: {
    border?: boolean;
    bold?: boolean;
    align?: 'left' | 'center' | 'right';
    fill?: ExcelJS.FillPattern;
    fontSize?: number;
    wrapText?: boolean;
    rotate?: number;
  }
): void {
  const m = range.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
  if (!m) return;
  const c1 = ws.getColumn(m[1]!).number;
  const r1 = parseInt(m[2]!, 10);
  const c2 = ws.getColumn(m[3]!).number;
  const r2 = parseInt(m[4]!, 10);
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      const cell = ws.getCell(r, c);
      if (opts.border) cell.border = { ...THIN };
      const fontPatch: Partial<ExcelJS.Font> = {};
      if (opts.bold) fontPatch.bold = true;
      if (opts.fontSize) fontPatch.size = opts.fontSize;
      if (Object.keys(fontPatch).length > 0) cell.font = { ...cell.font, ...fontPatch };
      if (opts.fill) cell.fill = opts.fill;
      cell.alignment = {
        horizontal: opts.align ?? 'center',
        vertical: 'middle',
        wrapText: opts.wrapText ?? true,
        textRotation: opts.rotate ?? 0,
      };
    }
  }
}

function setCell(
  ws: ExcelJS.Worksheet,
  ref: string,
  value: string | number,
  opts: {
    border?: boolean;
    bold?: boolean;
    align?: 'left' | 'center' | 'right';
    fill?: ExcelJS.FillPattern;
    fontSize?: number;
    wrapText?: boolean;
  } = {}
): void {
  ws.getCell(ref).value = value;
  styleRange(ws, `${ref}:${ref}`, opts);
}

/** 元号年月日（令和8年2月24日 形式）。令和元年(2019/5)未満は西暦表記。 */
function toReiwaParts(isoDate: string): { era: string; year: string; month: number; day: number } {
  const [yStr, mStr, dStr] = isoDate.split('-');
  const y = parseInt(yStr ?? '0', 10);
  const m = parseInt(mStr ?? '0', 10);
  const d = parseInt(dStr ?? '0', 10);
  if (!y || !m || !d) return { era: '', year: String(y), month: m, day: d };
  if (y < 2019 || (y === 2019 && m < 5)) {
    return { era: '', year: String(y), month: m, day: d };
  }
  const reiwa = y - 2018;
  return { era: '令和', year: reiwa === 1 ? '元' : String(reiwa), month: m, day: d };
}

function toJapaneseWeekday(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  return ['日', '月', '火', '水', '木', '金', '土'][d.getDay()] ?? '';
}

function checkbox(checked: boolean): string {
  return checked ? '☑' : '☐';
}

/**
 * FieldReport から様式7.5-9-02 形式の Excel ブック（Buffer）を生成する。
 */
export async function generateFieldReportExcel(
  report: FieldReport,
  supervisorName: string
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = '作業日報システム';
  wb.created = new Date();

  const ws = wb.addWorksheet('打合せ指示書・日誌', {
    views: [{ showGridLines: false }],
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      margins: {
        left: 0.3, right: 0.3, top: 0.3, bottom: 0.3,
        header: 0.2, footer: 0.2,
      },
    },
  });

  // 列幅（A〜P 16列）
  ws.columns = [
    { width: 5 },   // A: 縦書き「作業内容」など
    { width: 14 },  // B: 協力会社
    { width: 5 },   // C: 人員
    { width: 5 },   // D: 常用
    { width: 18 },  // E: 作業内容
    { width: 14 },  // F: 安全指示事項
    { width: 5 },   // G: 縦書き 受入先(外注工事含む)
    { width: 12 },  // H: 受入先 / 工種ラベル
    { width: 16 },  // I: 品名 / 検査チェック左
    { width: 6 },   // J: 数量 / 検査チェック右
    { width: 4 },   // K: 単位
    { width: 10 },  // L: 持ち出し品 数量
    { width: 9 },   // M: 持ち出し品 区分 / 個人勤務
    { width: 8 },   // N: 職種ラベル
    { width: 6 },   // O: 人員
    { width: 7 },   // P: 累計
  ];

  // ============================================================
  // 1〜2行: ヘッダ（様式番号 / タイトル / 勤務時間 / 回覧）
  // ============================================================
  let row = 1;

  // 様式番号
  ws.getCell(`A${row}`).value = '(様式 7.5-9-02)';
  ws.getCell(`A${row}`).font = { size: 9 };
  ws.getCell(`A${row}`).alignment = { horizontal: 'left', vertical: 'middle' };

  // タイトル
  ws.mergeCells(`B${row}:E${row}`);
  ws.getCell(`B${row}`).value = '打合せ指示書・日誌';
  styleRange(ws, `B${row}:E${row}`, { bold: true, align: 'center', fontSize: 16 });

  // 勤務時間ラベル + 値
  ws.getCell(`F${row}`).value = '勤務時間';
  styleRange(ws, `F${row}:F${row}`, { align: 'right', fontSize: 9 });
  ws.mergeCells(`G${row}:K${row}`);
  ws.getCell(`G${row}`).value =
    `【${supervisorName || '監督'}】${report.supervisorWorkStart ?? ''}〜${report.supervisorWorkEnd ?? ''}  現場管理`;
  styleRange(ws, `G${row}:K${row}`, { align: 'left', fontSize: 10 });

  // 回覧 ヘッダ（社長/専務/作成）
  setCell(ws, `L${row}`, '回覧', { border: true, bold: true, align: 'center', fill: HEADER_FILL, fontSize: 9 });
  setCell(ws, `M${row}`, '社長', { border: true, bold: true, align: 'center', fill: HEADER_FILL, fontSize: 9 });
  setCell(ws, `N${row}`, '専務', { border: true, bold: true, align: 'center', fill: HEADER_FILL, fontSize: 9 });
  ws.mergeCells(`O${row}:P${row}`);
  setCell(ws, `O${row}`, '作成', { border: true, bold: true, align: 'center', fill: HEADER_FILL, fontSize: 9 });
  ws.getRow(row).height = 22;
  row++;

  // 押印枠
  ws.getCell(`A${row}`).value = '';
  ws.getCell(`F${row}`).value = '作業時間';
  styleRange(ws, `F${row}:F${row}`, { align: 'right', fontSize: 9 });
  ws.mergeCells(`G${row}:K${row}`);
  ws.getCell(`G${row}`).value = `${report.workTimeStart ?? ''} 〜`;
  styleRange(ws, `G${row}:K${row}`, { align: 'left', fontSize: 10 });
  setCell(ws, `L${row}`, '', { border: true });
  setCell(ws, `M${row}`, '', { border: true });
  setCell(ws, `N${row}`, '', { border: true });
  ws.mergeCells(`O${row}:P${row}`);
  setCell(ws, `O${row}`, supervisorName, { border: true, align: 'center', fontSize: 10 });
  ws.getRow(row).height = 38;
  row++;

  // ============================================================
  // 3行: 日付/曜日/天候 ヘッダ + 受入先ヘッダ + 稼働人員ヘッダ
  // ============================================================
  setCell(ws, `A${row}`, '日付', { border: true, bold: true, align: 'center', fill: HEADER_FILL, fontSize: 9 });
  ws.mergeCells(`B${row}:D${row}`);
  setCell(ws, `B${row}`, '日付', { border: true, bold: true, align: 'center', fill: HEADER_FILL, fontSize: 9 });
  setCell(ws, `E${row}`, '曜日', { border: true, bold: true, align: 'center', fill: HEADER_FILL, fontSize: 9 });
  setCell(ws, `F${row}`, '天候', { border: true, bold: true, align: 'center', fill: HEADER_FILL, fontSize: 9 });

  // 受入先ヘッダ（縦書きG列）
  ws.mergeCells(`G${row}:G${row + 1}`);
  setCell(ws, `G${row}`, '受入先（外注工事含む）', {
    border: true, bold: true, align: 'center', fill: HEADER_FILL, fontSize: 8,
  });
  ws.getCell(`G${row}`).alignment = {
    ...ws.getCell(`G${row}`).alignment,
    textRotation: 90,
  };
  setCell(ws, `H${row}`, '受入先', { border: true, bold: true, align: 'center', fill: HEADER_FILL, fontSize: 9 });
  setCell(ws, `I${row}`, '品名', { border: true, bold: true, align: 'center', fill: HEADER_FILL, fontSize: 9 });
  setCell(ws, `J${row}`, '数量', { border: true, bold: true, align: 'center', fill: HEADER_FILL, fontSize: 9 });
  setCell(ws, `K${row}`, '単位', { border: true, bold: true, align: 'center', fill: HEADER_FILL, fontSize: 9 });
  // 持ち出し品はあとで描く（先に作るのは稼動人員ヘッダ）

  // 稼働人員ヘッダ（縦書きL列）
  setCell(ws, `L${row}`, '稼動人員', { border: true, bold: true, align: 'center', fill: HEADER_FILL, fontSize: 9 });
  setCell(ws, `M${row}`, '', { border: true, fill: HEADER_FILL });
  setCell(ws, `N${row}`, '職種', { border: true, bold: true, align: 'center', fill: HEADER_FILL, fontSize: 9 });
  setCell(ws, `O${row}`, '人員', { border: true, bold: true, align: 'center', fill: HEADER_FILL, fontSize: 9 });
  setCell(ws, `P${row}`, '累計', { border: true, bold: true, align: 'center', fill: HEADER_FILL, fontSize: 9 });
  ws.getRow(row).height = 18;
  row++;

  // ============================================================
  // 4行: 日付値 + 受入先1行目 + 職種1（鳶工）
  // ============================================================
  const reiwa = toReiwaParts(report.reportDate);
  // A4 セルに「令和」+ 改行 + 「8年」のように積みたいが、シンプルに 1セル1値で
  ws.mergeCells(`A${row}:D${row}`);
  ws.getCell(`A${row}`).value = `${reiwa.era}${reiwa.year}年 ${reiwa.month}月 ${reiwa.day}日`;
  styleRange(ws, `A${row}:D${row}`, { border: true, align: 'center', fontSize: 11, bold: true });
  setCell(ws, `E${row}`, toJapaneseWeekday(report.reportDate), { border: true, align: 'center', fontSize: 11 });
  setCell(ws, `F${row}`, WEATHER_LABEL[report.weather] ?? '', { border: true, align: 'center', fontSize: 11 });
  ws.getRow(row).height = 24;

  // 受入先 1行目（さらに2行追加で計3行作る）
  const receiveItems = report.receiveItems ?? [];
  setCell(ws, `H${row}`, receiveItems[0]?.receiver ?? '', { border: true, align: 'center', fontSize: 9 });
  setCell(ws, `I${row}`, receiveItems[0]?.itemName ?? '', { border: true, align: 'center', fontSize: 9 });
  setCell(ws, `J${row}`, receiveItems[0]?.quantity ?? '', { border: true, align: 'center', fontSize: 9 });
  setCell(ws, `K${row}`, receiveItems[0]?.unit ?? '', { border: true, align: 'center', fontSize: 9 });

  // 稼働人員: 鳶工
  writeTradeRow(ws, row, 0, report);
  row++;

  // ============================================================
  // 5行: 工事名 + 現場責任者ヘッダ + 受入先2行目 + 職種2（土工）
  // ============================================================
  setCell(ws, `A${row}`, '', { border: true });
  ws.mergeCells(`B${row}:D${row}`);
  setCell(ws, `B${row}`, '工事名', { border: true, bold: true, align: 'center', fill: HEADER_FILL, fontSize: 9 });
  ws.mergeCells(`E${row}:F${row}`);
  setCell(ws, `E${row}`, '現場責任者 氏名', { border: true, bold: true, align: 'center', fill: HEADER_FILL, fontSize: 9 });
  setCell(ws, `H${row}`, receiveItems[1]?.receiver ?? '', { border: true, align: 'center', fontSize: 9 });
  setCell(ws, `I${row}`, receiveItems[1]?.itemName ?? '', { border: true, align: 'center', fontSize: 9 });
  setCell(ws, `J${row}`, receiveItems[1]?.quantity ?? '', { border: true, align: 'center', fontSize: 9 });
  setCell(ws, `K${row}`, receiveItems[1]?.unit ?? '', { border: true, align: 'center', fontSize: 9 });
  writeTradeRow(ws, row, 1, report);
  row++;

  // ============================================================
  // 6行: 工事名 値 + 現場責任者 値 + 受入先3行目 + 職種3
  // ============================================================
  setCell(ws, `A${row}`, '', { border: true });
  ws.mergeCells(`B${row}:D${row}`);
  setCell(ws, `B${row}`, report.projectName ?? report.siteName, {
    border: true, align: 'center', fontSize: 11, bold: true,
  });
  ws.mergeCells(`E${row}:F${row}`);
  setCell(ws, `E${row}`, report.siteResponsible ?? '', {
    border: true, align: 'center', fontSize: 11,
  });
  setCell(ws, `H${row}`, receiveItems[2]?.receiver ?? '', { border: true, align: 'center', fontSize: 9 });
  setCell(ws, `I${row}`, receiveItems[2]?.itemName ?? '', { border: true, align: 'center', fontSize: 9 });
  setCell(ws, `J${row}`, receiveItems[2]?.quantity ?? '', { border: true, align: 'center', fontSize: 9 });
  setCell(ws, `K${row}`, receiveItems[2]?.unit ?? '', { border: true, align: 'center', fontSize: 9 });
  writeTradeRow(ws, row, 2, report);
  ws.getRow(row).height = 24;
  row++;

  // ============================================================
  // 7行: 作業内容 ヘッダ + 工程内検査 ヘッダ + 職種4
  // 「作業内容」は縦書き列A、B〜F は協力会社/人員/常用/作業内容/安全指示
  // ============================================================
  // 作業内容 縦書き（A列）。協力会社4行 + ヘッダ1行 = 5行を結合
  const subWorks = report.subcontractorWorks;
  const workContentRows = Math.max(4, subWorks.length); // 最低4行
  const workSectionRowStart = row;
  ws.mergeCells(`A${row}:A${row + workContentRows}`);
  setCell(ws, `A${row}`, '作\n業\n内\n容', {
    border: true, bold: true, align: 'center', fill: HEADER_FILL, fontSize: 11,
  });

  // 作業内容ヘッダ
  setCell(ws, `B${row}`, '協力会社', { border: true, bold: true, align: 'center', fill: HEADER_FILL, fontSize: 9 });
  setCell(ws, `C${row}`, '人員', { border: true, bold: true, align: 'center', fill: HEADER_FILL, fontSize: 9 });
  setCell(ws, `D${row}`, '常用', { border: true, bold: true, align: 'center', fill: HEADER_FILL, fontSize: 9 });
  setCell(ws, `E${row}`, '作業内容', { border: true, bold: true, align: 'center', fill: HEADER_FILL, fontSize: 9 });
  setCell(ws, `F${row}`, '安全指示事項', { border: true, bold: true, align: 'center', fill: HEADER_FILL, fontSize: 9 });

  // 工程内検査ヘッダ（G列縦書き）
  ws.mergeCells(`G${row}:G${row + 7}`);
  setCell(ws, `G${row}`, '工\n程\n内\n検\n査', {
    border: true, bold: true, align: 'center', fill: HEADER_FILL, fontSize: 11,
  });
  setCell(ws, `H${row}`, '工種', { border: true, bold: true, align: 'center', fill: HEADER_FILL, fontSize: 9 });
  ws.mergeCells(`I${row}:J${row}`);
  setCell(ws, `I${row}`, '工種', { border: true, bold: true, align: 'center', fill: HEADER_FILL, fontSize: 9 });
  ws.mergeCells(`K${row}:M${row}`);
  setCell(ws, `K${row}`, '指摘・是正事項', { border: true, bold: true, align: 'center', fill: HEADER_FILL, fontSize: 9 });

  writeTradeRow(ws, row, 3, report);
  row++;

  // ============================================================
  // 8〜11行: 協力会社4行 + 工程内検査チェックリスト
  // ============================================================
  const inspection = report.processInspection;
  for (let i = 0; i < workContentRows; i++) {
    const work = subWorks[i];
    setCell(ws, `B${row}`, work?.companyName ?? '', { border: true, align: 'center', fontSize: 10 });
    setCell(ws, `C${row}`, work?.workerCount ?? '', { border: true, align: 'center', fontSize: 10 });
    setCell(ws, `D${row}`, '', { border: true, align: 'center', fontSize: 10 });
    setCell(ws, `E${row}`, work?.workContent ?? '', { border: true, align: 'left', fontSize: 10 });
    setCell(ws, `F${row}`, '', { border: true, align: 'left', fontSize: 10 });

    // 工程内検査チェック（左7項目）
    const left = INSPECTION_LEFT[i];
    if (left) {
      const [key, label] = left;
      setCell(ws, `H${row}`,
        `${checkbox(inspection?.[key] ?? false)} ${label}`,
        { border: true, align: 'left', fontSize: 9 }
      );
    } else {
      setCell(ws, `H${row}`, '', { border: true });
    }
    // 工程内検査チェック（右4項目）
    const right = INSPECTION_RIGHT[i];
    if (right) {
      const [key, label, sub] = right;
      const text = key
        ? `${checkbox(inspection?.[key] ?? false)} ${label}${sub ? `\n${sub}` : ''}`
        : '';
      ws.mergeCells(`I${row}:J${row}`);
      setCell(ws, `I${row}`, text, { border: true, align: 'left', fontSize: 8, wrapText: true });
    } else {
      ws.mergeCells(`I${row}:J${row}`);
      setCell(ws, `I${row}`, '', { border: true });
    }
    // 指摘・是正事項（最初の行に集約）
    ws.mergeCells(`K${row}:M${row}`);
    setCell(ws, `K${row}`, i === 0 ? (inspection?.notes ?? '') : '', {
      border: true, align: 'left', fontSize: 9, wrapText: true,
    });

    // 稼動人員: 4列目以降
    writeTradeRow(ws, row, 4 + i, report);
    ws.getRow(row).height = 22;
    row++;
  }

  // 工程内検査が7行に満たない場合、残り行は空欄＋検査右ブロック後半
  // workContentRows < 7 のとき、追加3行で工程内検査を埋める
  for (let i = workContentRows; i < 7; i++) {
    setCell(ws, `B${row}`, '', { border: true });
    setCell(ws, `C${row}`, '', { border: true });
    setCell(ws, `D${row}`, '', { border: true });
    setCell(ws, `E${row}`, '', { border: true });
    setCell(ws, `F${row}`, '', { border: true });
    const left = INSPECTION_LEFT[i];
    if (left) {
      const [key, label] = left;
      setCell(ws, `H${row}`, `${checkbox(inspection?.[key] ?? false)} ${label}`,
        { border: true, align: 'left', fontSize: 9 }
      );
    } else {
      setCell(ws, `H${row}`, '', { border: true });
    }
    const right = INSPECTION_RIGHT[i];
    ws.mergeCells(`I${row}:J${row}`);
    if (right) {
      const [key, label, sub] = right;
      const text = key
        ? `${checkbox(inspection?.[key] ?? false)} ${label}${sub ? `\n${sub}` : ''}`
        : '';
      setCell(ws, `I${row}`, text, { border: true, align: 'left', fontSize: 8 });
    } else {
      setCell(ws, `I${row}`, '', { border: true });
    }
    ws.mergeCells(`K${row}:M${row}`);
    setCell(ws, `K${row}`, '', { border: true });
    writeTradeRow(ws, row, 4 + i, report);
    ws.getRow(row).height = 22;
    row++;
  }

  // 作業内容の縦書きセル結合の後始末: 7行ぶん使ったので、結合範囲を更新
  // （workContentRows = 4 なら A 列を 4行で結合済み、残り3行は空欄でA列も空にする）
  // 既存実装で問題ない: A列は最初の merge で既に結合済み

  // ============================================================
  // 持ち出し品セクション（行 +3）
  // ============================================================
  // 縦書き G 列
  ws.mergeCells(`G${row}:G${row + 3}`);
  setCell(ws, `G${row}`, '会\n社\n資\n材\n・\n機\n材\n・\n備\n品\n・\n特\n記\n記\n録', {
    border: true, bold: true, align: 'center', fill: HEADER_FILL, fontSize: 9,
  });
  // ヘッダ
  ws.mergeCells(`H${row}:I${row}`);
  setCell(ws, `H${row}`, '持ち出し品', { border: true, bold: true, align: 'center', fill: HEADER_FILL, fontSize: 9 });
  setCell(ws, `J${row}`, '数量', { border: true, bold: true, align: 'center', fill: HEADER_FILL, fontSize: 9 });
  ws.mergeCells(`K${row}:M${row}`);
  setCell(ws, `K${row}`, '借入・返却・消却', { border: true, bold: true, align: 'center', fill: HEADER_FILL, fontSize: 9 });
  writeTradeRow(ws, row, 11, report); // 11行目の職種（金属工）
  row++;
  // 持ち出し品 3行
  const carryOuts = report.carryOutItems ?? [];
  for (let i = 0; i < 3; i++) {
    const it = carryOuts[i];
    ws.mergeCells(`H${row}:I${row}`);
    setCell(ws, `H${row}`, it?.itemName ?? '', { border: true, align: 'left', fontSize: 9 });
    setCell(ws, `J${row}`, it?.quantity ?? '', { border: true, align: 'center', fontSize: 9 });
    ws.mergeCells(`K${row}:M${row}`);
    setCell(ws, `K${row}`, it ? CARRY_OUT_LABEL[it.category] : '', {
      border: true, align: 'center', fontSize: 9,
    });
    writeTradeRow(ws, row, 12 + i, report);
    ws.getRow(row).height = 20;
    row++;
  }

  // ============================================================
  // 打合せ記録（左ブロック） + 個人勤務時間（中央ブロック）
  // ============================================================
  // 打合せ記録 縦書き A列
  ws.mergeCells(`A${row}:A${row + 2}`);
  setCell(ws, `A${row}`, '打\n合\nせ\n記\n録', {
    border: true, bold: true, align: 'center', fill: HEADER_FILL, fontSize: 10,
  });
  // ヘッダ
  setCell(ws, `B${row}`, '相手先', { border: true, bold: true, align: 'center', fill: HEADER_FILL, fontSize: 9 });
  ws.mergeCells(`C${row}:F${row}`);
  setCell(ws, `C${row}`, '項目・対策', { border: true, bold: true, align: 'center', fill: HEADER_FILL, fontSize: 9 });
  // 個人勤務時間 縦書き G列
  ws.mergeCells(`G${row}:G${row + 5}`);
  setCell(ws, `G${row}`, '個\n人\n勤\n務\n時\n間', {
    border: true, bold: true, align: 'center', fill: HEADER_FILL, fontSize: 10,
  });
  // 個人勤務時間 ヘッダ
  ws.mergeCells(`H${row}:M${row}`);
  setCell(ws, `H${row}`, '個人勤務時間', { border: true, bold: true, align: 'center', fill: HEADER_FILL, fontSize: 9 });
  writeTradeRow(ws, row, 15, report);
  row++;

  const meetings = report.meetingRecords ?? [];
  for (let i = 0; i < 2; i++) {
    const m = meetings[i];
    setCell(ws, `B${row}`, m?.partner ?? '', { border: true, align: 'center', fontSize: 10 });
    ws.mergeCells(`C${row}:F${row}`);
    setCell(ws, `C${row}`, m?.topic ?? '', { border: true, align: 'left', fontSize: 10 });
    // 個人勤務時間 行
    const indWorks = report.individualWorkTimes ?? [];
    const iw = indWorks[i];
    ws.mergeCells(`H${row}:M${row}`);
    const iwText = iw
      ? `${iw.name}  ${iw.startTime ?? ''}〜${iw.endTime ?? ''}  ${iw.workContent ?? ''}`
      : '〜';
    setCell(ws, `H${row}`, iwText, { border: true, align: 'left', fontSize: 9 });
    writeTradeRow(ws, row, 16 + i, report);
    ws.getRow(row).height = 22;
    row++;
  }

  // ============================================================
  // 使用機器セクション（左ブロック）+ 個人勤務続き
  // ============================================================
  const machineRows = 5;
  // 使用機器 縦書き A列
  ws.mergeCells(`A${row}:A${row + machineRows}`);
  setCell(ws, `A${row}`, '使\n用\n機\n器', {
    border: true, bold: true, align: 'center', fill: HEADER_FILL, fontSize: 10,
  });
  // ヘッダ
  setCell(ws, `B${row}`, '機械名', { border: true, bold: true, align: 'center', fill: HEADER_FILL, fontSize: 9 });
  setCell(ws, `C${row}`, '自社・リース', { border: true, bold: true, align: 'center', fill: HEADER_FILL, fontSize: 8 });
  setCell(ws, `D${row}`, '規格', { border: true, bold: true, align: 'center', fill: HEADER_FILL, fontSize: 9 });
  setCell(ws, `E${row}`, '運転者名', { border: true, bold: true, align: 'center', fill: HEADER_FILL, fontSize: 9 });
  setCell(ws, `F${row}`, '使用時間', { border: true, bold: true, align: 'center', fill: HEADER_FILL, fontSize: 9 });

  // 個人勤務時間 続き
  const indWorks = report.individualWorkTimes ?? [];
  const iw = indWorks[2];
  ws.mergeCells(`H${row}:M${row}`);
  const iwText = iw
    ? `${iw.name}  ${iw.startTime ?? ''}〜${iw.endTime ?? ''}  ${iw.workContent ?? ''}`
    : '〜';
  setCell(ws, `H${row}`, iwText, { border: true, align: 'left', fontSize: 9 });
  writeTradeRow(ws, row, 18, report);
  row++;

  for (let i = 0; i < machineRows; i++) {
    const machine = (report.machineUsages ?? [])[i];
    setCell(ws, `B${row}`, machine?.machineName ?? '', { border: true, align: 'center', fontSize: 9 });
    setCell(ws, `C${row}`, machine ? OWNERSHIP_LABEL[machine.ownership] : '', {
      border: true, align: 'center', fontSize: 9,
    });
    setCell(ws, `D${row}`, machine?.spec ?? '', { border: true, align: 'center', fontSize: 9 });
    setCell(ws, `E${row}`, machine?.operator ?? '', { border: true, align: 'center', fontSize: 9 });
    setCell(ws, `F${row}`, machine?.usageHours ? `${machine.usageHours}h` : 'h', {
      border: true, align: 'center', fontSize: 9,
    });
    // 個人勤務時間
    const iwI = indWorks[3 + i];
    ws.mergeCells(`H${row}:M${row}`);
    const text = iwI
      ? `${iwI.name}  ${iwI.startTime ?? ''}〜${iwI.endTime ?? ''}  ${iwI.workContent ?? ''}`
      : '〜';
    setCell(ws, `H${row}`, text, { border: true, align: 'left', fontSize: 9 });
    // 稼動人員: i 番目
    const tradeIdx = 19 + i;
    if (tradeIdx < TRADE_TYPES.length) {
      writeTradeRow(ws, row, tradeIdx, report);
    } else {
      writeBlankTradeRow(ws, row);
    }
    ws.getRow(row).height = 20;
    row++;
  }

  // ============================================================
  // 残りの稼働人員行（24職種目以降）+ 合計行 + 労働本日/累計
  // ============================================================
  while (true) {
    const tradeIdx = 19 + machineRows + (row - (workSectionRowStart + 7 + 4 + 3 + machineRows));
    void tradeIdx;
    break;
  }
  // 残り職種を埋める（職種総数 27 + 合計）
  // すでに 0..(19+machineRows-1)= 0..23 を書いた前提。残り 24..26 + 合計 を3行で出す。
  const remainingTrades = [
    TRADE_TYPES[24], // クレーン
    TRADE_TYPES[25], // 解体工
    TRADE_TYPES[26], // 職員
  ];
  for (const trade of remainingTrades) {
    // 左+中央は空欄行
    setCell(ws, `A${row}`, '', { border: true });
    setCell(ws, `B${row}`, '', { border: true });
    setCell(ws, `C${row}`, '', { border: true });
    setCell(ws, `D${row}`, '', { border: true });
    setCell(ws, `E${row}`, '', { border: true });
    setCell(ws, `F${row}`, '', { border: true });
    setCell(ws, `G${row}`, '', { border: true });
    ws.mergeCells(`H${row}:M${row}`);
    setCell(ws, `H${row}`, '', { border: true });
    if (trade) {
      const idx = TRADE_TYPES.indexOf(trade);
      writeTradeRow(ws, row, idx, report);
    }
    ws.getRow(row).height = 18;
    row++;
  }

  // 合計 + 労働時間
  setCell(ws, `A${row}`, '', { border: true });
  ws.mergeCells(`B${row}:G${row}`);
  setCell(ws, `B${row}`, '', { border: true });
  ws.mergeCells(`H${row}:I${row}`);
  setCell(ws, `H${row}`, '労働本日', { border: true, bold: true, align: 'center', fill: HEADER_FILL, fontSize: 9 });
  ws.mergeCells(`J${row}:K${row}`);
  setCell(ws, `J${row}`, report.laborHoursToday !== undefined ? `${report.laborHoursToday}` : '', {
    border: true, align: 'center', fontSize: 11, bold: true,
  });
  setCell(ws, `L${row}`, '時間', { border: true, align: 'center', fontSize: 9 });
  setCell(ws, `M${row}`, '', { border: true });
  setCell(ws, `N${row}`, '合計', { border: true, bold: true, align: 'center', fill: HEADER_FILL, fontSize: 9 });
  setCell(ws, `O${row}`, report.totalWorkerCount, { border: true, align: 'center', fontSize: 11, bold: true });
  setCell(ws, `P${row}`, '', { border: true });
  row++;
  setCell(ws, `A${row}`, '', { border: true });
  ws.mergeCells(`B${row}:G${row}`);
  setCell(ws, `B${row}`, '（注）記入項目のない箇所は該当なし。必ず毎日提出すること。', {
    border: false, align: 'left', fontSize: 9,
  });
  ws.mergeCells(`H${row}:I${row}`);
  setCell(ws, `H${row}`, '労働延時間 累計', { border: true, bold: true, align: 'center', fill: HEADER_FILL, fontSize: 9 });
  ws.mergeCells(`J${row}:K${row}`);
  setCell(ws, `J${row}`, report.laborHoursCumulative !== undefined ? `${report.laborHoursCumulative}` : '', {
    border: true, align: 'center', fontSize: 11, bold: true,
  });
  setCell(ws, `L${row}`, '時間', { border: true, align: 'center', fontSize: 9 });
  setCell(ws, `M${row}`, '', { border: true });
  // 累計の合計
  const cumTotal = computeCumulativeTotal(report);
  setCell(ws, `N${row}`, '累計', { border: true, bold: true, align: 'center', fill: HEADER_FILL, fontSize: 9 });
  ws.mergeCells(`O${row}:P${row}`);
  setCell(ws, `O${row}`, cumTotal, { border: true, align: 'center', fontSize: 11, bold: true });
  row++;

  // 印刷時の縮小
  ws.pageSetup.printArea = `A1:P${row - 1}`;

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * 稼動人員の行を書き込む（N=職種ラベル / O=本日 / P=累計）
 * tradeIdx は TRADE_TYPES 配列のインデックス。
 */
function writeTradeRow(
  ws: ExcelJS.Worksheet,
  row: number,
  tradeIdx: number,
  report: FieldReport
): void {
  if (tradeIdx >= TRADE_TYPES.length) {
    writeBlankTradeRow(ws, row);
    return;
  }
  const trade = TRADE_TYPES[tradeIdx];
  if (!trade) return;
  const tw = report.tradeWorkers?.[trade];
  setCell(ws, `N${row}`, TRADE_LABELS[trade], {
    border: true, align: 'center', fontSize: 9,
  });
  setCell(ws, `O${row}`, tw?.today != null ? `${tw.today.toFixed(1)}` : '', {
    border: true, align: 'right', fontSize: 10,
  });
  setCell(ws, `P${row}`, tw?.cumulative != null ? `${tw.cumulative.toFixed(1)}` : '', {
    border: true, align: 'right', fontSize: 10,
  });
}

function writeBlankTradeRow(ws: ExcelJS.Worksheet, row: number): void {
  setCell(ws, `N${row}`, '', { border: true });
  setCell(ws, `O${row}`, '', { border: true });
  setCell(ws, `P${row}`, '', { border: true });
}

/** 累計の合計を計算 */
function computeCumulativeTotal(report: FieldReport): string {
  const tw = report.tradeWorkers ?? {};
  const sum = TRADE_TYPES.reduce((acc, trade) => {
    const v = tw[trade]?.cumulative ?? 0;
    return acc + v;
  }, 0);
  if (sum === 0) return '';
  return sum.toFixed(1);
}

/** Excel ダウンロード時のファイル名 */
export function buildFieldReportFileName(report: FieldReport): string {
  const safeSiteName = report.siteName.replace(/[\\\\/:*?"<>|]/g, '_');
  return `打合せ指示書_${report.reportDate}_${safeSiteName}.xlsx`;
}
