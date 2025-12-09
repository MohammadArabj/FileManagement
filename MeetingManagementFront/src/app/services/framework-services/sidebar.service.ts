// sidebar.service.ts
import { Injectable, signal } from '@angular/core';
import { LocalStorageService } from './local.storage.service';

@Injectable({ providedIn: 'root' })
export class SidebarService {
  private readonly STORAGE_KEY = 'templateCustomizer-vertical-menu-template--LayoutCollapsed';
  readonly collapsed = signal<boolean>(false);

  constructor(private readonly localStorage: LocalStorageService) {
    this.collapsed.set(this.localStorage.getItem(this.STORAGE_KEY) === 'true');
  }

  toggleSidebar(): void {
    this.setCollapsed(!this.collapsed());
  }

  setCollapsed(value: boolean): void {
    this.collapsed.set(value);
    this.localStorage.setItem(this.STORAGE_KEY, value.toString());
  }
}
