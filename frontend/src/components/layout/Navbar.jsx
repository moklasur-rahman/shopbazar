import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate, useSearchParams } from "react-router-dom";
import {
  Search, ShoppingCart, Heart, User, Menu, Store, Package,
  LogOut, LayoutDashboard, ChevronDown, Phone, X, HelpCircle, ShieldCheck,
} from "lucide-react";
import { Badge, Button, Drawer } from "../ui";
import { useCart } from "../../store/CartContext";
import { useAuth } from "../../store/AuthContext";
import { api, isMockMode } from "../../api";
import { useAsync } from "../../hooks/useAsync";
import { classNames as cx, toBnDigits } from "../../lib/format";
import { SITE } from "../../config";

function Logo({ onClick }) {
  return (
    <Link to="/" onClick={onClick} className="flex shrink-0 items-center gap-2">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-500 font-display text-lg font-bold text-white">
        শ
      </span>
      <span className="hidden font-display text-lg font-bold tracking-tight text-ink sm:block">
        {SITE.name}
      </span>
    </Link>
  );
}

function SearchBox({ className, autoFocus, onDone }) {
  const [params] = useSearchParams();
  const [term, setTerm] = useState(params.get("search") ?? "");
  const navigate = useNavigate();

  function submit(e) {
    e.preventDefault();
    const q = term.trim();
    navigate(q ? `/products?search=${encodeURIComponent(q)}` : "/products");
    onDone?.();
  }

  return (
    <form onSubmit={submit} className={cx("relative", className)} role="search">
      <Search size={17} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
      <input
        value={term}
        autoFocus={autoFocus}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="পণ্য, ব্র্যান্ড বা দোকান খুঁজুন…"
        className="h-11 w-full rounded-xl border border-line-2 bg-white pr-24 pl-10 text-sm transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 focus:outline-none"
      />
      {term && (
        <button
          type="button"
          onClick={() => setTerm("")}
          className="absolute top-1/2 right-[86px] -translate-y-1/2 text-muted hover:text-ink"
          aria-label="মুছুন"
        >
          <X size={15} />
        </button>
      )}
      <Button type="submit" size="sm" className="absolute top-1/2 right-1.5 -translate-y-1/2">
        খুঁজুন
      </Button>
    </form>
  );
}

function AccountMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (!user) {
    return (
      <Link
        to="/login"
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-ink-2 transition hover:bg-brand-50 hover:text-brand-700"
      >
        <User size={19} />
        <span className="hidden lg:block">লগইন</span>
      </Link>
    );
  }

  const links = [
    { to: "/orders", label: "আমার অর্ডার", icon: Package },
    { to: "/wishlist", label: "উইশলিস্ট", icon: Heart },
  ];
  if (user.role === "vendor") {
    links.unshift({ to: "/vendor", label: "ভেন্ডর ড্যাশবোর্ড", icon: LayoutDashboard });
  }
  if (user.isStaff) {
    links.unshift({ to: "/admin", label: "অ্যাডমিন প্যানেল", icon: ShieldCheck });
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-ink-2 transition hover:bg-brand-50 hover:text-brand-700"
      >
        <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-500 text-xs font-semibold text-white">
          {user.name.charAt(0)}
        </span>
        <span className="hidden max-w-24 truncate lg:block">{user.name}</span>
        <ChevronDown size={14} className={cx("transition", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-line bg-white shadow-lift">
          <div className="border-b border-line px-4 py-3">
            <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
            <p className="tnum truncate text-xs text-muted">{toBnDigits(user.phone)}</p>
          </div>
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink-2 transition hover:bg-canvas hover:text-brand-700"
            >
              <l.icon size={16} />
              {l.label}
            </Link>
          ))}
          <button
            onClick={async () => {
              await logout();
              setOpen(false);
              navigate("/");
            }}
            className="flex w-full items-center gap-2.5 border-t border-line px-4 py-2.5 text-sm text-red-600 transition hover:bg-red-50"
          >
            <LogOut size={16} />
            লগআউট
          </button>
        </div>
      )}
    </div>
  );
}

