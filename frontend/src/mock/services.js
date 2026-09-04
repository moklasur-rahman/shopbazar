/**
 * mock ব্যাকএন্ড — api/services.js এর হুবহু একই ফাংশন, একই আকারের ডেটা।
 * ফিল্টার-সর্ট-পেজিনেশনও DRF-এর মতো query param দিয়েই চলে, যাতে
 * আসল API-তে যাওয়ার সময় কম্পোনেন্টের কোড এক অক্ষরও বদলাতে না হয়।
 */

import { RULES, STORAGE_KEYS } from "../config";
import { calculateCart, vendorSettlement } from "../lib/pricing";
import { isInsideDhaka } from "../lib/bd";
import * as db from "./db";

const wait = (ms = 260) => new Promise((r) => setTimeout(r, ms));

function page(list, { page = 1, page_size = RULES.pageSize } = {}) {
  const start = (Number(page) - 1) * Number(page_size);
  const slice = list.slice(start, start + Number(page_size));
  return {
    count: list.length,
    next: start + Number(page_size) < list.length ? Number(page) + 1 : null,
    previous: Number(page) > 1 ? Number(page) - 1 : null,
    results: slice,
  };
}

function readLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

/** File → data URL (mock মোডে ছবি "সংরক্ষণ" করার একমাত্র উপায়) */
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function writeLS(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* কোটা শেষ — উপেক্ষা করা যায় */
  }
}

/* --------------------------------- auth -------------------------------- */

const DEMO_USERS = [
  { id: 1, name: "রাকিব হাসান", phone: "01711111111", email: "rakib@example.com", role: "customer", password: "1234" },
  { id: 2, name: "টেকজোন বিডি", phone: "01722222222", email: "shop@techzone.bd", role: "vendor", vendorSlug: "techzone-bd", vendorName: "টেকজোন বিডি", vendorStatus: "approved", vendorId: 1, password: "1234" },
  { id: 3, name: "অ্যাডমিন", phone: "01700000000", email: "admin@shopbazar.com.bd", role: "staff", isStaff: true, password: "1234" },
];

/** নতুন বিক্রেতার আবেদনের অবস্থা — mock মোডে মেমোরিতে থাকে */
let mockApplication = {
  vendor: { slug: "", shopName: "", status: "pending", isVerified: false, district: "", createdAt: null },
  kyc: null,
  checklist: { account: true, documents: false, payout: false, approved: false },
};

export const authApi = {
  async login({ phone, password }) {
    await wait();
    const found = DEMO_USERS.find((u) => u.phone === phone);
    if (!found) {
      const err = new Error("এই নম্বরে কোনো অ্যাকাউন্ট নেই");
      err.fields = { phone: "এই নম্বরে কোনো অ্যাকাউন্ট নেই" };
      throw err;
    }
    if (found.password !== password) {
      const err = new Error("পাসওয়ার্ড ভুল হয়েছে");
      err.fields = { password: "পাসওয়ার্ড ভুল হয়েছে" };
      throw err;
    }
    const { password: _pw, ...user } = found;
    writeLS(STORAGE_KEYS.auth, { user });
    return user;
  },

  async register(payload) {
    await wait(400);
    if (DEMO_USERS.some((u) => u.phone === payload.phone)) {
      const err = new Error("এই নম্বরে আগেই অ্যাকাউন্ট আছে");
      err.fields = { phone: "এই নম্বরে আগেই অ্যাকাউন্ট আছে" };
      throw err;
    }
    const isVendor = payload.role === "vendor";
    const user = {
      id: Date.now(),
      name: payload.name,
      phone: payload.phone,
      email: payload.email ?? "",
      role: payload.role ?? "customer",
      vendorSlug: isVendor ? `shop-${payload.phone.slice(-4)}` : null,
      vendorName: isVendor ? payload.shopName : null,
      // নতুন দোকান সবসময় অনুমোদনের অপেক্ষায় — আসল ব্যাকএন্ডেও একই নিয়ম
      vendorStatus: isVendor ? "pending" : null,
      vendorId: isVendor ? null : null,
    };

    if (isVendor) {
      mockApplication = {
        vendor: {
          slug: user.vendorSlug,
          shopName: payload.shopName,
          status: "pending",
          isVerified: false,
          district: "",
          createdAt: new Date().toISOString(),
        },
        kyc: null,
        checklist: { account: true, documents: false, payout: false, approved: false },
      };
    }

    writeLS(STORAGE_KEYS.auth, { user });
    return user;
  },

  async me() {
    await wait(80);
    const stored = readLS(STORAGE_KEYS.auth, {});
    if (!stored.user) throw new Error("লগইন করা নেই");
    return stored.user;
  },

  async logout() {
    localStorage.removeItem(STORAGE_KEYS.auth);
  },
};

