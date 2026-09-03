import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],

  test: {
    // টাকার হিসাবের টেস্ট ব্রাউজার ছাড়াই চলে, কিন্তু কম্পোনেন্ট টেস্টের
    // জন্য DOM লাগে — তাই jsdom
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.{js,jsx}"],
  },

  build: {
    rollupOptions: {
      output: {
        /**
         * লাইব্রেরিগুলো আলাদা ফাইলে রাখা হয়।
         *
         * কারণ: React বা Router প্রায় কখনো বদলায় না, কিন্তু আমাদের কোড
         * প্রতি ডেপ্লয়েই বদলায়। আলাদা রাখলে ব্যবহারকারীর ব্রাউজারে
         * লাইব্রেরির ক্যাশ টিকে থাকে — প্রতিবার ৪০০ KB নামাতে হয় না।
         */
        manualChunks: {
          // react/react-dom আলাদা করার চেষ্টা করা হয়েছিল, কিন্তু Vite-এর
          // JSX রানটাইম ওগুলো মূল বান্ডলেই রাখে — খালি চাংক তৈরি হতো।
          router: ["react-router-dom"],
          icons: ["lucide-react"],
        },
      },
    },
    // চাংক বড় হলে সতর্কতা — ৩০০ KB পেরোলে ভাবার সময়
    chunkSizeWarningLimit: 300,
  },
  server: {
    port: 5173,
    watch: {
      // backend/ ফোল্ডারে Python-এর হাজার হাজার ফাইল আছে (.venv, db, media)।
      // এগুলো ওয়াচ করলে HMR স্লো হয় আর অকারণে পেজ রিলোড হতে থাকে।
      ignored: ["**/backend/**"],
    },
    // Django dev server চালু করার পর VITE_USE_MOCK=false করলে এই প্রক্সিও ব্যবহার করতে
    // পারেন — তখন VITE_API_URL=/api/v1 দিলে CORS নিয়ে ভাবতে হবে না।
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
});
