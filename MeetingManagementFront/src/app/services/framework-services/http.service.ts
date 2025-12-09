import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ToastService } from './toast.service';  // سرویس Toast را وارد کنید
import { Result } from '../../core/types/result';
export class RequestConfig {
  noValidate?: boolean;
  loading?: boolean;
  formId?: string;
  submitted?: boolean;  // اضافه کردن این متغیر برای تشخیص ارسال فرم

  constructor({ noValidate = false, loading = true, formId = 'submitForm', submitted = false }) {
    this.noValidate = noValidate;
    this.loading = loading;
    this.formId = formId;
    this.submitted = submitted;
  }
}

@Injectable({
  providedIn: 'root'
})
export class HttpService {
  constructor(
    private readonly http: HttpClient,
    private readonly toastService: ToastService  // اضافه کردن سرویس Toast
  ) { }
  private setHeaders(config: RequestConfig): HttpHeaders {
    let headers = new HttpHeaders({
      'Content-Type': 'application/json; charset=utf-8',
      'Accept': 'application/json',
      'loading': (config.loading ?? true).toString(),
      'noValidate': (config.noValidate ?? false).toString(),
      'formId': config.formId ?? ''
    });
  
    if (config.submitted) {
      headers = headers.set('X-Form-Submitted', 'true');  // اضافه کردن هدر در صورت ارسال فرم
    }
  
    return headers;
  }

  private setHeadersForFile(config: RequestConfig): HttpHeaders {
    let headers= new HttpHeaders({
      'loading': (config.loading ?? true).toString(),
      'noValidate': (config.noValidate ?? false).toString(),
      'formId': config.formId ?? ''
    });
    if (config.submitted) {
      headers = headers.set('X-Form-Submitted', 'true');  // اضافه کردن هدر در صورت ارسال فرم
    }
    return headers;
  }
  private handleResponse<T>(response: any, showToast: boolean): T {
    if (response && typeof response === 'object' && 'isSuccess' in response) {
      if (response.isSuccess) {
        if (showToast && response.message) this.toastService.success(response.message);
        return response.data as T;
      } else {
        if (showToast && response.message) this.toastService.error(response.message);
      }
    }
    return response as T;
  }
 

  // مدیریت خطاها و نمایش پیام خطا به صورت Toast
  private handleError(error: HttpErrorResponse, showToast: boolean) {
    console.error('HTTP Error:', error);
    //if (showToast) this.toastService.error(error.error?.message || 'مشکلی رخ داده است. لطفا دوباره تلاش کنید.');
    return throwError(() => new Error(error.error?.message || 'مشکلی رخ داده است.'));
  }

  // متد getAll با پشتیبانی از پیام‌های Toast
  getAll<T>(path: string, config = new RequestConfig({ noValidate: true }), showToast: boolean = false): Observable<T> {
    return this.http.get<Result<T>>(path, { headers: this.setHeaders(config) }).pipe(
      map(response => this.handleResponse<T>(response, showToast)),
      catchError(error => this.handleError(error, showToast))
    );
  }

  // متد get برای دریافت داده‌ها از API
  get<T>(path: string, id: any = '', config = new RequestConfig({ noValidate: true }), showToast: boolean = false): Observable<T> {
    return this.http.get<Result<T>>(`${path}/${id}`, { headers: this.setHeaders(config) }).pipe(
      map(response => this.handleResponse<T>(response, showToast)),
      catchError(error => this.handleError(error, showToast))
    );
  }

  // متد getBlob برای دریافت داده‌های blob
  getBlob<T>(path: string, id: any = '', config = new RequestConfig({ noValidate: true }), showToast: boolean = false) {
    return this.http.get<Result<T>>(`${path}/${id}`, { headers: this.setHeaders(config), responseType: 'blob' as 'json' }).pipe(
      map(response => this.handleResponse<T>(response, showToast)),
      catchError(error => this.handleError(error, showToast))
    );
  }

  // متد getWithParams با پارامترهای اضافه
  getWithParams<T>(path: string, params = {}, config = new RequestConfig({ noValidate: true }), showToast: boolean = false) {
    return this.http.get<Result<T>>(`${path}`, { headers: this.setHeaders(config), params: params }).pipe(
      map(response => this.handleResponse<T>(response, showToast)),
      catchError(error => this.handleError(error, showToast))
    );
  }

 
  post<T>(path: string, body: any = {}, config = new RequestConfig({ submitted: true }), showToast: boolean = true): Observable<T> {
    return this.http.post<Result<T>>(path, body, { headers: this.setHeaders(config) }).pipe(
      map(response => this.handleResponse<T>(response, showToast)),
      catchError(error => this.handleError(error, showToast))
    );
  }
  
  put<T>(path: string, body: any = {}, config = new RequestConfig({ submitted: true }), showToast: boolean = true): Observable<T> {
    return this.http.put<Result<T>>(path, body, { headers: this.setHeaders(config) }).pipe(
      map(response => this.handleResponse<T>(response, showToast)),
      catchError(error => this.handleError(error, showToast))
    );
  }
  // متد postFormData برای ارسال FormData
  postFormData<T>(path: string, formData: FormData, config = new RequestConfig({submitted:true}), showToast: boolean = true) {
    return this.http.post<Result<T>>(path, formData, { headers: this.setHeadersForFile(config) }).pipe(
      map(response => this.handleResponse<T>(response, showToast)),
      catchError(error => this.handleError(error, showToast))
    );
  }

  // متد putFormData برای آپدیت داده‌ها با FormData
  putFormData<T>(path: string, formData: any, config = new RequestConfig({submitted:true}), showToast: boolean = true) {
    return this.http.put<Result<T>>(path, formData, { headers: this.setHeadersForFile(config) }).pipe(
      map(response => this.handleResponse<T>(response, showToast)),
      catchError(error => this.handleError(error, showToast))
    );
  }

  // متد delete برای حذف داده‌ها
  delete<T>(path: string, config = new RequestConfig({ noValidate: false }), showToast: boolean = true): Observable<T> {
    return this.http.delete<Result<T>>(path, { headers: this.setHeaders(config) }).pipe(
      map(response => this.handleResponse<T>(response, showToast)),
      catchError(error => this.handleError(error, showToast))
    );
  }

  // متد identityGet برای دریافت داده‌ها از یک URL خاص
  identityGet(ajax_url: string, path: string, showToast: boolean = true) {
    return this.http.get<string>(`${ajax_url}${path}`, { headers: this.setHeaders({ loading: true, noValidate: true }) }).pipe(
      catchError(error => this.handleError(error, showToast))
    );
  }
}
