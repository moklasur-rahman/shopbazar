# ------------------------------------------------------------- ফ্রন্টএন্ড
# React বিল্ড করে nginx দিয়ে পরিবেশন।  docker compose build web

# ---------- ধাপ ১: বিল্ড ----------
FROM node:22-alpine AS build

WORKDIR /app

# package ফাইল আগে — node_modules-এর লেয়ারটা ক্যাশে থাকে
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite বিল্ডের সময়ই VITE_* মান কোডে বসিয়ে দেয়, রানটাইমে বদলানো যায় না।
# তাই এগুলো ARG — docker compose build-এ পাঠানো হয়।
#
# ডিফল্ট /api/v1 আপেক্ষিক পথ: ব্রাউজার যে হোস্টে সাইট খুলেছে সেখানেই
# API খুঁজবে, আর nginx সেটা ব্যাকএন্ডে পাঠাবে। ফলে CORS-এর প্রশ্নই ওঠে না।
ARG VITE_USE_MOCK=false
ARG VITE_API_URL=/api/v1
ARG VITE_MEDIA_URL=
ENV VITE_USE_MOCK=$VITE_USE_MOCK \
    VITE_API_URL=$VITE_API_URL \
    VITE_MEDIA_URL=$VITE_MEDIA_URL

RUN npm run build

# ---------- ধাপ ২: পরিবেশন ----------
# node_modules (২০০+ MB) চূড়ান্ত ইমেজে যায় না — শুধু dist/ যায়
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
