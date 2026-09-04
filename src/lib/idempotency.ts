/**
 * একই কাজ দুইবার হওয়া ঠেকানোর কি।
 *
 * এটাই প্রজেক্টের প্রথম TypeScript ফাইল — ইচ্ছে করে ছোট আর স্বাধীন
 * একটা মডিউল বেছে নেওয়া হয়েছে, যাতে সেটআপটা (Vite, Vitest, ESLint,
 * tsc) সত্যিই কাজ করে কি না তা প্রমাণ হয়। নতুন ফাইল এভাবেই `.ts`
 * বা `.tsx` হিসেবে লিখুন; পুরোনো `.jsx` ফাইলগুলো আগের মতোই চলবে।
 */

/**
 * চেকআউটের জন্য একটা নতুন কি।
 *
 * `crypto.randomUUID` শুধু HTTPS বা localhost-এ থাকে। LAN-এ
 * (যেমন ফোন থেকে http://192.168.0.5:5173 খুলে টেস্ট করার সময়)
 * সেটা `undefined` — তাই ফলব্যাক লাগে, নইলে ওখানে অর্ডারই হতো না।
 */
export function newIdempotencyKey(prefix = "co"): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();

  const time = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${time}-${random}`;
}
