/**
 * Django-র সব URL এক জায়গায়। ব্যাকএন্ডে `config/urls.py` লেখার সময়
 * এই ফাইলটাই আপনার চেকলিস্ট — এখানকার প্রতিটা পাথের জন্য একটা করে
 * DRF ViewSet বা APIView বানালেই ফ্রন্টএন্ড কাজ করা শুরু করবে।
 */

export const ENDPOINTS = {
  auth: {
    register: "/auth/register/",
    verifyOtp: "/auth/otp/verify/",
    token: "/auth/token/",
    refresh: "/auth/token/refresh/",
    me: "/auth/me/",
  },

  catalog: {
    categories: "/catalog/categories/",
    products: "/catalog/products/",
    product: (slug) => `/catalog/products/${slug}/`,
    reviews: (slug) => `/catalog/products/${slug}/reviews/`,
    banners: "/catalog/banners/",
    flashSale: "/catalog/flash-sale/",
  },

  vendors: {
    list: "/vendors/",
    detail: (slug) => `/vendors/${slug}/`,
    products: (slug) => `/vendors/${slug}/products/`,
  },

  cart: {
    root: "/cart/",
    items: "/cart/items/",
    item: (id) => `/cart/items/${id}/`,
  },

  checkout: {
    /** কার্ট + ঠিকানা + কুপন পাঠালে সার্ভার পুরো হিসাব ফেরত দেয় */
    quote: "/checkout/quote/",
    validateCoupon: "/promotions/coupons/validate/",
  },

  orders: {
    list: "/orders/",
    detail: (number) => `/orders/${number}/`,
    cancelVendorOrder: (id) => `/orders/vendor-orders/${id}/cancel/`,
  },

  addresses: {
    list: "/accounts/addresses/",
    detail: (id) => `/accounts/addresses/${id}/`,
  },

  wishlist: {
    root: "/accounts/wishlist/",
    item: (productId) => `/accounts/wishlist/${productId}/`,
  },

  /** প্ল্যাটফর্ম অ্যাডমিন — শুধু is_staff ইউজারের জন্য */
  admin: {
    stats: "/admin/stats/",
    vendors: "/admin/vendors/",
    vendor: (id) => `/admin/vendors/${id}/`,
    vendorAction: (id, action) => `/admin/vendors/${id}/${action}/`,
    products: "/admin/products/",
    productAction: (id, action) => `/admin/products/${id}/${action}/`,
    orders: "/admin/orders/",
    payouts: "/admin/payouts/",
    payoutAction: (id, action) => `/admin/payouts/${id}/${action}/`,

    categories: "/admin/categories/",
    category: (id) => `/admin/categories/${id}/`,
    coupons: "/admin/coupons/",
    coupon: (id) => `/admin/coupons/${id}/`,
    couponVendorOptions: "/admin/coupons/vendor-options/",
    banners: "/admin/banners/",
    banner: (id) => `/admin/banners/${id}/`,
    users: "/admin/users/",
    userAction: (id, action) => `/admin/users/${id}/${action}/`,
    settings: "/admin/settings/",

    reportSales: "/admin/reports/sales/",
    reportVendors: "/admin/reports/vendors/",
    reportProducts: "/admin/reports/products/",
    reportExport: "/admin/reports/export/",
  },

  /** পেমেন্ট গেটওয়ে (SSLCommerz) */
  payments: {
    /** কোন পদ্ধতিগুলো এখন চালু — লগইন ছাড়াই পড়া যায় */
    methods: "/payments/methods/",
    /** অর্ডারের জন্য গেটওয়ের পাতার ঠিকানা আনে */
    start: "/payments/start/",
    /** গেটওয়ে থেকে ফেরার পর টাকা সত্যিই পৌঁছেছে কি না জিজ্ঞাসা করে */
    status: (orderNumber) => `/payments/status/${orderNumber}/`,
  },

  /** ভেন্ডর প্যানেল — সব রেসপন্স শুধু লগইন করা ভেন্ডরের নিজের ডেটা */
  vendorPanel: {
    /** অনুমোদনের অপেক্ষায় থাকা বিক্রেতাও এটা ব্যবহার করতে পারেন */
    application: "/vendor/application/",
    stats: "/vendor/stats/",
    products: "/vendor/products/",
    product: (id) => `/vendor/products/${id}/`,
    orders: "/vendor/orders/",
    order: (id) => `/vendor/orders/${id}/`,
    shipOrder: (id) => `/vendor/orders/${id}/ship/`,
    ledger: "/vendor/ledger/",
    balance: "/vendor/balance/",
    payouts: "/vendor/payouts/",
  },
};
