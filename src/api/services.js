/**
 * আসল Django REST API-র সাথে কথা বলার সার্ভিসগুলো।
 *
 * mock/services.js ফাইলে ঠিক একই নামের ফাংশনগুলো আছে, একই আকারের ডেটা
 * ফেরত দেয়। তাই VITE_USE_MOCK ফ্ল্যাগ বদলালেই পুরো অ্যাপ আসল ব্যাকএন্ডে
 * চলে যাবে — কোনো কম্পোনেন্ট বদলাতে হবে না।
 */

import { downloadFile, http, refreshAccessToken, tokenStore } from "./client";
import { ENDPOINTS } from "./endpoints";
import {
  mediaUrl, toOrder, toPage, toProduct, toReview, toUser, toVendor, toVendorOrder,
} from "./adapters";

/* --------------------------------- auth -------------------------------- */

export const authApi = {
  async login({ phone, password }) {
    const data = await http.post(ENDPOINTS.auth.token, { phone, password }, { auth: false });
    tokenStore.set({ access: data.access, refresh: data.refresh });
    const user = toUser(data.user ?? (await http.get(ENDPOINTS.auth.me)));
    tokenStore.set({ user });
    return user;
  },

  async register(payload) {
    const data = await http.post(
      ENDPOINTS.auth.register,
      {
        full_name: payload.name,
        phone: payload.phone,
        email: payload.email,
        password: payload.password,
        role: payload.role ?? "customer",
        shop_name: payload.shopName,
      },
      { auth: false },
    );
    if (data.access) tokenStore.set({ access: data.access, refresh: data.refresh });
    const user = toUser(data.user ?? data);
    tokenStore.set({ user });
    return user;
  },

  async me() {
    // পেজ রিলোডের পর মেমোরির access টোকেন হারিয়ে যায়। আগেই রিফ্রেশ করে
    // নিলে প্রথম কলটা ৪০১ না খেয়ে সরাসরি সফল হয়।
    if (!tokenStore.access && tokenStore.refresh) {
      await refreshAccessToken();
    }
    return toUser(await http.get(ENDPOINTS.auth.me));
  },

  async logout() {
    tokenStore.clear();
  },
};

/* ------------------------------- catalog ------------------------------- */

export const catalogApi = {
  async listCategories() {
    const data = await http.get(ENDPOINTS.catalog.categories);
    return Array.isArray(data) ? data : (data.results ?? []);
  },

  /**
   * @param {object} params { search, category, vendor, min_price, max_price,
   *                          rating, ordering, page, page_size, free_shipping }
   */
  async listProducts(params = {}) {
    return toPage(await http.get(ENDPOINTS.catalog.products, params), toProduct);
  },

  async getProduct(slug) {
    return toProduct(await http.get(ENDPOINTS.catalog.product(slug)));
  },

  async listReviews(slug, params = {}) {
    return toPage(await http.get(ENDPOINTS.catalog.reviews(slug), params), toReview);
  },

  async listBanners() {
    return http.get(ENDPOINTS.catalog.banners);
  },

  async getFlashSale() {
    const data = await http.get(ENDPOINTS.catalog.flashSale);
    return { endsAt: data.ends_at, products: (data.products ?? []).map(toProduct) };
  },
};

/* -------------------------------- vendors ------------------------------ */

export const vendorsApi = {
  async list(params = {}) {
    return toPage(await http.get(ENDPOINTS.vendors.list, params), toVendor);
  },
  async get(slug) {
    return toVendor(await http.get(ENDPOINTS.vendors.detail(slug)));
  },
  async products(slug, params = {}) {
    return toPage(await http.get(ENDPOINTS.vendors.products(slug), params), toProduct);
  },
};

/* ------------------------------- checkout ------------------------------ */

