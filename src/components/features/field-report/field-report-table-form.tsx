'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  useCreateFieldReport,
  useFieldReportCumulative,
  useUpdateFieldReport,
} from '@/hooks/use-field-reports';
import { getIdToken } from '@/lib/firebase/auth';
import { formatDateToISO } from '@/lib/utils/date';
import {
  CARRY_OUT_CATEGORY,
  EXPENSE_CATEGORY,
  MACHINE_OWNERSHIP,
  TRADE_LABELS,
  type CarryOutItem,
  type FieldReport,
  type MachineUsage,
  type MeetingRecord,
  type ProcessInspection,
  type ReceiveItem,
  type SubcontractorWork,
  type TradeType,
  type Weather,
} from '@/types/field-report';
import type { CreateFieldReportInput } from '@/types/field-report';
import { createEmptyProcessInspection } from '@/types/field-report';

interface SiteMaster {
  id: string;
  siteName: string;
}

interface Props {
  defaultReport?: FieldReport;
  reportId?: string;
}

const WEATHER_OPTIONS: Array<{ value: Weather; label: string }> = [
  { value: 'sunny', label: '晴' },
  { value: 'cloudy', label: '晴/曇' },
  { value: 'cloudy', label: '曇' },
  { value: 'rainy', label: '雨' },
  { value: 'snowy', label: '雪' },
];

const RECEIVE_UNITS = ['式', '枚', '個', '本', 'm', 'm²'];

const TOP_TRADES: TradeType[] = ['zosaku', 'yane_bankin', 'denko'];
const WORK_TRADES: TradeType[] = ['glass', 'setsubi', 'naiso', 'shokuin'];
const DISPLAY_TRADES = [...TOP_TRADES, ...WORK_TRADES];
const TOP_TRADE_BY_ROW: Record<number, TradeType> = {
  0: 'zosaku',
  1: 'yane_bankin',
  2: 'denko',
};
const WORK_TRADE_BY_ROW: Record<number, TradeType> = {
  0: 'glass',
  1: 'setsubi',
  2: 'naiso',
  3: 'shokuin',
};

const INSPECTION_ITEMS: Array<[keyof ProcessInspection, string]> = [
  ['foundation_pile', '基礎杭'],
  ['electrical', '電気'],
  ['rebar', '鉄筋'],
  ['plumbing', '給排水衛生'],
  ['formwork', '型枠'],
  ['concrete', 'コンクリート'],
  ['roof', '屋根'],
  ['roof_waterproof', '屋根防水'],
  ['exterior_wall', '外壁'],
  ['interior', '内装'],
  ['internal_waterproof', '内部防水'],
];

function emptyReceive(): ReceiveItem {
  return { receiver: '', itemName: '', quantity: '', unit: '式' };
}

function emptySubWork(): SubcontractorWork {
  return {
    subcontractorId: null,
    companyName: '',
    workerCount: 0,
    workContent: '',
    expenseCategory: EXPENSE_CATEGORY.LABOR,
    workerNames: [],
  };
}

function emptyMeeting(): MeetingRecord {
  return { partner: '', topic: '' };
}

function emptyCarryOut(): CarryOutItem {
  return {
    itemName: '',
    quantity: '',
    category: CARRY_OUT_CATEGORY.BORROW,
  };
}

function emptyMachine(): MachineUsage {
  return {
    machineName: '',
    ownership: MACHINE_OWNERSHIP.OWN,
    spec: '',
    operator: '',
    usageHours: '',
  };
}

function padRows<T>(rows: T[], min: number, create: () => T): T[] {
  const next = [...rows];
  while (next.length < min) next.push(create());
  return next;
}

function getDateParts(dateStr: string) {
  const parts = dateStr.split('-').map(Number);
  const yearRaw = parts[0];
  const monthRaw = parts[1];
  const dayRaw = parts[2];
  const now = new Date();
  const year =
    typeof yearRaw === 'number' && Number.isFinite(yearRaw)
      ? yearRaw
      : now.getFullYear();
  const month =
    typeof monthRaw === 'number' && Number.isFinite(monthRaw)
      ? monthRaw
      : now.getMonth() + 1;
  const day =
    typeof dayRaw === 'number' && Number.isFinite(dayRaw)
      ? dayRaw
      : now.getDate();
  return { year, reiwa: Math.max(1, year - 2018), month, day };
}

