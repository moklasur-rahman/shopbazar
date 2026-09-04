import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Package, Search, Check, X, EyeOff, ExternalLink } from "lucide-react";
import { api } from "../../api";
import { useAsync } from "../../hooks/useAsync";
import { useDebounce } from "../../hooks/useDebounce";
import { useToast } from "../../store/ToastContext";
import {
  Badge, Button, Card, EmptyState, Input, Pagination, Skeleton, SmartImage, Tabs,
} from "../../components/ui";
import { money, toBnDigits } from "../../lib/format";

const TABS = [
  { value: "pending", label: "অপেক্ষমাণ" },
  { value: "live", label: "সচল" },
  { value: "draft", label: "খসড়া" },
  { value: "rejected", label: "বাতিল" },
  { value: "", label: "সব" },
];

const STATUS = {
  live: { label: "সচল", tone: "ok" },
  pending: { label: "অপেক্ষমাণ", tone: "warn" },
  draft: { label: "খসড়া", tone: "neutral" },
  rejected: { label: "বাতিল", tone: "danger" },
};

export default function AdminProducts() {
  const [params, setParams] = useSearchParams();
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState(null);
  const toast = useToast();
  const search = useDebounce(term, 350);

  const status = params.get("status") ?? "pending";

  const { data, loading, reload } = useAsync(
    () => api.admin.listProducts({ status: status || undefined, search, page, page_size: 20 }),
    [status, search, page],
  );

  async function act(product, action) {
    setBusyId(product.id);
    try {
      await api.admin.productAction(product.id, action);
      const messages = {
        approve: "পণ্যটি সাইটে প্রকাশিত হয়েছে",
        reject: "পণ্যটি বাতিল করা হয়েছে",
        unpublish: "পণ্যটি সাইট থেকে সরানো হয়েছে",
      };
      toast.success(messages[action]);
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
          <h1 className="font-display text-2xl font-semibold text-ink">পণ্য</h1>
          <p className="tnum mt-0.5 text-[13.5px] text-muted">
            {loading ? "লোড হচ্ছে…" : `${toBnDigits(data?.count ?? 0)}টি পণ্য`}
          </p>
        </div>
        <Input
          icon={Search}
          value={term}
          onChange={(e) => { setTerm(e.target.value); setPage(1); }}
          placeholder="পণ্য বা দোকানের নাম…"
          className="w-full sm:w-64"
        />
      </div>

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
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : data?.results.length === 0 ? (
        <Card>
          <EmptyState
            icon={Package}
            title="এই অবস্থায় কোনো পণ্য নেই"
            description={
              status === "pending"
                ? "সব পণ্য যাচাই করা হয়ে গেছে — নতুন এলে এখানে দেখা যাবে।"
                : undefined
            }
          />
        </Card>
      ) : (
        <div className="space-y-2.5">
          {data.results.map((p) => {
            const st = STATUS[p.status] ?? STATUS.draft;
            const busy = busyId === p.id;
            return (
              <Card key={p.id} className="flex flex-wrap items-center gap-3 p-3.5">
                <SmartImage src={p.image} alt="" className="h-14 w-14 shrink-0 rounded-lg" />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to={`/product/${p.slug}`}
                      target="_blank"
                      className="line-clamp-2-safe max-w-md text-[14px] font-medium text-ink hover:text-brand-600"
                    >
                      {p.title}
                    </Link>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </div>
                  <p className="tnum mt-0.5 flex flex-wrap items-center gap-x-3 text-[12.5px] text-muted">
                    <Link to={`/shop/${p.vendorSlug}`} target="_blank"
                          className="hover:text-brand-600">
                      {p.vendorName}
                    </Link>
                    <span>{p.categoryName}</span>
                    <span className="font-medium text-ink">{money(p.price)}</span>
                    <span>স্টক {toBnDigits(p.stock)}</span>
                  </p>
                </div>

                <div className="flex shrink-0 gap-1.5">
                  <Button as={Link} to={`/product/${p.slug}`} target="_blank"
                          variant="ghost" size="sm" aria-label="সাইটে দেখুন">
                    <ExternalLink size={15} />
                  </Button>

                  {p.status !== "live" ? (
                    <Button size="sm" loading={busy} onClick={() => act(p, "approve")}>
                      <Check size={15} /> প্রকাশ করুন
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" loading={busy}
                            onClick={() => act(p, "unpublish")}>
                      <EyeOff size={15} /> সরান
                    </Button>
                  )}

                  {p.status === "pending" && (
                    <Button variant="ghost" size="sm" loading={busy}
                            onClick={() => act(p, "reject")}
                            className="text-red-600 hover:bg-red-50">
                      <X size={15} />
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Pagination page={page} count={data?.count ?? 0} pageSize={20} onChange={setPage} />
    </div>
  );
}
