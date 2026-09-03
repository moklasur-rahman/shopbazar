import {
  createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState,
} from "react";
import { RULES, STORAGE_KEYS } from "../config";
import { calculateCart, clampQuantity } from "../lib/pricing";
import { isInsideDhaka } from "../lib/bd";

const CartContext = createContext(null);

/* ------------------------------ helpers ------------------------------ */

const lineId = (productId, variantId) => `${productId}::${variantId}`;

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * প্রোডাক্ট + ভ্যারিয়েন্ট থেকে কার্টের একটা লাইন বানায়।
 * কার্টে দাম আর নাম কপি করে রাখা হয় — ভেন্ডর দাম বদলালেও ব্যবহারকারীর
 * কার্ট হঠাৎ বদলে যাবে না (চেকআউটে সার্ভার আবার যাচাই করবে)।
 */
export function makeCartLine(product, variant, quantity = 1) {
  return {
    id: lineId(product.id, variant.id),
    productId: product.id,
    slug: product.slug,
    title: product.title,
    image: product.images?.[0] ?? null,
    variantId: variant.id,
    sku: variant.sku,
    options: variant.options ?? {},
    price: variant.price,
    compareAtPrice: variant.compareAtPrice ?? null,
    stock: variant.stock,
    quantity,
    vendor: {
      id: product.vendor.id,
      slug: product.vendor.slug,
      shopName: product.vendor.shopName,
      logo: product.vendor.logo,
      commissionRate: product.vendor.commissionRate,
      shipsIn: product.vendor.shipsIn,
    },
  };
}

/* ------------------------------ reducer ------------------------------ */

function reducer(items, action) {
  switch (action.type) {
    case "add": {
      const { line } = action;
      const existing = items.find((i) => i.id === line.id);

      if (existing) {
        const next = clampQuantity(existing.quantity + line.quantity, existing.stock);
        return items.map((i) => (i.id === line.id ? { ...i, quantity: next } : i));
      }
      return [...items, { ...line, quantity: clampQuantity(line.quantity, line.stock) }];
    }

    case "setQuantity": {
      const next = clampQuantity(action.quantity, action.stock ?? RULES.maxQtyPerItem);
      if (next <= 0) return items.filter((i) => i.id !== action.id);
      return items.map((i) => (i.id === action.id ? { ...i, quantity: next } : i));
    }

    case "remove":
      return items.filter((i) => i.id !== action.id);

    case "removeVendor":
      return items.filter((i) => i.vendor.id !== action.vendorId);

    case "clear":
      return [];

    default:
      return items;
  }
}

/* ----------------------------- provider ------------------------------ */

export function CartProvider({ children }) {
  const [items, dispatch] = useReducer(reducer, null, () =>
    load(STORAGE_KEYS.cart, []),
  );
  const [coupon, setCoupon] = useState(null);
  const [district, setDistrict] = useState("ঢাকা");
  const [wishlist, setWishlist] = useState(() => load(STORAGE_KEYS.wishlist, []));
  const [recent, setRecent] = useState(() => load(STORAGE_KEYS.recent, []));

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.cart, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.wishlist, JSON.stringify(wishlist));
  }, [wishlist]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.recent, JSON.stringify(recent));
  }, [recent]);

  /* ------------------------------ কার্ট ------------------------------ */

  const addItem = useCallback((product, variant, quantity = 1) => {
    dispatch({ type: "add", line: makeCartLine(product, variant, quantity) });
  }, []);

  const setQuantity = useCallback((id, quantity, stock) => {
    dispatch({ type: "setQuantity", id, quantity, stock });
  }, []);

  const removeItem = useCallback((id) => dispatch({ type: "remove", id }), []);
  const removeVendor = useCallback((vendorId) => dispatch({ type: "removeVendor", vendorId }), []);
  const clear = useCallback(() => {
    dispatch({ type: "clear" });
    setCoupon(null);
  }, []);

  const getQuantity = useCallback(
    (productId, variantId) =>
      items.find((i) => i.id === lineId(productId, variantId))?.quantity ?? 0,
    [items],
  );

  /* ------------------------- উইশলিস্ট ও সাম্প্রতিক ------------------------ */

  const toggleWishlist = useCallback((product) => {
    setWishlist((list) => {
      const exists = list.some((p) => p.id === product.id);
      if (exists) return list.filter((p) => p.id !== product.id);
      return [
        {
          id: product.id,
          slug: product.slug,
          title: product.title,
          image: product.images?.[0],
          price: product.price,
          compareAtPrice: product.compareAtPrice,
          rating: product.rating,
          vendorName: product.vendor?.shopName,
        },
        ...list,
      ];
    });
  }, []);

  const inWishlist = useCallback(
    (productId) => wishlist.some((p) => p.id === productId),
    [wishlist],
  );

  const pushRecent = useCallback((product) => {
    setRecent((list) => {
      const without = list.filter((p) => p.id !== product.id);
      return [
        {
          id: product.id,
          slug: product.slug,
          title: product.title,
          image: product.images?.[0],
          price: product.price,
        },
        ...without,
      ].slice(0, 8);
    });
  }, []);

  /* ------------------------------ হিসাব ------------------------------ */

  const summary = useMemo(
    () =>
      calculateCart({
        items,
        insideDhaka: isInsideDhaka(district),
        coupon,
      }),
    [items, district, coupon],
  );

  const value = useMemo(
    () => ({
      items,
      summary,
      coupon,
      setCoupon,
      district,
      setDistrict,
      addItem,
      setQuantity,
      removeItem,
      removeVendor,
      clear,
      getQuantity,
      itemCount: summary.itemCount,
      vendorCount: summary.groups.length,
      wishlist,
      toggleWishlist,
      inWishlist,
      recent,
      pushRecent,
    }),
    [
      items, summary, coupon, district, addItem, setQuantity, removeItem,
      removeVendor, clear, getQuantity, wishlist, toggleWishlist, inWishlist,
      recent, pushRecent,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