function toIsoDateFromParts(reiwa: number, month: number, day: number) {
  const year = 2018 + Math.max(1, reiwa);
  return formatDateToISO(new Date(year, month - 1, day));
}

function getYoubi(dateStr: string): string {
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? '' : (days[d.getDay()] ?? '');
}

function parseNumber(value: string): number {
  return Number.parseInt(value, 10) || 0;
}

function normalizeTime(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '--:--') return undefined;
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return trimmed;
  const hour = match[1] ?? '';
  const minute = match[2] ?? '';
  return `${hour.padStart(2, '0')}:${minute}`;
}

export function FieldReportTableForm({ defaultReport, reportId }: Props) {
  const router = useRouter();
  const createMut = useCreateFieldReport();
  const updateMut = useUpdateFieldReport();

  const [sites, setSites] = useState<SiteMaster[]>([]);
  const [reportDate, setReportDate] = useState(
    defaultReport?.reportDate ?? formatDateToISO(new Date())
  );
  const [weather, setWeather] = useState<Weather>(
    defaultReport?.weather ?? 'sunny'
  );
  const [siteId, setSiteId] = useState(defaultReport?.siteId ?? '');
  const [siteName, setSiteName] = useState(defaultReport?.siteName ?? '');
  const [siteResponsible, setSiteResponsible] = useState(
    defaultReport?.siteResponsible ?? ''
  );
  const [workStart, setWorkStart] = useState(
    defaultReport?.supervisorWorkStart ?? ''
  );
  const [workEnd, setWorkEnd] = useState(
    defaultReport?.supervisorWorkEnd ?? ''
  );
  const [workTimeStart, setWorkTimeStart] = useState(
    defaultReport?.workTimeStart ?? ''
  );
  const [receives, setReceives] = useState<ReceiveItem[]>(() =>
    padRows(defaultReport?.receiveItems ?? [], 2, emptyReceive)
  );
  const [subWorks, setSubWorks] = useState<SubcontractorWork[]>(() =>
    padRows(defaultReport?.subcontractorWorks ?? [], 5, emptySubWork)
  );
  const [tradeToday, setTradeToday] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const trade of DISPLAY_TRADES) {
      init[trade] = defaultReport?.tradeWorkers?.[trade]?.today ?? 0;
    }
    return init;
  });
  const [inspection, setInspection] = useState(
    defaultReport?.processInspection ?? createEmptyProcessInspection()
  );
  const [meetings, setMeetings] = useState<MeetingRecord[]>(() =>
    padRows(defaultReport?.meetingRecords ?? [], 2, emptyMeeting)
  );
  const [carryOuts, setCarryOuts] = useState<CarryOutItem[]>(() =>
    padRows(defaultReport?.carryOutItems ?? [], 1, emptyCarryOut)
  );
  const [machines, setMachines] = useState<MachineUsage[]>(() =>
    padRows(defaultReport?.machineUsages ?? [], 1, emptyMachine)
  );
  const [laborToday, setLaborToday] = useState(
    defaultReport?.laborHoursToday ?? 0
  );
  const [notes, setNotes] = useState(defaultReport?.notes ?? '');

  const dateParts = useMemo(() => getDateParts(reportDate), [reportDate]);
  const { data: cumData } = useFieldReportCumulative(siteId || undefined);
  const cumTrade = cumData?.tradeWorkers ?? {};
  const cumLabor = cumData?.laborHoursCumulative ?? 0;
  const todayTotal = DISPLAY_TRADES.reduce(
    (sum, trade) => sum + (tradeToday[trade] ?? 0),
    0
  );
  const cumTotal = DISPLAY_TRADES.reduce(
    (sum, trade) => sum + (cumTrade[trade] ?? 0) + (tradeToday[trade] ?? 0),
    0
  );
  const isSubmitting = createMut.isPending || updateMut.isPending;

  useEffect(() => {
    const load = async () => {
      const token = await getIdToken();
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await fetch('/api/masters/sites?active=true', { headers });
      if (!response.ok) return;
      const json = (await response.json()) as {
        data?: { sites?: SiteMaster[] };
      };
      if (json.data?.sites) setSites(json.data.sites);
    };
    void load();
  }, []);

  useEffect(() => {
    const draft = {
      reportDate,
      weather,
      siteId,
      siteName,
      siteResponsible,
      workStart,
      workEnd,
      workTimeStart,
      receives,
      subWorks,
      tradeToday,
      inspection,
      meetings,
      carryOuts,
      machines,
      laborToday,
      notes,
    };
    window.localStorage.setItem('field-report-table-draft', JSON.stringify(draft));
  }, [
    reportDate,
    weather,
    siteId,
    siteName,
    siteResponsible,
    workStart,
    workEnd,
    workTimeStart,
    receives,
    subWorks,
    tradeToday,
    inspection,
    meetings,
    carryOuts,
    machines,
    laborToday,
    notes,
  ]);

  function handleDatePartChange(
    part: 'reiwa' | 'month' | 'day',
    value: string
  ) {
    const next = {
      ...dateParts,
      [part]: Math.max(1, parseNumber(value)),
    };
    setReportDate(toIsoDateFromParts(next.reiwa, next.month, next.day));
  }

  function handleSiteChange(id: string) {
    setSiteId(id);
    const found = sites.find((site) => site.id === id);
    setSiteName(found?.siteName ?? '');
  }

  function updateReceive(index: number, patch: Partial<ReceiveItem>) {
    setReceives((current) => {
      const next = [...current];
      next[index] = { ...(next[index] ?? emptyReceive()), ...patch };
      return next;
    });
  }

  function updateSubWork(index: number, patch: Partial<SubcontractorWork>) {
    setSubWorks((current) => {
      const next = [...current];
      next[index] = { ...(next[index] ?? emptySubWork()), ...patch };
      return next;
    });
  }

  function updateMeeting(index: number, patch: Partial<MeetingRecord>) {
    setMeetings((current) => {
      const next = [...current];
      next[index] = { ...(next[index] ?? emptyMeeting()), ...patch };
      return next;
    });
  }

  function updateCarryOut(index: number, patch: Partial<CarryOutItem>) {
    setCarryOuts((current) => {
      const next = [...current];
      next[index] = { ...(next[index] ?? emptyCarryOut()), ...patch };
      return next;
    });
  }

  function updateMachine(index: number, patch: Partial<MachineUsage>) {
    setMachines((current) => {
      const next = [...current];
      next[index] = { ...(next[index] ?? emptyMachine()), ...patch };
      return next;
    });
  }

  function handleSaveDraft() {
    toast.success('一時保存しました');
  }

  async function handleSubmit() {
    if (!siteId || !siteName) {
      toast.error('現場を選択してください');
      return;
    }
    const filteredWorks = subWorks.filter(
      (work) => work.companyName.trim() && work.workContent.trim()
    );
    if (filteredWorks.length === 0) {
      toast.error('協力会社と作業内容を1件以上入力してください');
      return;
    }

    const tradeWorkers: CreateFieldReportInput['tradeWorkers'] = {};
    for (const trade of DISPLAY_TRADES) {
      const today = tradeToday[trade] ?? 0;
      const cumulative = (cumTrade[trade] ?? 0) + today;
      if (today > 0 || cumulative > 0) {
        tradeWorkers[trade] = { today, cumulative };
      }
    }

    const payload: CreateFieldReportInput = {
      siteId,
      siteName,
      reportDate,
      weather,
      subcontractorWorks: filteredWorks,
      materialDeliveries: [],
      notes: notes || undefined,
      projectName: siteName || undefined,
      siteResponsible: siteResponsible || undefined,
      supervisorWorkStart: normalizeTime(workStart),
      supervisorWorkEnd: normalizeTime(workEnd),
      workTimeStart: normalizeTime(workTimeStart),
      processInspection: inspection,
      receiveItems: receives.filter(
        (item) => item.receiver.trim() || item.itemName.trim()
      ),
      carryOutItems: carryOuts.filter((item) => item.itemName.trim()),
      meetingRecords: meetings.filter(
        (meeting) => meeting.partner.trim() || meeting.topic.trim()
      ),
      machineUsages: machines.filter(
        (machine) =>
          machine.machineName.trim() ||
          machine.operator.trim() ||
          machine.usageHours.trim()
      ),
      ownEmployees: [],
      tradeWorkers,
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
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : '保存に失敗しました'
      );
    }
  }

  function renderTradeRow(trade: TradeType) {
    return (
      <>
        <td className="lh">{TRADE_LABELS[trade]}</td>
        <td>
          <input
            min={0}
            placeholder="0"
            type="number"
            value={tradeToday[trade] || ''}
            onChange={(event) =>
              setTradeToday((current) => ({
                ...current,
                [trade]: parseNumber(event.target.value),
              }))
            }
          />
        </td>
        <td className="note">{(cumTrade[trade] ?? 0) + (tradeToday[trade] ?? 0)}</td>
      </>
    );
  }

  return (
    <div className="field-report-a4-shell">
      <style>{`
        .field-report-a4,
        .field-report-a4 * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        .field-report-a4-shell {
          background: #e0e0e0;
          overflow-x: auto;
          padding: 12px;
        }
        .field-report-a4 {
          background: #fff;
          border: 1.5px solid #555;
          color: #111;
          font-family: "Meiryo UI", "Hiragino Sans", Arial, sans-serif;
          font-size: 11px;
          margin: 0 auto;
          max-width: 1100px;
          min-width: 1100px;
          width: 1100px;
        }
        .field-report-a4 .xtitle {
          align-items: center;
          background: #1B3A6B;
          color: #fff;
          display: flex;
          justify-content: space-between;
          padding: 6px 12px;
        }
        .field-report-a4 .xtitle h1 {
          font-size: 14px;
          font-weight: 500;
          letter-spacing: .05em;
        }
        .field-report-a4 .xtitle small {
          font-size: 10px;
          opacity: .8;
        }
        .field-report-a4 table {
          border-collapse: collapse;
          width: 100%;
        }
        .field-report-a4 td,
        .field-report-a4 th {
          border: .5px solid #aaa;
          padding: 2px 4px;
          vertical-align: middle;
        }
        .field-report-a4 th {
          background: #C5D9F1;
          color: #1B3A6B;
          font-size: 10px;
          font-weight: 500;
          text-align: center;
          white-space: nowrap;
        }
        .field-report-a4 td.lh {
          background: #D9E8F8;
          color: #1B3A6B;
          font-size: 10px;
          font-weight: 500;
          text-align: center;
          white-space: nowrap;
        }
        .field-report-a4 td.note {
          background: #F2F2F2;
          color: #666;
          font-size: 10px;
          text-align: center;
        }
        .field-report-a4 td.total {
          background: #1B3A6B;
          color: #fff;
          font-size: 10px;
          font-weight: 500;
          text-align: center;
        }
        .field-report-a4 td.sum {
          background: #FFF2CC;
          font-size: 12px;
          font-weight: 500;
          text-align: center;
        }
        .field-report-a4 td input,
        .field-report-a4 td select,
        .field-report-a4 textarea {
          background: transparent;
          border: none;
          color: #111;
          font-family: inherit;
          font-size: 11px;
          outline: none;
          text-align: center;
          width: 100%;
        }
        .field-report-a4 td input.l,
        .field-report-a4 td select.l {
          text-align: left;
        }
        .field-report-a4 td input:focus,
        .field-report-a4 td select:focus,
        .field-report-a4 textarea:focus {
          background: #EEF4FF;
          border-radius: 1px;
        }
        .field-report-a4 td input[readonly] {
          color: #777;
        }
        .field-report-a4 td.check {
          line-height: 1.8;
          padding: 5px 8px;
        }
        .field-report-a4 td.check label {
          align-items: center;
          cursor: pointer;
          display: inline-flex;
          font-size: 10px;
          gap: 3px;
          margin-right: 10px;
          white-space: nowrap;
        }
        .field-report-a4 td.check input[type=checkbox] {
          cursor: pointer;
          height: 12px;
          width: 12px;
        }
        .field-report-a4 .sb {
          border-top: 1.5px solid #555;
        }
        .field-report-a4 .rb {
          border-right: 1.5px solid #555 !important;
        }
        .field-report-a4 .add-btn {
          background: #fff;
          border: .5px dashed #1B3A6B;
          border-radius: 2px;
          color: #1B3A6B;
          cursor: pointer;
          font-size: 10px;
          padding: 1px 8px;
        }
        .field-report-a4 .add-btn:hover {
          background: #EEF4FF;
        }
        .field-report-a4 .xfooter {
          align-items: center;
          background: #F5F5F5;
          border-top: 1.5px solid #555;
          display: flex;
          gap: 8px;
          justify-content: space-between;
          padding: 7px 10px;
        }
        .field-report-a4 .xfooter .note-txt {
          color: #888;
          font-size: 10px;
        }
        .field-report-a4 .xfooter .btns {
          display: flex;
          gap: 6px;
        }
        .field-report-a4 .xfooter button {
          background: #fff;
          border: .5px solid #aaa;
          border-radius: 3px;
          cursor: pointer;
          font-size: 11px;
          padding: 4px 16px;
        }
        .field-report-a4 .xfooter .sub {
          background: #1B3A6B;
          border-color: #1B3A6B;
          color: #fff;
        }
        .field-report-a4 .xfooter .sub:hover {
          background: #254F8A;
        }
        .field-report-a4 .xfooter button:disabled {
          cursor: default;
          opacity: .55;
        }
      `}</style>

      <div className="field-report-a4">
        <div className="xtitle">
          <h1>打合せ指示書・日誌</h1>
          <small>
            自動保存 ✓ ／ 現場監督：
            {siteResponsible.trim() || '未入力'}
          </small>
        </div>

        <table>
          <tbody>
            <tr>
              <td className="lh" colSpan={2} style={{ width: 70 }}>
                令和
              </td>
              <td style={{ width: 36 }}>
                <input
                  max={99}
                  min={1}
                  type="number"
                  value={dateParts.reiwa}
                  onChange={(event) =>
                    handleDatePartChange('reiwa', event.target.value)
                  }
                />
              </td>
              <td className="note" style={{ width: 14 }}>
                月
              </td>
              <td style={{ width: 36 }}>
                <input
                  max={12}
                  min={1}
                  type="number"
                  value={dateParts.month}
                  onChange={(event) =>
                    handleDatePartChange('month', event.target.value)
                  }
                />
              </td>
              <td className="note" style={{ width: 14 }}>
                日
              </td>
              <td style={{ width: 36 }}>
                <input
                  max={31}
                  min={1}
                  type="number"
                  value={dateParts.day}
                  onChange={(event) =>
                    handleDatePartChange('day', event.target.value)
                  }
                />
              </td>
              <td className="lh" style={{ width: 36 }}>
                曜日
              </td>
              <td style={{ width: 28 }}>
                <input readOnly value={getYoubi(reportDate)} />
              </td>
              <td className="lh" style={{ width: 30 }}>
                天候
              </td>
              <td style={{ width: 72 }}>
                <select
                  value={weather}
                  onChange={(event) => setWeather(event.target.value as Weather)}
                >
                  {WEATHER_OPTIONS.map((option, index) => (
                    <option key={`${option.value}-${index}`} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </td>
              <td className="lh" style={{ width: 60 }}>
                工　事　名
              </td>
              <td>
                <select
                  className="l"
                  value={siteId}
                  onChange={(event) => handleSiteChange(event.target.value)}
                >
                  <option value="">現場を選択</option>
                  {sites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.siteName}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
            <tr>
              <td className="lh" colSpan={2}>
                勤務時間
              </td>
              <td colSpan={2}>
                <input
                  placeholder="8:00"
                  value={workStart}
                  onChange={(event) => setWorkStart(event.target.value)}
                />
              </td>
              <td className="note">〜</td>
              <td colSpan={2}>
                <input
                  placeholder="20:30"
                  value={workEnd}
                  onChange={(event) => setWorkEnd(event.target.value)}
                />
              </td>
              <td className="lh" colSpan={2}>
                作業時間
              </td>
              <td>
                <input
                  placeholder="8:00"
                  value={workTimeStart}
                  onChange={(event) => setWorkTimeStart(event.target.value)}
                />
              </td>
              <td className="note">〜</td>
              <td className="lh">現場責任者</td>
              <td>
                <input
                  value={siteResponsible}
                  onChange={(event) => setSiteResponsible(event.target.value)}
                />
              </td>
            </tr>
          </tbody>
        </table>

        <table className="sb">
          <colgroup>
            <col style={{ width: '18%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '6%' }} />
            <col style={{ width: '6%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
          </colgroup>
          <thead>
            <tr>
              <th className="rb" colSpan={4}>
                外注工事受入品
              </th>
              <th colSpan={3}>稼 働 人 員</th>
            </tr>
            <tr>
              <th>受入先</th>
              <th>品　名</th>
              <th>数量</th>
              <th className="rb">単位</th>
              <th>職　種</th>
              <th>本日</th>
              <th>累　計</th>
            </tr>
          </thead>
          <tbody>
            {receives.slice(0, 2).map((item, index) => (
              <tr key={`receive-${index}`}>
                <td>
                  <input
                    className="l"
                    placeholder="受入先"
                    value={item.receiver}
                    onChange={(event) =>
                      updateReceive(index, { receiver: event.target.value })
                    }
                  />
                </td>
                <td>
                  <input
                    className="l"
                    placeholder="品名"
                    value={item.itemName}
                    onChange={(event) =>
                      updateReceive(index, { itemName: event.target.value })
                    }
                  />
                </td>
                <td>
                  <input
                    placeholder="0"
                    type="number"
                    value={item.quantity}
                    onChange={(event) =>
                      updateReceive(index, { quantity: event.target.value })
                    }
                  />
                </td>
                <td className="rb">
                  <select
                    value={item.unit || '式'}
                    onChange={(event) =>
                      updateReceive(index, { unit: event.target.value })
                    }
                  >
                    {RECEIVE_UNITS.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                </td>
                {renderTradeRow(TOP_TRADE_BY_ROW[index] ?? 'zosaku')}
              </tr>
            ))}
            <tr>
              <td className="note rb" colSpan={4}>
                <button
                  className="add-btn"
                  type="button"
                  onClick={() => setReceives((current) => [...current, emptyReceive()])}
                >
                  + 行追加
                </button>
              </td>
              {renderTradeRow(TOP_TRADE_BY_ROW[2] ?? 'denko')}
            </tr>
            {receives.slice(2).map((item, index) => {
              const actualIndex = index + 2;
              return (
                <tr key={`receive-extra-${actualIndex}`}>
                  <td>
                    <input
                      className="l"
                      placeholder="受入先"
                      value={item.receiver}
                      onChange={(event) =>
                        updateReceive(actualIndex, { receiver: event.target.value })
                      }
                    />
                  </td>
                  <td>
                    <input
                      className="l"
                      placeholder="品名"
                      value={item.itemName}
                      onChange={(event) =>
                        updateReceive(actualIndex, { itemName: event.target.value })
                      }
                    />
                  </td>
                  <td>
                    <input
                      placeholder="0"
                      type="number"
                      value={item.quantity}
                      onChange={(event) =>
                        updateReceive(actualIndex, { quantity: event.target.value })
                      }
                    />
                  </td>
                  <td className="rb">
                    <select
                      value={item.unit || '式'}
                      onChange={(event) =>
                        updateReceive(actualIndex, { unit: event.target.value })
                      }
                    >
                      {RECEIVE_UNITS.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td />
                  <td />
                  <td />
                </tr>
              );
            })}
          </tbody>
        </table>

        <table className="sb">
          <colgroup>
            <col style={{ width: '18%' }} />
            <col style={{ width: '6%' }} />
            <col style={{ width: '6%' }} />
            <col style={{ width: '24%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '9%' }} />
          </colgroup>
          <thead>
            <tr>
              <th>協力会社</th>
              <th>人員</th>
              <th>常用</th>
              <th>作　業　内　容</th>
              <th className="rb">安全指示事項</th>
              <th>職　種</th>
              <th>本日</th>
              <th>累計</th>
            </tr>
          </thead>
          <tbody>
            {subWorks.slice(0, 4).map((work, index) => (
              <tr key={`work-${index}`}>
                <td>
                  <input
                    className="l"
                    placeholder="協力会社名"
                    value={work.companyName}
                    onChange={(event) =>
                      updateSubWork(index, { companyName: event.target.value })
                    }
                  />
                </td>
                <td>
                  <input
                    placeholder="0"
                    type="number"
                    value={work.workerCount || ''}
                    onChange={(event) =>
                      updateSubWork(index, {
                        workerCount: parseNumber(event.target.value),
                      })
                    }
                  />
                </td>
                <td>
                  <input type="number" />
                </td>
                <td>
                  <input
                    className="l"
                    placeholder="作業内容を入力"
                    value={work.workContent}
                    onChange={(event) =>
                      updateSubWork(index, { workContent: event.target.value })
                    }
                  />
                </td>
                <td className="rb">
                  <input className="l" />
                </td>
                {renderTradeRow(WORK_TRADE_BY_ROW[index] ?? 'glass')}
              </tr>
            ))}
            <tr>
              <td>
                <input
                  className="l"
                  placeholder="協力会社名"
                  value={subWorks[4]?.companyName ?? ''}
                  onChange={(event) =>
                    updateSubWork(4, { companyName: event.target.value })
                  }
                />
              </td>
              <td>
                <input
                  placeholder="0"
                  type="number"
                  value={subWorks[4]?.workerCount || ''}
                  onChange={(event) =>
                    updateSubWork(4, { workerCount: parseNumber(event.target.value) })
                  }
                />
              </td>
              <td>
                <input type="number" />
              </td>
              <td>
                <input
                  className="l"
                  placeholder="作業内容を入力"
                  value={subWorks[4]?.workContent ?? ''}
                  onChange={(event) =>
                    updateSubWork(4, { workContent: event.target.value })
                  }
                />
              </td>
              <td className="rb">
                <input className="l" />
              </td>
              <td className="total">合　計</td>
              <td className="sum">{todayTotal}</td>
              <td className="note" style={{ fontWeight: 500 }}>
                {cumTotal}
              </td>
            </tr>
            {subWorks.slice(5).map((work, index) => {
              const actualIndex = index + 5;
              return (
                <tr key={`work-extra-${actualIndex}`}>
                  <td>
                    <input
                      className="l"
                      placeholder="協力会社名"
                      value={work.companyName}
                      onChange={(event) =>
                        updateSubWork(actualIndex, {
                          companyName: event.target.value,
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      placeholder="0"
                      type="number"
                      value={work.workerCount || ''}
                      onChange={(event) =>
                        updateSubWork(actualIndex, {
                          workerCount: parseNumber(event.target.value),
                        })
                      }
                    />
                  </td>
                  <td>
                    <input type="number" />
                  </td>
                  <td>
                    <input
                      className="l"
                      placeholder="作業内容"
                      value={work.workContent}
                      onChange={(event) =>
                        updateSubWork(actualIndex, {
                          workContent: event.target.value,
                        })
                      }
                    />
                  </td>
                  <td className="rb">
                    <input className="l" />
                  </td>
                  <td />
                  <td />
                  <td />
                </tr>
              );
            })}
            <tr>
              <td className="note rb" colSpan={5}>
                <button
                  className="add-btn"
                  type="button"
                  onClick={() => setSubWorks((current) => [...current, emptySubWork()])}
                >
                  + 行追加
                </button>
              </td>
              <td className="lh">労働時間</td>
              <td>
                <input
                  min={0}
                  type="number"
                  value={laborToday || ''}
                  onChange={(event) => setLaborToday(parseNumber(event.target.value))}
                />
              </td>
              <td className="note">{cumLabor + laborToday}</td>
            </tr>
          </tbody>
        </table>

        <table className="sb">
          <tbody>
            <tr>
              <th style={{ paddingLeft: 8, textAlign: 'left', width: '50%' }}>
                工程内検査
              </th>
              <th style={{ paddingLeft: 8, textAlign: 'left' }}>
                指摘・是正事項
              </th>
            </tr>
            <tr>
              <td className="check" style={{ verticalAlign: 'top' }}>
                {INSPECTION_ITEMS.map(([key, label]) => (
                  <label key={key}>
                    <input
                      checked={inspection[key] as boolean}
                      type="checkbox"
                      onChange={(event) =>
                        setInspection((current) => ({
                          ...current,
                          [key]: event.target.checked,
                        }))
                      }
                    />
                    {label}
                  </label>
                ))}
              </td>
              <td style={{ padding: 5, verticalAlign: 'top' }}>
                <textarea
                  placeholder="指摘・是正事項を入力..."
                  style={{ height: 56, resize: 'none' }}
                  value={inspection.notes}
                  onChange={(event) =>
                    setInspection((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                />
              </td>
            </tr>
          </tbody>
        </table>

        <table className="sb">
          <thead>
            <tr>
              <th style={{ width: '22%' }}>相手先（打合せ記録）</th>
              <th>項目・対策</th>
            </tr>
          </thead>
          <tbody>
            {meetings.map((meeting, index) => (
              <tr key={`meeting-${index}`}>
                <td>
                  <input
                    className="l"
                    placeholder="相手先"
                    value={meeting.partner}
                    onChange={(event) =>
                      updateMeeting(index, { partner: event.target.value })
                    }
                  />
                </td>
                <td>
                  <input
                    className="l"
                    placeholder="項目・対策を入力"
                    value={meeting.topic}
                    onChange={(event) =>
                      updateMeeting(index, { topic: event.target.value })
                    }
                  />
                </td>
              </tr>
            ))}
            <tr>
              <td className="note" colSpan={2}>
                <button
                  className="add-btn"
                  type="button"
                  onClick={() => setMeetings((current) => [...current, emptyMeeting()])}
                >
                  + 行追加
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <table className="sb">
          <thead>
            <tr>
              <th className="rb" colSpan={3}>
                持ち出し品
              </th>
              <th colSpan={4}>使用機器</th>
            </tr>
            <tr>
              <th style={{ width: '20%' }}>品　名</th>
              <th style={{ width: '7%' }}>数量</th>
              <th className="rb" style={{ width: '10%' }}>
                借入・返却
              </th>
              <th style={{ width: '18%' }}>機械名</th>
              <th style={{ width: '10%' }}>自社/リース</th>
              <th style={{ width: '18%' }}>運転者名</th>
              <th style={{ width: '17%' }}>使用時間</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({
              length: Math.max(carryOuts.length, machines.length, 1),
            }).map((_, index) => {
              const carry = carryOuts[index] ?? emptyCarryOut();
              const machine = machines[index] ?? emptyMachine();
              return (
                <tr key={`carry-machine-${index}`}>
                  <td>
                    <input
                      className="l"
                      placeholder="品名"
                      value={carry.itemName}
                      onChange={(event) =>
                        updateCarryOut(index, { itemName: event.target.value })
                      }
                    />
                  </td>
                  <td>
                    <input
                      placeholder="0"
                      type="number"
                      value={carry.quantity}
                      onChange={(event) =>
                        updateCarryOut(index, { quantity: event.target.value })
                      }
                    />
                  </td>
                  <td className="rb">
                    <select
                      value={carry.category}
                      onChange={(event) =>
                        updateCarryOut(index, {
                          category: event.target.value as CarryOutItem['category'],
                        })
                      }
                    >
                      <option value={CARRY_OUT_CATEGORY.BORROW}>借入</option>
                      <option value={CARRY_OUT_CATEGORY.RETURN}>返却</option>
                      <option value={CARRY_OUT_CATEGORY.CONSUME}>消却</option>
                    </select>
                  </td>
                  <td>
                    <input
                      className="l"
                      placeholder="機械名"
                      value={machine.machineName}
                      onChange={(event) =>
                        updateMachine(index, { machineName: event.target.value })
                      }
                    />
                  </td>
                  <td>
                    <select
                      value={machine.ownership}
                      onChange={(event) =>
                        updateMachine(index, {
                          ownership: event.target.value as MachineUsage['ownership'],
                        })
                      }
                    >
                      <option value={MACHINE_OWNERSHIP.OWN}>自社</option>
                      <option value={MACHINE_OWNERSHIP.LEASE}>リース</option>
                    </select>
                  </td>
                  <td>
                    <input
                      className="l"
                      placeholder="氏名"
                      value={machine.operator}
                      onChange={(event) =>
                        updateMachine(index, { operator: event.target.value })
                      }
                    />
                  </td>
                  <td>
                    <input
                      placeholder="8:00〜17:00"
                      value={machine.usageHours}
                      onChange={(event) =>
                        updateMachine(index, { usageHours: event.target.value })
                      }
                    />
                  </td>
                </tr>
              );
            })}
            <tr>
              <td className="note" colSpan={7}>
                <button
                  className="add-btn"
                  type="button"
                  onClick={() => {
                    setCarryOuts((current) => [...current, emptyCarryOut()]);
                    setMachines((current) => [...current, emptyMachine()]);
                  }}
                >
                  + 行追加
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <table className="sb">
          <tbody>
            <tr>
              <th style={{ paddingLeft: 8, textAlign: 'left' }}>
                会社資材・機材・備品・特記記録
              </th>
            </tr>
            <tr>
              <td style={{ padding: 5 }}>
                <textarea
                  placeholder="特記事項を入力..."
                  style={{ height: 34, resize: 'none' }}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </td>
            </tr>
          </tbody>
        </table>

        <div className="xfooter">
          <span className="note-txt">
            （注）記入項目のない箇所は該当なし。必ず毎日提出すること。
          </span>
          <div className="btns">
            <button type="button" onClick={handleSaveDraft}>
              一時保存
            </button>
            <button
              className="sub"
              disabled={isSubmitting}
              type="button"
              onClick={handleSubmit}
            >
              {isSubmitting ? '保存中...' : '提出する'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
