'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useCreateFieldReport, useUpdateFieldReport, useFieldReportCumulative } from '@/hooks/use-field-reports';
import { getIdToken } from '@/lib/firebase/auth';
import { formatDateToISO } from '@/lib/utils/date';
import {
  WEATHER, CARRY_OUT_CATEGORY, MACHINE_OWNERSHIP,
  TRADE_TYPES, TRADE_LABELS,
  createEmptyProcessInspection,
  type Weather, type FieldReport, type TradeType,
} from '@/types/field-report';
import type { CreateFieldReportInput } from '@/types/field-report';

// --- 型定義 ---
interface SiteMaster { id: string; siteName: string; }
interface SubcontractorMaster { id: string; companyName: string; }
interface UserMaster { id: string; displayName: string; }

// --- 天候ラベル ---
const WEATHER_LABELS: Record<Weather, string> = {
  sunny: '晴れ', cloudy: '曇り', rainy: '雨', snowy: '雪',
};
const WEATHER_OPTIONS: Weather[] = ['sunny', 'cloudy', 'rainy', 'snowy'];

// --- ユーティリティ: 曜日取得 ---
function getYoubi(dateStr: string): string {
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? '' : (days[d.getDay()] ?? '');
}

// --- CSS (Excel風テーブル) ---
const S = {
  wrap: 'bg-white border border-gray-400 max-w-[1100px] mx-auto text-[11px] font-sans',
  titleBar: 'bg-[#1B3A6B] text-white px-3 py-1.5 flex justify-between items-center',
  th: 'bg-[#C5D9F1] text-[#1B3A6B] text-[10px] font-medium text-center whitespace-nowrap border border-gray-300 px-1 py-0.5',
  lh: 'bg-[#D9E8F8] text-[#1B3A6B] text-[10px] font-medium text-center whitespace-nowrap border border-gray-300 px-1 py-0.5',
  note: 'bg-[#F2F2F2] text-gray-500 text-[10px] text-center border border-gray-300 px-1 py-0.5',
  total: 'bg-[#1B3A6B] text-white text-[10px] font-medium text-center border border-gray-300 px-1 py-0.5',
  sum: 'bg-[#FFF2CC] font-medium text-center text-xs border border-gray-300 px-1 py-0.5',
  td: 'border border-gray-300 px-1 py-0.5',
  inp: 'border-0 bg-transparent text-[11px] w-full outline-none text-center focus:bg-blue-50 h-6',
  inpL: 'border-0 bg-transparent text-[11px] w-full outline-none text-left focus:bg-blue-50 h-6',
  sel: 'border-0 bg-transparent text-[11px] w-full outline-none text-center focus:bg-blue-50 h-6',
  addBtn: 'text-[10px] text-[#1B3A6B] border border-dashed border-[#1B3A6B] bg-white rounded px-2 py-0.5 cursor-pointer hover:bg-blue-50',
  footer: 'flex justify-between items-center gap-2 px-3 py-2 border-t border-gray-400 bg-gray-100',
} as const;

// --- メインコンポーネント ---
interface Props {
  defaultReport?: FieldReport;
  reportId?: string;
}

