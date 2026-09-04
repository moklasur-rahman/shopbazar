/**
 * ফ্রন্টএন্ডের ডেটার আকার — এক জায়গায়।
 *
 * এগুলো `src/api/adapters.js` যা ফেরত দেয় তার হুবহু বর্ণনা। অ্যাডাপ্টারে
 * কোনো ফিল্ড যোগ বা বাদ দিলে এখানেও দিতে হবে — নাহলে টাইপ মিথ্যা বলবে,
 * আর মিথ্যা টাইপ টাইপ না থাকার চেয়েও খারাপ।
 *
 * `.d.ts` মানে এতে শুধু বর্ণনা, কোনো কোড নেই — বিল্ডে একটা বাইটও যায় না।
 * ইমপোর্ট ছাড়াই সব ফাইলে পাওয়া যায় (global)।
 */

// ------------------------------------------------------------ সাধারণ

/** DRF পেজিনেশন র‍্যাপার */
interface Page<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

type OrderStatus =
  | "pending"
  | "confirmed"
  | "packed"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "returned";

type PaymentMethod = "cod" | "bkash" | "nagad" | "card";
type PaymentStatus = "pending" | "paid" | "refunded" | "failed";
type VendorStatus = "pending" | "approved" | "suspended" | "rejected";
type ProductStatus = "draft" | "pending" | "live" | "rejected" | "hidden";
type UserRole = "customer" | "vendor";

// -------------------------------------------------------------- ইউজার

interface User {
  id: number;
  name: string;
  phone: string;
  email: string;
  role: UserRole;
  avatar: string | null;
  vendorSlug: string | null;
  vendorName: string | null;
  /** দোকান অনুমোদিত না হলে ভেন্ডর প্যানেলের সব API ৪০৩ দেয় */
  vendorStatus: VendorStatus | null;
  /** প্ল্যাটফর্ম অ্যাডমিন — ব্যাকএন্ডের is_staff ফ্ল্যাগই একমাত্র সত্য */
  isStaff: boolean;
}

interface Address {
  name: string;
  phone: string;
  division: string;
  district: string;
  thana: string;
  addressLine: string;
  note: string;
}

// -------------------------------------------------------------- দোকান

interface Vendor {
  id: number;
  slug: string;
  shopName: string;
  logo: string | null;
  banner: string | null;
  rating: number;
  ratingCount: number;
  productCount: number;
  since: string | null;
  district: string;
  isVerified: boolean;
  responseRate: number | null;
  /** কত দিনে পাঠায় */
  shipsIn: number;
  /** শতাংশে — এই দোকানের কমিশন */
  commissionRate: number;
}

// --------------------------------------------------------------- পণ্য

interface ProductVariant {
  id: number;
  sku: string;
  /** যেমন { রং: "কালো", সাইজ: "M" } */
  options: Record<string, string>;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  weightKg: number;
}

interface Product {
  id: number;
  slug: string;
  title: string;
  description: string;
  images: (string | null)[];
  category: string | null;
  categoryName: string;
  brand: string;
  vendor: Vendor | null;
  variants: ProductVariant[];
  price: number;
  compareAtPrice: number | null;
  stock: number;
  rating: number;
  ratingCount: number;
  soldCount: number;
  isFreeShipping: boolean;
  status: ProductStatus;
  createdAt: string | null;
  specs: Record<string, string>;
}

interface Review {
  id: number;
  rating: number;
  comment: string;
  author: string;
  createdAt: string | null;
  isVerified: boolean;
  photos: (string | null)[];
}

// -------------------------------------------------------------- কার্ট

/** কার্টে জমা থাকা একটা লাইন — CartContext-এর আকার */
interface CartItem {
  id: string;
  productId: number;
  variantId: number;
  vendorId: number;
  vendor: Pick<Vendor, "id" | "slug" | "shopName" | "commissionRate">;
  title: string;
  slug: string;
  image: string | null;
  options: Record<string, string>;
  price: number;
  quantity: number;
  stock: number;
}

interface Coupon {
  code: string;
  label: string;
  type: "flat" | "percent";
  value: number;
  minOrder: number;
  maxDiscount: number | null;
  vendorId: number | null;
}

/** প্রতি দোকানের আলাদা হিসাব (src/lib/pricing.js) */
interface CartGroup {
  vendor: Vendor;
  items: CartItem[];
  itemsTotal: number;
  discount: number;
  shipping: number;
  payableTotal: number;
}

interface CartSummary {
  itemsTotal: number;
  shippingTotal: number;
  discount: number;
  grandTotal: number;
  groups: CartGroup[];
  couponError: string | null;
}

// ------------------------------------------------------------- অর্ডার

interface OrderItem {
  id: number | string;
  productTitle: string;
  productSlug: string;
  image: string | null;
  options: Record<string, string>;
  unitPrice: number;
  quantity: number;
  canReview: boolean;
}

/** এক দোকানের পার্সেল। ভেন্ডর প্যানেলে এটাই "অর্ডার"। */
interface VendorOrder {
  id: number | string;
  subNumber: string;
  vendor: Vendor | null;
  status: OrderStatus;
  items: OrderItem[];
  orderNumber: string | null;
  address: Address;
  createdAt: string | null;
  itemsTotal: number;
  discount: number;
  shipping: number;
  commission: number;
  payable: number;
  courier: string | null;
  trackingCode: string | null;
  updatedAt: string | null;
}

interface Order {
  number: string;
  createdAt: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  address: Address;
  itemsTotal: number;
  shippingTotal: number;
  discount: number;
  grandTotal: number;
  /** এক অর্ডার একাধিক দোকানে ভাগ হয় — এটাই মাল্টি-ভেন্ডরের মূল কথা */
  vendorOrders: VendorOrder[];
}

/** `api.orders.create()` যা নেয় */
interface PlaceOrderPayload {
  items: CartItem[];
  address: Address;
  paymentMethod: PaymentMethod;
  couponCode: string | null;
  /** একই চেকআউটের প্রতিটি চেষ্টায় একই মান — দুইবার অর্ডার হওয়া ঠেকায় */
  idempotencyKey?: string;
}
