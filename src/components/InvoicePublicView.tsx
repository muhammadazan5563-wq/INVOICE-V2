import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  FileText,
  Calendar,
  Users,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Printer,
  Download,
} from 'lucide-react';

const BRAND_MARK =
  'https://mgx-backend-cdn.metadl.com/generate/images/1500378/2026-08-01/tumdfoacajra/logo-finnova-n-mark.png';

interface InvoiceRow {
  room: string;
  checkIn: string;
  checkout: string;
  nights: number;
  roomPrice: number;
  total: number;
  sum: number;
  due: number;
  group: string;
  ref: string;
}

interface InvoiceData {
  invoiceNumber: string;
  refValue: string;
  group: string;
  rows: InvoiceRow[];
  totalAmount: number;
  totalDue: number;
  headers: string[];
}

const money = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export default function InvoicePublicView() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(
    (location.state as any)?.invoiceData || null
  );
  const [loading, setLoading] = useState(!invoiceData);
  const [error, setError] = useState('');

  useEffect(() => {
    if (invoiceData) return;
    if (!invoiceId) {
      setError('No invoice number provided');
      setLoading(false);
      return;
    }

    const fetchInvoice = async () => {
      try {
        const response = await fetch(`/api/lookup-invoice/${encodeURIComponent(invoiceId)}`);
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || `Failed to load invoice (${response.status})`);
        }
        const data = await response.json();
        if (!data.rows || data.rows.length === 0) {
          setError('No invoice found with that number.');
          setLoading(false);
          return;
        }
        setInvoiceData(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load invoice');
      } finally {
        setLoading(false);
      }
    };

    fetchInvoice();
  }, [invoiceId, invoiceData]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <div className="flex flex-col items-center gap-4">
          <div className="w-9 h-9 border-[3px] border-hairline border-t-brand rounded-full animate-spin" />
          <p className="text-[12px] font-bold text-quill">Loading invoice…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-canvas px-3 sm:px-5 py-4 sm:py-6">
        <div className="max-w-[600px] mx-auto">
          <header className="flex items-center gap-4 mb-8">
            <button
              onClick={() => navigate('/track')}
              className="w-10 h-10 rounded-full bg-mist hover:bg-mist-2 flex items-center justify-center transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-ink" />
            </button>
            <a href="/" className="flex items-center gap-2.5 no-underline">
              <img src={BRAND_MARK} alt="" className="w-8 h-8 object-contain" />
              <span className="text-[16px] font-extrabold tracking-tight text-ink font-display">FINNOVA</span>
            </a>
          </header>

          <div className="bg-shell rounded-[28px] p-8 text-center shadow-[0_20px_60px_-30px_rgba(19,17,38,0.15)]">
            <span className="w-14 h-14 rounded-2xl bg-[#fdeeea] flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6 text-[#a8492f]" />
            </span>
            <h2 className="text-[18px] font-extrabold text-ink font-display">Invoice Not Found</h2>
            <p className="text-[13px] text-quill mt-2 max-w-sm mx-auto leading-relaxed font-medium">{error}</p>
            <button
              onClick={() => navigate('/track')}
              className="mt-6 bg-brand hover:bg-brand-mid text-white text-[12px] font-bold px-6 py-3 rounded-full transition-colors cursor-pointer"
            >
              Try Another Number
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!invoiceData) return null;

  const totalPaid = invoiceData.totalAmount - invoiceData.totalDue;
  const isPaid = invoiceData.totalDue <= 0;

  return (
    <div className="min-h-screen bg-canvas px-3 sm:px-5 py-4 sm:py-6 print:bg-white print:p-0">
      <div className="max-w-[900px] mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between gap-4 mb-6 print:hidden">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/track')}
              className="w-10 h-10 rounded-full bg-mist hover:bg-mist-2 flex items-center justify-center transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-ink" />
            </button>
            <a href="/" className="flex items-center gap-2.5 no-underline">
              <img src={BRAND_MARK} alt="" className="w-8 h-8 object-contain" />
              <span className="text-[16px] font-extrabold tracking-tight text-ink font-display">FINNOVA</span>
            </a>
          </div>

          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-ink hover:bg-ink-2 text-white text-[12px] font-bold px-5 py-3 rounded-full transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            Print
          </button>
        </header>

        {/* Invoice Card */}
        <div className="bg-shell rounded-[30px] overflow-hidden shadow-[0_40px_90px_-60px_rgba(19,17,38,0.25)] animate-fade-in print:shadow-none print:rounded-none">
          {/* Top Banner */}
          <div className="bg-ink px-6 sm:px-8 py-6 sm:py-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <img src={BRAND_MARK} alt="" className="w-8 h-8 object-contain" />
                  <span className="text-[18px] font-extrabold text-white font-display">FINNOVA</span>
                </div>
                <p className="text-[11px] text-white/50 font-semibold">Invoice Details</p>
              </div>

              <div className="text-left sm:text-right">
                <span className="block text-[11px] font-bold text-white/50 uppercase tracking-wider">Reference</span>
                <span className="block text-[22px] font-extrabold text-white font-display mt-1">
                  {invoiceData.refValue}
                </span>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="px-6 sm:px-8 py-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
              <div className="bg-mist rounded-[18px] p-4">
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-quill-soft uppercase tracking-wider">
                  <Users className="w-3.5 h-3.5" /> Group
                </span>
                <span className="block text-[14px] font-extrabold text-ink mt-2 truncate font-display">
                  {invoiceData.group || '—'}
                </span>
              </div>

              <div className="bg-mist rounded-[18px] p-4">
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-quill-soft uppercase tracking-wider">
                  <FileText className="w-3.5 h-3.5" /> Rooms
                </span>
                <span className="nums block text-[14px] font-extrabold text-ink mt-2 font-display">
                  {invoiceData.rows.length}
                </span>
              </div>

              <div className="bg-mist rounded-[18px] p-4">
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-quill-soft uppercase tracking-wider">
                  <DollarSign className="w-3.5 h-3.5" /> Total
                </span>
                <span className="nums block text-[14px] font-extrabold text-ink mt-2 font-display">
                  ${money(invoiceData.totalAmount)}
                </span>
              </div>

              <div className={`rounded-[18px] p-4 ${isPaid ? 'bg-[#e8f7ee]' : 'bg-[#fdeeea]'}`}>
                <span className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${isPaid ? 'text-[#2f6b48]' : 'text-[#a8492f]'}`}>
                  {isPaid ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                  {isPaid ? 'Settled' : 'Balance Due'}
                </span>
                <span className={`nums block text-[14px] font-extrabold mt-2 font-display ${isPaid ? 'text-[#2f6b48]' : 'text-[#a8492f]'}`}>
                  ${money(isPaid ? 0 : invoiceData.totalDue)}
                </span>
              </div>
            </div>

            {/* Booking Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-hairline">
                    <th className="text-[10px] font-bold text-quill-soft uppercase tracking-wider pb-3 pr-4">Room</th>
                    <th className="text-[10px] font-bold text-quill-soft uppercase tracking-wider pb-3 pr-4">Check In</th>
                    <th className="text-[10px] font-bold text-quill-soft uppercase tracking-wider pb-3 pr-4">Checkout</th>
                    <th className="text-[10px] font-bold text-quill-soft uppercase tracking-wider pb-3 pr-4 text-right">Nights</th>
                    <th className="text-[10px] font-bold text-quill-soft uppercase tracking-wider pb-3 pr-4 text-right">Rate</th>
                    <th className="text-[10px] font-bold text-quill-soft uppercase tracking-wider pb-3 pr-4 text-right">Total</th>
                    <th className="text-[10px] font-bold text-quill-soft uppercase tracking-wider pb-3 text-right">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceData.rows.map((row, idx) => (
                    <tr key={idx} className="border-b border-hairline/50 last:border-b-0">
                      <td className="py-3 pr-4">
                        <span className="text-[12px] font-bold text-ink">{row.room || '—'}</span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="text-[12px] font-medium text-quill">{row.checkIn || '—'}</span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="text-[12px] font-medium text-quill">{row.checkout || '—'}</span>
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <span className="nums text-[12px] font-bold text-ink">{row.nights}</span>
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <span className="nums text-[12px] font-medium text-quill">${money(row.roomPrice)}</span>
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <span className="nums text-[12px] font-bold text-ink">${money(row.total)}</span>
                      </td>
                      <td className="py-3 text-right">
                        <span className={`nums text-[12px] font-bold ${row.due > 0 ? 'text-[#a8492f]' : 'text-[#2f6b48]'}`}>
                          ${money(row.due)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals Footer */}
            <div className="mt-6 pt-5 border-t border-hairline flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-6">
                <div>
                  <span className="block text-[10px] font-bold text-quill-soft uppercase tracking-wider">Grand Total</span>
                  <span className="nums block text-[18px] font-extrabold text-ink mt-1 font-display">
                    ${money(invoiceData.totalAmount)}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-quill-soft uppercase tracking-wider">Paid</span>
                  <span className="nums block text-[18px] font-extrabold text-[#2f6b48] mt-1 font-display">
                    ${money(totalPaid)}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-quill-soft uppercase tracking-wider">Balance</span>
                  <span className={`nums block text-[18px] font-extrabold mt-1 font-display ${invoiceData.totalDue > 0 ? 'text-[#a8492f]' : 'text-[#2f6b48]'}`}>
                    ${money(invoiceData.totalDue)}
                  </span>
                </div>
              </div>

              <div className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-[12px] font-bold ${isPaid ? 'bg-[#e8f7ee] text-[#2f6b48]' : 'bg-[#fdeeea] text-[#a8492f]'}`}>
                {isPaid ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                {isPaid ? 'Fully Settled' : 'Payment Outstanding'}
              </div>
            </div>
          </div>
        </div>

        <footer className="mt-8 text-center print:hidden">
          <span className="text-[11px] font-semibold text-quill-soft">
            FINNOVA © 2026 · Smart Finances, Better Business
          </span>
        </footer>
      </div>
    </div>
  );
}
