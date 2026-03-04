import { format, parseISO, formatISO } from 'date-fns';
import { ja } from 'date-fns/locale';

/**
 * 今日の日付を "YYYY-MM-DD" 形式で取得
 */
export function getTodayString(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

/**
 * "YYYY-MM-DD" を "YYYY年MM月DD日（曜日）" 形式に変換
 */
export function formatDateJapanese(dateString: string): string {
  const date = parseISO(dateString);
  return format(date, 'yyyy年MM月dd日（E）', { locale: ja });
}

/**
 * "YYYY-MM-DD" を "MM/DD（曜日）" 形式に変換（コンパクト表示用）
 */
export function formatDateShort(dateString: string): string {
  const date = parseISO(dateString);
  return format(date, 'MM/dd（E）', { locale: ja });
}

/**
 * "YYYY-MM-DD" を "YYYY年MM月" 形式に変換
 */
export function formatYearMonth(dateString: string): string {
  const date = parseISO(dateString);
  return format(date, 'yyyy年MM月', { locale: ja });
}

/**
 * Date を "YYYY-MM-DD" 形式に変換
 */
export function formatDateToISO(date: Date): string {
  return formatISO(date, { representation: 'date' });
}

/**
 * "YYYY-MM-DD" を "YYYY年MM月DD日（曜日）" 形式に変換
 * formatDateJapanese のエイリアス
 */
export function formatDateToJapanese(dateString: string): string {
  return formatDateJapanese(dateString);
}

/**
 * 指定月の初日と末日を "YYYY-MM-DD" 形式で取得
 */
export function getMonthRange(year: number, month: number): {
  startDate: string;
  endDate: string;
} {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { startDate, endDate };
}
