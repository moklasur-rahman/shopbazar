import { useEffect, useState } from "react";

/** সার্চ বক্সে টাইপ করার সময় প্রতি অক্ষরে API না ডেকে থেমে যাওয়ার পর ডাকে */
export function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

/** স্ক্রিন সাইজ — মোবাইল/ডেস্কটপ আলাদা UI দেখানোর জন্য */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e) => setMatches(e.matches);
    mql.addEventListener("change", handler);
    setMatches(mql.matches);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}
