/**
 * Django (snake_case) → React (camelCase) অনুবাদক।
 *
 * এই ফাইলটাই ফ্রন্টএন্ড আর ব্যাকএন্ডের মাঝের চুক্তি। DRF সিরিয়ালাইজার
 * লেখার সময় বাঁ পাশের ফিল্ডগুলো দিলেই হবে — UI কম্পোনেন্ট শুধু ডান
 * পাশের নাম চেনে, তাই ব্যাকএন্ডে নাম বদলালেও শুধু এই ফাইলটা ঠিক করতে হবে।
 */

import { MEDIA_URL } from "../config";

/** আপেক্ষিক মিডিয়া পাথকে পূর্ণ URL বানায়: /media/a.jpg → http://host/media/a.jpg */
export function mediaUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//.test(path) || path.startsWith("data:")) return path;
  return `${MEDIA_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

export function toVendor(raw = {}) {
  return {
    id: raw.id,
    slug: raw.slug,
    shopName: raw.shop_name ?? raw.shopName,
    logo: mediaUrl(raw.logo),
    banner: mediaUrl(raw.banner),
    rating: Number(raw.rating_avg ?? raw.rating ?? 0),
    ratingCount: raw.rating_count ?? 0,
    productCount: raw.product_count ?? 0,
    since: raw.created_at ?? raw.since ?? null,
    district: raw.district ?? "",
    isVerified: Boolean(raw.is_verified ?? raw.isVerified),
    responseRate: raw.response_rate ?? null,
    shipsIn: raw.ships_in_days ?? 2,
    commissionRate: Number(raw.commission_rate ?? 8),
  };
}

export function toVariant(raw = {}) {
  return {
    id: raw.id,
    sku: raw.sku,
    options: raw.options ?? {},
    price: Number(raw.price ?? 0),
    compareAtPrice: raw.compare_at_price ? Number(raw.compare_at_price) : null,
    stock: Number(raw.stock ?? 0),
    weightKg: Number(raw.weight_kg ?? 0),
  };
}

export function toProduct(raw = {}) {
  const variants = (raw.variants ?? []).map(toVariant);
  const first = variants[0];

  return {
    id: raw.id,
    slug: raw.slug,
    title: raw.title,
    description: raw.description ?? "",
    images: (raw.images ?? []).map((img) =>
      typeof img === "string" ? mediaUrl(img) : mediaUrl(img.image),
    ),
    category: raw.category?.slug ?? raw.category ?? null,
    categoryName: raw.category?.name ?? raw.category_name ?? "",
    brand: raw.brand?.name ?? raw.brand ?? "",
    vendor: raw.vendor ? toVendor(raw.vendor) : null,
    variants,
    price: Number(raw.price ?? first?.price ?? 0),
    compareAtPrice: raw.compare_at_price
      ? Number(raw.compare_at_price)
      : (first?.compareAtPrice ?? null),
    stock: Number(raw.stock ?? variants.reduce((s, v) => s + v.stock, 0)),
    rating: Number(raw.rating_avg ?? raw.rating ?? 0),
    ratingCount: raw.rating_count ?? 0,
    soldCount: raw.sold_count ?? 0,
    isFreeShipping: Boolean(raw.free_shipping),
    status: raw.status ?? "live",
    createdAt: raw.created_at ?? null,
    specs: raw.specs ?? {},
  };
}

export function toReview(raw = {}) {
  return {
    id: raw.id,
    rating: Number(raw.rating ?? 0),
    comment: raw.comment ?? "",
    author: raw.author_name ?? raw.author ?? "ক্রেতা",
    createdAt: raw.created_at ?? null,
    isVerified: Boolean(raw.is_verified_purchase ?? true),
    photos: (raw.photos ?? []).map(mediaUrl),
  };
}

/**
 * ঠিকানা — Django snake_case (receiver_name, address_line) কে UI-র
 * camelCase (name, addressLine) এ আনে।
 *
 * mock মোডে ঠিকানা আগে থেকেই camelCase, তাই দুই দিকই সামলানো হয়েছে —
 * নাহলে VITE_USE_MOCK বদলালে অর্ডারের পাতায় ঠিকানা ফাঁকা দেখাত।
 */
export function toAddress(raw = {}) {
  return {
    name: raw.receiver_name ?? raw.name ?? "",
    phone: raw.phone ?? "",
    division: raw.division ?? "",
    district: raw.district ?? "",
    thana: raw.thana ?? "",
    addressLine: raw.address_line ?? raw.addressLine ?? "",
    note: raw.note ?? "",
  };
}

export function toOrderItem(raw = {}) {
  return {
    id: raw.id,
    productTitle: raw.product_title ?? raw.productTitle,
    productSlug: raw.product_slug ?? raw.productSlug,
    image: mediaUrl(raw.image),
    options: raw.options ?? {},
    unitPrice: Number(raw.unit_price ?? raw.unitPrice ?? 0),
    quantity: Number(raw.quantity ?? 1),
    canReview: Boolean(raw.can_review),
  };
}

export function toVendorOrder(raw = {}) {
  return {
    id: raw.id,
    subNumber: raw.sub_number ?? raw.subNumber,
    vendor: raw.vendor ? toVendor(raw.vendor) : null,
    status: raw.status ?? "pending",
    items: (raw.items ?? []).map(toOrderItem),
    // ভেন্ডর প্যানেল এই তিনটা দেখায় — সে মূল Order কখনো পায় না
    orderNumber: raw.order_number ?? raw.orderNumber ?? null,
    address: toAddress(raw.shipping_address ?? raw.address ?? {}),
    createdAt: raw.created_at ?? raw.createdAt ?? null,
    itemsTotal: Number(raw.subtotal ?? raw.itemsTotal ?? 0),
    discount: Number(raw.discount ?? 0),
    shipping: Number(raw.shipping_fee ?? raw.shipping ?? 0),
    commission: Number(raw.commission_amount ?? raw.commission ?? 0),
    payable: Number(raw.payable ?? 0),
    courier: raw.courier ?? null,
    trackingCode: raw.tracking_code ?? null,
    updatedAt: raw.updated_at ?? null,
  };
}

export function toOrder(raw = {}) {
  return {
    number: raw.order_number ?? raw.number,
    createdAt: raw.created_at ?? raw.createdAt,
    paymentMethod: raw.payment_method ?? raw.paymentMethod,
    paymentStatus: raw.payment_status ?? "pending",
    address: toAddress(raw.shipping_address ?? raw.address ?? {}),
    itemsTotal: Number(raw.items_total ?? raw.itemsTotal ?? 0),
    shippingTotal: Number(raw.shipping_total ?? raw.shippingTotal ?? 0),
    discount: Number(raw.discount_total ?? raw.discount ?? 0),
    grandTotal: Number(raw.grand_total ?? raw.grandTotal ?? 0),
    vendorOrders: (raw.vendor_orders ?? raw.vendorOrders ?? []).map(toVendorOrder),
  };
}

export function toUser(raw = {}) {
  return {
    id: raw.id,
    name: raw.full_name ?? raw.name ?? "",
    phone: raw.phone ?? "",
    email: raw.email ?? "",
    role: raw.role ?? "customer",
    avatar: mediaUrl(raw.avatar),
    vendorSlug: raw.vendor?.slug ?? raw.vendor_slug ?? null,
    vendorName: raw.vendor?.shop_name ?? null,
    /**
     * নতুন দোকান pending অবস্থায় থাকে — অ্যাডমিন অনুমোদন না দেওয়া পর্যন্ত
     * ভেন্ডর প্যানেলের সব API ৪০৩ দেয়। এই ফিল্ডটা দেখেই ফ্রন্টএন্ড ঠিক করে
     * ড্যাশবোর্ড দেখাবে নাকি "অনুমোদনের অপেক্ষায়" পাতা।
     */
    vendorStatus: raw.vendor?.status ?? raw.vendorStatus ?? null,
    /** প্ল্যাটফর্ম অ্যাডমিন — ব্যাকএন্ডের is_staff ফ্ল্যাগই একমাত্র সত্য */
    isStaff: Boolean(raw.is_staff ?? raw.isStaff),
  };
}

/** DRF পেজিনেশন র‍্যাপার — {count, next, previous, results} */
export function toPage(raw, mapper) {
  if (Array.isArray(raw)) {
    return { count: raw.length, next: null, previous: null, results: raw.map(mapper) };
  }
  return {
    count: raw?.count ?? 0,
    next: raw?.next ?? null,
    previous: raw?.previous ?? null,
    results: (raw?.results ?? []).map(mapper),
  };
}
