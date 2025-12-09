import { HostListener, Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class UnloadService {
  @HostListener('window:beforeunload', ['$event'])
  unloadHandler(event: BeforeUnloadEvent) {
    // متدی که می‌خوای قبل از خروج کاربر اجرا بشه
    alert('Are you sure you want to leave this page? Any unsaved changes will be lost.');

    // اگه بخوای پیغام هشدار نشون بدی:
    event.preventDefault();
    event.returnValue = '';
  }
}
