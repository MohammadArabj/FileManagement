import { Component, input, output, signal, computed, OnInit } from '@angular/core';
import { CustomControlComponent } from './custom-control';
import { InputType, normalizePersianNumber, PersianValidators } from '../../core/types/configuration';

@Component({
  selector: 'custom-input',
  standalone: true,
  template: `
    @if (styleType() === 'simple') {
      <div class="form-group">
        <label [for]="identity()" class="form-label">
          {{label()}}
          @if (isRequired()) {
            <span class="text-danger"> *</span>
          }
        </label>
        @switch (type()) {
          @case ('textarea') {
            <textarea
              [id]="identity()"
              class="form-control {{classInput()}}"
              [placeholder]="placeholder()"
              [value]="value()"
              [attr.cols]="cols()"
              [attr.rows]="rows()"
              [disabled]="isDisabled()"
              [readonly]="isReadonly()"
              (input)="handleInput($event)"
              (focus)="handleFocus()"
              (blur)="handleBlur()"
              autocomplete="off"
              [attr.required]="isRequired() || null"
              [attr.minLength]="min() || null"
              [attr.maxLength]="max() || null"
              [attr.aria-describedby]="hasError() ? identity() + '-error' : null">
            </textarea>
          }
          @case ('text') {
            <input
              type="text"
              [id]="identity()"
              class="form-control {{classInput()}}"
              [placeholder]="placeholder()"
              [value]="value()"
              [disabled]="isDisabled()"
              [readonly]="isReadonly()"
              (input)="handleInput($event)"
              (focus)="handleFocus()"
              (blur)="handleBlur()"
              autocomplete="off"
              [attr.required]="isRequired() || null"
              (keyup.enter)="handleKeyUp('enter')"
              [attr.minLength]="min() || null"
              [attr.maxLength]="max() || null"
              [attr.aria-describedby]="hasError() ? identity() + '-error' : null">
          }
          @case ('national-code') {
            <input
              type="text"
              [id]="identity()"
              class="form-control {{classInput()}}"
              [placeholder]="placeholder() || 'کد ملی 10 رقمی'"
              [value]="value()"
              [disabled]="isDisabled()"
              [readonly]="isReadonly()"
              (input)="handleNationalCodeInput($event)"
              (focus)="handleFocus()"
              (blur)="handleBlur()"
              autocomplete="off"
              [attr.required]="isRequired() || null"
              (keyup.enter)="handleKeyUp('enter')"
              maxlength="10"
              pattern="[0-9]{10}"
              data-national-code="true"
              [attr.aria-describedby]="hasError() ? identity() + '-error' : null">
          }
          @case ('password') {
            <div class="input-group">
              <input
                [type]="showPassword() ? 'text' : 'password'"
                [id]="identity()"
                class="form-control {{classInput()}}"
                [placeholder]="placeholder()"
                [value]="value()"
                [disabled]="isDisabled()"
                [readonly]="isReadonly()"
                (input)="handleInput($event)"
                (focus)="handleFocus()"
                (blur)="handleBlur()"
                autocomplete="new-password"
                [attr.required]="isRequired() || null"
                (keyup.enter)="handleKeyUp('enter')"
                [attr.minLength]="min() || null"
                [attr.maxLength]="max() || null"
                [attr.aria-describedby]="hasError() ? identity() + '-error' : null">
              <button
                class="btn btn-outline-secondary"
                type="button"
                (click)="togglePasswordVisibility()"
                [attr.aria-label]="showPassword() ? 'پنهان کردن رمز عبور' : 'نمایش رمز عبور'">
                <i class="fa" [class.fa-eye]="!showPassword()" [class.fa-eye-slash]="showPassword()"></i>
              </button>
            </div>
          }
          @case ('mobile') {
            <input
              type="tel"
              [id]="identity()"
              class="form-control {{classInput()}}"
              placeholder="09111234567"
              [value]="value()"
              [disabled]="isDisabled()"
              [readonly]="isReadonly()"
              (input)="handleMobileInput($event)"
              (focus)="handleFocus()"
              (blur)="handleMobileBlur($event)"
              autocomplete="tel"
              [attr.required]="isRequired() || null"
              maxlength="11"
              pattern="^09[0-9]{9}$"
              title="شماره موبایل باید با 09 شروع شده و 11 رقم باشد"
              [attr.aria-describedby]="hasError() ? identity() + '-error' : null">
          }
          @case ('email') {
            <input
              type="email"
              [id]="identity()"
              class="form-control {{classInput()}}"
              [placeholder]="placeholder()"
              [value]="value()"
              [disabled]="isDisabled()"
              [readonly]="isReadonly()"
              (input)="handleInput($event)"
              (focus)="handleFocus()"
              (blur)="handleBlur()"
              autocomplete="email"
              [attr.required]="isRequired() || null"
              (keyup.enter)="handleKeyUp('enter')"
              [attr.minLength]="min() || null"
              [attr.maxLength]="max() || null"
              [attr.aria-describedby]="hasError() ? identity() + '-error' : null">
          }
          @case ('time') {
            <input
              type="text"
              [id]="identity()"
              class="form-control {{classInput()}}"
              placeholder="HH:mm"
              [value]="value()"
              [disabled]="isDisabled()"
              [readonly]="isReadonly()"
              (input)="handleTimeInput($event)"
              (focus)="handleFocus()"
              (blur)="handleTimeBlur($event)"
              autocomplete="off"
              [attr.required]="isRequired() || null"
              maxlength="5"
              pattern="^([01]\\d|2[0-3]):([0-5]\\d)$"
              title="لطفاً زمان را در قالب 24 ساعته (HH:mm) وارد کنید"
              [attr.aria-describedby]="hasError() ? identity() + '-error' : null">
          }
          @case ('number') {
            <input
              type="number"
              step="0.001"
              [id]="identity()"
              class="form-control {{classInput()}}"
              [placeholder]="placeholder()"
              [value]="value()"
              [disabled]="isDisabled()"
              [readonly]="isReadonly()"
              (input)="handleInput($event)"
              (focus)="handleFocus()"
              (blur)="handleBlur()"
              autocomplete="off"
              [attr.required]="isRequired() || null"
              [attr.min]="min() || null"
              [attr.max]="max() || null"
              [attr.aria-describedby]="hasError() ? identity() + '-error' : null">
          }
          @case ('date') {
            <input
              [id]="identity()"
              class="form-control {{classInput()}}"
              [placeholder]="placeholder()"
              [value]="value()"
              [disabled]="isDisabled()"
              [readonly]="isReadonly()"
              data-jdp
              (input)="handleInput($event)"
              (focus)="handleFocus()"
              (blur)="handleBlur()"
              autocomplete="off"
              [attr.required]="isRequired() || null"
              appDateMask
              data-date
              [attr.aria-describedby]="hasError() ? identity() + '-error' : null">
          }
          @case ('file') {
            <input
              type="file"
              [id]="identity()"
              class="form-control {{classInput()}}"
              [accept]="acceptedFiles()"
              [disabled]="isDisabled()"
              [readonly]="isReadonly()"
              autocomplete="off"
              [attr.required]="isRequired() || null"
              (change)="handleFileChange($event)"
              [attr.aria-describedby]="hasError() ? identity() + '-error' : null">
          }
          @case ('fileMultiple') {
            <input
              type="file"
              multiple
              [id]="identity()"
              class="form-control {{classInput()}}"
              [accept]="acceptedFiles()"
              [disabled]="isDisabled()"
              [readonly]="isReadonly()"
              autocomplete="off"
              [attr.required]="isRequired() || null"
              (change)="handleFileChange($event)"
              [attr.aria-describedby]="hasError() ? identity() + '-error' : null">
          }
          @case ('color') {
            <input
              type="color"
              [id]="identity()"
              class="form-control form-control-color"
              [value]="value() || '#000000'"
              [disabled]="isDisabled()"
              [readonly]="isReadonly()"
              (input)="handleInput($event)"
              (focus)="handleFocus()"
              (blur)="handleBlur()"
              autocomplete="off"
              [attr.required]="isRequired() || null"
              [attr.aria-describedby]="hasError() ? identity() + '-error' : null">
          }
          @case ('url') {
            <input
              type="url"
              [id]="identity()"
              class="form-control {{classInput()}}"
              [placeholder]="placeholder() || 'https://example.com'"
              [value]="value()"
              [disabled]="isDisabled()"
              [readonly]="isReadonly()"
              (input)="handleInput($event)"
              (focus)="handleFocus()"
              (blur)="handleBlur()"
              autocomplete="url"
              [attr.required]="isRequired() || null"
              [attr.aria-describedby]="hasError() ? identity() + '-error' : null">
          }
          @case ('search') {
            <input
              type="search"
              [id]="identity()"
              class="form-control {{classInput()}}"
              [placeholder]="placeholder() || 'جستجو...'"
              [value]="value()"
              [disabled]="isDisabled()"
              [readonly]="isReadonly()"
              (input)="handleInput($event)"
              (focus)="handleFocus()"
              (blur)="handleBlur()"
              autocomplete="off"
              [attr.required]="isRequired() || null"
              (keyup.enter)="handleKeyUp('enter')"
              [attr.aria-describedby]="hasError() ? identity() + '-error' : null">
          }
          @case ('range') {
            <div class="range-container">
              <input
                type="range"
                [id]="identity()"
                class="form-range {{classInput()}}"
                [value]="value()"
                [disabled]="isDisabled()"
                [readonly]="isReadonly()"
                (input)="handleInput($event)"
                (focus)="handleFocus()"
                (blur)="handleBlur()"
                [attr.min]="min() || 0"
                [attr.max]="max() || 100"
                [attr.step]="step() || 1"
                [attr.aria-describedby]="hasError() ? identity() + '-error' : null">
              <div class="range-value">{{value() || 0}}</div>
            </div>
          }
        }

        @if (helpText()) {
          <div class="form-text">{{helpText()}}</div>
        }

        @if (hasError()) {
          <div [id]="identity() + '-error'" class="invalid-feedback d-block">
            @for (message of errorMessages(); track $index) {
              <div>{{message}}</div>
            }
          </div>
        }
      </div>
    } @else if (styleType() === 'group') {
      <div class="input-group mb-1 mt-1">
        <label class="sr-only" style="display:none;" [for]="identity()">{{label()}}</label>
        <span class="input-group-text">
          {{label()}}
          @if (isRequired()) {
            <span class="text-danger"> *</span>
          }
        </span>

        <!-- Same switch content as above but without form-group wrapper -->
        @switch (type()) {
          @case ('textarea') {
            <textarea
              [id]="identity()"
              class="form-control {{classInput()}}"
              [placeholder]="placeholder()"
              [value]="value()"
              [attr.cols]="cols()"
              [attr.rows]="rows()"
              [disabled]="isDisabled()"
              [readonly]="isReadonly()"
              (input)="handleInput($event)"
              (focus)="handleFocus()"
              (blur)="handleBlur()"
              autocomplete="off"
              [attr.required]="isRequired() || null"
              [attr.minLength]="min() || null"
              [attr.maxLength]="max() || null">
            </textarea>
          }
          <!-- Continue with other input types... -->
        }

        <ng-content></ng-content>

        @if (hasError()) {
          <div class="invalid-feedback d-block">
            @for (message of errorMessages(); track $index) {
              <div>{{message}}</div>
            }
          </div>
        }
      </div>
    } @else if (styleType() === 'floating') {
      <div class="form-floating">
        <!-- Floating label inputs -->
        @switch (type()) {
          @case ('textarea') {
            <textarea
              [id]="identity()"
              class="form-control {{classInput()}}"
              [placeholder]="label()"
              [value]="value()"
              [attr.cols]="cols()"
              [attr.rows]="rows()"
              [disabled]="isDisabled()"
              [readonly]="isReadonly()"
              (input)="handleInput($event)"
              (focus)="handleFocus()"
              (blur)="handleBlur()"
              autocomplete="off"
              [attr.required]="isRequired() || null"
              [attr.minLength]="min() || null"
              [attr.maxLength]="max() || null">
            </textarea>
          }
          @default {
            <input
              [type]="getInputType()"
              [id]="identity()"
              class="form-control {{classInput()}}"
              [placeholder]="label()"
              [value]="value()"
              [disabled]="isDisabled()"
              [readonly]="isReadonly()"
              (input)="handleInput($event)"
              (focus)="handleFocus()"
              (blur)="handleBlur()"
              autocomplete="off"
              [attr.required]="isRequired() || null">
          }
        }
        <label [for]="identity()">
          {{label()}}
          @if (isRequired()) {
            <span class="text-danger"> *</span>
          }
        </label>

        @if (hasError()) {
          <div class="invalid-feedback d-block">
            @for (message of errorMessages(); track $index) {
              <div>{{message}}</div>
            }
          </div>
        }
      </div>
    }
  `,
  host: {
    '[attr.data-component]': '"custom-input"'
  }
})
export class CustomInputComponent extends CustomControlComponent implements OnInit {
  // Additional input properties specific to input component
  type = input<InputType>('text');
  rows = input<string>('3');
  cols = input<string>();
  step = input<number>(1);
  acceptedFiles = input<string>('*/*');

