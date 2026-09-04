import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard, Package, ClipboardList, Wallet, Menu, X, Store, ExternalLink,
} from "lucide-react";
import { useAuth } from "../../store/AuthContext";
import { classNames as cx } from "../../lib/format";
import { SITE } from "../../config";

const NAV = [
  { to: "/vendor", end: true, label: "ড্যাশবোর্ড", icon: LayoutDashboard },
  { to: "/vendor/products", label: "আমার পণ্য", icon: Package },
  { to: "/vendor/orders", label: "অর্ডার", icon: ClipboardList },
  { to: "/vendor/payouts", label: "আয় ও পেমেন্ট", icon: Wallet },
];

function NavItems({ onNavigate }) {
  return (
    <nav className="space-y-1">
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cx(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] font-medium transition",
              isActive
                ? "bg-brand-500 text-white shadow-sm"
                : "text-ink-2 hover:bg-brand-50 hover:text-brand-700",
            )
          }
        >
          <item.icon size={18} />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

export function VendorLayout() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-canvas">
      {/* টপবার */}
      <header className="sticky top-0 z-40 border-b border-line bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4">
          <button
            onClick={() => setOpen((o) => !o)}
            className="-ml-1 rounded-lg p-2 text-ink-2 transition hover:bg-canvas lg:hidden"
            aria-label="মেনু"
          >
            {open ? <X size={21} /> : <Menu size={21} />}
          </button>

          <Link to="/vendor" className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-ink font-display text-lg font-bold text-white">
              শ
            </span>
            <span className="hidden sm:block">
              <span className="block font-display text-[15px] leading-tight font-bold text-ink">
                ভেন্ডর প্যানেল
              </span>
              <span className="block text-[11.5px] leading-tight text-muted">{SITE.name}</span>
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-2">
            <Link
              to="/"
              className="hidden items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[13px] text-ink-2 transition hover:border-brand-300 hover:text-brand-600 sm:flex"
            >
              <ExternalLink size={14} /> সাইট দেখুন
            </Link>
            {user?.vendorSlug && (
              <Link
                to={`/shop/${user.vendorSlug}`}
                className="flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-2 text-[13px] font-medium text-brand-700 transition hover:bg-brand-100"
              >
                <Store size={14} />
                <span className="hidden sm:inline">আমার দোকান</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-5">
        {/* ডেস্কটপ সাইডবার */}
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-24 rounded-card border border-line bg-white p-3">
            <NavItems />
          </div>
        </aside>

        {/* মোবাইল সাইডবার */}
        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
            <div className="absolute top-0 bottom-0 left-0 w-64 bg-white p-4 shadow-lift">
              <p className="mb-3 font-display text-[15px] font-semibold">মেনু</p>
              <NavItems onNavigate={() => setOpen(false)} />
              <Link
                to="/"
                onClick={() => setOpen(false)}
                className="mt-3 flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] text-ink-2 hover:bg-canvas"
              >
                <ExternalLink size={18} /> সাইটে ফিরুন
              </Link>
            </div>
          </div>
        )}

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
