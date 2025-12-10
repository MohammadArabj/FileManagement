# File Management Platform (SSO-aware, TUS-enabled)

این سند یک طرح اولیه برای پیاده‌سازی کامل سامانه مدیریت فایل است. خروجی شامل لایه‌های بک‌اند (ASP.NET Core 8/10) و فرانت‌اند (Angular 17/20) به همراه اجزای TUS برای آپلود chunk به chunk و یک مدال واحد برای نمایش/آپلود/حذف/دانلود فایل‌ها است.

## اهداف کلیدی
1. **امنیت و یکپارچگی**: احراز هویت/اجازه با SSO (Bearer/JWT) و ادغام claimهای کاربر در سرویس‌ها.
2. **آپلود پایدار**: استفاده از tusdotnet با قابلیت resume، محدودیت پسوند و حجم، و محاسبه checksum برای یکپارچگی فایل.
3. **معماری Clean**: جداسازی لایه‌های Presentation (API)، Application، Domain و Infrastructure.
4. **تجربه کاربری**: یک مدال واحد در فرانت‌اند برای مشاهده لیست فایل‌ها، آپلود، حذف، دانلود و پیش‌نمایش.

## ساختار پوشه پیشنهادی
```
root
├─ backend/              # ASP.NET Core API + TUS endpoint
│  ├─ src/
│  │  ├─ FileManagement.Api/            # Controllers, middlewares
│  │  ├─ FileManagement.Application/    # Command/Query handlers, DTOs
│  │  ├─ FileManagement.Domain/         # Aggregate roots & services
│  │  ├─ FileManagement.Infrastructure/ # EF Core, TUS service, repositories
│  │  └─ FileManagement.Tests/          # Unit/integration tests
│  └─ build/restore scripts
├─ frontend/            # Angular workspace
│  ├─ apps/file-manager/               # Angular 17/20 app
│  ├─ libs/shared/                     # UI & data-access libraries
│  └─ tooling/                         # lint/test config
└─ docs/
   ├─ architecture.md
   └─ api-contracts.md (در آینده)
```

## API لایه‌ها (نمونه‌های کلیدی)
### AttachmentController
- `POST /api/Attachment/UploadFile` و `POST /UploadFiles`: آپلود چندگانه (پیش از TUS برای سازگاری).
- `GET /Download/{guid}`: دانلود و بازگردانی نام/نوع محتوا.
- `GET /GetList`: درخت پوشه/فایل بر اساس Classification.
- `POST /Delete/{guid}`: حذف نرم و پاک‌سازی فایل پس از commit.

### UploadController (TUS)
- `POST /api/Upload/Initiate`: ایجاد جلسه و ارائه TusFileId + Url.
- `MapTus /api/Upload/tus`: مدیریت chunkها.
- `POST /api/Upload/Complete`: ذخیره در مسیر نهایی، ساخت Attachment و محاسبه SHA256.
- `POST /api/Upload/Cancel/{sessionGuid}`: حذف فایل‌های موقت.
- Debug endpoints برای وضعیت استوریج.

## مسیرهای داده‌ای
1. **Initiate**: کلاینت → UploadController → UploadCommandHandler → UploadSession (DB) → پاسخ شامل `tusFileId`.
2. **Upload chunks**: کلاینت → MapTus → TusDiskStore → فایل موقت.
3. **Complete**: کلاینت → UploadController.Complete → TusFileService → AttachmentCommandHandler → ذخیره فایل نهایی + رکورد.
4. **Download**: کلاینت → AttachmentController.Download → AttachmentQueryHandler → FileService.Download → پاسخ FileStream.

## ملاحظات امنیتی
- سیاست CORS فقط بر اساس Origins مجاز.
- Policy: scope = `FileManagementApi`.
- محدودیت پسوندهای خطرناک در TUS (`.exe`, `.dll`, ...).
- اندازه حداکثر 5GB (قابل تنظیم از `appsettings` / `TusSettings`).

## فرانت‌اند (Angular مدال فایل)
- **FileManagerModalComponent**
  - تب «Files»: نمایش لیست بر اساس API `GetList`، پشتیبانی pagination/virtual scroll.
  - تب «Upload»: فرم انتخاب فایل (input یا drag-drop)، ارسال مستقیم TUS به `/api/Upload/tus/{id}`، نمایش progress bar و قابلیت Resume.
  - اکشن‌ها: Preview (برای تصاویر/pdf)، Download (لینک مستقیم)، Delete (تأیید)، Copy link.
- **TusService**: مدیریت initiate/complete، eventهای progress، و cancel.
- **AttachmentService**: فراخوانی API های Attachment برای لیست/حذف/دانلود.

## گام‌های بعدی برای پیاده‌سازی
1. **Bootstrap بک‌اند**: ساخت solution و پروژه‌های چهارگانه (Api, Application, Domain, Infrastructure) با DI و MapTus.
2. **Entities & EF**: تعریف Attachment، Classification، UploadSession و migration اولیه.
3. **TUS plumbing**: TusFileService + TusConfiguration + middlewareها.
4. **فرانت‌اند**: ایجاد Angular workspace، FileManagerModalComponent و سرویس‌های داده.
5. **پیکربندی CI/CD**: restore/test/lint در GH Actions یا Azure DevOps.

## نکات توسعه
- ConnectionString و `TusSettings.StoragePath` باید از تنظیمات محیطی خوانده شوند.
- حتماً قبل از حذف رکورد، فایل فیزیکی به صورت async حذف شود و خطاها لاگ شوند.
- از SHA256 برای تشخیص تکراری بودن (dedup) استفاده کنید در آینده.

این سند نقطه شروع است؛ در مراحل بعدی، کدهای کامل بک‌اند و فرانت‌اند طبق این طرح اضافه می‌شوند.
