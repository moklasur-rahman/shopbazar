import { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";

import { Layout } from "./components/layout/Layout";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AuthProvider, useAuth } from "./store/AuthContext";
import { CartProvider } from "./store/CartContext";
import { ToastProvider } from "./store/ToastContext";
import { Spinner } from "./components/ui";

/* ------------------------------------------------------------------
   কোন পাতা সাথে সাথে লোড হবে, কোনটা পরে
   ------------------------------------------------------------------
   ক্রেতার মূল পথ (হোম → পণ্য → কার্ট) সাথে সাথেই লাগে, তাই সেগুলো
   সরাসরি ইমপোর্ট। বাকি সব lazy — বিশেষ করে ভেন্ডর ও অ্যাডমিন প্যানেল,
   যেগুলো সাধারণ ক্রেতা কখনো খোলেনই না।

   এতে প্রথম লোডের বান্ডল অনেক ছোট হয়: ৬০৭ KB → ~২৫০ KB।
   ------------------------------------------------------------------ */

import Home from "./pages/Home";
import Products from "./pages/Products";
import ProductDetail from "./pages/ProductDetail";
import Cart from "./pages/Cart";
import NotFound from "./pages/NotFound";

// কম ব্যবহৃত ক্রেতার পাতা
const Shops = lazy(() => import("./pages/Shops"));
const VendorStore = lazy(() => import("./pages/VendorStore"));
const Checkout = lazy(() => import("./pages/Checkout"));
const OrderSuccess = lazy(() => import("./pages/OrderSuccess"));
const Orders = lazy(() => import("./pages/Orders"));
const OrderDetail = lazy(() => import("./pages/OrderDetail"));
const Wishlist = lazy(() => import("./pages/Wishlist"));
const Sell = lazy(() => import("./pages/Sell"));
const Help = lazy(() => import("./pages/Help"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));

// ভেন্ডর প্যানেল
const VendorLayout = lazy(() =>
  import("./components/layout/VendorLayout").then((m) => ({ default: m.VendorLayout })),
);
const VendorPending = lazy(() => import("./pages/vendor/VendorPending"));
const VendorDashboard = lazy(() => import("./pages/vendor/Dashboard"));
const VendorProducts = lazy(() => import("./pages/vendor/VendorProducts"));
const VendorProductForm = lazy(() => import("./pages/vendor/VendorProductForm"));
const VendorOrders = lazy(() => import("./pages/vendor/VendorOrders"));
const VendorPayouts = lazy(() => import("./pages/vendor/VendorPayouts"));

// অ্যাডমিন প্যানেল
const AdminLayout = lazy(() =>
  import("./components/layout/AdminLayout").then((m) => ({ default: m.AdminLayout })),
);
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminVendors = lazy(() => import("./pages/admin/AdminVendors"));
const AdminProducts = lazy(() => import("./pages/admin/AdminProducts"));
const AdminOrders = lazy(() => import("./pages/admin/AdminOrders"));
const AdminPayouts = lazy(() => import("./pages/admin/AdminPayouts"));
const AdminCategories = lazy(() => import("./pages/admin/AdminCategories"));
const AdminCoupons = lazy(() => import("./pages/admin/AdminCoupons"));
const AdminBanners = lazy(() => import("./pages/admin/AdminBanners"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminReports = lazy(() => import("./pages/admin/AdminReports"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));

/** lazy পাতা লোড হওয়ার সময় যা দেখা যায় */
function PageLoader() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <Spinner size={28} />
    </div>
  );
}

function FullPageLoader() {
  return (
    <div className="grid min-h-screen place-items-center">
      <Spinner size={28} />
    </div>
  );
}

