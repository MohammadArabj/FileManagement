import { Component, Input, Output, EventEmitter, OnInit, signal, computed, inject, input, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActionService } from '../../../services/action.service';
import { ToastService } from '../../../services/framework-services/toast.service';
import { SwalService } from '../../../services/framework-services/swal.service';
import { USER_ID_NAME } from '../../../core/types/configuration';
import { firstValueFrom } from 'rxjs';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';
import { LocalStorageService } from '../../../services/framework-services/local.storage.service';

interface ActionItem {
  id: number;
  description: string;
  status: string;
  statusStr?: string;
  followStatus?: string;
  followStatusStr?: string;
  userName: string;
  date: string;
  type: 'Action' | 'Follow';
  userGuid: string;
}

interface ResolutionData {
  meetingNumber: string;
  meetingDate: string;
  meetingTitle: string;
  resolutionNumber: string;
  resolutionTitle: string;
  resolutionDescription: string;
  dueDate: string;
}

@Component({
  selector: 'app-resolution-actions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './resolution-actions.html',
  styleUrls: ['./resolution-actions.css']
})
export class ResolutionActionsComponent implements OnInit {
  // Injected services
  private readonly actionService = inject(ActionService);
  private readonly toastService = inject(ToastService);
  private readonly swalService = inject(SwalService);
  private readonly localStorageService = inject(LocalStorageService);

  // Input signals
  readonly assignmentId = input<number>(0);
  readonly resolutionData = input<ResolutionData>({
    meetingNumber: '',
    meetingDate: '',
    meetingTitle: '',
    resolutionNumber: '',
    resolutionTitle: '',
    dueDate: '',
    resolutionDescription:''
  });
  readonly userType = input<'action' | 'follow'>('action');

  // Output events
  @Output() onClose = new EventEmitter<void>();
  @Output() onSaved = new EventEmitter<void>();

  // State signals
  public readonly actions = signal<ActionItem[]>([]);
  public readonly followups = signal<ActionItem[]>([]);
  public readonly isLoading = signal<boolean>(false);
  public readonly isSaving = signal<boolean>(false);

  // Form state
  public readonly editMode = signal<boolean>(false);
  public readonly editingActionId = signal<number | null>(null);
  public readonly modalType = signal<'action' | 'follow'>('action');

  // Form fields - اینجا مشکل بود، باید writable signals باشند
  public description = signal<string>('');
  public selectedStatus = signal<string>('');
  public actionDate = signal<string>('');

  // Computed values
  public readonly actionsCount = computed(() => this.actions().length);
  public readonly followupsCount = computed(() => this.followups().length);
  public readonly modalTitle = computed(() =>
    this.editMode()
      ? (this.modalType() === 'action' ? 'ویرایش اقدام' : 'ویرایش پیگیری')
      : (this.modalType() === 'action' ? 'ثبت اقدام جدید' : 'ثبت پیگیری جدید')
  );

  // برای چک کردن که آیا توضیحات اجباری است یا نه
  public readonly isDescriptionRequired = computed(() => {
    return this.selectedStatus() !== 'Done';
  });

  // Status options
  public readonly actionStatusOptions = [
    { value: 'Done', label: 'انجام شده', class: 'success' },
    { value: 'InProgress', label: 'در حال انجام', class: 'warning' },
    { value: 'NotDone', label: 'انجام نشده', class: 'danger' }
  ];

  public readonly followStatusOptions = [
    { value: 'FollowingUp', label: 'در حال پیگیری', class: 'info' },
    { value: 'NotFollowedUp', label: 'پیگیری نشده', class: 'warning' }
  ];

  constructor() {
    // Auto-load actions when assignmentId changes
    effect(() => {
      if (this.assignmentId() > 0) {
        this.loadActions();
      }
    });
  }

  ngOnInit(): void {
    if (this.assignmentId() > 0) {
      this.loadActions();
    }
  }