export function Navbar() {
  const { itemCount, wishlist } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { data: categories } = useAsync(() => api.catalog.listCategories(), []);

  return (
    <>
      {/* ঘোষণা বার */}
      <div className="bg-ink text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-1.5 text-[12.5px]">
          <p className="truncate">
            ৳১০০০+ অর্ডারে <span className="font-semibold text-accent-300">SHOPBAZAR100</span> কোডে ৳১০০ ছাড়
          </p>
          <div className="hidden items-center gap-4 sm:flex">
            <a href={`tel:${SITE.supportPhone}`} className="flex items-center gap-1 opacity-85 hover:opacity-100">
              <Phone size={12} /> {SITE.supportPhone}
            </a>
            <Link to="/help" className="opacity-85 hover:opacity-100">
              সাহায্য
            </Link>
            <Link
              to="/sell"
              className="rounded bg-white/10 px-2 py-0.5 font-medium text-accent-300 transition hover:bg-white/20"
            >
              বিক্রেতা হোন
            </Link>
          </div>
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="container-page">
          <div className="flex h-16 items-center gap-3">
            <button
              onClick={() => setMenuOpen(true)}
              className="-ml-1 rounded-lg p-2 text-ink-2 transition hover:bg-canvas lg:hidden"
              aria-label="মেনু"
            >
              <Menu size={21} />
            </button>

            <Logo />

            <SearchBox className="mx-4 hidden flex-1 md:block" />

            <div className="ml-auto flex items-center gap-0.5">
              <button
                onClick={() => setSearchOpen(true)}
                className="rounded-lg p-2 text-ink-2 transition hover:bg-canvas md:hidden"
                aria-label="খুঁজুন"
              >
                <Search size={20} />
              </button>

              <Link
                to="/wishlist"
                className="relative hidden rounded-lg p-2 text-ink-2 transition hover:bg-brand-50 hover:text-brand-700 sm:block"
                aria-label="উইশলিস্ট"
              >
                <Heart size={20} />
                {wishlist.length > 0 && (
                  <span className="tnum absolute top-0.5 right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {toBnDigits(wishlist.length)}
                  </span>
                )}
              </Link>

              <Link
                to="/cart"
                className="relative rounded-lg p-2 text-ink-2 transition hover:bg-brand-50 hover:text-brand-700"
                aria-label="কার্ট"
              >
                <ShoppingCart size={20} />
                {itemCount > 0 && (
                  <span className="tnum absolute top-0.5 right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white">
                    {toBnDigits(itemCount)}
                  </span>
                )}
              </Link>

              <AccountMenu />
            </div>
          </div>

          {/* ক্যাটাগরি স্ট্রিপ */}
          <nav className="no-scrollbar -mb-px hidden gap-1 overflow-x-auto lg:flex">
            <NavLink
              to="/products"
              end
              className={({ isActive }) =>
                cx(
                  "border-b-2 px-3 py-2.5 text-[13.5px] font-medium whitespace-nowrap transition",
                  isActive
                    ? "border-brand-500 text-brand-700"
                    : "border-transparent text-ink-2 hover:text-brand-600",
                )
              }
            >
              সব পণ্য
            </NavLink>
            {(categories ?? []).map((c) => (
              <NavLink
                key={c.slug}
                to={`/products?category=${c.slug}`}
                className="border-b-2 border-transparent px-3 py-2.5 text-[13.5px] font-medium whitespace-nowrap text-ink-2 transition hover:border-brand-300 hover:text-brand-600"
              >
                <span className="mr-1">{c.icon}</span>
                {c.name}
              </NavLink>
            ))}
            <NavLink
              to="/shops"
              className="ml-auto border-b-2 border-transparent px-3 py-2.5 text-[13.5px] font-medium whitespace-nowrap text-ink-2 transition hover:border-brand-300 hover:text-brand-600"
            >
              <Store size={14} className="mr-1 inline" />
              সব দোকান
            </NavLink>
            <NavLink
              to="/help"
              className="border-b-2 border-transparent px-3 py-2.5 text-[13.5px] font-medium whitespace-nowrap text-ink-2 transition hover:border-brand-300 hover:text-brand-600"
            >
              <HelpCircle size={14} className="mr-1 inline" />
              সাহায্য
            </NavLink>
          </nav>
        </div>

        {/* মোবাইল সার্চ */}
        {searchOpen && (
          <div className="border-t border-line bg-white p-3 md:hidden">
            <SearchBox autoFocus onDone={() => setSearchOpen(false)} />
          </div>
        )}
      </header>

      {/* মোবাইল মেনু */}
      <Drawer open={menuOpen} onClose={() => setMenuOpen(false)} title="ক্যাটাগরি" side="left">
        <div className="p-2">
          <Link
            to="/products"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-ink transition hover:bg-canvas"
          >
            <span className="text-lg">🗂️</span> সব পণ্য
          </Link>
          {(categories ?? []).map((c) => (
            <Link
              key={c.slug}
              to={`/products?category=${c.slug}`}
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-ink transition hover:bg-canvas"
            >
              <span className="text-lg">{c.icon}</span>
              <span className="flex-1">{c.name}</span>
              <span className="text-xs text-muted">{c.children.length}</span>
            </Link>
          ))}
          <div className="my-2 border-t border-line" />
          <Link
            to="/shops"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-ink transition hover:bg-canvas"
          >
            <Store size={18} /> সব দোকান
          </Link>
          <Link
            to="/help"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-ink transition hover:bg-canvas"
          >
            <HelpCircle size={18} /> সাহায্য ও তথ্য
          </Link>
          <Link
            to="/sell"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-3 rounded-lg bg-accent-50 px-3 py-3 text-sm font-medium text-accent-600 transition hover:bg-accent-100"
          >
            <LayoutDashboard size={18} /> বিক্রেতা হিসেবে যোগ দিন
          </Link>

          {isMockMode && (
            <div className="mt-4 rounded-lg bg-canvas p-3">
              <Badge tone="warn">ডেমো মোড</Badge>
              <p className="mt-1.5 text-xs leading-relaxed text-muted">
                ডেটা ব্রাউজারেই আছে। Django যোগ করলে <code className="text-[11px]">.env</code>-এ
                VITE_USE_MOCK=false দিন।
              </p>
            </div>
          )}
        </div>
      </Drawer>
    </>
  );
}
