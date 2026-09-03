import { useState } from "react";
import { Link } from "react-router-dom";
import { Search, BadgeCheck, MapPin, Store } from "lucide-react";
import { api } from "../api";
import { useAsync } from "../hooks/useAsync";
import { useDebounce } from "../hooks/useDebounce";
import { Badge, Card, Input, Rating, Skeleton, SmartImage, EmptyState } from "../components/ui";
import { formatDate, toBnDigits } from "../lib/format";

export default function Shops() {
  const [term, setTerm] = useState("");
  const search = useDebounce(term, 350);
  const { data, loading } = useAsync(
    () => api.vendors.list({ search, page_size: 24 }),
    [search],
  );

  return (
    <div className="container-page py-5">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">সব দোকান</h1>
          <p className="mt-0.5 text-[13.5px] text-muted">
            {loading ? "লোড হচ্ছে…" : `${toBnDigits(data?.count ?? 0)}টি যাচাই করা বিক্রেতা`}
          </p>
        </div>
        <Input
          icon={Search}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="দোকানের নাম লিখুন…"
          className="w-full sm:w-72"
        />
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : data?.results.length === 0 ? (
        <Card>
          <EmptyState
            icon={Store}
            title="কোনো দোকান পাওয়া যায়নি"
            description="অন্য নাম দিয়ে খুঁজে দেখুন।"
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.results.map((v) => (
            <Card key={v.id} hover className="overflow-hidden">
              <Link to={`/shop/${v.slug}`}>
                <div className="relative h-24">
                  <img src={v.banner} alt="" className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/60 to-transparent" />
                </div>

                <div className="px-4 pb-4">
                  <div className="-mt-8 mb-2.5">
                    <SmartImage
                      src={v.logo}
                      alt={v.shopName}
                      className="h-16 w-16 rounded-xl border-2 border-white shadow-soft"
                    />
                  </div>

                  <div className="flex items-center gap-1.5">
                    <h2 className="truncate font-display text-base font-semibold text-ink">
                      {v.shopName}
                    </h2>
                    {v.isVerified && <BadgeCheck size={16} className="shrink-0 text-brand-500" />}
                  </div>

                  <Rating value={v.rating} count={v.ratingCount} size={12} className="mt-1" />

                  <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[12px] text-muted">
                    <span className="flex items-center gap-1">
                      <MapPin size={12} /> {v.district}
                    </span>
                    <span className="tnum">{toBnDigits(v.productCount)}টি পণ্য</span>
                  </div>

                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    <Badge tone="ok">{toBnDigits(v.responseRate)}% রেসপন্স</Badge>
                    <Badge tone="neutral">
                      {toBnDigits(v.shipsIn)} দিনে পাঠায়
                    </Badge>
                  </div>

                  <p className="mt-2.5 text-[11.5px] text-muted">
                    যুক্ত হয়েছে {formatDate(v.since)}
                  </p>
                </div>
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
