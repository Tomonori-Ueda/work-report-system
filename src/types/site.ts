import type { Timestamp } from 'firebase/firestore';

/** 現場ドキュメント型 */
export interface Site {
  id: string;
  /** 現場コード */
  siteCode: string;
  /** 現場名 */
  siteName: string;
  /** 担当現場監督のUID配列 */
  supervisorIds: string[];
  /** 終了した現場はfalse */
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** 現場作成時の入力型 */
export interface CreateSiteInput {
  siteCode: string;
  siteName: string;
  supervisorIds?: string[];
}

/** 協力会社ドキュメント型 */
export interface Subcontractor {
  id: string;
  companyName: string;
  contactPerson: string | null;
  unitPrice: number | null;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** 作業内容マスタードキュメント型 */
export interface WorkType {
  id: string;
  /** 作業名 */
  name: string;
  /** カテゴリ（内装・外装・電気等） */
  category: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: Timestamp;
}