/* ------------------------------- catalog ------------------------------- */

function filterProducts(params = {}) {
  const {
    search, category, vendor, min_price, max_price, rating,
    free_shipping, ordering = "-created_at",
  } = params;

  let list = db.products.filter((p) => p.status === "live");

  if (search) {
    const q = String(search).trim().toLowerCase();
    list = list.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.categoryName.includes(q) ||
        p.vendor.shopName.includes(q),
    );
  }
  if (category) list = list.filter((p) => p.category === category);
  if (vendor) list = list.filter((p) => p.vendor.slug === vendor || p.vendor.id === Number(vendor));
  if (min_price) list = list.filter((p) => p.price >= Number(min_price));
  if (max_price) list = list.filter((p) => p.price <= Number(max_price));
  if (rating) list = list.filter((p) => p.rating >= Number(rating));
  if (free_shipping === "true" || free_shipping === true) {
    list = list.filter((p) => p.isFreeShipping);
  }

  const sorters = {
    price: (a, b) => a.price - b.price,
    "-price": (a, b) => b.price - a.price,
    "-rating_avg": (a, b) => b.rating - a.rating,
    "-sold_count": (a, b) => b.soldCount - a.soldCount,
    "-created_at": (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  };
  return [...list].sort(sorters[ordering] ?? sorters["-created_at"]);
}

export const catalogApi = {
  async listCategories() {
    await wait(60);
    return db.categories;
  },

  async listProducts(params = {}) {
    await wait();
    return page(filterProducts(params), params);
  },

  async getProduct(slug) {
    await wait(180);
    const found = db.products.find((p) => p.slug === slug);
    if (!found) throw new Error("পণ্যটি খুঁজে পাওয়া যায়নি");
    return found;
  },

  async listReviews(slug, params = {}) {
    await wait(140);
    const product = db.products.find((p) => p.slug === slug);
    const list = db.reviews.filter((r) => r.productId === product?.id);
    return page(list, { page_size: 20, ...params });
  },

  async listBanners() {
    await wait(60);
    return db.banners;
  },

  async getFlashSale() {
    await wait(120);
    const endsAt = new Date();
    endsAt.setHours(23, 59, 59, 999);
    const products = db.products
      .filter((p) => p.compareAtPrice)
      .sort((a, b) => b.compareAtPrice - b.price - (a.compareAtPrice - a.price))
      .slice(0, 8);
    return { endsAt: endsAt.toISOString(), products };
  },
};

/* -------------------------------- vendors ------------------------------ */

export const vendorsApi = {
  async list(params = {}) {
    await wait(120);
    let list = [...db.vendors];
    if (params.search) {
      const q = params.search.toLowerCase();
      list = list.filter((v) => v.shopName.toLowerCase().includes(q));
    }
    list.sort((a, b) => b.rating - a.rating);
    return page(list, { page_size: 12, ...params });
  },

  async get(slug) {
    await wait(120);
    const found = db.vendors.find((v) => v.slug === slug);
    if (!found) throw new Error("দোকানটি খুঁজে পাওয়া যায়নি");
    return found;
  },

  async products(slug, params = {}) {
    await wait(160);
    return page(filterProducts({ ...params, vendor: slug }), params);
  },
};

/* ------------------------------- checkout ------------------------------ */

export const checkoutApi = {
  async validateCoupon(code) {
    await wait(300);
    const found = db.coupons.find(
      (c) => c.code.toLowerCase() === String(code).trim().toLowerCase(),
    );
    if (!found) throw new Error("এই কুপন কোডটি সঠিক নয়");
    return found;
  },

  /** সার্ভারের চূড়ান্ত হিসাব — ফ্রন্টএন্ডের হিসাবের সাথে মিলিয়ে দেখা হয় */
  async quote({ items, district, couponCode }) {
    await wait(220);
    let coupon = null;
    if (couponCode) {
      coupon = db.coupons.find(
        (c) => c.code.toLowerCase() === couponCode.toLowerCase(),
      ) ?? null;
    }
    const summary = calculateCart({
      items,
      insideDhaka: isInsideDhaka(district),
      coupon,
    });
    return {
      items_total: summary.itemsTotal,
      shipping_total: summary.shippingTotal,
      discount_total: summary.discount,
      grand_total: summary.grandTotal,
      coupon_error: summary.couponError,
    };
  },
};

/* -------------------------------- orders ------------------------------- */

function loadOrders() {
  return readLS(STORAGE_KEYS.orders, []);
}

