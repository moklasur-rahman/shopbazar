import { useState } from "react";
import { Users, Search, Store, ShieldCheck, Ban, Check, BadgeCheck } from "lucide-react";
import { api } from "../../api";
import { useAsync } from "../../hooks/useAsync";
import { useDebounce } from "../../hooks/useDebounce";
import { useToast } from "../../store/ToastContext";
import { useAuth } from "../../store/AuthContext";
import {
  Badge, Button, Card, EmptyState, Input, Pagination, Skeleton, Tabs,
} from "../../components/ui";
import { formatDate, toBnDigits } from "../../lib/format";

const TABS = [
  { value: "", label: "সবাই" },
  { value: "customer", label: "ক্রেতা" },
  { value: "vendor", label: "বিক্রেতা" },
  { value: "staff", label: "স্টাফ" },
];

const ROLE = {
  customer: { label: "ক্রেতা", tone: "neutral", icon: Users },
  vendor: { label: "বিক্রেতা", tone: "warn", icon: Store },
  staff: { label: "স্টাফ", tone: "info", icon: ShieldCheck },
};

export default function AdminUsers() {
  const toast = useToast();
  const { user: me } = useAuth();
  const [role, setRole] = useState("");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState(null);
  const search = useDebounce(term, 350);

  const { data, loading, reload } = useAsync(
    () => api.admin.listUsers({ role: role || undefined, search, page, page_size: 20 }),
    [role, search, page],
  );

  async function toggle(user) {
    setBusyId(user.id);
    try {
      await api.admin.userAction(user.id, user.isActive ? "deactivate" : "activate");
      toast.success(
        user.isActive
          ? `${user.name} এর অ্যাকাউন্ট বন্ধ করা হয়েছে`
          : `${user.name} এর অ্যাকাউন্ট আবার চালু হয়েছে`,
      );
      reload();
    } catch (err) {
      toast.error(err.message || "কাজটি করা গেল না");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">ইউজার</h1>
          <p className="tnum mt-0.5 text-[13.5px] text-muted">
            {loading ? "লোড হচ্ছে…" : `${toBnDigits(data?.count ?? 0)}টি অ্যাকাউন্ট`}
          </p>
        </div>
        <Input
          icon={Search}
          value={term}
          onChange={(e) => { setTerm(e.target.value); setPage(1); }}
          placeholder="নাম বা মোবাইল নম্বর…"
          className="w-full sm:w-64"
        />
      </div>

      <Tabs tabs={TABS} active={role}
            onChange={(v) => { setRole(v); setPage(1); }} />

      <Card className="flex items-start gap-2.5 border-line bg-canvas px-4 py-3">
        <Ban size={16} className="mt-0.5 shrink-0 text-muted" />
        <p className="text-[12.5px] leading-relaxed text-muted">
          অ্যাকাউন্ট মুছে ফেলার সুযোগ নেই — মুছলে তার অর্ডারের ইতিহাসও হারিয়ে যেত।
          সমস্যা হলে <b>বন্ধ</b> করে দিন, পরে আবার চালু করা যাবে।
        </p>
      </Card>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : data?.results.length === 0 ? (
        <Card>
          <EmptyState icon={Users} title="কোনো অ্যাকাউন্ট নেই" />
        </Card>
      ) : (
        <div className="space-y-2.5">
          {data.results.map((u) => {
            const r = ROLE[u.role] ?? ROLE.customer;
            const Icon = r.icon;
            const isMe = me?.id === u.id;
            return (
              <Card key={u.id} className="flex flex-wrap items-center gap-3 p-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-canvas text-ink-2">
                  <Icon size={19} />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14.5px] font-medium text-ink">{u.name}</span>
                    <Badge tone={r.tone}>{r.label}</Badge>
                    {isMe && <Badge tone="ok">আপনি</Badge>}
                    {u.isVerified && (
                      <BadgeCheck size={14} className="text-brand-500" />
                    )}
                    {!u.isActive && <Badge tone="danger">বন্ধ</Badge>}
                  </div>
                  <p className="tnum mt-0.5 flex flex-wrap items-center gap-x-3 text-[12.5px] text-muted">
                    <span>{toBnDigits(u.phone)}</span>
                    {u.email && <span className="truncate">{u.email}</span>}
                    {u.shopName && <span>দোকান: {u.shopName}</span>}
                    {u.orderCount > 0 && <span>{toBnDigits(u.orderCount)}টি অর্ডার</span>}
                    <span>যোগ {formatDate(u.joinedAt)}</span>
                  </p>
                </div>

                {!isMe && (
                  <Button
                    variant={u.isActive ? "outline" : "primary"}
                    size="sm"
                    loading={busyId === u.id}
                    onClick={() => toggle(u)}
                    className={u.isActive ? "text-red-600 hover:border-red-300" : ""}
                  >
                    {u.isActive ? (
                      <><Ban size={14} /> বন্ধ করুন</>
                    ) : (
                      <><Check size={14} /> চালু করুন</>
                    )}
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Pagination page={page} count={data?.count ?? 0} pageSize={20} onChange={setPage} />
    </div>
  );
}