export const checkoutApi = {
  /**
   * সার্ভারই আসল হিসাব করে দেয় — ফ্রন্টএন্ডের calculateCart() শুধু
   * সাথে সাথে দেখানোর জন্য, চূড়ান্ত টাকা এখান থেকেই আসে।
   */
  async quote({ items, district, couponCode }) {
    return http.post(ENDPOINTS.checkout.quote, {
      items: items.map((i) => ({ variant: i.variantId, quantity: i.quantity })),
      district,
      coupon_code: couponCode || null,
    });
  },

  async validateCoupon(code) {
    const raw = await http.post(ENDPOINTS.checkout.validateCoupon, { code });
    return {
      code: raw.code,
      type: raw.type,
      value: Number(raw.value),
      minOrder: Number(raw.min_order ?? 0),
      maxDiscount: raw.max_discount ? Number(raw.max_discount) : null,
      vendorId: raw.vendor ?? null,
      expiresAt: raw.expires_at ?? null,
      usageLimit: raw.usage_limit ?? null,
      usedCount: raw.used_count ?? 0,
      label: raw.label ?? "",
    };
  },
};

/* -------------------------------- orders ------------------------------- */

export const ordersApi = {
  async create(payload) {
    const raw = await http.post(ENDPOINTS.orders.list, {
      items: payload.items.map((i) => ({ variant: i.variantId, quantity: i.quantity })),
      shipping_address: {
        receiver_name: payload.address.name,
        phone: payload.address.phone,
        division: payload.address.division,
        district: payload.address.district,
        thana: payload.address.thana,
        address_line: payload.address.addressLine,
        note: payload.address.note ?? "",
      },
      payment_method: payload.paymentMethod,
      coupon_code: payload.couponCode || null,
    });
    return toOrder(raw);
  },

  async list(params = {}) {
    return toPage(await http.get(ENDPOINTS.orders.list, params), toOrder);
  },

  async get(number) {
    return toOrder(await http.get(ENDPOINTS.orders.detail(number)));
  },

  async cancelVendorOrder(id, reason) {
    return toVendorOrder(
      await http.post(ENDPOINTS.orders.cancelVendorOrder(id), { reason }),
    );
  },
};

/* ---------------------------- ভেন্ডর প্যানেল ---------------------------- */

/* ------------------------- প্ল্যাটফর্ম অ্যাডমিন ------------------------- */

function toAdminVendor(raw = {}) {
  return {
    id: raw.id,
    slug: raw.slug,
    shopName: raw.shop_name,
    logo: mediaUrl(raw.logo),
    banner: mediaUrl(raw.banner),
    district: raw.district ?? "",
    status: raw.status,
    isVerified: raw.is_verified,
    commissionRate: Number(raw.commission_rate ?? 0),
    ownerName: raw.owner_name ?? "",
    ownerPhone: raw.owner_phone ?? "",
    ownerEmail: raw.owner_email ?? "",
    documentsReady: Boolean(raw.documents_ready),
    productCount: raw.product_count ?? 0,
    createdAt: raw.created_at,
    shipsIn: raw.ships_in_days,
    rating: Number(raw.rating_avg ?? 0),
    stats: raw.stats ?? null,
    kyc: raw.kyc
      ? {
          nidNumber: raw.kyc.nid_number ?? "",
          nidFront: mediaUrl(raw.kyc.nid_front),
          nidBack: mediaUrl(raw.kyc.nid_back),
          tradeLicense: mediaUrl(raw.kyc.trade_license),
          bkashNumber: raw.kyc.bkash_number ?? "",
          bankName: raw.kyc.bank_name ?? "",
          bankAccountName: raw.kyc.bank_account_name ?? "",
          bankAccountNumber: raw.kyc.bank_account_number ?? "",
          payoutTarget: raw.kyc.payout_target ?? "",
          reviewedAt: raw.kyc.reviewed_at,
          reviewNote: raw.kyc.review_note ?? "",
        }
      : null,
  };
}