export const ordersApi = {
  async create(payload) {
    await wait(700);

    const { items, address, paymentMethod, couponCode, idempotencyKey } = payload;

    // আসল ব্যাকএন্ডের মতোই আচরণ: একই কি দিয়ে দ্বিতীয়বার এলে নতুন অর্ডার
    // না বানিয়ে আগেরটাই ফেরত। মক আর আসল API-র আচরণ আলাদা হলে মক দিয়ে
    // টেস্ট করে "ঠিক আছে" ভেবে বসে থাকা যেত, অথচ লাইভে দুইবার অর্ডার হতো।
    if (idempotencyKey) {
      const already = loadOrders().find((o) => o.idempotencyKey === idempotencyKey);
      if (already) return already;
    }

    // স্টক যাচাই — আসল ব্যাকএন্ডে এইটা select_for_update() দিয়ে হবে
    for (const item of items) {
      const product = db.products.find((p) => p.id === item.productId);
      const variant = product?.variants.find((v) => v.id === item.variantId);
      if (!variant || variant.stock < item.quantity) {
        throw new Error(`"${item.title}" এর স্টক শেষ হয়ে গেছে`);
      }
    }

    const coupon = couponCode
      ? (db.coupons.find((c) => c.code.toLowerCase() === couponCode.toLowerCase()) ?? null)
      : null;

    const summary = calculateCart({
      items,
      insideDhaka: isInsideDhaka(address.district),
      coupon,
    });

    const number = `SB-${Math.floor(100000 + Math.random() * 899999)}`;

    const order = {
      number,
      idempotencyKey: idempotencyKey ?? null,
      createdAt: new Date().toISOString(),
      paymentMethod,
      paymentStatus: paymentMethod === "cod" ? "pending" : "paid",
      address,
      itemsTotal: summary.itemsTotal,
      shippingTotal: summary.shippingTotal,
      discount: summary.discount,
      grandTotal: summary.grandTotal,
      // এখানেই মূল অর্ডার ভেন্ডর অনুযায়ী ভাগ হচ্ছে
      vendorOrders: summary.groups.map((group, i) => {
        const settlement = vendorSettlement({
          itemsTotal: group.itemsTotal,
          discount: group.discount,
          shipping: group.shipping,
          commissionRate: group.vendor.commissionRate,
        });
        return {
          id: `${number}-${i + 1}`,
          subNumber: `${number}-${String.fromCharCode(65 + i)}`,
          vendor: group.vendor,
          status: "pending",
          items: group.items.map((it) => ({
            id: it.id,
            productTitle: it.title,
            productSlug: it.slug,
            image: it.image,
            options: it.options,
            unitPrice: it.price,
            quantity: it.quantity,
            canReview: false,
          })),
          itemsTotal: group.itemsTotal,
          discount: group.discount,
          shipping: group.shipping,
          commission: settlement.commission,
          payable: settlement.payable,
          courier: null,
          trackingCode: null,
          updatedAt: new Date().toISOString(),
        };
      }),
    };

    // স্টক কমাও
    for (const item of items) {
      const product = db.products.find((p) => p.id === item.productId);
      const variant = product?.variants.find((v) => v.id === item.variantId);
      if (variant) variant.stock -= item.quantity;
      if (product) product.stock = product.variants.reduce((s, v) => s + v.stock, 0);
    }

    writeLS(STORAGE_KEYS.orders, [order, ...loadOrders()]);
    return order;
  },

  async list(params = {}) {
    await wait(200);
    let list = loadOrders();
    // স্ট্যাটাস ফিল্টার পুরো তালিকার উপরে চলে, শুধু চলতি পাতার উপরে নয়
    if (params.status) {
      list = list.filter((o) => o.vendorOrders.some((v) => v.status === params.status));
    }
    return page(list, { page_size: 10, ...params });
  },

  async get(number) {
    await wait(180);
    const found = loadOrders().find((o) => o.number === number);
    if (!found) throw new Error("অর্ডারটি খুঁজে পাওয়া যায়নি");
    return found;
  },

  async cancelVendorOrder(id, reason) {
    await wait(300);
    const orders = loadOrders();
    for (const order of orders) {
      const vo = order.vendorOrders.find((v) => v.id === id);
      if (vo) {
        if (!["pending", "confirmed"].includes(vo.status)) {
          throw new Error("প্যাক হয়ে যাওয়ার পর আর বাতিল করা যায় না");
        }
        vo.status = "cancelled";
        vo.cancelReason = reason;
        vo.updatedAt = new Date().toISOString();
        writeLS(STORAGE_KEYS.orders, orders);
        return vo;
      }
    }
    throw new Error("অর্ডারটি পাওয়া যায়নি");
  },
};

/* ---------------------------- ভেন্ডর প্যানেল ---------------------------- */

const VENDOR_ID = 1; // ডেমো ভেন্ডর

/* ------------------------- প্ল্যাটফর্ম অ্যাডমিন ------------------------- */

/* mock মোডে অ্যাডমিনের বদলগুলো মেমোরিতে থাকে — পেজ রিফ্রেশ করলে
   আবার আগের অবস্থায় ফিরে যায়। আসল API-তে সবই ডেটাবেসে। */

