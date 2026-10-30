// این فایل نسخهٔ آفلاین برنامه را نگه می‌دارد و درخواست‌های صفحه را مدیریت می‌کند.
const CACHE_NAME = "my-tasks-pwa-v4";
// فایل‌ها و تصویرهایی که برای باز شدن برنامه بدون اینترنت نگهداری می‌شوند.
const APP_SHELL = [
  "./",
  "./index.html",
  "./add.html",
  "./archives.html",
  "./style.css",
  "./data-layer.js",
  "./script.js",
  "./login.html",
  "./register.html",
  "./profile.html",
  "./pwa.js",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
];

// هنگام نصب، فایل‌های لازم در حافظهٔ آفلاین ذخیره می‌شوند.
// ورودی: رویداد نصب مرورگر؛ خروجی ندارد و کار را تا پایان ذخیره‌سازی به تأخیر می‌اندازد.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      // پس از بازکردن حافظهٔ تازه، همهٔ فایل‌های برنامه در آن ذخیره می‌شوند.
      .then((cache) => cache.addAll(APP_SHELL))
      // پس از نصب موفق، نسخهٔ تازه آمادهٔ استفاده می‌شود.
      .then(() => self.skipWaiting()),
  );
});

// هنگام فعال‌شدن نسخهٔ تازه، حافظه‌های قدیمی برنامه پاک و نسخهٔ تازه فعال می‌شود.
// ورودی: رویداد فعال‌شدن مرورگر؛ خروجی ندارد و کار را تا پایان پاک‌سازی نگه می‌دارد.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      // ابتدا نام حافظه‌های ذخیره‌شده را می‌گیرد.
      .keys()
      // برای هر نام حافظه، فقط نسخه‌های قدیمی همین برنامه انتخاب می‌شوند.
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter(
              // حافظه‌های برنامه‌های دیگر دست‌نخورده می‌مانند.
              (cacheName) =>
                cacheName.startsWith("my-tasks-pwa-") && cacheName !== CACHE_NAME,
            )
            // هر حافظهٔ قدیمیِ پیدا‌شده پاک می‌شود.
            .map((cacheName) => caches.delete(cacheName)),
        ),
      )
      // پس از پاک‌سازی، نسخهٔ تازه کنترل صفحه‌ها را در دست می‌گیرد.
      .then(() => self.clients.claim()),
  );
});

// درخواست‌های صفحه را پاسخ می‌دهد؛ در حالت آفلاین تا جای ممکن از نسخهٔ ذخیره‌شده استفاده می‌کند.
// ورودی: رویداد درخواست مرورگر؛ خروجی ندارد و پاسخ مناسب را به مرورگر برمی‌گرداند.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const requestUrl = new URL(request.url);

  // درخواست‌های غیرخواندنی یا مربوط به سایت‌های دیگر در این فایل مدیریت نمی‌شوند.
  if (request.method !== "GET" || requestUrl.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    // برای بازکردن صفحه، اول اینترنت را امتحان می‌کند و نسخهٔ موفق را برای بعد ذخیره می‌کند.
    event.respondWith(
      fetch(request)
        // اگر پاسخ اینترنت درست بود، یک نسخه برای استفادهٔ آفلاین نگهداری می‌شود.
        .then((response) => {
          if (response.ok) {
            const responseCopy = response.clone();
            // نگهداری پاسخ در حافظه انجام می‌شود، اما همان پاسخ اصلی هم به صفحه می‌رسد.
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseCopy));
          }
          return response;
        })
        // اگر اینترنت در دسترس نبود، صفحهٔ ذخیره‌شده یا صفحهٔ اصلی نمایش داده می‌شود.
        .catch(async () => {
          const cachedPage = await caches.match(request, { ignoreSearch: true });
          return cachedPage || caches.match("./index.html");
        }),
    );
    return;
  }

  // برای فایل‌های دیگر، نسخهٔ ذخیره‌شده مقدم است؛ اگر نباشد از اینترنت دریافت می‌شود.
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(
      // در صورت نبود نسخهٔ ذخیره‌شده، درخواست به اینترنت فرستاده می‌شود.
      (cachedResponse) =>
        cachedResponse ||
        // پاسخ موفق اینترنت هم برای استفادهٔ بعدی ذخیره می‌شود.
        fetch(request).then((response) => {
          if (response.ok) {
            const responseCopy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseCopy));
          }
          return response;
        }),
    ),
  );
});
