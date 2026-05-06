import type { Timestamp } from 'firebase/firestore';

/** 経費科目 */
export const EXPENSE_CATEGORY = {
  MATERIAL: 'material',       // 材料費
  LABOR: 'labor',             // 労務費
  SUBCONTRACT: 'subcontract', // 外注費
  OTHER: 'other',             // 経費
} as const;

export type ExpenseCategory =
  (typeof EXPENSE_CATEGORY)[keyof typeof EXPENSE_CATEGORY];

/** 天候 */
export const WEATHER = {
  SUNNY: 'sunny',
  CLOUDY: 'cloudy',
  RAINY: 'rainy',
  SNOWY: 'snowy',
} as const;

export type Weather = (typeof WEATHER)[keyof typeof WEATHER];

/** 協力会社の作業記録 */
export interface SubcontractorWork {
  /** 協力会社マスターのID（未選択時はnull） */
  subcontractorId: string | null;
  /** 会社名（マスターまたは手入力） */
  companyName: string;
  workerCount: number;
  workContent: string;
  expenseCategory: ExpenseCategory;
  /** 作業開始時刻 "HH:mm"（任意） */
  startTime?: string | null;
  /** 作業終了時刻 "HH:mm"（任意） */
  endTime?: string | null;
  /**
   * 当該会社から入った作業員の氏名リスト（人名単位の照合用 / Phase 2 追加）。
   * 既存データでは未設定（undefined）。
   */
  workerNames?: string[];
}

/** 資材搬入記録 */
export interface MaterialDelivery {
  materialName: string;
  /** 数量（単位含む） */
  quantity: string;
}

// =============================================================
// Phase 2 追加: 様式7.5-9-02「打合せ指示書・日誌」対応
// =============================================================

/**
 * 工程内検査チェックリスト（11項目）
 * 様式上のチェックボックス。true=検査実施 / false=未実施・該当なし
 */
export interface ProcessInspection {
  foundation_pile: boolean;     // 基礎杭
  rebar: boolean;               // 鉄筋
  formwork: boolean;            // 型枠
  concrete: boolean;            // コンクリート
  roof: boolean;                // 屋根
  exterior_wall: boolean;       // 外壁
  internal_waterproof: boolean; // 内部防水
  electrical: boolean;          // 電気
  plumbing: boolean;            // 給排水衛生
  roof_waterproof: boolean;     // 屋根防水
  interior: boolean;            // 内装
  /** 指摘・是正事項（自由記述） */
  notes: string;
}

/** 受入先（外注工事含む）1件 */
export interface ReceiveItem {
  receiver: string;
  itemName: string;
  quantity: string;
  unit: string;
}

/** 持ち出し品の取扱区分 */
export const CARRY_OUT_CATEGORY = {
  BORROW: 'borrow',   // 借入
  RETURN: 'return',   // 返却
  CONSUME: 'consume', // 消却
} as const;

export type CarryOutCategory =
  (typeof CARRY_OUT_CATEGORY)[keyof typeof CARRY_OUT_CATEGORY];

/** 持ち出し品 1件 */
export interface CarryOutItem {
  itemName: string;
  quantity: string;
  category: CarryOutCategory;
}

/** 打合せ記録 1件 */
export interface MeetingRecord {
  partner: string;
  topic: string;
}

/** 機器の所有区分 */
export const MACHINE_OWNERSHIP = {
  OWN: 'own',
  LEASE: 'lease',
} as const;

export type MachineOwnership =
  (typeof MACHINE_OWNERSHIP)[keyof typeof MACHINE_OWNERSHIP];

/** 使用機器 1件 */
export interface MachineUsage {
  machineName: string;
  ownership: MachineOwnership;
  spec: string;
  operator: string;
  /** 使用時間（"H" や "8:30" など自由形式） */
  usageHours: string;
}

/** 個人勤務時間 1件 */
export interface IndividualWorkTime {
  /** 名前 */
  name: string;
  /** 開始時刻 "HH:mm" */
  startTime: string;
  /** 終了時刻 "HH:mm" */
  endTime: string;
  /** 業務内容 */
  workContent: string;
}

/**
 * 自社作業員 1件（人名単位）
 * Phase 3 の名寄せ照合で使用する。userId が一致する場合は本人日報と突合できる。
 */
export interface OwnEmployee {
  /** users コレクションの uid（マスター選択時）。手入力時は null */
  userId: string | null;
  /** 表示名 */
  displayName: string;
  /** 作業内容 */
  workContent: string;
  /** 開始時刻 "HH:mm"（任意） */
  startTime?: string | null;
  /** 終了時刻 "HH:mm"（任意） */
  endTime?: string | null;
}

/**
 * 様式上の職種27種（順序固定。Excel出力で同順に書き出す）
 */
