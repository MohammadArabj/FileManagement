import { inject, Injectable } from '@angular/core';
import { LocalStorageService } from './local.storage.service';
import { ToastService } from './toast.service';

@Injectable({
  providedIn: 'root'
})
export class AgGridStateService {
  localStorageService=inject(LocalStorageService)
  toastService=inject(ToastService)
  constructor() { }

  private makeStorageName(name: string): string {
    return `${name}_colState`;
  }

  saveState(gridColumnApi: any, name: string): void {
    const colState = JSON.stringify(gridColumnApi.getColumnState());
    const storageName = this.makeStorageName(name);
    this.localStorageService.setItem(storageName, colState);
    this.toastService.success("حالت جدول با موفقیت ذخیره شد.");
  }

  restoreState(gridColumnApi: any, name: string): boolean {
    const storageName = this.makeStorageName(name);
    const colState = JSON.parse(this.localStorageService.getItem(storageName));
    if (!colState) {
      return false;
    }

    gridColumnApi.applyColumnState({
      state: colState,
      applyOrder: true,
    });

    return true;
  }

  resetState(gridColumnApi: any, name: string): void {
    gridColumnApi.resetColumnState();
    const storageName = this.makeStorageName(name);
    if (this.localStorageService.exists(storageName)) {
      this.localStorageService.removeItem(storageName);
    }

    this.toastService.success("برگشت جدول به حالت پیش فرض با موفقیت انجام شد.");
  }
}