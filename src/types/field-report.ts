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
}

/** 資材搬入記録 */
export interface MaterialDelivery {
  materialName: string;
  /** 数量（単位含む） */
  quantity: string;
}

/** 現場日報ドキュメント型 */
export interface FieldReport {
  id: string;
  /** 入力した現場監督のUID */
  supervisorId: string;
  /** 現場マスターのID */
  siteId: string;
  /** 現場名 */
  siteName: string;
  /** 日付 "YYYY-MM-DD" */
  reportDate: string;
  weather: Weather;
  subcontractorWorks: SubcontractorWork[];
  materialDeliveries: MaterialDelivery[];
  notes: string | null;
  /** 作業員合計（自動集計） */
  totalWorkerCount: number;
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
}
