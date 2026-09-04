import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, Pencil, Trash2, Package, AlertTriangle } from "lucide-react";
import { api } from "../../api";
import { useAsync } from "../../hooks/useAsync";
import { useDebounce } from "../../hooks/useDebounce";
import { useToast } from "../../store/ToastContext";
import {
  Badge, Button, Card, EmptyState, Input, Modal, Pagination, Skeleton, SmartImage,
} from "../../components/ui";
import { money, toBnDigits } from "../../lib/format";

export default function VendorProducts() {
  const toast = useToast();
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState(null);
  const search = useDebounce(term, 350);

  const { data, loading, reload } = useAsync(
    () => api.vendorPanel.listProducts({ search, page, page_size: 10 }),
    [search, page],
  );

  async function confirmDelete() {
    try {
      await api.vendorPanel.deleteProduct(deleting.id);
      toast.success("পণ্যটি মুছে ফেলা হয়েছে");
      setDeleting(null);
      reload();
    } catch (err) {
      toast.error(err.message || "মোছা গেল না");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">আমার পণ্য</h1>
          <p className="tnum mt-0.5 text-[13.5px] text-muted">
            {loading ? "লোড হচ্ছে…" : `${toBnDigits(data?.count ?? 0)}টি পণ্য`}
          </p>
        </div>

        <div className="flex w-full gap-2 sm:w-auto">
          <Input
            icon={Search}
            value={term}
            onChange={(e) => {
              setTerm(e.target.value);
              setPage(1);
            }}
            placeholder="পণ্য খুঁজুন…"
            className="w-full sm:w-56"
          />
          <Button as={Link} to="/vendor/products/new" className="shrink-0">
            <Plus size={17} /> নতুন
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="space-y-2 p-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16" />)}
          </div>
        ) : data?.results.length === 0 ? (
          <EmptyState
            icon={Package}
            title="কোনো পণ্য নেই"
            description="প্রথম পণ্যটি যোগ করে বিক্রি শুরু করুন।"
            action={
              <Button as={Link} to="/vendor/products/new">
                <Plus size={17} /> পণ্য যোগ করুন
              </Button>
            }
          />
        ) : (
          <>
            {/* ডেস্কটপ টেবিল */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-[13.5px]">
                <thead>
                  <tr className="border-b border-line bg-canvas text-left text-[12px] text-muted">
                    <th className="px-4 py-3 font-medium">পণ্য</th>
                    <th className="px-4 py-3 font-medium">দাম</th>
                    <th className="px-4 py-3 font-medium">স্টক</th>
                    <th className="px-4 py-3 font-medium">বিক্রি</th>
                    <th className="px-4 py-3 font-medium">অবস্থা</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.results.map((p) => (
                    <tr key={p.id} className="transition hover:bg-canvas/60">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <SmartImage
                            src={p.images?.[0]}
                            alt=""
                            className="h-11 w-11 shrink-0 rounded-lg"
                          />
                          <div className="min-w-0 max-w-xs">
                            <Link
                              to={`/product/${p.slug}`}
                              className="line-clamp-2-safe font-medium text-ink hover:text-brand-600"
                            >
                              {p.title}
                            </Link>
                            <p className="text-[12px] text-muted">{p.categoryName}</p>
                          </div>
                        </div>
                      </td>
                      <td className="tnum px-4 py-3 font-medium">{money(p.price)}</td>
                      <td className="tnum px-4 py-3">
                        <span className={p.stock < 15 ? "font-semibold text-accent-600" : ""}>
                          {toBnDigits(p.stock)}
                        </span>
                        {p.stock < 15 && (
                          <AlertTriangle size={13} className="ml-1 inline text-accent-500" />
                        )}
                      </td>
                      <td className="tnum px-4 py-3 text-muted">{toBnDigits(p.soldCount)}</td>
                      <td className="px-4 py-3">
                        <Badge tone={p.status === "live" ? "ok" : "warn"}>
                          {p.status === "live" ? "সচল" : "অপেক্ষমাণ"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Link
                            to={`/vendor/products/${p.id}`}
                            className="rounded-lg p-2 text-ink-2 transition hover:bg-brand-50 hover:text-brand-600"
                            aria-label="সম্পাদনা"
                          >
                            <Pencil size={15} />
                          </Link>
                          <button
                            onClick={() => setDeleting(p)}
                            className="rounded-lg p-2 text-ink-2 transition hover:bg-red-50 hover:text-red-600"
                            aria-label="মুছুন"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* মোবাইল কার্ড */}
            <ul className="divide-y divide-line md:hidden">
              {data.results.map((p) => (
                <li key={p.id} className="flex gap-3 p-4">
                  <SmartImage src={p.images?.[0]} alt="" className="h-16 w-16 shrink-0 rounded-lg" />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2-safe text-[13.5px] font-medium text-ink">{p.title}</p>
                    <div className="tnum mt-1 flex flex-wrap items-center gap-x-3 text-[12.5px] text-muted">
                      <span className="font-semibold text-ink">{money(p.price)}</span>
                      <span className={p.stock < 15 ? "text-accent-600" : ""}>
                        স্টক {toBnDigits(p.stock)}
                      </span>
                      <span>বিক্রি {toBnDigits(p.soldCount)}</span>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <Button as={Link} to={`/vendor/products/${p.id}`} size="sm" variant="outline">
                        <Pencil size={13} /> সম্পাদনা
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleting(p)}>
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <Pagination page={page} count={data?.count ?? 0} pageSize={10} onChange={setPage} />

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="পণ্যটি মুছবেন?"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setDeleting(null)}>
              না, থাক
            </Button>
            <Button variant="danger" size="sm" onClick={confirmDelete}>
              হ্যাঁ, মুছে ফেলুন
            </Button>
          </div>
        }
      >
        <p className="text-[14px] text-ink-2">
          <b className="text-ink">{deleting?.title}</b> মুছে ফেললে এটি আর সাইটে দেখা যাবে না।
          আগের অর্ডারগুলো ঠিক থাকবে।
        </p>
      </Modal>
    </div>
  );
}
