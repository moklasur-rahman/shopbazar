/**
 * ছবি — দেখানো আর আপলোড করা
 *
 * ডিজাইন সিস্টেমের অংশ। সব কম্পোনেন্ট `../ui` থেকে ইমপোর্ট করুন —
 * এই ফাইলটা সরাসরি ইমপোর্ট করার দরকার নেই।
 */

import { useEffect, useRef, useState } from "react";
import { X, ImageOff, Upload, Check } from "lucide-react";
import { classNames as cx, toBnDigits } from "../../lib/format";
import { Skeleton } from "./feedback";

/* ----------------------------- SmartImage ----------------------------- */

/** ছবি লোড না হলে খালি বাক্স না দেখিয়ে একটা প্লেসহোল্ডার দেখায় */
export function SmartImage({ src, alt, className, ratio = "square", ...props }) {
  const [state, setState] = useState("loading");

  useEffect(() => {
    setState(src ? "loading" : "error");
  }, [src]);

  const ratios = { square: "aspect-square", wide: "aspect-[16/9]", tall: "aspect-[3/4]" };

  return (
    <div className={cx("relative overflow-hidden bg-canvas", ratios[ratio], className)}>
      {state === "loading" && <Skeleton className="absolute inset-0 rounded-none" />}
      {state === "error" ? (
        <div className="absolute inset-0 grid place-items-center text-line-2">
          <ImageOff size={26} />
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onLoad={() => setState("ready")}
          onError={() => setState("error")}
          className={cx(
            "h-full w-full object-cover transition-opacity duration-300",
            state === "ready" ? "opacity-100" : "opacity-0",
          )}
          {...props}
        />
      )}
    </div>
  );
}

/* ------------------------------ ImageUpload --------------------------- */

/** ব্যাকএন্ডের common/validators.py এর সাথে মিলিয়ে রাখা */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * একটা ছবি বেছে নেওয়ার ঘর — প্রিভিউসহ।
 *
 * `value` তিন রকম হতে পারে:
 *   File          → ব্যবহারকারী এইমাত্র বেছেছেন (এখনো আপলোড হয়নি)
 *   string (URL)  → আগে আপলোড করা, সার্ভারে আছে
 *   null          → কিছু নেই
 *
 * সার্ভারে পাঠানোর আগেই আকার ও ফরম্যাট যাচাই করা হয়, যাতে ৫ MB ছবি
 * আপলোড হওয়ার পর "খুব বড়" বলে ফেরত না আসে।
 */
export function ImageUpload({
  label, value, onChange, hint, error, required, className,
}) {
  const inputRef = useRef(null);
  const [localError, setLocalError] = useState(null);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (!value) {
      setPreview(null);
      return;
    }
    if (typeof value === "string") {
      setPreview(value);
      return;
    }
    // File — অস্থায়ী URL বানিয়ে প্রিভিউ, আর আনমাউন্টে ছেড়ে দেওয়া
    const url = URL.createObjectURL(value);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  function pick(file) {
    setLocalError(null);
    if (!file) return;

    if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) {
      setLocalError("শুধু JPG, PNG বা WEBP ছবি দেওয়া যাবে");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      setLocalError(`ছবির আকার ${toBnDigits(mb)} MB — সর্বোচ্চ ৫ MB`);
      return;
    }
    onChange(file);
  }

  const shownError = error || localError;

  return (
    <div className={className}>
      {label && (
        <span className="mb-1.5 block text-sm font-medium text-ink-2">
          {label}
          {required && <span className="text-red-500"> *</span>}
        </span>
      )}

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          pick(e.dataTransfer.files?.[0]);
        }}
        className={cx(
          "relative overflow-hidden rounded-xl border-2 border-dashed transition",
          shownError ? "border-red-300 bg-red-50/40" : "border-line-2 bg-canvas hover:border-brand-400",
        )}
      >
        {preview ? (
          <div className="relative">
            <img
              src={preview}
              alt={label}
              className="h-40 w-full bg-white object-contain"
            />
            <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-ink/70 px-3 py-2 backdrop-blur">
              <span className="flex items-center gap-1.5 text-[12px] font-medium text-white">
                <Check size={13} />
                {typeof value === "string" ? "জমা দেওয়া আছে" : "বাছাই হয়েছে"}
              </span>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="ml-auto rounded px-2 py-0.5 text-[12px] text-white/90 transition hover:bg-white/15"
              >
                বদলান
              </button>
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setLocalError(null);
                  if (inputRef.current) inputRef.current.value = "";
                }}
                className="rounded p-1 text-white/90 transition hover:bg-red-500"
                aria-label="ছবিটি সরান"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-40 w-full flex-col items-center justify-center gap-2 px-4 text-center"
          >
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-white text-brand-500 shadow-soft">
              <Upload size={20} />
            </span>
            <span className="text-[13.5px] font-medium text-ink">
              ছবি বেছে নিন
            </span>
            <span className="text-[11.5px] text-muted">
              অথবা এখানে টেনে আনুন · JPG/PNG · সর্বোচ্চ ৫ MB
            </span>
          </button>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0])}
        />
      </div>

      {shownError ? (
        <span className="mt-1 block text-[13px] text-red-600">{shownError}</span>
      ) : hint ? (
        <span className="mt-1 block text-[12.5px] text-muted">{hint}</span>
      ) : null}
    </div>
  );
}
