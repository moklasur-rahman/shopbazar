/** টাকা, সংখ্যা আর তারিখ ফরম্যাট করার একমাত্র জায়গা */

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

/** ইংরেজি অঙ্ককে বাংলা অঙ্কে বদলায়: 1250 → ১২৫০ */
export function toBnDigits(value) {
  return String(value).replace(/\d/g, (d) => BN_DIGITS[Number(d)]);
}

/**
 * দাম দেখানোর ফরম্যাট। ভেতরের হিসাব সবসময় ইংরেজি সংখ্যায় হয়,
 * শুধু দেখানোর সময় বাংলা করা হয়।
 * money(1250) → "৳ ১,২৫০"
 */
export function money(amount, { withSymbol = true, bn = true } = {}) {
  const n = Number(amount || 0);
  const rounded = Math.round(n * 100) / 100;
  const hasPaisa = rounded % 1 !== 0;
  const grouped = rounded.toLocaleString("en-IN", {
    minimumFractionDigits: hasPaisa ? 2 : 0,
    maximumFractionDigits: 2,
  });
  const body = bn ? toBnDigits(grouped) : grouped;
  return withSymbol ? `৳ ${body}` : body;
}

/** সংখ্যা সংক্ষেপ: 1200 → ১.২ হাজার */
export function compactNumber(value) {
  const n = Number(value || 0);
  if (n >= 10000000) return `${toBnDigits((n / 10000000).toFixed(1))} কোটি`;
  if (n >= 100000) return `${toBnDigits((n / 100000).toFixed(1))} লাখ`;
  if (n >= 1000) return `${toBnDigits((n / 1000).toFixed(1))} হাজার`;
  return toBnDigits(n);
}

const BN_MONTHS = [
  "জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন",
  "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর",
];

export function formatDate(value, { withTime = false } = {}) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const base = `${toBnDigits(d.getDate())} ${BN_MONTHS[d.getMonth()]} ${toBnDigits(d.getFullYear())}`;
  if (!withTime) return base;
  const h = d.getHours() % 12 || 12;
  const m = String(d.getMinutes()).padStart(2, "0");
  const ampm = d.getHours() < 12 ? "সকাল" : d.getHours() < 18 ? "দুপুর" : "রাত";
  return `${base}, ${ampm} ${toBnDigits(h)}:${toBnDigits(m)}`;
}

/** "৩ দিন আগে" ধরনের লেখা */
export function timeAgo(value) {
  const d = new Date(value);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "এইমাত্র";
  if (diff < 3600) return `${toBnDigits(Math.floor(diff / 60))} মিনিট আগে`;
  if (diff < 86400) return `${toBnDigits(Math.floor(diff / 3600))} ঘণ্টা আগে`;
  if (diff < 2592000) return `${toBnDigits(Math.floor(diff / 86400))} দিন আগে`;
  return formatDate(d);
}

/** ছাড়ের শতাংশ: (১০০০ → ৭৫০) হলে ২৫% */
export function discountPercent(price, compareAt) {
  if (!compareAt || compareAt <= price) return 0;
  return Math.round(((compareAt - price) / compareAt) * 100);
}

/** ফোন নম্বর যাচাই — বাংলাদেশি মোবাইল */
export function isValidBdPhone(phone) {
  return /^01[3-9]\d{8}$/.test(String(phone || "").replace(/\s|-/g, ""));
}

export function classNames(...parts) {
  return parts.filter(Boolean).join(" ");
}
