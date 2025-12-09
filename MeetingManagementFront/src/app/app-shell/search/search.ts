import { Component, OnInit, signal } from '@angular/core';
import { BreadcrumbService } from '../../services/framework-services/breadcrumb.service';
import { PasswordFlowService } from '../../services/framework-services/password-flow.service';
import { LocalStorageService } from '../../services/framework-services/local.storage.service';
import { ToastService } from '../../services/framework-services/toast.service';
import { ResolutionSearchComponent } from './resolution-search/resolution-search';
import { MeetingSearchComponent } from './meeting-search/meeting-search';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [MeetingSearchComponent, ResolutionSearchComponent],
  templateUrl: './search.html',
  styleUrl: './search.css'
})
export class SearchComponent implements OnInit {
  isPermitted = signal<boolean>(false);
  activeTab = signal<string>('meetings'); // Default tab

  // SessionStorage key for active tab
  private readonly ACTIVE_TAB_KEY = 'searchActiveTab';

  constructor(
    private readonly breadcrumbService: BreadcrumbService,
    private readonly passwordFlowService: PasswordFlowService,
    private readonly localStorageService: LocalStorageService,
    private readonly toastService: ToastService
  ) {
    this.breadcrumbService.setItems([
      { label: 'جستجو', routerLink: '/search' },
    ]);
  }

  async ngOnInit(): Promise<void> {
    const checkPermission = await this.passwordFlowService.checkPermission('MT_Meetings_Search');
    if (!checkPermission) {
      this.toastService.error('شما مجوز مشاهده این صفحه را ندارید');
      return;
    }

    this.isPermitted.set(true);

    // Restore active tab from sessionStorage
    this.restoreActiveTab();
  }

  /**
   * Restore the previously active tab
   */
  private restoreActiveTab(): void {
    try {
      const savedTab = sessionStorage.getItem(this.ACTIVE_TAB_KEY);
      if (savedTab) {
        this.activeTab.set(savedTab);

        // Wait for DOM to be ready before activating tab
        setTimeout(() => {
          this.activateTab(savedTab);
        }, 100);
      }
    } catch (error) {
      console.error('Error restoring active tab:', error);
    }
  }

  /**
   * Activate a specific tab programmatically
   */
  private activateTab(tabId: string): void {
    const tabElement = document.querySelector(`[data-bs-target="#navs-${tabId}"]`) as HTMLElement;
    if (tabElement) {
      const tab = new (window as any).bootstrap.Tab(tabElement);
      tab.show();
    }
  }

  /**
   * Handle tab change and save to sessionStorage
   */
  onTabChange(tabId: string): void {
    this.activeTab.set(tabId);
    sessionStorage.setItem(this.ACTIVE_TAB_KEY, tabId);
  }
}