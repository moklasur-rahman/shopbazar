/**
 * একমাত্র জায়গা যেখানে fetch() ডাকা হয়।
 *
 * যা সামলায়:
 *  - বেস URL জোড়া লাগানো
 *  - query params
 *  - JWT Authorization হেডার
 *  - ৪০১ পেলে একবার টোকেন রিফ্রেশ করে রিকোয়েস্ট আবার চালানো
 *  - DRF-এর এরর শেপকে ({field: ["msg"]}) একটা সাধারণ ApiError-এ বদলানো
 *  - FormData হলে Content-Type নিজে থেকে না বসানো (ছবি আপলোডের জন্য জরুরি)
 */

import { API_URL, STORAGE_KEYS } from "../config";
import { ENDPOINTS } from "./endpoints";

export class ApiError extends Error {
  constructor(message, { status = 0, fields = {}, raw = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fields = fields; // { phone: "এই নম্বর আগেই ব্যবহৃত" }
    this.raw = raw;
  }
}

/* ------------------------------- টোকেন ------------------------------- */

let accessToken = null;

export const tokenStore = {
  get access() {
    return accessToken;
  },
  get refresh() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.auth) || "{}").refresh || null;
    } catch {
      return null;
    }
  },
  set({ access, refresh, user }) {
    accessToken = access ?? accessToken;
    const current = tokenStore.read();
    localStorage.setItem(
      STORAGE_KEYS.auth,
      JSON.stringify({
        refresh: refresh ?? current.refresh ?? null,
        user: user ?? current.user ?? null,
      }),
    );
  },
  read() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.auth) || "{}");
    } catch {
      return {};
    }
  },
  clear() {
    accessToken = null;
    localStorage.removeItem(STORAGE_KEYS.auth);
  },
};

/* ------------------------------ রিকোয়েস্ট ----------------------------- */

function buildUrl(path, params) {
  const url = new URL(
    path.startsWith("http") ? path : `${API_URL}${path}`,
    window.location.origin,
  );
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === "") continue;
      if (Array.isArray(value)) value.forEach((v) => url.searchParams.append(key, v));
      else url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

/** DRF এরর বডিকে পড়ার মতো বার্তায় বদলায় */
function parseError(status, body) {
  if (!body || typeof body === "string") {
    return new ApiError(body || `সার্ভার এরর (${status})`, { status });
  }

  const fields = {};
  let message = body.detail || body.message || null;

  for (const [key, value] of Object.entries(body)) {
    if (key === "detail" || key === "message") continue;
    const text = Array.isArray(value) ? value.join(" ") : String(value);
    if (key === "non_field_errors") message = message || text;
    else fields[key] = text;
  }

  if (!message) {
    message = Object.values(fields)[0] || `অনুরোধটি ব্যর্থ হয়েছে (${status})`;
  }

  return new ApiError(message, { status, fields, raw: body });
}

async function rawRequest(path, { method = "GET", body, params, auth = true, headers = {} } = {}) {
  const isForm = body instanceof FormData;

  const response = await fetch(buildUrl(path, params), {
    method,
    headers: {
      Accept: "application/json",
      ...(isForm ? {} : body ? { "Content-Type": "application/json" } : {}),
      ...(auth && accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) return null;

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) throw parseError(response.status, data);
  return data;
}

let refreshing = null;

/**
 * সংরক্ষিত refresh টোকেন দিয়ে নতুন access টোকেন আনে।
 *
 * access টোকেন শুধু মেমোরিতে থাকে (XSS-এ যাতে চুরি না যায়), তাই পেজ
 * রিলোডের পর সেটা থাকে না। অ্যাপ চালু হওয়ার সময় একবার এটা ডেকে নিলে
 * প্রথম রিকোয়েস্টটা অকারণে ৪০১ খেয়ে ফিরে আসে না।
 */
export async function refreshAccessToken() {
  const refresh = tokenStore.refresh;
  if (!refresh) return false;

  // একসাথে অনেক রিকোয়েস্ট ৪০১ পেলে যেন একবারই রিফ্রেশ হয়
  refreshing ??= rawRequest(ENDPOINTS.auth.refresh, {
    method: "POST",
    body: { refresh },
    auth: false,
  })
    .then((data) => {
      tokenStore.set({ access: data.access, refresh: data.refresh });
      return true;
    })
    .catch(() => {
      tokenStore.clear();
      return false;
    })
    .finally(() => {
      refreshing = null;
    });

  return refreshing;
}

/** বাইরে থেকে ব্যবহার করার মূল ফাংশন */
export async function request(path, options = {}) {
  try {
    return await rawRequest(path, options);
  } catch (error) {
    if (error.status === 401 && options.auth !== false && !options._retried) {
      const ok = await refreshAccessToken();
      if (ok) return rawRequest(path, { ...options, _retried: true });
    }
    throw error;
  }
}

/**
 * ফাইল ডাউনলোড (CSV এক্সপোর্ট)।
 *
 * সাধারণ <a href> দিয়ে করা যায় না — ওতে Authorization হেডার যায় না,
 * ফলে সার্ভার ৪০১ দেয়। তাই fetch দিয়ে এনে blob বানিয়ে ডাউনলোড করানো হয়।
 */
export async function downloadFile(path, params, fallbackName = "export.csv") {
  const response = await fetch(buildUrl(path, params), {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });

  if (!response.ok) {
    throw new ApiError("ফাইলটি নামানো গেল না।", { status: response.status });
  }

  // সার্ভারের দেওয়া নামটাই ব্যবহার করা হয়, না পেলে fallback
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="?([^";]+)"?/);
  const filename = match ? match[1] : fallbackName;

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  return filename;
}

export const http = {
  get: (path, params, options) => request(path, { ...options, params }),
  post: (path, body, options) => request(path, { ...options, method: "POST", body }),
  patch: (path, body, options) => request(path, { ...options, method: "PATCH", body }),
  put: (path, body, options) => request(path, { ...options, method: "PUT", body }),
  delete: (path, options) => request(path, { ...options, method: "DELETE" }),
};