export function FieldReportTableForm({ defaultReport, reportId }: Props) {
  const router = useRouter();
  const createMut = useCreateFieldReport();
  const updateMut = useUpdateFieldReport();

  // マスターデータ
  const [sites, setSites] = useState<SiteMaster[]>([]);
  const [subs, setSubs] = useState<SubcontractorMaster[]>([]);
  const [users, setUsers] = useState<UserMaster[]>([]);

  // 基本情報
  const [reportDate, setReportDate] = useState(defaultReport?.reportDate ?? formatDateToISO(new Date()));
  const [weather, setWeather] = useState<Weather>(defaultReport?.weather ?? 'sunny');
  const [siteId, setSiteId] = useState(defaultReport?.siteId ?? '');
  const [siteName, setSiteName] = useState(defaultReport?.siteName ?? '');
  const [projectName, setProjectName] = useState(defaultReport?.projectName ?? '');
  const [siteResponsible, setSiteResponsible] = useState(defaultReport?.siteResponsible ?? '');
  const [workStart, setWorkStart] = useState(defaultReport?.supervisorWorkStart ?? '');
  const [workEnd, setWorkEnd] = useState(defaultReport?.supervisorWorkEnd ?? '');
  const [workTimeStart, setWorkTimeStart] = useState(defaultReport?.workTimeStart ?? '');
  const [notes, setNotes] = useState(defaultReport?.notes ?? '');

  // 受入品
  const [receives, setReceives] = useState(defaultReport?.receiveItems ?? [{ receiver: '', itemName: '', quantity: '', unit: '' }]);
  // 協力会社
  const [subWorks, setSubWorks] = useState(defaultReport?.subcontractorWorks ?? [
    { subcontractorId: null, companyName: '', workerCount: 0, workContent: '', expenseCategory: 'labor' as const, workerNames: [] },
  ]);
  // 自社作業員
  const [ownEmps, setOwnEmps] = useState(defaultReport?.ownEmployees ?? []);
  // 職種別稼働人員
  const [tradeToday, setTradeToday] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const t of TRADE_TYPES) init[t] = defaultReport?.tradeWorkers?.[t]?.today ?? 0;
    return init;
  });
  // 工程内検査
  const [inspection, setInspection] = useState(defaultReport?.processInspection ?? createEmptyProcessInspection());
  // 打合せ記録
  const [meetings, setMeetings] = useState(defaultReport?.meetingRecords ?? [{ partner: '', topic: '' }]);
  // 持ち出し品
  const [carryOuts, setCarryOuts] = useState(defaultReport?.carryOutItems ?? []);
  // 使用機器
  const [machines, setMachines] = useState(defaultReport?.machineUsages ?? []);
  // 労働時間
  const [laborToday, setLaborToday] = useState(defaultReport?.laborHoursToday ?? 0);
  // 特記事項
  const [specialNotes, setSpecialNotes] = useState('');

  // 累計データ取得
  const { data: cumData } = useFieldReportCumulative(siteId || undefined);
  const cumTrade = cumData?.tradeWorkers ?? {};
  const cumLabor = cumData?.laborHoursCumulative ?? 0;

  // 合計計算
  const todayTotal = useMemo(() => Object.values(tradeToday).reduce((s, v) => s + (v || 0), 0), [tradeToday]);
  const cumTotal = useMemo(() => {
    let s = 0;
    for (const t of TRADE_TYPES) s += (cumTrade[t] ?? 0) + (tradeToday[t] ?? 0);
    return s;
  }, [cumTrade, tradeToday]);

  // マスター取得
  useEffect(() => {
    const load = async () => {
      const token = await getIdToken();
      const h: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      await Promise.allSettled([
        fetch('/api/masters/sites?active=true', { headers: h }).then(r => r.ok ? r.json() : null)
          .then((j: unknown) => { const t = j as { data?: { sites?: SiteMaster[] } } | null; if (t?.data?.sites) setSites(t.data.sites); }),
        fetch('/api/masters/subcontractors?active=true', { headers: h }).then(r => r.ok ? r.json() : null)
          .then((j: unknown) => { const t = j as { data?: { subcontractors?: SubcontractorMaster[] } } | null; if (t?.data?.subcontractors) setSubs(t.data.subcontractors); }),
        fetch('/api/users?active=true', { headers: h }).then(r => r.ok ? r.json() : null)
          .then((j: unknown) => { const t = j as { data?: { users?: UserMaster[] } } | null; if (t?.data?.users) setUsers(t.data.users); }),
      ]);
    };
    void load();
  }, []);

  // 現場選択時に名前を同期
  function handleSiteChange(id: string) {
    setSiteId(id);
    const found = sites.find(s => s.id === id);
    if (found) setSiteName(found.siteName);
  }

  // 提出処理
  async function handleSubmit() {
    if (!siteId || !siteName) { toast.error('現場を選択してください'); return; }
    if (subWorks.length === 0 || !subWorks[0]?.companyName) { toast.error('協力会社を1件以上入力してください'); return; }

    const tw: CreateFieldReportInput['tradeWorkers'] = {};
    for (const t of TRADE_TYPES) {
      const today = tradeToday[t] ?? 0;
      const cum = (cumTrade[t] ?? 0) + today;
      if (today > 0 || cum > 0) tw[t] = { today, cumulative: cum };
    }

    const payload: CreateFieldReportInput = {
      siteId, siteName, reportDate, weather,
      subcontractorWorks: subWorks.filter(w => w.companyName.trim()),
      materialDeliveries: [],
      notes: notes || undefined,
      projectName: projectName || undefined,
      siteResponsible: siteResponsible || undefined,
      supervisorWorkStart: workStart || undefined,
      supervisorWorkEnd: workEnd || undefined,
      workTimeStart: workTimeStart || undefined,
      processInspection: inspection,
      receiveItems: receives.filter(r => r.receiver.trim() || r.itemName.trim()),
      meetingRecords: meetings.filter(m => m.partner.trim() || m.topic.trim()),
      carryOutItems: carryOuts.filter(c => c.itemName.trim()),
      machineUsages: machines.filter(m => m.machineName.trim()),
      ownEmployees: ownEmps.filter(e => e.displayName.trim()),
      tradeWorkers: tw,
      laborHoursToday: laborToday || undefined,
      laborHoursCumulative: cumLabor + laborToday || undefined,
    };

    try {
      if (reportId) {
        await updateMut.mutateAsync({ id: reportId, data: payload });
        toast.success('更新しました');
      } else {
        await createMut.mutateAsync(payload);
        toast.success('保存しました');
      }
      router.push('/field-report/history');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '保存に失敗しました');
    }
  }

  const isSubmitting = createMut.isPending || updateMut.isPending;

  // 職種を2分割（左: 受入品テーブル右半分、右: 協力会社テーブル右半分）
  const tradeLeft = TRADE_TYPES.slice(0, 3);
  const tradeRight = TRADE_TYPES.slice(3, 8);
  const tradeBottom = TRADE_TYPES.slice(8);

  return (
    <div className={S.wrap}>
      {/* タイトルバー */}
      <div className={S.titleBar}>
        <h1 className="text-sm font-medium tracking-wide">打合せ指示書・日誌</h1>
        <small className="text-[10px] opacity-80">一括入力モード</small>
      </div>

      {/* 基本情報 */}
      <table className="w-full border-collapse"><tbody>
        <tr>
          <td className={S.lh} style={{ width: 70 }}>日付</td>
          <td className={S.td} style={{ width: 130 }}>
            <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} className={S.inp} />
          </td>
          <td className={S.lh} style={{ width: 36 }}>曜日</td>
          <td className={S.td} style={{ width: 28 }}>
            <input value={getYoubi(reportDate)} readOnly className={`${S.inp} text-gray-500`} />
          </td>
          <td className={S.lh} style={{ width: 36 }}>天候</td>
          <td className={S.td} style={{ width: 80 }}>
            <select value={weather} onChange={e => setWeather(e.target.value as Weather)} className={S.sel}>
              {WEATHER_OPTIONS.map(w => <option key={w} value={w}>{WEATHER_LABELS[w]}</option>)}
            </select>
          </td>
          <td className={S.lh} style={{ width: 60 }}>工事名</td>
          <td className={S.td}>
            <select value={siteId} onChange={e => handleSiteChange(e.target.value)} className={S.sel + ' !text-left'}>
              <option value="">現場を選択</option>
              {sites.map(s => <option key={s.id} value={s.id}>{s.siteName}</option>)}
            </select>
          </td>
        </tr>
        <tr>
          <td className={S.lh}>勤務時間</td>
          <td className={S.td}>
            <input type="time" value={workStart} onChange={e => setWorkStart(e.target.value)} className={S.inp} />
          </td>
          <td className={S.note}>〜</td>
          <td className={S.td} colSpan={2}>
            <input type="time" value={workEnd} onChange={e => setWorkEnd(e.target.value)} className={S.inp} />
          </td>
          <td className={S.lh}>作業時間</td>
          <td className={S.td}>
            <input type="time" value={workTimeStart} onChange={e => setWorkTimeStart(e.target.value)} className={S.inp} />
          </td>
          <td className={S.td}>
            <input value={siteResponsible} onChange={e => setSiteResponsible(e.target.value)} placeholder="現場責任者" className={S.inpL} />
          </td>
        </tr>
      </tbody></table>

      {/* 稼働人員（全27職種） */}
      <table className="w-full border-collapse border-t border-gray-400"><tbody>
        <tr><th className={S.th} colSpan={3}>稼 働 人 員</th></tr>
        <tr><th className={S.th}>職種</th><th className={S.th} style={{ width: 60 }}>本日</th><th className={S.th} style={{ width: 60 }}>累計</th></tr>
        {TRADE_TYPES.map(t => (
          <tr key={t}>
            <td className={S.lh}>{TRADE_LABELS[t]}</td>
            <td className={S.td}>
              <input type="number" min={0} value={tradeToday[t] || ''} placeholder="0"
                onChange={e => setTradeToday(p => ({ ...p, [t]: parseInt(e.target.value) || 0 }))} className={S.inp} />
            </td>
            <td className={S.note}>{(cumTrade[t] ?? 0) + (tradeToday[t] ?? 0)}</td>
          </tr>
        ))}
        <tr>
          <td className={S.total}>合計</td>
          <td className={S.sum}>{todayTotal}</td>
          <td className={S.note} style={{ fontWeight: 500 }}>{cumTotal}</td>
        </tr>
        <tr>
          <td className={S.lh}>労働時間</td>
          <td className={S.td}>
            <input type="number" min={0} value={laborToday || ''} placeholder="0"
              onChange={e => setLaborToday(parseInt(e.target.value) || 0)} className={S.inp} />
          </td>
          <td className={S.note}>{cumLabor + laborToday}</td>
        </tr>
      </tbody></table>

      {/* 協力会社 */}
      <table className="w-full border-collapse border-t border-gray-400"><tbody>
        <tr>
          <th className={S.th}>協力会社</th><th className={S.th} style={{ width: 40 }}>人員</th>
          <th className={S.th}>作業内容</th><th className={S.th} style={{ width: 80 }}>安全指示</th>
        </tr>
        {subWorks.map((w, i) => (
          <tr key={i}>
            <td className={S.td}>
              <select value={w.subcontractorId ?? ''} onChange={e => {
                const arr = [...subWorks];
                const found = subs.find(s => s.id === e.target.value);
                arr[i] = { ...w, subcontractorId: e.target.value || null, companyName: found?.companyName ?? e.target.value };
                setSubWorks(arr);
              }} className={S.sel + ' !text-left'}>
                <option value="">選択/手入力</option>
                {subs.map(s => <option key={s.id} value={s.id}>{s.companyName}</option>)}
              </select>
            </td>
            <td className={S.td}>
              <input type="number" min={0} value={w.workerCount || ''} placeholder="0"
                onChange={e => { const arr = [...subWorks]; arr[i] = { ...w, workerCount: parseInt(e.target.value) || 0 }; setSubWorks(arr); }} className={S.inp} />
            </td>
            <td className={S.td}>
              <input value={w.workContent} placeholder="作業内容"
                onChange={e => { const arr = [...subWorks]; arr[i] = { ...w, workContent: e.target.value }; setSubWorks(arr); }} className={S.inpL} />
            </td>
            <td className={S.td}>
              <input className={S.inpL} placeholder="" />
            </td>
          </tr>
        ))}
        <tr><td colSpan={4} className={S.note}>
          <button className={S.addBtn} onClick={() => setSubWorks([...subWorks, { subcontractorId: null, companyName: '', workerCount: 0, workContent: '', expenseCategory: 'labor', workerNames: [] }])}>+ 行追加</button>
        </td></tr>
      </tbody></table>

      {/* 自社作業員 */}
      <table className="w-full border-collapse border-t border-gray-400"><tbody>
        <tr><th className={S.th} colSpan={3}>自社作業員（マスターから選択）</th></tr>
        <tr><th className={S.th}>氏名</th><th className={S.th}>作業内容</th><th className={S.th} style={{ width: 60 }}>削除</th></tr>
        {ownEmps.map((e, i) => (
          <tr key={i}>
            <td className={S.td}>
              <select value={e.userId ?? ''} onChange={ev => {
                const arr = [...ownEmps];
                const found = users.find(u => u.id === ev.target.value);
                arr[i] = { ...e, userId: ev.target.value || null, displayName: found?.displayName ?? '' };
                setOwnEmps(arr);
              }} className={S.sel + ' !text-left'}>
                <option value="">選択</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.displayName}</option>)}
              </select>
            </td>
            <td className={S.td}>
              <input value={e.workContent} onChange={ev => { const arr = [...ownEmps]; arr[i] = { ...e, workContent: ev.target.value }; setOwnEmps(arr); }} className={S.inpL} placeholder="作業内容" />
            </td>
            <td className={S.td + ' text-center'}>
              <button className="text-red-400 hover:text-red-600 text-xs" onClick={() => setOwnEmps(ownEmps.filter((_, j) => j !== i))}>×</button>
            </td>
          </tr>
        ))}
        <tr><td colSpan={3} className={S.note}>
          <button className={S.addBtn} onClick={() => setOwnEmps([...ownEmps, { userId: null, displayName: '', workContent: '', startTime: null, endTime: null }])}>+ 作業員追加</button>
        </td></tr>
      </tbody></table>

      {/* 工程内検査 + 指摘是正 */}
      <table className="w-full border-collapse border-t border-gray-400"><tbody>
        <tr><th className={S.th} style={{ width: '50%', textAlign: 'left', paddingLeft: 8 }}>工程内検査</th><th className={S.th} style={{ textAlign: 'left', paddingLeft: 8 }}>指摘・是正事項</th></tr>
        <tr>
          <td className={S.td + ' p-2 align-top'}>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {([['foundation_pile','基礎杭'],['electrical','電気'],['rebar','鉄筋'],['plumbing','給排水衛生'],['formwork','型枠'],['concrete','コンクリート'],['roof','屋根'],['roof_waterproof','屋根防水'],['exterior_wall','外壁'],['interior','内装'],['internal_waterproof','内部防水']] as const).map(([key, label]) => (
                <label key={key} className="inline-flex items-center gap-1 text-[10px] cursor-pointer">
                  <input type="checkbox" className="w-3 h-3" checked={inspection[key] as boolean}
                    onChange={ev => setInspection({ ...inspection, [key]: ev.target.checked })} />
                  {label}
                </label>
              ))}
            </div>
          </td>
          <td className={S.td + ' align-top p-1'}>
            <textarea value={inspection.notes} onChange={e => setInspection({ ...inspection, notes: e.target.value })}
              className="w-full h-14 border-0 bg-transparent text-[11px] resize-none outline-none" placeholder="指摘・是正事項を入力..." />
          </td>
        </tr>
      </tbody></table>

      {/* 打合せ記録 */}
      <table className="w-full border-collapse border-t border-gray-400"><tbody>
        <tr><th className={S.th} style={{ width: '22%' }}>相手先（打合せ記録）</th><th className={S.th}>項目・対策</th></tr>
        {meetings.map((m, i) => (
          <tr key={i}>
            <td className={S.td}><input value={m.partner} onChange={e => { const a = [...meetings]; a[i] = { ...m, partner: e.target.value }; setMeetings(a); }} className={S.inpL} placeholder="相手先" /></td>
            <td className={S.td}><input value={m.topic} onChange={e => { const a = [...meetings]; a[i] = { ...m, topic: e.target.value }; setMeetings(a); }} className={S.inpL} placeholder="項目・対策を入力" /></td>
          </tr>
        ))}
        <tr><td colSpan={2} className={S.note}><button className={S.addBtn} onClick={() => setMeetings([...meetings, { partner: '', topic: '' }])}>+ 行追加</button></td></tr>
      </tbody></table>

      {/* 特記記録 */}
      <table className="w-full border-collapse border-t border-gray-400"><tbody>
        <tr><th className={S.th} style={{ textAlign: 'left', paddingLeft: 8 }}>会社資材・機材・備品・特記記録</th></tr>
        <tr><td className={S.td + ' p-1'}>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            className="w-full h-8 border-0 bg-transparent text-[11px] resize-none outline-none" placeholder="特記事項を入力..." />
        </td></tr>
      </tbody></table>

      {/* フッター */}
      <div className={S.footer}>
        <span className="text-[10px] text-gray-400">（注）記入項目のない箇所は該当なし。必ず毎日提出すること。</span>
        <div className="flex gap-2">
          <button onClick={handleSubmit} disabled={isSubmitting}
            className="text-[11px] px-4 py-1 cursor-pointer border border-[#1B3A6B] rounded bg-[#1B3A6B] text-white hover:bg-[#254F8A] disabled:opacity-50">
            {isSubmitting ? '保存中...' : reportId ? '更新する' : '提出する'}
          </button>
        </div>
      </div>
    </div>
  );
}
