import { useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Home, LayoutGrid, ShoppingCart, Heart, User } from "lucide-react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { useCart } from "../../store/CartContext";
import { classNames as cx, toBnDigits } from "../../lib/format";

const TABS = [
  { to: "/", label: "হোম", icon: Home, end: true },
  { to: "/products", label: "ক্যাটাগরি", icon: LayoutGrid },
  { to: "/cart", label: "কার্ট", icon: ShoppingCart, badge: "cart" },
  { to: "/wishlist", label: "উইশলিস্ট", icon: Heart, badge: "wish" },
  { to: "/orders", label: "অ্যাকাউন্ট", icon: User },
];

function MobileTabBar() {
  const { itemCount, wishlist } = useCart();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/97 backdrop-blur lg:hidden">
      <div className="flex">
        {TABS.map((tab) => {
          const badge =
            tab.badge === "cart" ? itemCount : tab.badge === "wish" ? wishlist.length : 0;
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                cx(
                  "relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[10.5px] font-medium transition",
                  isActive ? "text-brand-600" : "text-muted",
                )
              }
            >
              <span className="relative">
                <tab.icon size={20} />
                {badge > 0 && (
                  <span className="tnum absolute -top-1.5 -right-2 grid h-4 min-w-4 place-items-center rounded-full bg-brand-500 px-1 text-[9px] font-bold text-white">
                    {toBnDigits(badge)}
                  </span>
                )}
              </span>
              {tab.label}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

/** রুট বদলালে পাতা উপরে উঠে যাবে */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);
  return null;
}

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <ScrollToTop />
      <Navbar />
      <main className="flex-1 pb-16 lg:pb-0">
        <Outlet />
      </main>
      <Footer />
      <MobileTabBar />
    </div>
  );
}