export const TRADE_TYPES = [
  'tobi',          // 鳶工
  'doko',          // 土工
  'asso',          // 圧送工
  'tekkin',        // 鉄筋工
  'katawaku',      // 型枠工
  'tekko',         // 鉄工
  'gaiheki',       // 外壁工
  'bosui',         // 防水工
  'ishi_tile',     // 石・タイル工
  'zosaku',        // 造作大工
  'yane_bankin',   // 屋根板金工
  'kinzoku',       // 金属工
  'sakan',         // 左官工
  'kagu_mokken',   // 家具木建工
  'kosei_tategu',  // 鋼製建具工
  'glass',         // ガラス工
  'toso',          // 塗装工
  'naiso',         // 内装工
  'shoko',         // 昇降機工
  'denko',         // 電工
  'setsubi',       // 設備工
  'jiban_kairyo',  // 地盤改良工
  'choku_ei',      // 直営
  'sonota',        // その他
  'crane',         // クレーン
  'kaitai',        // 解体工
  'shokuin',       // 職員
] as const;

export type TradeType = (typeof TRADE_TYPES)[number];

/** 職種コード → 表示ラベル */
export const TRADE_LABELS: Record<TradeType, string> = {
  tobi: '鳶工',
  doko: '土工',
  asso: '圧送工',
  tekkin: '鉄筋工',
  katawaku: '型枠工',
  tekko: '鉄工',
  gaiheki: '外壁工',
  bosui: '防水工',
  ishi_tile: '石・タイル工',
  zosaku: '造作大工',
  yane_bankin: '屋根板金工',
  kinzoku: '金属工',
  sakan: '左官工',
  kagu_mokken: '家具木建工',
  kosei_tategu: '鋼製建具工',
  glass: 'ガラス工',
  toso: '塗装工',
  naiso: '内装工',
  shoko: '昇降機工',
  denko: '電工',
  setsubi: '設備工',
  jiban_kairyo: '地盤改良工',
  choku_ei: '直営',
  sonota: 'その他',
  crane: 'クレーン',
  kaitai: '解体工',
  shokuin: '職員',
};

/** 職種別人員（本日 + 累計） */
export interface TradeWorkers {
  today: number;
  cumulative: number;
}

/** 工程内検査の空デフォルト */
export function createEmptyProcessInspection(): ProcessInspection {
  return {
    foundation_pile: false,
    rebar: false,
    formwork: false,
    concrete: false,
    roof: false,
    exterior_wall: false,
    internal_waterproof: false,
    electrical: false,
    plumbing: false,
    roof_waterproof: false,
    interior: false,
    notes: '',
  };
}

/** 現場日報ドキュメント型 */
export interface FieldReport {
  id: string;
  /** 入力した現場監督のUID */
  supervisorId: string;
  /** 現場マスターのID */
  siteId: string;
  /** 現場名（マスター名） */
  siteName: string;
  /** 日付 "YYYY-MM-DD" */
  reportDate: string;
  weather: Weather;
  subcontractorWorks: SubcontractorWork[];
  materialDeliveries: MaterialDelivery[];
  notes: string | null;
  /** 作業員合計（自動集計） */
  totalWorkerCount: number;

  // === Phase 2 追加（既存データ非破壊のためすべて optional） ===
  /** 工事名（siteName とは別の正式工事名 / 例: 「(軽井沢)小峯様別荘新築工事」） */
  projectName?: string;
  /** 現場責任者氏名（自由記述） */
  siteResponsible?: string;
  /** 監督勤務時間 開始 "HH:mm" */
  supervisorWorkStart?: string;
  /** 監督勤務時間 終了 "HH:mm" */
  supervisorWorkEnd?: string;
  /** 現場管理 開始時刻 "HH:mm"（様式の「作業時間」） */
  workTimeStart?: string;
  /** 工程内検査 + 指摘事項 */
  processInspection?: ProcessInspection;
  /** 受入先（外注工事含む） */
  receiveItems?: ReceiveItem[];
  /** 持ち出し品 */
  carryOutItems?: CarryOutItem[];
  /** 打合せ記録 */
  meetingRecords?: MeetingRecord[];
  /** 使用機器 */
  machineUsages?: MachineUsage[];
  /** 個人勤務時間 */
  individualWorkTimes?: IndividualWorkTime[];
  /** 自社作業員（人名単位、Phase 3 名寄せ用） */
  ownEmployees?: OwnEmployee[];
  /** 職種別稼働人員（27職種、未設定の slot は欠落でOK） */
  tradeWorkers?: Partial<Record<TradeType, TradeWorkers>>;
  /** 労働本日時間（合計） */
  laborHoursToday?: number;
  /** 労働累計時間 */
  laborHoursCumulative?: number;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** 現場日報作成時の入力型 */
export interface CreateFieldReportInput {
  siteId: string;
  siteName: string;
  reportDate: string;
  weather: Weather;
  subcontractorWorks: SubcontractorWork[];
  materialDeliveries: MaterialDelivery[];
  notes?: string;

  // === Phase 2 追加 ===
  projectName?: string;
  siteResponsible?: string;
  supervisorWorkStart?: string;
  supervisorWorkEnd?: string;
  workTimeStart?: string;
  processInspection?: ProcessInspection;
  receiveItems?: ReceiveItem[];
  carryOutItems?: CarryOutItem[];
  meetingRecords?: MeetingRecord[];
  machineUsages?: MachineUsage[];
  individualWorkTimes?: IndividualWorkTime[];
  ownEmployees?: OwnEmployee[];
  tradeWorkers?: Partial<Record<TradeType, TradeWorkers>>;
  laborHoursToday?: number;
  laborHoursCumulative?: number;
}
