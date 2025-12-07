# Backend

این نسخه‌ی اولیه یک وب‌اپلیکیشن ASP.NET Core 8 است که آپلود فایل را به دو صورت استاندارد (FormData) و tus.io فراهم می‌کند. داده‌ها و متادیتا به‌صورت درون‌حافظه‌ای نگهداری می‌شوند تا بتوانید سرویس را سریعاً بالا بیاورید و سپس لایه‌های پایدار را اضافه کنید.

## ساختار
- `src/FileManagement.Api/Program.cs`: پیکربندی سرویس‌ها، Swagger و انتهای TUS.
- `Controllers/AttachmentController.cs`: آپلود/لیست/دانلود/حذف فایل با FormData.
- `Controllers/UploadController.cs`: متادیتا و وضعیت آپلودهای TUS.
- `Services`: سرویس ذخیره‌سازی فایل روی دیسک و مخزن درون‌حافظه‌ای برای متادیتا.
- `Infrastructure`: تنظیمات فایل و TUS.

## اجرای سریع
```bash
cd backend/src/FileManagement.Api
DOTNET_URLS=http://localhost:5001 dotnet run
```
سپس:
- آپلود ساده: `POST /api/attachment/upload` با `multipart/form-data`
- لیست: `GET /api/attachment`
- لیست با فیلتر پوشه: `GET /api/attachment?folderPath=2024/08`
- دانلود: `GET /api/attachment/download/{guid}`
- حذف: `DELETE /api/attachment/{guid}`
- TUS: نقطه پایان `POST/PATCH/HEAD /api/upload/tus` بر اساس پروتکل tus.io

برای ذخیره روی دیسک، مسیر پیش‌فرض `storage/files` و `storage/tus` در ریشه‌ی برنامه ایجاد می‌شود. مقادیر را می‌توانید در `appsettings.json` تغییر دهید.