function toAdminProduct(raw = {}) {
  return {
    id: raw.id,
    slug: raw.slug,
    title: raw.title,
    image: mediaUrl(raw.image),
    vendorName: raw.vendor_name,
    vendorSlug: raw.vendor_slug,
    categoryName: raw.category_name,
    price: Number(raw.price ?? 0),
    stock: raw.stock ?? 0,
    status: raw.status,
    soldCount: raw.sold_count ?? 0,
    createdAt: raw.created_at,
  };
}

function toAdminOrder(raw = {}) {
  return {
    number: raw.order_number,
    customerName: raw.customer_name,
    customerPhone: raw.customer_phone,
    createdAt: raw.created_at,
    paymentMethod: raw.payment_method,
    paymentStatus: raw.payment_status,
    grandTotal: Number(raw.grand_total ?? 0),
    status: raw.status,
    parcels: (raw.parcels ?? []).map((p) => ({
      id: p.id,
      subNumber: p.sub_number,
      vendor: p.vendor,
      status: p.status,
      subtotal: Number(p.subtotal ?? 0),
      commission: Number(p.commission ?? 0),
      payable: Number(p.payable ?? 0),
    })),
  };
}

function toAdminPayout(raw = {}) {
  return {
    id: raw.id,
    vendorName: raw.vendor_name,
    vendorSlug: raw.vendor_slug,
    amount: Number(raw.amount ?? 0),
    status: raw.status,
    method: raw.method ?? "",
    reference: raw.reference ?? "",
    entryCount: raw.entry_count ?? 0,
    createdAt: raw.created_at,
    paidAt: raw.paid_at,
  };
}