const mockCategories = db.categories.map((c, i) => ({
  id: c.id,
  name: c.name,
  slug: c.slug,
  icon: c.icon,
  parent: null,
  sortOrder: i,
  isActive: true,
}));

const mockCoupons = db.coupons.map((c, i) => ({
  id: i + 1,
  code: c.code,
  label: c.label,
  type: c.type,
  value: c.value,
  minOrder: c.minOrder,
  maxDiscount: c.maxDiscount,
  vendor: c.vendorId,
  expiresAt: c.expiresAt,
  usageLimit: c.usageLimit,
  usedCount: c.usedCount,
  isActive: true,
}));

const mockBanners = db.banners.map((b, i) => ({
  id: b.id,
  title: b.title,
  subtitle: b.subtitle,
  cta: b.cta,
  href: b.href,
  imageUrl: b.image,
  tone: b.tone,
  sortOrder: i,
  isActive: true,
}));

const mockUsers = [
  { id: 1, name: "রাকিব হাসান", phone: "01711111111", email: "rakib@example.com", role: "customer", isActive: true, isVerified: true, isStaff: false, shopName: "", orderCount: 3, joinedAt: "2026-06-12" },
  { id: 3, name: "অ্যাডমিন", phone: "01700000000", email: "admin@shopbazar.com.bd", role: "staff", isActive: true, isVerified: true, isStaff: true, shopName: "", orderCount: 0, joinedAt: "2026-01-05" },
  ...db.vendors.map((v, i) => ({
    id: 100 + i,
    name: v.shopName,
    phone: `017222222${20 + v.id}`,
    email: `${v.slug}@example.com`,
    role: "vendor",
    isActive: true,
    isVerified: true,
    isStaff: false,
    shopName: v.shopName,
    orderCount: 0,
    joinedAt: v.since,
  })),
];

/** mock মোডে দোকানের অবস্থা মেমোরিতে বদলায় */
const vendorStatuses = Object.fromEntries(db.vendors.map((v) => [v.id, "approved"]));
// ডেমোতে দুটো দোকান অপেক্ষমাণ রাখা হয়, যাতে অনুমোদনের কাজটা দেখা যায়
vendorStatuses[5] = "pending";
vendorStatuses[7] = "pending";

function mockAdminVendor(vendor, withKyc = false) {
  const status = vendorStatuses[vendor.id];
  const base = {
    id: vendor.id,
    slug: vendor.slug,
    shopName: vendor.shopName,
    logo: vendor.logo,
    banner: vendor.banner,
    district: vendor.district,
    status,
    isVerified: status === "approved" && vendor.isVerified,
    commissionRate: vendor.commissionRate,
    ownerName: vendor.shopName,
    ownerPhone: `017222222${20 + vendor.id}`,
    ownerEmail: `${vendor.slug}@example.com`,
    documentsReady: true,
    productCount: vendor.productCount,
    createdAt: vendor.since,
    shipsIn: vendor.shipsIn,
    rating: vendor.rating,
    stats: null,
    kyc: null,
  };
  if (!withKyc) return base;

  return {
    ...base,
    stats: {
      orders: 12 + vendor.id,
      products: vendor.productCount,
      live_products: vendor.productCount,
    },
    kyc: {
      nidNumber: `19901234${String(vendor.id).padStart(5, "0")}`,
      nidFront: `https://picsum.photos/seed/nid-front-${vendor.slug}/700/440`,
      nidBack: `https://picsum.photos/seed/nid-back-${vendor.slug}/700/440`,
      tradeLicense: vendor.isVerified
        ? `https://picsum.photos/seed/tl-${vendor.slug}/700/900`
        : null,
      bkashNumber: `017222222${20 + vendor.id}`,
      bankName: "",
      bankAccountName: "",
      bankAccountNumber: "",
      payoutTarget: `বিকাশ 01722******`,
      reviewedAt: null,
      reviewNote: "",
    },
  };
}

