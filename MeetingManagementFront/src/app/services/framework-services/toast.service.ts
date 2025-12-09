import { Injectable } from '@angular/core';
import * as toastr from 'toastr';
import { operationSuccessful } from '../../shared/app-messages';

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  constructor() {
    // تنظیمات پیش‌فرض
    toastr.options.closeButton = true;
    toastr.options.debug = false;
    toastr.options.newestOnTop = true;
    toastr.options.progressBar = true;
    toastr.options.positionClass = 'toast-top-right'; // موقعیت نمایش
    toastr.options.preventDuplicates = true;
    toastr.options.showDuration = 300;
    toastr.options.hideDuration = 1000;
    toastr.options.timeOut = 5000;
    toastr.options.extendedTimeOut = 1000;
    toastr.options.showEasing = 'swing';
    toastr.options.hideEasing = 'linear';
    toastr.options.showMethod = 'fadeIn';
    toastr.options.hideMethod = 'fadeOut';
  }

  success(message: string = operationSuccessful, title: string = 'موفقیت') {
    toastr.success(message, title);
  }

  error(message: string, title: string = 'خطا') {
    toastr.error(message, title);
  }

  info(message: string, title: string = 'توجه') {
    toastr.info(message, title);
  }

  warning(message: string, title: string = 'هشدار') {
    toastr.warning(message, title);
  }

  clear() {
    toastr.clear();
  }
  
}