/**
 * ভেন্ডর প্যানেলের দরজা।
 *
 * তিন ধাপে যাচাই:
 *   ১. লগইন করা আছে?           → না হলে /login
 *   ২. ভূমিকা vendor?           → না হলে হোম
 *   ৩. দোকান অনুমোদিত?          → না হলে "অপেক্ষমাণ" পাতা
 *
 * তৃতীয় ধাপটা জরুরি: নতুন দোকান `pending` অবস্থায় থাকে আর ব্যাকএন্ড
 * প্যানেলের প্রতিটা কলে ৪০৩ দেয়। এই চেক ছাড়া নতুন বিক্রেতা একটা
 * ভাঙা ড্যাশবোর্ড দেখতেন, কেন কাজ করছে না তার কোনো ব্যাখ্যা ছাড়াই।
 *
 * মনে রাখবেন: এটা শুধু UI-র সুবিধা। আসল নিরাপত্তা ব্যাকএন্ডের
 * IsApprovedVendor পারমিশনে।
 */
function RequireVendor({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageLoader />;

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  if (user.role !== "vendor") {
    return <Navigate to="/" replace />;
  }
  if (user.vendorStatus && user.vendorStatus !== "approved") {
    return <VendorPending />;
  }
  return children;
}

/**
 * প্ল্যাটফর্ম অ্যাডমিনের দরজা।
 *
 * ব্যাকএন্ডের `is_staff` ফ্ল্যাগই একমাত্র শর্ত — `role` ফিল্ড নয়,
 * কারণ ওটা রেজিস্ট্রেশনের সময় ব্যবহারকারীর পাঠানো ডেটা থেকে আসতে পারত।
 * এখানকার চেকটা শুধু UI-র সুবিধা; আসল পাহারা ব্যাকএন্ডের IsStaffUser-এ।
 */
function RequireStaff({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageLoader />;

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  if (!user.isStaff) {
    return <Navigate to="/" replace />;
  }
  return children;
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <CartProvider>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  {/* ক্রেতার সাইট */}
                  <Route element={<Layout />}>
                    <Route index element={<Home />} />
                    <Route path="products" element={<Products />} />
                    <Route path="product/:slug" element={<ProductDetail />} />
                    <Route path="shops" element={<Shops />} />
                    <Route path="shop/:slug" element={<VendorStore />} />
                    <Route path="cart" element={<Cart />} />
                    <Route path="checkout" element={<Checkout />} />
                    <Route path="order-success/:number" element={<OrderSuccess />} />
                    <Route path="orders" element={<Orders />} />
                    <Route path="orders/:number" element={<OrderDetail />} />
                    <Route path="wishlist" element={<Wishlist />} />
                    <Route path="sell" element={<Sell />} />
                    <Route path="help" element={<Help />} />
                    <Route path="login" element={<Login />} />
                    <Route path="register" element={<Register />} />
                    <Route path="*" element={<NotFound />} />
                  </Route>

                  {/* ভেন্ডর প্যানেল */}
                  <Route
                    path="/vendor"
                    element={
                      <RequireVendor>
                        <VendorLayout />
                      </RequireVendor>
                    }
                  >
                    <Route index element={<VendorDashboard />} />
                    <Route path="products" element={<VendorProducts />} />
                    <Route path="products/new" element={<VendorProductForm />} />
                    <Route path="products/:id" element={<VendorProductForm />} />
                    <Route path="orders" element={<VendorOrders />} />
                    <Route path="payouts" element={<VendorPayouts />} />
                  </Route>

                  {/* প্ল্যাটফর্ম অ্যাডমিন */}
                  <Route
                    path="/admin"
                    element={
                      <RequireStaff>
                        <AdminLayout />
                      </RequireStaff>
                    }
                  >
                    <Route index element={<AdminDashboard />} />
                    <Route path="vendors" element={<AdminVendors />} />
                    <Route path="products" element={<AdminProducts />} />
                    <Route path="orders" element={<AdminOrders />} />
                    <Route path="payouts" element={<AdminPayouts />} />
                    <Route path="categories" element={<AdminCategories />} />
                    <Route path="coupons" element={<AdminCoupons />} />
                    <Route path="banners" element={<AdminBanners />} />
                    <Route path="users" element={<AdminUsers />} />
                    <Route path="reports" element={<AdminReports />} />
                    <Route path="settings" element={<AdminSettings />} />
                  </Route>
                </Routes>
              </Suspense>
            </CartProvider>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