export const adminApi = {
  async stats() {
    await wait(220);
    const all = Object.values(vendorStatuses);
    const orders = loadOrders();
    return {
      gmvToday: db.salesTrend.at(-1).amount,
      gmvMonth: db.salesTrend.reduce((s, d) => s + d.amount, 0) * 4,
      commissionMonth: Math.round(
        db.salesTrend.reduce((s, d) => s + d.amount, 0) * 4 * 0.08,
      ),
      ordersToday: orders.length,
      ordersTotal: orders.length,
      customers: 1284,
      vendors: {
        total: all.length,
        pending: all.filter((s) => s === "pending").length,
        approved: all.filter((s) => s === "approved").length,
        suspended: all.filter((s) => s === "suspended").length,
      },
      products: {
        total: db.products.length,
        pending: db.products.filter((p) => p.status === "pending").length,
        live: db.products.filter((p) => p.status === "live").length,
      },
      payoutsPending: db.payouts.filter((p) => p.status === "processing").length,
      payoutsPendingAmount: db.payouts
        .filter((p) => p.status === "processing")
        .reduce((s, p) => s + p.amount, 0),
      salesTrend: db.salesTrend,
      todo: {
        vendor_approvals: all.filter((s) => s === "pending").length,
        product_approvals: db.products.filter((p) => p.status === "pending").length,
        payouts: db.payouts.filter((p) => p.status === "processing").length,
      },
    };
  },

  async listVendors(params = {}) {
    await wait(200);
    let list = db.vendors.map((v) => mockAdminVendor(v));
    if (params.status) list = list.filter((v) => v.status === params.status);
    if (params.search) {
      const q = params.search.toLowerCase();
      list = list.filter(
        (v) => v.shopName.toLowerCase().includes(q) || v.ownerPhone.includes(q),
      );
    }
    return page(list, { page_size: 20, ...params });
  },

  async getVendor(id) {
    await wait(180);
    const vendor = db.vendors.find((v) => v.id === Number(id));
    if (!vendor) throw new Error("দোকানটি পাওয়া যায়নি");
    return mockAdminVendor(vendor, true);
  },

  async vendorAction(id, action) {
    await wait(400);
    const map = { approve: "approved", suspend: "suspended", reactivate: "approved" };
    vendorStatuses[Number(id)] = map[action] ?? vendorStatuses[Number(id)];
    return this.getVendor(id);
  },

  async listProducts(params = {}) {
    await wait(220);
    let list = db.products.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      image: p.images[0],
      vendorName: p.vendor.shopName,
      vendorSlug: p.vendor.slug,
      categoryName: p.categoryName,
      price: p.price,
      stock: p.stock,
      status: p.status,
      soldCount: p.soldCount,
      createdAt: p.createdAt,
    }));
    if (params.status) list = list.filter((p) => p.status === params.status);
    if (params.search) {
      const q = params.search.toLowerCase();
      list = list.filter(
        (p) => p.title.toLowerCase().includes(q) || p.vendorName.includes(params.search),
      );
    }
    return page(list, { page_size: 20, ...params });
  },

  async productAction(id, action) {
    await wait(300);
    const product = db.products.find((p) => p.id === Number(id));
    const map = { approve: "live", reject: "rejected", unpublish: "draft" };
    if (product) product.status = map[action] ?? product.status;
    return { ...product, status: product?.status };
  },

  async listOrders(params = {}) {
    await wait(220);
    let list = loadOrders().map((o) => ({
      number: o.number,
      customerName: o.address?.name ?? "ক্রেতা",
      customerPhone: o.address?.phone ?? "",
      createdAt: o.createdAt,
      paymentMethod: o.paymentMethod,
      paymentStatus: o.paymentStatus,
      grandTotal: o.grandTotal,
      status: o.vendorOrders.every((v) => v.status === "delivered")
        ? "delivered"
        : o.vendorOrders[0]?.status ?? "pending",
      parcels: o.vendorOrders.map((v) => ({
        id: v.id,
        subNumber: v.subNumber,
        vendor: v.vendor.shopName,
        status: v.status,
        subtotal: v.itemsTotal,
        commission: v.commission,
        payable: v.payable,
      })),
    }));
    if (params.search) {
      list = list.filter((o) => o.number.includes(params.search));
    }
    return page(list, { page_size: 20, ...params });
  },

  async listPayouts(params = {}) {
    await wait(200);
    let list = db.payouts.map((p) => ({
      id: p.id,
      vendorName: "টেকজোন বিডি",
      vendorSlug: "techzone-bd",
      amount: p.amount,
      status: p.status,
      method: p.method,
      reference: "",
      entryCount: 4,
      createdAt: p.createdAt,
      paidAt: p.paidAt,
    }));
    if (params.status) list = list.filter((p) => p.status === params.status);
    return page(list, { page_size: 20, ...params });
  },

  async payoutAction(id, action, reference = "") {
    await wait(350);
    const payout = db.payouts.find((p) => p.id === Number(id));
    if (payout && action === "mark-paid") {
      payout.status = "paid";
      payout.paidAt = new Date().toISOString();
    }
    if (payout && action === "mark-failed") payout.status = "failed";
    return { ...payout, reference };
  },

  /* ---------------------------- ক্যাটাগরি ---------------------------- */

  async listCategories() {
    await wait(160);
    return mockCategories.map((c) => ({
      ...c,
      productCount: db.products.filter((p) => p.category === c.slug).length,
      parentName: mockCategories.find((x) => x.id === c.parent)?.name ?? "",
    }));
  },

  async saveCategory(payload) {
    await wait(350);
    if (payload.id) {
      const existing = mockCategories.find((c) => c.id === payload.id);
      Object.assign(existing, payload);
      return existing;
    }
    const created = {
      ...payload,
      id: Math.max(0, ...mockCategories.map((c) => c.id)) + 1,
      slug: payload.slug || `category-${mockCategories.length + 1}`,
    };
    mockCategories.push(created);
    return created;
  },

  async deleteCategory(id) {
    await wait(250);
    const category = mockCategories.find((c) => c.id === Number(id));
    const used = db.products.filter((p) => p.category === category?.slug).length;
    if (used > 0) {
      throw new Error(`এই ক্যাটাগরিতে ${used}টি পণ্য আছে — আগে সেগুলো সরান।`);
    }
    const index = mockCategories.findIndex((c) => c.id === Number(id));
    if (index >= 0) mockCategories.splice(index, 1);
    return true;
  },

  /* ------------------------------ কুপন ------------------------------- */

  async listCoupons(params = {}) {
    await wait(180);
    let list = mockCoupons.map((c) => ({
      ...c,
      vendorName: db.vendors.find((v) => v.id === c.vendor)?.shopName ?? "",
      scope: c.vendor ? "vendor" : "platform",
    }));
    if (params.scope === "platform") list = list.filter((c) => !c.vendor);
    if (params.scope === "vendor") list = list.filter((c) => c.vendor);
    return list;
  },

  async couponVendorOptions() {
    await wait(120);
    return db.vendors.map((v) => ({ id: v.id, name: v.shopName }));
  },

  async saveCoupon(payload) {
    await wait(350);
    const code = String(payload.code).trim().toUpperCase();
    const clash = mockCoupons.find(
      (c) => c.code === code && c.id !== payload.id,
    );
    if (clash) throw new Error("এই কোডটি আগেই ব্যবহার হয়েছে।");
    if (payload.type === "percent" && !(payload.value > 0 && payload.value <= 100)) {
      throw new Error("শতাংশ ১ থেকে ১০০ এর মধ্যে হতে হবে।");
    }

    if (payload.id) {
      const existing = mockCoupons.find((c) => c.id === payload.id);
      Object.assign(existing, payload, { code });
      return existing;
    }
    const created = {
      ...payload,
      code,
      id: Math.max(0, ...mockCoupons.map((c) => c.id)) + 1,
      usedCount: 0,
    };
    mockCoupons.push(created);
    return created;
  },

  async deleteCoupon(id) {
    await wait(250);
    const index = mockCoupons.findIndex((c) => c.id === Number(id));
    if (index >= 0) mockCoupons.splice(index, 1);
    return true;
  },

  /* ----------------------------- ব্যানার ------------------------------ */

  async listBanners() {
    await wait(150);
    return mockBanners.map((b) => ({ ...b, preview: b.imageUrl }));
  },

  async saveBanner(payload) {
    await wait(320);
    if (payload.id) {
      const existing = mockBanners.find((b) => b.id === payload.id);
      Object.assign(existing, payload);
      return existing;
    }
    const created = { ...payload, id: Math.max(0, ...mockBanners.map((b) => b.id)) + 1 };
    mockBanners.push(created);
    return created;
  },

  async deleteBanner(id) {
    await wait(250);
    const index = mockBanners.findIndex((b) => b.id === Number(id));
    if (index >= 0) mockBanners.splice(index, 1);
    return true;
  },

  /* ------------------------------ ইউজার ------------------------------ */

  async listUsers(params = {}) {
    await wait(200);
    let list = mockUsers;
    if (params.role) list = list.filter((u) => u.role === params.role);
    if (params.search) {
      const q = params.search.toLowerCase();
      list = list.filter(
        (u) => u.name.toLowerCase().includes(q) || u.phone.includes(params.search),
      );
    }
    return page(list, { page_size: 20, ...params });
  },

  async userAction(id, action) {
    await wait(280);
    const user = mockUsers.find((u) => u.id === Number(id));
    if (user) user.isActive = action === "activate";
    return user;
  },

  /* ----------------------------- সেটিংস ------------------------------ */

  async settings() {
    await wait(120);
    return {
      commission: {
        default: RULES.defaultCommissionRate,
        byCategory: RULES.commissionByCategory,
      },
      shipping: {
        insideDhaka: RULES.shipping.insideDhaka,
        outsideDhaka: RULES.shipping.outsideDhaka,
        extraVendorMultiplier: RULES.shipping.extraVendorMultiplier,
        freeThreshold: RULES.shipping.freeShippingThreshold,
      },
      payoutHoldDays: RULES.payoutHoldDays,
      maxQtyPerItem: RULES.maxQtyPerItem,
      lowStockThreshold: 15,
      source: "src/config.js → RULES (mock মোড)",
      note: "আসল API-তে এই মান আসে backend/config/settings.py → MARKETPLACE থেকে।",
    };
  },

  /* ----------------------------- রিপোর্ট ----------------------------- */

  async salesReport(params = {}) {
    await wait(260);
    const byMonth = params.group_by === "month";
    const series = byMonth
      ? [
          { label: "জুলাই ২০২৬", date: "2026-07-01", sales: 284000 },
          { label: "আগস্ট ২০২৬", date: "2026-08-01", sales: 336000 },
          { label: "সেপ্টেম্বর ২০২৬", date: "2026-09-01", sales: 98600 },
        ]
      : db.salesTrend.map((d, i) => ({
          label: d.day,
          date: `2026-09-0${i + 1}`,
          sales: d.amount,
        }));

    const rows = series.map((row) => ({
      ...row,
      discount: Math.round(row.sales * 0.03),
      shipping: Math.round(row.sales * 0.02),
      commission: Math.round(row.sales * 0.08),
      parcels: Math.max(1, Math.round(row.sales / 3200)),
    }));

    const sum = (key) => rows.reduce((s, r) => s + r[key], 0);
    const parcels = sum("parcels");

    return {
      from: rows[0]?.date ?? "",
      to: rows.at(-1)?.date ?? "",
      groupBy: params.group_by ?? "day",
      series: rows,
      totals: {
        sales: sum("sales"),
        discount: sum("discount"),
        shipping: sum("shipping"),
        commission: sum("commission"),
        parcels,
        delivered: Math.round(parcels * 0.86),
        deliveryRate: 86,
      },
    };
  },

  async vendorReport() {
    await wait(240);
    return db.vendors
      .map((v) => {
        const sales = v.productCount * 4200 + v.ratingCount * 3;
        const commission = Math.round((sales * v.commissionRate) / 100);
        return {
          vendorId: v.id,
          shopName: v.shopName,
          slug: v.slug,
          district: v.district,
          sales,
          commission,
          payable: sales - commission,
          parcels: Math.round(sales / 2800),
        };
      })
      .sort((a, b) => b.sales - a.sales);
  },

  async productReport() {
    await wait(240);
    const top = [...db.products]
      .sort((a, b) => b.soldCount * b.price - a.soldCount * a.price)
      .slice(0, 15)
      .map((p) => ({
        title: p.title,
        slug: p.slug,
        quantity: p.soldCount,
        revenue: p.soldCount * p.price,
      }));

    const byCategory = db.categories
      .map((c) => {
        const items = db.products.filter((p) => p.category === c.slug);
        return {
          name: c.name,
          slug: c.slug,
          quantity: items.reduce((s, p) => s + p.soldCount, 0),
          revenue: items.reduce((s, p) => s + p.soldCount * p.price, 0),
        };
      })
      .sort((a, b) => b.revenue - a.revenue);

    return {
      topProducts: top,
      byCategory,
      lowStock: db.products
        .filter((p) => p.stock < 15)
        .slice(0, 20)
        .map((p) => ({
          title: p.title,
          slug: p.slug,
          vendor: p.vendor.shopName,
          stock: p.stock,
        })),
    };
  },

  async exportReport(type) {
    await wait(400);
    // mock মোডে সার্ভার নেই, তাই ব্রাউজারেই CSV বানিয়ে নামানো হয়
    const sets = {
      vendors: {
        head: ["দোকান", "জেলা", "পণ্য", "রেটিং", "কমিশন %"],
        rows: db.vendors.map((v) => [
          v.shopName, v.district, v.productCount, v.rating, v.commissionRate,
        ]),
      },
      products: {
        head: ["পণ্য", "দোকান", "ক্যাটাগরি", "দাম", "স্টক", "বিক্রি"],
        rows: db.products.map((p) => [
          p.title, p.vendor.shopName, p.categoryName, p.price, p.stock, p.soldCount,
        ]),
      },
      orders: {
        head: ["অর্ডার", "তারিখ", "মোট"],
        rows: loadOrders().map((o) => [o.number, o.createdAt, o.grandTotal]),
      },
    };

    const set = sets[type] ?? sets.orders;
    const escape = (cell) => `"${String(cell).replace(/"/g, '""')}"`;
    const csv = [set.head, ...set.rows].map((r) => r.map(escape).join(",")).join("\n");

    const filename = `shopbazar-${type}-demo.csv`;
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return filename;
  },
};

