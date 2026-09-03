import { useState } from "react";
import { Wallet, Clock, ArrowDownToLine, TrendingUp, TrendingDown, RotateCcw } from "lucide-react";
import { api } from "../../api";
import { useAsync } from "../../hooks/useAsync";
import { useToast } from "../../store/ToastContext";
import { Badge, Button, Card, Modal, Skeleton, Tabs, EmptyState } from "../../components/ui";
import { formatDate, money, toBnDigits } from "../../lib/format";
import { RULES } from "../../config";

const KIND = {
  sale: { label: "বিক্রি", icon: TrendingUp, tone: "text-brand-600" },
  commission: { label: "কমিশন", icon: TrendingDown, tone: "text-muted" },
  refund: { label: "রিফান্ড", icon: RotateCcw, tone: "text-red-600" },
};

const PAYOUT_STATUS = {
  paid: { label: "পরিশোধিত", tone: "ok" },
  processing: { label: "প্রক্রিয়াধীন", tone: "warn" },
  failed: { label: "ব্যর্থ", tone: "danger" },
};

export default function VendorPayouts() {
  const toast = useToast();
  const [tab, setTab] = useState("ledger");
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const stats = useAsync(() => api.vendorPanel.stats(), []);
  const ledger = useAsync(() => api.vendorPanel.ledger(), []);
  const payouts = useAsync(() => api.vendorPanel.payouts(), []);

  const available = stats.data?.availableBalance ?? 0;
  const onHold = stats.data?.onHold ?? 0;

  async function requestPayout() {
    setBusy(true);
    try {
      await api.vendorPanel.requestPayout(available);
      toast.success("পে-আউটের অনুরোধ জমা হয়েছে");
      setModalOpen(false);
      payouts.reload();
    } catch (err) {
      toast.error(err.message || "অনুরোধ পাঠানো গেল না");
    } finally {
      setBusy(false);
    }
  }

  if (stats.loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">আয় ও পেমেন্ট</h1>
        <p className="mt-0.5 text-[13.5px] text-muted">
          প্রতিটা বিক্রি, কমিশন আর রিফান্ড আলাদা এন্ট্রি হিসেবে জমা থাকে
        </p>
      </div>

      {/* ব্যালেন্স */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-brand-200 bg-brand-50 p-5">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-500 text-white">
            <Wallet size={19} />
          </span>
          <p className="mt-3 text-[12.5px] text-brand-700">তোলা যাবে</p>
          <p className="tnum font-display text-2xl font-bold text-brand-800">{money(available)}</p>
          <Button
            size="sm"
            className="mt-3 w-full"
            disabled={available <= 0}
            onClick={() => setModalOpen(true)}
          >
            <ArrowDownToLine size={15} /> টাকা তুলুন
          </Button>
        </Card>

        <Card className="p-5">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-accent-50 text-accent-500">
            <Clock size={19} />
          </span>
          <p className="mt-3 text-[12.5px] text-muted">হোল্ডে আছে</p>
          <p className="tnum font-display text-2xl font-bold text-ink">{money(onHold)}</p>
          <p className="mt-2 text-[12px] leading-relaxed text-muted">
            ডেলিভারির {toBnDigits(RULES.payoutHoldDays)} দিন পর খুলে যাবে
          </p>
        </Card>

        <Card className="p-5">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-canvas text-ink-2">
            <TrendingUp size={19} />
          </span>
          <p className="mt-3 text-[12.5px] text-muted">এ মাসের বিক্রি</p>
          <p className="tnum font-display text-2xl font-bold text-ink">
            {money(stats.data.monthSales)}
          </p>
          <p className="mt-2 text-[12px] text-muted">কমিশন কাটার আগে</p>
        </Card>
      </div>

      <Tabs
        tabs={[
          { value: "ledger", label: "লেজার" },
          { value: "payouts", label: "পে-আউট ইতিহাস" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "ledger" && (
        <Card className="overflow-hidden">
          {ledger.loading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {(ledger.data ?? []).map((entry) => {
                const kind = KIND[entry.kind] ?? KIND.sale;
                const Icon = kind.icon;
                return (
                  <li key={entry.id} className="flex items-center gap-3 px-4 py-3">
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-canvas ${kind.tone}`}>
                      <Icon size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-medium text-ink">{kind.label}</p>
                      <p className="tnum text-[12px] text-muted">
                        {entry.orderNumber} · {formatDate(entry.createdAt)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p
                        className={`tnum text-[14px] font-semibold ${
                          entry.amount >= 0 ? "text-brand-700" : "text-ink-2"
                        }`}
                      >
                        {entry.amount >= 0 ? "+" : "−"}
                        {money(Math.abs(entry.amount))}
                      </p>
                      <Badge tone={entry.released ? "ok" : "warn"} className="mt-0.5">
                        {entry.released ? "মুক্ত" : "হোল্ড"}
                      </Badge>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="border-t border-line bg-canvas px-4 py-3 text-[12.5px] leading-relaxed text-muted">
            <b className="text-ink">কেন লেজার?</b> ভেন্ডরের ব্যালেন্স আলাদা কলামে না রেখে
            প্রতিটা লেনদেন এন্ট্রি হিসেবে রাখা হয়। ব্যালেন্স = সব এন্ট্রির যোগফল। এতে হিসাব
            অডিট করা যায় আর দুইবার টাকা দেওয়ার ভুল হয় না।
          </div>
        </Card>
      )}

      {tab === "payouts" && (
        <Card className="overflow-hidden">
          {payouts.loading ? (
            <div className="space-y-2 p-4">
              {[1, 2].map((i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : (payouts.data ?? []).length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="কোনো পে-আউট নেই"
              description="ব্যালেন্স জমা হলে টাকা তোলার অনুরোধ করতে পারবেন।"
            />
          ) : (
            <ul className="divide-y divide-line">
              {payouts.data.map((p) => {
                const st = PAYOUT_STATUS[p.status] ?? PAYOUT_STATUS.processing;
                return (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="tnum text-[15px] font-semibold text-ink">{money(p.amount)}</p>
                      <p className="text-[12.5px] text-muted">{p.method}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <Badge tone={st.tone}>{st.label}</Badge>
                      <p className="mt-1 text-[11.5px] text-muted">
                        {p.paidAt ? formatDate(p.paidAt) : `অনুরোধ ${formatDate(p.createdAt)}`}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="টাকা তোলার অনুরোধ"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>
              বাতিল
            </Button>
            <Button size="sm" loading={busy} onClick={requestPayout}>
              অনুরোধ পাঠান
            </Button>
          </div>
        }
      >
        <p className="text-[14px] text-ink-2">
          আপনার তোলা যাবে এমন ব্যালেন্স{" "}
          <b className="tnum text-ink">{money(available)}</b>। অনুরোধ পাঠালে ১-২ কর্মদিবসের
          মধ্যে আপনার বিকাশ/ব্যাংক অ্যাকাউন্টে পাঠানো হবে।
        </p>
        <p className="mt-3 rounded-lg bg-canvas p-3 text-[12.5px] text-muted">
          হোল্ডে থাকা <b className="tnum text-ink">{money(onHold)}</b> এখনো তোলা যাবে না —
          ডেলিভারির {toBnDigits(RULES.payoutHoldDays)} দিন পার হলে যোগ হবে।
        </p>
      </Modal>
    </div>
  );
}
