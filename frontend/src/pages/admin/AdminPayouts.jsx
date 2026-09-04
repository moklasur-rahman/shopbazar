import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Wallet, Check, X, Store, Info } from "lucide-react";
import { api } from "../../api";
import { useAsync } from "../../hooks/useAsync";
import { useToast } from "../../store/ToastContext";
import {
  Badge, Button, Card, EmptyState, Input, Modal, Pagination, Skeleton, Tabs,
} from "../../components/ui";
import { formatDate, money, toBnDigits } from "../../lib/format";

const TABS = [
  { value: "processing", label: "পাঠানো বাকি" },
  { value: "paid", label: "পরিশোধিত" },
  { value: "failed", label: "ব্যর্থ" },
  { value: "", label: "সব" },
];

const STATUS = {
  requested: { label: "অনুরোধ", tone: "warn" },
  processing: { label: "প্রক্রিয়াধীন", tone: "warn" },
  paid: { label: "পরিশোধিত", tone: "ok" },
  failed: { label: "ব্যর্থ", tone: "danger" },
};

export default function AdminPayouts() {
  const [params, setParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [paying, setPaying] = useState(null);
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const status = params.get("status") ?? "processing";

  const { data, loading, reload } = useAsync(
    () => api.admin.listPayouts({ status: status || undefined, page, page_size: 20 }),
    [status, page],
  );

  async function confirmPaid() {
    setBusy(true);
    try {
      await api.admin.payoutAction(paying.id, "mark-paid", reference.trim());
      toast.success("পে-আউট পরিশোধিত হিসেবে চিহ্নিত হয়েছে");
      setPaying(null);
      setReference("");
      reload();
    } catch (err) {
      toast.error(err.message || "কাজটি করা গেল না");
    } finally {
      setBusy(false);
    }
  }

  async function markFailed(payout) {
    try {
      await api.admin.payoutAction(payout.id, "mark-failed");
      toast.info("ব্যর্থ হিসেবে চিহ্নিত — টাকা আবার ভেন্ডরের ব্যালেন্সে ফিরে গেছে");
      reload();
    } catch (err) {
      toast.error(err.message || "কাজটি করা গেল না");
    }
  }

  const pendingTotal = (data?.results ?? [])
    .filter((p) => p.status === "processing")
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">পে-আউট</h1>
        <p className="mt-0.5 text-[13.5px] text-muted">
          বিক্রেতাদের টাকা পাঠানোর অনুরোধ
        </p>
      </div>

      {status === "processing" && pendingTotal > 0 && (
        <Card className="flex flex-wrap items-center gap-3 border-accent-200 bg-accent-50 px-4 py-3.5">
          <Info size={17} className="shrink-0 text-accent-500" />
          <p className="flex-1 text-[13.5px] text-accent-600">
            এই পাতার অনুরোধগুলো মিলিয়ে মোট{" "}
            <b className="tnum">{money(pendingTotal)}</b> পাঠানো বাকি। বিকাশ/ব্যাংকে
            পাঠানোর পর এখানে চিহ্নিত করুন।
          </p>
        </Card>
      )}

      <Tabs
        tabs={TABS}
        active={status}
        onChange={(v) => {
          const next = new URLSearchParams(params);
          if (v) next.set("status", v); else next.delete("status");
          setParams(next);
          setPage(1);
        }}
      />

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : data?.results.length === 0 ? (
        <Card>
          <EmptyState
            icon={Wallet}
            title="কোনো পে-আউট নেই"
            description={
              status === "processing"
                ? "সব টাকা পাঠানো হয়ে গেছে — নতুন অনুরোধ এলে এখানে দেখা যাবে।"
                : undefined
            }
          />
        </Card>
      ) : (
        <div className="space-y-2.5">
          {data.results.map((p) => {
            const st = STATUS[p.status] ?? STATUS.processing;
            return (
              <Card key={p.id} className="flex flex-wrap items-center gap-3 p-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
                  <Store size={19} />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-[15px] font-semibold text-ink">
                      {p.vendorName}
                    </span>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </div>
                  <p className="tnum mt-0.5 flex flex-wrap items-center gap-x-3 text-[12.5px] text-muted">
                    <span>{p.method || "নির্ধারিত হয়নি"}</span>
                    <span>{toBnDigits(p.entryCount)}টি লেনদেন</span>
                    <span>অনুরোধ {formatDate(p.createdAt)}</span>
                    {p.paidAt && <span>পরিশোধ {formatDate(p.paidAt)}</span>}
                  </p>
                  {p.reference && (
                    <p className="tnum mt-0.5 text-[12px] text-muted">
                      রেফারেন্স: {p.reference}
                    </p>
                  )}
                </div>

                <p className="tnum shrink-0 font-display text-xl font-bold text-brand-700">
                  {money(p.amount)}
                </p>

                {["requested", "processing"].includes(p.status) && (
                  <div className="flex shrink-0 gap-1.5">
                    <Button size="sm" onClick={() => setPaying(p)}>
                      <Check size={15} /> পাঠানো হয়েছে
                    </Button>
                    <Button variant="ghost" size="sm"
                            onClick={() => markFailed(p)}
                            className="text-red-600 hover:bg-red-50">
                      <X size={15} />
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Pagination page={page} count={data?.count ?? 0} pageSize={20} onChange={setPage} />

      <Modal
        open={Boolean(paying)}
        onClose={() => setPaying(null)}
        title="পে-আউট পরিশোধিত চিহ্নিত করুন"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setPaying(null)}>
              বাতিল
            </Button>
            <Button size="sm" loading={busy} onClick={confirmPaid}>
              নিশ্চিত করুন
            </Button>
          </div>
        }
      >
        {paying && (
          <>
            <p className="text-[14px] text-ink-2">
              <b className="text-ink">{paying.vendorName}</b> কে{" "}
              <b className="tnum text-ink">{money(paying.amount)}</b> পাঠানো হয়েছে —
              এটা নিশ্চিত করছেন?
            </p>
            <p className="tnum mt-1.5 text-[13px] text-muted">
              মাধ্যম: {paying.method || "নির্ধারিত হয়নি"}
            </p>
            <div className="mt-4">
              <label className="mb-1.5 block text-[13px] font-medium text-ink-2">
                ট্রানজেকশন আইডি (ঐচ্ছিক)
              </label>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="যেমন: BKS7X29QW1"
              />
              <p className="mt-1.5 text-[12px] text-muted">
                পরে কোনো প্রশ্ন উঠলে এটাই প্রমাণ হিসেবে কাজে লাগবে।
              </p>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