export const vendorPanelApi = {
  async getApplication() {
    await wait(180);
    return mockApplication;
  },

  async saveApplication(payload) {
    await wait(450);

    // mock মোডে সার্ভার নেই, তাই ছবিগুলো data URL বানিয়ে রাখা হয় —
    // এতে প্রিভিউ ঠিক আগের মতোই কাজ করে
    const previous = mockApplication.kyc ?? {};
    const kyc = { ...previous, ...payload };
    for (const field of ["nidFront", "nidBack", "tradeLicense"]) {
      const value = payload[field];
      if (value instanceof File) kyc[field] = await fileToDataUrl(value);
      else if (value === null) kyc[field] = null;
      else kyc[field] = previous[field] ?? null;
    }

    mockApplication = {
      ...mockApplication,
      vendor: { ...mockApplication.vendor, district: payload.district || "" },
      kyc,
      checklist: {
        account: true,
        documents: Boolean(payload.nidNumber && kyc.nidFront && kyc.nidBack),
        payout: Boolean(payload.bkashNumber || payload.bankAccountNumber),
        approved: false,
      },
    };
    return mockApplication;
  },

  async stats() {
    await wait(220);
    const mine = db.products.filter((p) => p.vendor.id === VENDOR_ID);
    const released = db.ledger.filter((e) => e.released).reduce((s, e) => s + e.amount, 0);
    const held = db.ledger.filter((e) => !e.released).reduce((s, e) => s + e.amount, 0);

    return {
      todaySales: db.salesTrend.at(-1).amount,
      monthSales: db.salesTrend.reduce((s, d) => s + d.amount, 0) * 4,
      pendingOrders: 6,
      lowStock: mine.filter((p) => p.stock < 15).length,
      totalProducts: mine.length,
      availableBalance: released,
      onHold: held,
      rating: db.vendors.find((v) => v.id === VENDOR_ID).rating,
      salesTrend: db.salesTrend,
    };
  },

  async listProducts(params = {}) {
    await wait(200);
    let list = db.products.filter((p) => p.vendor.id === VENDOR_ID);
    if (params.search) {
      list = list.filter((p) => p.title.toLowerCase().includes(params.search.toLowerCase()));
    }
    if (params.status) list = list.filter((p) => p.status === params.status);
    return page(list, { page_size: 10, ...params });
  },

  async saveProduct(product) {
    await wait(450);
    if (product.id) {
      const existing = db.products.find((p) => p.id === product.id);
      Object.assign(existing, product);
      existing.variants[0].price = product.price;
      existing.variants[0].stock = product.stock;
      return existing;
    }
    const vendor = db.vendors.find((v) => v.id === VENDOR_ID);
    const created = {
      ...product,
      id: db.products.length + 1,
      slug: `new-product-${db.products.length + 1}`,
      vendor,
      images: product.images?.length ? product.images : [`https://picsum.photos/seed/new${Date.now()}/700/700`],
      variants: [
        {
          id: `new-${Date.now()}`,
          sku: `NEW-${Date.now()}`,
          options: {},
          price: product.price,
          compareAtPrice: product.compareAtPrice,
          stock: product.stock,
          weightKg: 0.5,
        },
      ],
      rating: 0,
      ratingCount: 0,
      soldCount: 0,
      createdAt: new Date().toISOString(),
      specs: {},
      categoryName: db.categories.find((c) => c.slug === product.category)?.name ?? "",
    };
    db.products.unshift(created);
    return created;
  },

  async deleteProduct(id) {
    await wait(300);
    const index = db.products.findIndex((p) => p.id === id);
    if (index >= 0) db.products.splice(index, 1);
    return true;
  },

  async listOrders(params = {}) {
    await wait(240);
    const all = loadOrders().flatMap((o) =>
      o.vendorOrders
        .filter((vo) => vo.vendor.id === VENDOR_ID)
        .map((vo) => ({ ...vo, orderNumber: o.number, address: o.address, createdAt: o.createdAt })),
    );
    const filtered = params.status ? all.filter((vo) => vo.status === params.status) : all;
    return page(filtered, { page_size: 10, ...params });
  },

  async updateOrderStatus(id, status) {
    await wait(300);
    const orders = loadOrders();
    for (const order of orders) {
      const vo = order.vendorOrders.find((v) => v.id === id);
      if (vo) {
        vo.status = status;
        vo.updatedAt = new Date().toISOString();
        if (status === "shipped" && !vo.trackingCode) {
          vo.courier = "পাঠাও কুরিয়ার";
          vo.trackingCode = `PTH${Math.floor(1000000 + Math.random() * 8999999)}`;
        }
        writeLS(STORAGE_KEYS.orders, orders);
        return vo;
      }
    }
    throw new Error("অর্ডার পাওয়া যায়নি");
  },

  async ledger() {
    await wait(200);
    return db.ledger;
  },

  async payouts() {
    await wait(200);
    return db.payouts;
  },

  async requestPayout(amount) {
    await wait(500);
    const payout = {
      id: db.payouts.length + 1,
      amount,
      status: "processing",
      method: "বিকাশ ০১৭১২******",
      createdAt: new Date().toISOString(),
      paidAt: null,
    };
    db.payouts.unshift(payout);
    return payout;
  },
};
