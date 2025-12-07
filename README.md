# FileManagement

این مخزن شامل یک بک‌اند ASP.NET Core و یک رابط کاربری ساده برای مدیریت فایل است. بک‌اند از TUS برای آپلود chunked پشتیبانی می‌کند و مسیر ساده‌ای برای آپلود/دانلود معمولی هم دارد. رابط کاربری فعلی یک صفحه‌ی استاتیک با مدال مدیریت فایل است تا بتوانید رفتار API را سریعاً تست کنید.

## پوشه‌ها
- `docs/architecture.md`: طرح معماری کل سامانه و جریان‌های احراز هویت/آپلود.
- `backend/`: کد عملیاتی اولیه (API، سرویس‌های فایل و TUS) به همراه README اجرا.
- `frontend/`: صفحه‌ی HTML/CSS/JS که یک مدال آپلود و لیست فایل فراهم می‌کند و به API متصل می‌شود.

## اجرا
1. **Backend**
   ```bash
   cd backend/src/FileManagement.Api
   DOTNET_URLS=http://localhost:5001 dotnet run
   ```
   سپس Swagger روی `http://localhost:5001/swagger` در دسترس است.

2. **Frontend**
   فایل `frontend/index.html` را با یک سرویس ساده استاتیک (یا Live Server) باز کنید. متغیر `apiBase` در `frontend/script.js` پیش‌فرض به `https://localhost:5001/api` اشاره می‌کند؛ در صورت نیاز آن را تغییر دهید.