  // Output signals
  keyupEnter = output<void>();
  fileSelected = output<FileList | null>();

  // Internal state
  public showPassword = signal<boolean>(false);
  private errorMessage = signal<string>('');

  // Computed properties
  inputMode = computed(() => {
    switch (this.type()) {
      case 'number': return 'numeric';
      case 'tel':
      case 'mobile': return 'tel';
      case 'email': return 'email';
      case 'url': return 'url';
      default: return 'text';
    }
  });

  constructor() {
    super();
  }

  override ngOnInit(): void {
    super.ngOnInit();
  }

  // Event handlers
  protected handleInput(event: Event): void {
    this.handleValueChange(event);
  }

  protected handleNationalCodeInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    let value = normalizePersianNumber(target.value).replace(/[^0-9]/g, '');

    if (value.length > 10) {
      value = value.slice(0, 10);
    }

    target.value = value;
    this.value.set(value);
    this.onChange(value);
    this.changed.emit(value);
  }

  protected handleMobileInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    let value = normalizePersianNumber(target.value).replace(/[^0-9]/g, '');

    if (value.length > 11) {
      value = value.slice(0, 11);
    }

    target.value = value;
    this.value.set(value);
    this.onChange(value);
    this.changed.emit(value);
  }

  protected handleMobileBlur(event: Event): void {
    const target = event.target as HTMLInputElement;
    const value = target.value;

    if (value && !PersianValidators.mobileNumber({ value } as any)) {
      this.errorMessage.set('شماره موبایل باید ۱۱ رقمی و با 09 شروع شود');
    } else {
      this.errorMessage.set('');
    }

    this.handleBlur();
  }
  protected handleTimeInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    let value = normalizePersianNumber(target.value).replace(/[^0-9]/g, '');

    // محدود کردن به 4 رقم
    if (value.length > 4) value = value.slice(0, 4);

    let formattedTime = '';
    if (value.length >= 3) {
      formattedTime = value.substring(0, 2) + ':' + value.substring(2);
    } else if (value.length === 2) {
      formattedTime = value;
    } else {
      formattedTime = value;
    }

    target.value = formattedTime;
    this.value.set(formattedTime);
    this.onChange(formattedTime);
    this.changed.emit(formattedTime);
  }

  protected handleTimeBlur(event: Event): void {
    const target = event.target as HTMLInputElement;
    let value = target.value.trim();

    if (value) {
      // تلاش برای تکمیل و تصحیح خودکار
      value = this.completeTimeFormat(value);

      if (this.isValidTime(value)) {
        // بروزرسانی مقدار تصحیح شده
        target.value = value;
        this.value.set(value);
        this.onChange(value);
        this.changed.emit(value);
        this.errorMessage.set('');
      } else {
        // نمایش پیغام خطا بدون پاک کردن مقدار
        this.errorMessage.set('لطفاً زمان را در قالب 24 ساعته (HH:mm) وارد کنید');
        this.value.set('');
        this.onChange(value);
        this.changed.emit(value);

      }
    } else {
      this.errorMessage.set('');
    }

    this.handleBlur();
  }

  private completeTimeFormat(value: string): string {
    // حذف کاراکترهای غیرضروری
    let cleanValue = value.replace(/[^0-9:]/g, '');

    // اگر : وجود ندارد
    if (!cleanValue.includes(':')) {
      if (cleanValue.length === 1) {
        // مثال: 9 -> 09:00
        return '0' + cleanValue + ':00';
      } else if (cleanValue.length === 2) {
        // مثال: 14 -> 14:00
        return cleanValue + ':00';
      } else if (cleanValue.length === 3) {
        // مثال: 930 -> 09:30
        return '0' + cleanValue.charAt(0) + ':' + cleanValue.substring(1);
      } else if (cleanValue.length === 4) {
        // مثال: 1430 -> 14:30
        return cleanValue.substring(0, 2) + ':' + cleanValue.substring(2);
      }
    }

    // اگر فقط ساعت وارد شده (مثال: 14:)
    const parts = cleanValue.split(':');
    if (parts.length === 2 && parts[1] === '') {
      return parts[0].padStart(2, '0') + ':00';
    }

    // تکمیل فرمت
    if (parts.length === 2) {
      const hour = parts[0].padStart(2, '0');
      const minute = parts[1].padStart(2, '0');
      return hour + ':' + minute;
    }

    return cleanValue;
  }

  private isValidTime(time: string): boolean {
    const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
    return timePattern.test(time);
  }

  protected handleFileChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const files = target.files;

    this.value.set(files);
    this.onChange(files);
    this.changed.emit(files);
    this.fileSelected.emit(files);
  }

  protected handleKeyUp(type: string): void {
    if (type === 'enter') {
      this.keyupEnter.emit();
    }
  }

  protected togglePasswordVisibility(): void {
    this.showPassword.update(show => !show);
  }

  protected getInputType(): string {
    if (this.type() === 'password') {
      return this.showPassword() ? 'text' : 'password';
    }
    return this.type();
  }
}