export const adminApi = {
  async stats() {
    const raw = await http.get(ENDPOINTS.admin.stats);
    return {
      gmvToday: Number(raw.gmv_today ?? 0),
      gmvMonth: Number(raw.gmv_month ?? 0),
      commissionMonth: Number(raw.commission_month ?? 0),
      ordersToday: raw.orders_today ?? 0,
      ordersTotal: raw.orders_total ?? 0,
      customers: raw.customers ?? 0,
      vendors: raw.vendors ?? {},
      products: raw.products ?? {},
      payoutsPending: raw.payouts_pending ?? 0,
      payoutsPendingAmount: Number(raw.payouts_pending_amount ?? 0),
      salesTrend: raw.sales_trend ?? [],
      todo: raw.todo ?? {},
    };
  },

  async listVendors(params = {}) {
    return toPage(await http.get(ENDPOINTS.admin.vendors, params), toAdminVendor);
  },

  async getVendor(id) {
    return toAdminVendor(await http.get(ENDPOINTS.admin.vendor(id)));
  },

  async vendorAction(id, action, note = "") {
    return toAdminVendor(
      await http.post(ENDPOINTS.admin.vendorAction(id, action), { note }),
    );
  },

  async listProducts(params = {}) {
    return toPage(await http.get(ENDPOINTS.admin.products, params), toAdminProduct);
  },

  async productAction(id, action) {
    return toAdminProduct(await http.post(ENDPOINTS.admin.productAction(id, action), {}));
  },

  async listOrders(params = {}) {
    return toPage(await http.get(ENDPOINTS.admin.orders, params), toAdminOrder);
  },

  async listPayouts(params = {}) {
    return toPage(await http.get(ENDPOINTS.admin.payouts, params), toAdminPayout);
  },

  async payoutAction(id, action, reference = "") {
    return toAdminPayout(
      await http.post(ENDPOINTS.admin.payoutAction(id, action), { reference }),
    );
  },

  /* ---------------------------- ক্যাটাগরি ---------------------------- */

  async listCategories() {
    const rows = await http.get(ENDPOINTS.admin.categories);
    return (rows.results ?? rows).map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      icon: c.icon ?? "",
      parent: c.parent,
      parentName: c.parent_name ?? "",
      sortOrder: c.sort_order ?? 0,
      isActive: c.is_active,
      productCount: c.product_count ?? 0,
    }));
  },

  async saveCategory(payload) {
    const body = {
      name: payload.name,
      slug: payload.slug || undefined,
      icon: payload.icon,
      parent: payload.parent || null,
      sort_order: Number(payload.sortOrder) || 0,
      is_active: payload.isActive,
    };
    return payload.id
      ? http.patch(ENDPOINTS.admin.category(payload.id), body)
      : http.post(ENDPOINTS.admin.categories, body);
  },

  async deleteCategory(id) {
    await http.delete(ENDPOINTS.admin.category(id));
    return true;
  },

  /* ------------------------------ কুপন ------------------------------- */

  async listCoupons(params = {}) {
    const rows = await http.get(ENDPOINTS.admin.coupons, params);
    return (rows.results ?? rows).map((c) => ({
      id: c.id,
      code: c.code,
      label: c.label ?? "",
      type: c.type,
      value: Number(c.value ?? 0),
      minOrder: Number(c.min_order ?? 0),
      maxDiscount: c.max_discount ? Number(c.max_discount) : null,
      vendor: c.vendor,
      vendorName: c.vendor_name ?? "",
      scope: c.scope,
      expiresAt: c.expires_at,
      usageLimit: c.usage_limit,
      usedCount: c.used_count ?? 0,
      isActive: c.is_active,
    }));
  },

  async couponVendorOptions() {
    const rows = await http.get(ENDPOINTS.admin.couponVendorOptions);
    return (rows.results ?? rows).map((v) => ({ id: v.id, name: v.shop_name }));
  },

  async saveCoupon(payload) {
    const body = {
      code: payload.code,
      label: payload.label,
      type: payload.type,
      value: payload.value,
      min_order: payload.minOrder || 0,
      max_discount: payload.maxDiscount || null,
      vendor: payload.vendor || null,
      expires_at: payload.expiresAt || null,
      usage_limit: payload.usageLimit || null,
      is_active: payload.isActive,
    };
    return payload.id
      ? http.patch(ENDPOINTS.admin.coupon(payload.id), body)
      : http.post(ENDPOINTS.admin.coupons, body);
  },

  async deleteCoupon(id) {
    await http.delete(ENDPOINTS.admin.coupon(id));
    return true;
  },

  /* ----------------------------- ব্যানার ------------------------------ */

  async listBanners() {
    const rows = await http.get(ENDPOINTS.admin.banners);
    return (rows.results ?? rows).map((b) => ({
      id: b.id,
      title: b.title,
      subtitle: b.subtitle ?? "",
      cta: b.cta ?? "",
      href: b.href ?? "",
      imageUrl: b.image_url ?? "",
      preview: mediaUrl(b.preview),
      tone: b.tone,
      sortOrder: b.sort_order ?? 0,
      isActive: b.is_active,
    }));
  },

  async saveBanner(payload) {
    const body = {
      title: payload.title,
      subtitle: payload.subtitle,
      cta: payload.cta,
      href: payload.href,
      image_url: payload.imageUrl,
      tone: payload.tone,
      sort_order: Number(payload.sortOrder) || 0,
      is_active: payload.isActive,
    };
    return payload.id
      ? http.patch(ENDPOINTS.admin.banner(payload.id), body)
      : http.post(ENDPOINTS.admin.banners, body);
  },

  async deleteBanner(id) {
    await http.delete(ENDPOINTS.admin.banner(id));
    return true;
  },

  /* ------------------------------ ইউজার ------------------------------ */

  async listUsers(params = {}) {
    return toPage(await http.get(ENDPOINTS.admin.users, params), (u) => ({
      id: u.id,
      name: u.full_name,
      phone: u.phone,
      email: u.email ?? "",
      role: u.role,
      isActive: u.is_active,
      isVerified: u.is_phone_verified,
      isStaff: u.is_staff,
      shopName: u.shop_name ?? "",
      orderCount: u.order_count ?? 0,
      joinedAt: u.date_joined,
    }));
  },

  async userAction(id, action) {
    return http.post(ENDPOINTS.admin.userAction(id, action), {});
  },

  /* ----------------------------- সেটিংস ------------------------------ */

  async settings() {
    const raw = await http.get(ENDPOINTS.admin.settings);
    return {
      commission: {
        default: Number(raw.commission?.default ?? 0),
        byCategory: raw.commission?.by_category ?? {},
      },
      shipping: {
        insideDhaka: Number(raw.shipping?.inside_dhaka ?? 0),
        outsideDhaka: Number(raw.shipping?.outside_dhaka ?? 0),
        extraVendorMultiplier: Number(raw.shipping?.extra_vendor_multiplier ?? 0),
        freeThreshold: Number(raw.shipping?.free_threshold ?? 0),
      },
      payoutHoldDays: raw.payout_hold_days,
      maxQtyPerItem: raw.max_qty_per_item,
      lowStockThreshold: raw.low_stock_threshold,
      source: raw.source,
      note: raw.note,
    };
  },

  /* ----------------------------- রিপোর্ট ----------------------------- */

  async salesReport(params = {}) {
    const raw = await http.get(ENDPOINTS.admin.reportSales, params);
    return {
      from: raw.from,
      to: raw.to,
      groupBy: raw.group_by,
      series: (raw.series ?? []).map((r) => ({
        label: r.label,
        date: r.date,
        sales: Number(r.sales ?? 0),
        discount: Number(r.discount ?? 0),
        shipping: Number(r.shipping ?? 0),
        commission: Number(r.commission ?? 0),
        parcels: r.parcels ?? 0,
      })),
      totals: {
        sales: Number(raw.totals?.sales ?? 0),
        discount: Number(raw.totals?.discount ?? 0),
        shipping: Number(raw.totals?.shipping ?? 0),
        commission: Number(raw.totals?.commission ?? 0),
        parcels: raw.totals?.parcels ?? 0,
        delivered: raw.totals?.delivered ?? 0,
        deliveryRate: Number(raw.totals?.delivery_rate ?? 0),
      },
    };
  },

  async vendorReport(params = {}) {
    const raw = await http.get(ENDPOINTS.admin.reportVendors, params);
    return (raw.results ?? []).map((r) => ({
      vendorId: r.vendor_id,
      shopName: r.shop_name,
      slug: r.slug,
      district: r.district ?? "",
      sales: Number(r.sales ?? 0),
      commission: Number(r.commission ?? 0),
      payable: Number(r.payable ?? 0),
      parcels: r.parcels ?? 0,
    }));
  },

  async productReport(params = {}) {
    const raw = await http.get(ENDPOINTS.admin.reportProducts, params);
    const num = (rows) =>
      (rows ?? []).map((r) => ({ ...r, revenue: Number(r.revenue ?? 0) }));
    return {
      topProducts: num(raw.top_products),
      byCategory: num(raw.by_category),
      lowStock: raw.low_stock ?? [],
    };
  },

  async exportReport(type, params = {}) {
    return downloadFile(ENDPOINTS.admin.reportExport, { type, ...params },
                        `shopbazar-${type}.csv`);
  },
};

