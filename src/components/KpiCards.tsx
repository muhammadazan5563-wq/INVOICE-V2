import { Invoice } from '../types';
import {
  AlertOctagon,
  CalendarDays,
  Clock3,
  ShieldCheck,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

interface KpiCardsProps {
  invoices: Invoice[];
  currencySymbol: string;
  workspaceImage: string;
  onOpenLedger: () => void;
}

const money = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const monthKey = (d: Date) => d.toLocaleDateString('en-US', { month: 'short' });

/** Build the last 7 calendar months of billed revenue. */
function monthlyBilled(invoices: Invoice[]) {
  const now = new Date();
  const buckets: { label: string; value: number }[] = [];

  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ label: monthKey(d), value: 0 });
  }

  invoices.forEach((inv) => {
    const d = new Date(inv.date);
    if (isNaN(d.getTime())) return;
    const offset =
      (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
    if (offset >= 0 && offset <= 6) {
      buckets[6 - offset].value += inv.totalAmount;
    }
  });

  return buckets;
}

/** Cumulative collected cash across the same window, for the sparkline. */
function collectedCurve(invoices: Invoice[]) {
  const months = monthlyBilled(invoices).map((m) => ({ label: m.label, value: 0 }));
  const now = new Date();

  invoices.forEach((inv) => {
    const payments = inv.payments && inv.payments.length > 0
      ? inv.payments
      : inv.amountPaid > 0
        ? [{ amount: inv.amountPaid, date: inv.paymentDate || inv.date }]
        : [];

    payments.forEach((p) => {
      const d = new Date(p.date);
      if (isNaN(d.getTime())) return;
      const offset =
        (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
      if (offset >= 0 && offset <= 6) {
        months[6 - offset].value += p.amount;
      }
    });
  });

  let running = 0;
  return months.map((m) => {
    running += m.value;
    return { label: m.label, value: running };
  });
}

export default function KpiCards({
  invoices,
  currencySymbol,
  workspaceImage,
  onOpenLedger,
}: KpiCardsProps) {
  const now = new Date();
  const horizon = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

  let overdue = 0;
  let dueSoon = 0;
  let collected = 0;
  let paidDaysTotal = 0;
  let paidDaysCount = 0;

  invoices.forEach((inv) => {
    const due = new Date(inv.date);
    const isPast = !isNaN(due.getTime()) && due.getTime() < now.getTime();

    if (inv.balance > 0 && (inv.status === 'Overdue' || isPast)) {
      overdue += inv.balance;
    }
    if (inv.balance > 0 && !isNaN(due.getTime()) && due.getTime() >= now.getTime() && due.getTime() <= horizon.getTime()) {
      dueSoon += inv.balance;
    }
    collected += inv.amountPaid;

    const paidOn = new Date(inv.paymentDate || '');
    if (inv.amountPaid > 0 && !isNaN(paidOn.getTime()) && !isNaN(due.getTime())) {
      const diff = Math.round((paidOn.getTime() - due.getTime()) / 86400000);
      if (diff >= 0 && diff < 365) {
        paidDaysTotal += diff;
        paidDaysCount += 1;
      }
    }
  });

  const avgDays = paidDaysCount > 0 ? Math.round(paidDaysTotal / paidDaysCount) : 0;

  const bars = monthlyBilled(invoices);
  const barMax = Math.max(...bars.map((b) => b.value), 1);

  const curve = collectedCurve(invoices);
  const curveMax = Math.max(...curve.map((c) => c.value), 1);
  const points = curve.map((c, i) => {
    const x = 6 + (i * 148) / Math.max(curve.length - 1, 1);
    const y = 68 - (c.value / curveMax) * 54;
    return { x, y };
  });
  const polyline = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  const overdueShare = collected + overdue > 0 ? (overdue / (collected + overdue)) * 100 : 0;
  const dueShare = collected + dueSoon > 0 ? (dueSoon / (collected + dueSoon)) * 100 : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5" id="kpi-cards-row">
      {/* 1 — Overdue, anchored by workspace imagery */}
      <article className="bg-shell rounded-[26px] pt-5 overflow-hidden shadow-[0_18px_40px_-32px_rgba(19,17,38,0.5)] animate-rise" style={{ animationDelay: '0ms' }}>
        <div className="px-5 flex items-start justify-between gap-3">
          <span className="text-[13px] font-bold text-ink">Overdue</span>
          <span className="w-8 h-8 rounded-full bg-[#fef1ec] flex items-center justify-center shrink-0">
            <AlertOctagon className="w-4 h-4 text-[#e4694a]" />
          </span>
        </div>

        <div className="px-5 mt-2.5 flex items-baseline gap-1.5">
          <span className="text-[17px] font-semibold text-quill-soft">{currencySymbol}</span>
          <span className="nums text-[30px] leading-none font-extrabold tracking-tight text-ink font-display">
            {money(overdue)}
          </span>
        </div>

        <div className="px-5 mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-[#e4694a]">
          <TrendingUp className="w-3.5 h-3.5" />
          <span className="nums">{overdueShare.toFixed(1)}%</span>
          <span className="text-quill-soft font-medium">of open billing</span>
        </div>

        <div className="mt-4 px-2.5 pb-2.5">
          <div className="h-[104px] rounded-[20px] overflow-hidden bg-mist-2">
            {workspaceImage ? (
              <img
                src={workspaceImage}
                alt="Desk with a laptop, plant and lamp"
                className="w-full h-full object-cover"
              />
            ) : null}
          </div>
        </div>
      </article>

      {/* 2 — Due within next month, with billed-volume bars */}
      <article className="bg-shell rounded-[26px] p-5 shadow-[0_18px_40px_-32px_rgba(19,17,38,0.5)] animate-rise" style={{ animationDelay: '60ms' }}>
        <div className="flex items-start justify-between gap-3">
          <span className="text-[13px] font-bold text-ink">Due within next month</span>
          <span className="w-8 h-8 rounded-full bg-brand-pale flex items-center justify-center shrink-0">
            <CalendarDays className="w-4 h-4 text-brand" />
          </span>
        </div>

        <div className="mt-2.5 flex items-baseline gap-1.5">
          <span className="text-[17px] font-semibold text-quill-soft">{currencySymbol}</span>
          <span className="nums text-[30px] leading-none font-extrabold tracking-tight text-ink font-display">
            {money(dueSoon)}
          </span>
        </div>

        <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-brand">
          <TrendingUp className="w-3.5 h-3.5" />
          <span className="nums">{dueShare.toFixed(1)}%</span>
          <span className="text-quill-soft font-medium">of open billing</span>
        </div>

        <div className="mt-5 flex items-end justify-between gap-2 h-[86px]">
          {bars.map((b, i) => {
            const h = Math.max(10, (b.value / barMax) * 72);
            const strong = i >= bars.length - 2;
            return (
              <div key={`${b.label}-${i}`} className="flex-1 flex flex-col items-center gap-1.5">
                <div
                  className={`w-full rounded-t-[6px] rounded-b-[3px] animate-bar ${strong ? 'bg-brand' : 'bg-brand-soft/45'}`}
                  style={{ height: `${h}px`, animationDelay: `${i * 45}ms` }}
                />
                <span className="text-[9px] font-semibold text-quill-soft">{b.label}</span>
              </div>
            );
          })}
        </div>
      </article>

      {/* 3 — Average time to get paid, with collected-cash curve */}
      <article className="bg-shell rounded-[26px] p-5 shadow-[0_18px_40px_-32px_rgba(19,17,38,0.5)] animate-rise" style={{ animationDelay: '120ms' }}>
        <div className="flex items-start justify-between gap-3">
          <span className="text-[13px] font-bold text-ink">Average time to get paid</span>
          <span className="w-8 h-8 rounded-full bg-[#e9f6f8] flex items-center justify-center shrink-0">
            <Clock3 className="w-4 h-4 text-[#3d9aa8]" />
          </span>
        </div>

        <div className="mt-2.5 flex items-baseline gap-2">
          <span className="nums text-[30px] leading-none font-extrabold tracking-tight text-ink font-display">
            {avgDays}
          </span>
          <span className="text-[15px] font-bold text-quill">days</span>
        </div>

        <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-[#3d9aa8]">
          <TrendingDown className="w-3.5 h-3.5" />
          <span className="nums">{paidDaysCount}</span>
          <span className="text-quill-soft font-medium">settled invoices measured</span>
        </div>

        <div className="mt-5 h-[86px]">
          <svg viewBox="0 0 160 80" className="w-full h-full" preserveAspectRatio="none">
            <polyline
              points={polyline}
              fill="none"
              stroke="#5a49e6"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            {points.map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r="2.4"
                fill="#ffffff"
                stroke="#5a49e6"
                strokeWidth="1.4"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
        </div>
      </article>

      {/* 4 — Available for instant payout */}
      <article className="bg-shell rounded-[26px] p-5 shadow-[0_18px_40px_-32px_rgba(19,17,38,0.5)] animate-rise" style={{ animationDelay: '180ms' }}>
        <div className="flex items-start justify-between gap-3">
          <span className="text-[13px] font-bold text-ink leading-snug">Available for Instant Payout</span>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-8 h-8 rounded-full bg-[#e8f7ee] flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-[#3f9c68]" />
            </span>
            <button
              type="button"
              onClick={onOpenLedger}
              title="Open ledger"
              className="w-8 h-8 rounded-full bg-mist hover:bg-mist-2 flex items-center justify-center transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <ArrowUpRight className="w-4 h-4 text-ink" />
            </button>
          </div>
        </div>

        <div className="mt-2.5 flex items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[17px] font-semibold text-quill-soft">{currencySymbol}</span>
            <span className="nums text-[26px] leading-none font-extrabold tracking-tight text-ink font-display">
              {money(collected)}
            </span>
          </div>
          <span className="text-[10px] font-bold text-quill bg-mist px-2.5 py-1 rounded-full">
            Cleared
          </span>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2 items-end">
          {[
            { dots: '4242', label: 'Visa' },
            { dots: '6789', label: 'Stripe' },
            { dots: '1234', label: 'PayPal' },
          ].map((c, i) => {
            const active = i === 1;
            return (
              <div
                key={c.label}
                className={`rounded-[16px] px-2.5 text-center ${
                  active
                    ? 'bg-brand text-white py-5 shadow-[0_14px_26px_-16px_rgba(90,73,230,0.9)]'
                    : 'bg-mist text-ink py-3.5'
                }`}
              >
                <span className={`nums block text-[11px] font-bold ${active ? 'text-white' : 'text-ink'}`}>
                  ···· {c.dots}
                </span>
                <span className={`block text-[10px] font-semibold mt-1 ${active ? 'text-white/75' : 'text-quill-soft'}`}>
                  {c.label}
                </span>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onOpenLedger}
          className="mt-4 w-full bg-ink hover:bg-ink-3 text-white text-[12px] font-bold py-3 rounded-full transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Review payouts
        </button>
      </article>
    </div>
  );
}
