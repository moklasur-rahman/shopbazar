import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Store, Package, ClipboardList, Wallet, Menu, X,
  ExternalLink, LogOut, ShieldCheck, LayoutGrid, Tag, Images, Users,
  BarChart3, Settings,
} from "lucide-react";
import { api } from "../../api";
import { useAsync } from "../../hooks/useAsync";
import { useAuth } from "../../store/AuthContext";
import { classNames as cx } from "../../lib/format";
import { SITE } from "../../config";

/** দুই ভাগে সাজানো — উপরে রোজকার কাজ, নিচে সাইটের কনফিগারেশন */
const NAV_GROUPS = [
  {
    title: "রোজকার কাজ",
    items: [
      { to: "/admin", end: true, label: "ড্যাশবোর্ড", icon: LayoutDashboard },
      { to: "/admin/vendors", label: "দোকান", icon: Store, badge: "vendor_approvals" },
      { to: "/admin/products", label: "পণ্য", icon: Package, badge: "product_approvals" },
      { to: "/admin/orders", label: "অর্ডার", icon: ClipboardList },
      { to: "/admin/payouts", label: "পে-আউট", icon: Wallet, badge: "payouts" },
    ],
  },
  {
    title: "সাইট ব্যবস্থাপনা",
    items: [
      { to: "/admin/categories", label: "ক্যাটাগরি", icon: LayoutGrid },
      { to: "/admin/coupons", label: "কুপন", icon: Tag },
      { to: "/admin/banners", label: "ব্যানার", icon: Images },
      { to: "/admin/users", label: "ইউজার", icon: Users },
    ],
  },
  {
    title: "হিসাব",
    items: [
      { to: "/admin/reports", label: "রিপোর্ট", icon: BarChart3 },
      { to: "/admin/settings", label: "সেটিংস", icon: Settings },
    ],
  },
];

function NavItems({ todo = {}, onNavigate }) {
  return (
    <nav className="space-y-4">
      {NAV_GROUPS.map((group) => (
        <div key={group.title}>
          <p className="mb-1 px-3 text-[10.5px] font-semibold tracking-wider text-muted uppercase">
            {group.title}
          </p>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const count = item.badge ? todo[item.badge] : 0;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cx(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition",
                      isActive
                        ? "bg-ink text-white shadow-sm"
                        : "text-ink-2 hover:bg-canvas hover:text-ink",
                    )
                  }
                >
                  <item.icon size={17} />
                  <span className="flex-1">{item.label}</span>
                  {count > 0 && (
                    <span className="tnum grid h-5 min-w-5 place-items-center rounded-full bg-accent-400 px-1.5 text-[11px] font-bold text-ink">
                      {count}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

/**
 * প্ল্যাটফর্ম অ্যাডমিনের খোলস।
 *
 * ভেন্ডর প্যানেল থেকে আলাদা দেখতে — সাইডবারে গাঢ় হাইলাইট আর উপরে
 * "অ্যাডমিন" ব্যাজ। একই ব্রাউজারে দুই প্যানেল খোলা থাকলে কোনটায় আছেন
 * তা যেন এক নজরে বোঝা যায়।
 */
export function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  // সাইডবারের ব্যাজে "কতটা কাজ বাকি" দেখানোর জন্য
  const { data: stats } = useAsync(() => api.admin.stats(), []);
  const todo = stats?.todo ?? {};

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-40 border-b border-line bg-white">
        <div className="container-page flex h-16 items-center gap-3">
          <button
            onClick={() => setOpen((o) => !o)}
            className="-ml-1 rounded-lg p-2 text-ink-2 transition hover:bg-canvas lg:hidden"
            aria-label="মেনু"
          >
            {open ? <X size={21} /> : <Menu size={21} />}
          </button>

          <Link to="/admin" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-ink text-white">
              <ShieldCheck size={19} />
            </span>
            <span className="hidden sm:block">
              <span className="block font-display text-[15px] leading-tight font-bold text-ink">
                অ্যাডমিন প্যানেল
              </span>
              <span className="block text-[11.5px] leading-tight text-muted">
                {SITE.name}
              </span>
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-[13px] text-muted md:block">{user?.name}</span>
            <Link
              to="/"
              className="hidden items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[13px] text-ink-2 transition hover:border-brand-300 hover:text-brand-600 sm:flex"
            >
              <ExternalLink size={14} /> সাইট দেখুন
            </Link>
            <button
              onClick={async () => {
                await logout();
                navigate("/");
              }}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] text-ink-2 transition hover:bg-red-50 hover:text-red-600"
            >
              <LogOut size={15} />
              <span className="hidden sm:inline">লগআউট</span>
            </button>
          </div>
        </div>
      </header>

      <div className="container-page flex gap-6 py-5">
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-24 rounded-card border border-line bg-white p-3">
            <NavItems todo={todo} />
          </div>
        </aside>

        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
            <div className="absolute top-0 bottom-0 left-0 w-64 bg-white p-4 shadow-lift">
              <p className="mb-3 font-display text-[15px] font-semibold">অ্যাডমিন মেনু</p>
              <NavItems todo={todo} onNavigate={() => setOpen(false)} />
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