function toApplication(raw = {}) {
  return {
    vendor: {
      slug: raw.vendor?.slug,
      shopName: raw.vendor?.shop_name,
      status: raw.vendor?.status,
      isVerified: raw.vendor?.is_verified,
      district: raw.vendor?.district ?? "",
      createdAt: raw.vendor?.created_at,
    },
    kyc: raw.kyc
      ? {
          nidNumber: raw.kyc.nid_number ?? "",
          bkashNumber: raw.kyc.bkash_number ?? "",
          bankName: raw.kyc.bank_name ?? "",
          bankAccountName: raw.kyc.bank_account_name ?? "",
          bankAccountNumber: raw.kyc.bank_account_number ?? "",
          reviewNote: raw.kyc.review_note ?? "",
          // আপলোড করা ছবির URL — না থাকলে null
          nidFront: mediaUrl(raw.kyc.nid_front),
          nidBack: mediaUrl(raw.kyc.nid_back),
          tradeLicense: mediaUrl(raw.kyc.trade_license),
        }
      : null,
    checklist: raw.checklist ?? {},
  };
}

export const vendorPanelApi = {
  /** দোকানের আবেদনের অবস্থা ও জমা দেওয়া কাগজপত্র */
  async getApplication() {
    return toApplication(await http.get(ENDPOINTS.vendorPanel.application));
  },

  /**
   * ছবি থাকতে পারে বলে FormData দিয়ে পাঠানো হয়।
   * client.js নিজে থেকেই বোঝে — FormData হলে Content-Type বসায় না,
   * ব্রাউজারকে boundary ঠিক করতে দেয়।
   */
  async saveApplication(payload) {
    const form = new FormData();

    form.append("nid_number", payload.nidNumber ?? "");
    form.append("bkash_number", payload.bkashNumber ?? "");
    form.append("bank_name", payload.bankName ?? "");
    form.append("bank_account_name", payload.bankAccountName ?? "");
    form.append("bank_account_number", payload.bankAccountNumber ?? "");
    form.append("district", payload.district ?? "");

    // নতুন ফাইল হলে পাঠাও, null হলে খালি স্ট্রিং (= মুছে দাও),
    // আর আগের URL হলে কিছুই পাঠিও না — সার্ভারে যা আছে তাই থাকবে
    const files = [
      ["nid_front", payload.nidFront],
      ["nid_back", payload.nidBack],
      ["trade_license", payload.tradeLicense],
    ];
    for (const [field, value] of files) {
      if (value instanceof File) form.append(field, value);
      else if (value === null) form.append(field, "");
    }

    return toApplication(await http.put(ENDPOINTS.vendorPanel.application, form));
  },

  async stats() {
    const raw = await http.get(ENDPOINTS.vendorPanel.stats);
    return {
      todaySales: Number(raw.today_sales ?? 0),
      monthSales: Number(raw.month_sales ?? 0),
      pendingOrders: raw.pending_orders ?? 0,
      lowStock: raw.low_stock ?? 0,
      totalProducts: raw.total_products ?? 0,
      availableBalance: Number(raw.available_balance ?? 0),
      onHold: Number(raw.on_hold ?? 0),
      rating: Number(raw.rating ?? 0),
      salesTrend: raw.sales_trend ?? [],
    };
  },

  async listProducts(params = {}) {
    return toPage(await http.get(ENDPOINTS.vendorPanel.products, params), toProduct);
  },

  async saveProduct(product) {
    const body = {
      title: product.title,
      category: product.category,
      description: product.description,
      price: product.price,
      compare_at_price: product.compareAtPrice || null,
      stock: product.stock,
      status: product.status,
      images: product.images,
    };
    const raw = product.id
      ? await http.patch(ENDPOINTS.vendorPanel.product(product.id), body)
      : await http.post(ENDPOINTS.vendorPanel.products, body);
    return toProduct(raw);
  },

  async deleteProduct(id) {
    await http.delete(ENDPOINTS.vendorPanel.product(id));
    return true;
  },

  async listOrders(params = {}) {
    return toPage(await http.get(ENDPOINTS.vendorPanel.orders, params), toVendorOrder);
  },

  async updateOrderStatus(id, status) {
    return toVendorOrder(await http.patch(ENDPOINTS.vendorPanel.order(id), { status }));
  },

  async ledger(params = {}) {
    const data = await http.get(ENDPOINTS.vendorPanel.ledger, params);
    return (data.results ?? data).map((e) => ({
      id: e.id,
      kind: e.kind,
      amount: Number(e.amount),
      orderNumber: e.order_number,
      createdAt: e.created_at,
      released: Boolean(e.released),
    }));
  },

  async payouts() {
    const data = await http.get(ENDPOINTS.vendorPanel.payouts);
    return (data.results ?? data).map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      status: p.status,
      method: p.method,
      createdAt: p.created_at,
      paidAt: p.paid_at,
    }));
  },

  async requestPayout(amount) {
    return http.post(ENDPOINTS.vendorPanel.payouts, { amount });
  },
};
