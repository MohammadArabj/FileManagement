import { isPlatformBrowser } from "@angular/common";
import { inject, PLATFORM_ID } from "@angular/core";
import { AbstractControl, ValidationErrors } from "@angular/forms";
import moment from "jalali-moment";

export const ACCESS_TOKEN_NAME = "*&^%*((())$";
export const ROLE_TOKEN_NAME = "group_id";
export const PERMISSIONS_NAME = "%%%%%%%%%%";
export const SETTINGS_NAME = "Settings";
export const USER_ID_NAME = "user_id";
export const POSITION_ID = "position_id";
export const POSITION_NAME = "position_name";
export const DATABASAE_NAME = "dbName";
export const USER_COMPANY_ID_NAME = "comapny_id"
export const USER_ORGANIZATION_CHART_ID_NAME = "org_id"
export const USER_CLASSIFICATION_LEVEL_ID_NAME = "cl_id"
export const USER_SESSION_STORAGE_TOKEN = "user-token"
export const USER_CURRENT_ACTIVE_SESSION_NAME = ')(session_id_'
export const IsDeletage = 'isDeletage';
export const Main_USER_ID = 'main_user_id';
export const ISSP = 'issp';
export function normalizePersian(text: string): string {
  if (!text) return '';
  return text
    .replace(/ي/g, 'ی') // ی عربی → ی فارسی
    .replace(/ك/g, 'ک') // ک عربی → ک فارسی
    .replace(/\u200C/g, ' ') // ZWNJ → space (اختیاری)
    .trim()
    .toLowerCase(); // برای اینکه حساس به حروف بزرگ/کوچک نباشه
}
export function fixPersianDigits(input: string): string {
  return input.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
}
export type ButtonType = 'button' | 'submit' | 'reset';
export type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info' | 'light' | 'dark';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonConfig {
  variant: ButtonVariant;
  size: ButtonSize;
  fullWidth: boolean;
  rounded: boolean;
  outline: boolean;
}
// export function futureOrTodayDateValidator(control: AbstractControl): ValidationErrors | null {
//   if (!control.value) return null;
//   const date = control.value;
//   const fixedDate = fixPersianDigits(date);
//   const georgianDate = moment(fixedDate, 'jYYYY/jMM/jDD').format('YYYY-MM-DD');
//   const inputDate = new Date(georgianDate);
//   const today = new Date();
//   today.setHours(0, 0, 0, 0); // صفر کردن ساعت برای مقایسه دقیق تاریخ

//   return inputDate < today ? { pastDate: true } : null;
// }
export enum MeetingType {
  REGULAR = 'regular',
  BOARD = 'board'
}

export function generateGuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export type InputType =
  | 'time'
  | 'text'
  | 'number'
  | 'password'
  | 'email'
  | 'color'
  | 'date'
  | 'file'
  | 'fileMultiple'
  | 'national-code'
  | 'mobile'
  | 'textarea'
  | 'url'
  | 'search'
  | 'tel'
  | 'range';

export type SelectType = 'select' | 'select-ajax' | 'simple' | 'multiple';
export type StyleType = 'group' | 'simple' | 'floating';
export type SizeType = 'col-1' | 'col-2' | 'col-3' | 'col-4' | 'col-5' | 'col-6' | 'col-7' | 'col-8' | 'col-9' | 'col-10' | 'col-11' | 'col-12';

export interface ValidationError {
  type: string;
  message: string;
  params?: any;
}
export function createUniqueId(prefix: string = 'ctrl'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function isBrowser(): boolean {
  const platformId = inject(PLATFORM_ID);
  return isPlatformBrowser(platformId);
}

export function formatPersianNumber(value: string | number): string {
  const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
  const englishDigits = '0123456789';

  return String(value).replace(/[0-9]/g, (match) => {
    return persianDigits[englishDigits.indexOf(match)];
  });
}

export function normalizePersianNumber(value: string): string {
  const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  const englishDigits = '0123456789';

  return value
    .replace(/[۰-۹]/g, (match) => englishDigits[persianDigits.indexOf(match)])
    .replace(/[٠-٩]/g, (match) => englishDigits[arabicDigits.indexOf(match)]);
}
export interface FormControlConfig {
  identity: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  size?: SizeType;
  styleType?: StyleType;
}

export class PersianValidators {
  static nationalCode(control: AbstractControl): ValidationErrors | null {
    const value = control.value;
    if (!value) return null;

    if (!/^\d{10}$/.test(value)) {
      return { nationalCode: { message: 'کد ملی باید 10 رقم باشد' } };
    }

    const sum = value.split('').slice(0, 9)
      .reduce((acc: number, digit: string, index: number) =>
        acc + parseInt(digit) * (10 - index), 0);

    const remainder = sum % 11;
    const checkDigit = parseInt(value[9]);
    const isValid = remainder < 2 ? remainder === checkDigit : (11 - remainder) === checkDigit;

    return isValid ? null : { nationalCode: { message: 'کد ملی نامعتبر است' } };
  }

  static mobileNumber(control: AbstractControl): ValidationErrors | null {
    const value = control.value;
    if (!value) return null;

    const mobilePattern = /^09[0-9]{9}$/;
    return mobilePattern.test(value)
      ? null
      : { mobile: { message: 'شماره موبایل باید با 09 شروع شده و 11 رقم باشد' } };
  }

  static persianTime(control: AbstractControl): ValidationErrors | null {
    const value = control.value;
    if (!value) return null;

    const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
    return timePattern.test(value)
      ? null
      : { time: { message: 'زمان باید در قالب 24 ساعته (HH:mm) باشد' } };
  }
}