  /**
   * Load actions and followups from server
   */
  private async loadActions(): Promise<void> {
    if (!this.assignmentId()) return;

    this.isLoading.set(true);

    try {
      const response = await firstValueFrom(
        this.actionService.getListBy(this.assignmentId())
      );

      if (Array.isArray(response)) {
        this.actions.set(response.filter(item => item.type === 'Action'));
        this.followups.set(response.filter(item => item.type === 'Follow'));
      }
    } catch (error) {
      console.error('Error loading actions:', error);
      this.toastService.error('خطا در بارگذاری اقدامات');
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Open modal for creating new action/followup
   */
  public openActionModal(type: 'action' | 'follow'): void {
    this.modalType.set(type);
    this.resetForm();

    // Use Bootstrap modal
    const modal = document.getElementById('actionModal');
    if (modal) {
      const bootstrapModal = new (window as any).bootstrap.Modal(modal);
      bootstrapModal.show();
    }
  }

  /**
   * Edit existing action - اینجا اصلی‌ترین مشکل بود
   */
  public editAction(actionId: number, type: 'action' | 'follow'): void {
    const item = type === 'action'
      ? this.actions().find(a => a.id === actionId)
      : this.followups().find(f => f.id === actionId);

    if (!item) {
      this.toastService.error('آیتم مورد نظر یافت نشد');
      return;
    }

    this.editMode.set(true);
    this.editingActionId.set(actionId);
    this.modalType.set(type);

    // Fill form with existing data - اینجا signals رو درست set کنیم
    this.description.set(item.description || '');
    this.selectedStatus.set(
      type === 'action' ? (item.statusStr || '') : (item.followStatusStr || '')
    );
    this.actionDate.set(item.date || '');

    // Open modal
    const modal = document.getElementById('actionModal');
    if (modal) {
      const bootstrapModal = new (window as any).bootstrap.Modal(modal);
      bootstrapModal.show();
    }
  }

  /**
   * Save action or followup
   */
  public async saveAction(): Promise<void> {
    if (!this.validateForm()) {
      return;
    }

    this.isSaving.set(true);

    try {
      const userGuid = this.localStorageService.getItem(USER_ID_NAME);

      if (!userGuid) {
        throw new Error('اطلاعات کاربر یافت نشد');
      }

      const data = {
        id: this.editMode() ? this.editingActionId() : null,
        assignmentId: this.assignmentId(),
        description: this.description().trim(),
        status: this.modalType() === 'action' ? this.selectedStatus() : null,
        followStatus: this.modalType() === 'follow' ? this.selectedStatus() : null,
        actionDate: this.actionDate(),
        userGuid,
        type: this.modalType() === 'action' ? 'Action' : 'Follow',
      };

      await firstValueFrom(this.actionService.createOrEditAction(data));

      await this.loadActions();
      this.closeModal();
      this.onSaved.emit();

      this.toastService.success(
        this.editMode() ? 'تغییرات با موفقیت ذخیره شد' : 'مورد جدید با موفقیت اضافه شد'
      );

    } catch (error) {
      console.error('Error saving action:', error);
      this.toastService.error('خطا در ثبت اطلاعات');
    } finally {
      this.isSaving.set(false);
    }
  }

  /**
   * Delete action with confirmation
   */
  public async deleteAction(actionId: number): Promise<void> {
    const result = await this.swalService.fireSwal('آیا از حذف این مورد اطمینان دارید؟', 'حذف مورد');

    if (result.isConfirmed) {
      try {
        await firstValueFrom(this.actionService.delete(actionId));
        await this.loadActions();
        this.onSaved.emit();
        this.toastService.success('مورد با موفقیت حذف شد');
      } catch (error) {
        console.error('Error deleting action:', error);
        this.toastService.error('خطا در حذف مورد');
      }
    }
  }

  /**
   * Check if user can edit the action
   */
  public canEditAction(action: ActionItem): boolean {
    // Business logic: can only edit if not finished
    return action.statusStr !== 'End' && action.followStatusStr !== 'FollowUpEnd';
  }

  /**
   * Get status badge class
   */
  public getStatusClass(item: ActionItem, type: 'action' | 'follow'): string {
    const status = type === 'action' ? item.status : item.followStatus;

    switch (status) {
      case 'Done':
      case 'FollowingUp':
        return 'bg-success';
      case 'InProgress':
      case 'NotFollowedUp':
        return 'bg-warning';
      case 'NotDone':
        return 'bg-danger';
      default:
        return 'bg-secondary';
    }
  }

  /**
   * Get status label
   */
  public getStatusLabel(item: ActionItem, type: 'action' | 'follow'): string {
    const status = type === 'action' ? item.status : item.followStatus;
    const options = type === 'action' ? this.actionStatusOptions : this.followStatusOptions;

    return options.find(opt => opt.value === status)?.label ?? status ?? '';
  }

  /**
   * Close modal and reset form
   */
  public closeModal(): void {
    const modal = document.getElementById('actionModal');
    if (modal) {
      const bootstrapModal = (window as any).bootstrap.Modal.getInstance(modal);
      if (bootstrapModal) {
        bootstrapModal.hide();
      }
    }
    this.resetForm();
  }

  /**
   * Reset form to initial state
   */
  private resetForm(): void {
    this.editMode.set(false);
    this.editingActionId.set(null);
    this.description.set('');
    this.selectedStatus.set('');
    this.actionDate.set('');
  }

  /**
   * Validate form fields - اینجا validation رو اصلاح کردیم
   */
  private validateForm(): boolean {
    // چک کردن توضیحات فقط اگر اجباری باشه
    if (this.isDescriptionRequired() && !this.description().trim()) {
      this.toastService.error('لطفاً توضیحات را وارد کنید');
      return false;
    }

    if (!this.selectedStatus()) {
      this.toastService.error('لطفاً وضعیت را انتخاب کنید');
      return false;
    }

    if (!this.actionDate()) {
      this.toastService.error('لطفاً تاریخ را انتخاب کنید');
      return false;
    }

    return true;
  }

  /**
   * Handle back button click
   */
  public onBackClick(): void {
    this.onClose.emit();
  }
}