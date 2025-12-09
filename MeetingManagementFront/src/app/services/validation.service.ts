import { Injectable, signal } from '@angular/core';
import { ValidationErrors } from '@angular/forms';

@Injectable({
  providedIn: 'root'
})
export class ValidationMessageService {
  private defaultMessages = signal({
    required: 'این فیلد اجباری است',
    minlength: 'حداقل طول {requiredLength} کاراکتر میباشد. طول فعلی: {actualLength}',
    maxlength: 'حداکثر طول {requiredLength} کاراکتر میباشد. طول فعلی: {actualLength}',
    min: 'حداقل مقدار {min} میباشد',
    max: 'حداکثر مقدار {max} میباشد',
    email: 'ایمیل وارد شده معتبر نیست',
    pattern: 'فرمت وارد شده صحیح نیست',
    url: 'آدرس وارد شده معتبر نیست',
    nationalCode: 'کد ملی وارد شده معتبر نیست',
    mobile: 'شماره موبایل وارد شده معتبر نیست',
    time: 'زمان وارد شده معتبر نیست'
  });

  getErrorMessage(errors: ValidationErrors): string[] {
    const messages: string[] = [];
    const defaultMsgs = this.defaultMessages();

    for (const [errorType, errorValue] of Object.entries(errors)) {
      let message = defaultMsgs[errorType as keyof typeof defaultMsgs] || 'مقدار وارد شده نامعتبر است';

      if (typeof errorValue === 'object' && errorValue !== null) {
        // Replace placeholders with actual values
        Object.keys(errorValue).forEach(key => {
          message = message.replace(`{${key}}`, errorValue[key]);
        });
      }

      messages.push(message);
    }

    return messages;
  }
}