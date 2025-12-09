import { Component, input, output, signal, computed, effect, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MeetingMember } from '../../../../../core/models/Meeting';
import { ToastService } from '../../../../../services/framework-services/toast.service';

interface DescriptionValidation {
  isValid: boolean;
  errorMessage?: string;
}

@Component({
  selector: 'app-meeting-description',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './meeting-description.html',
  styleUrl: './meeting-description.css',
})
export class MeetingDescriptionComponent implements OnInit {
  private toastService = inject(ToastService);
  hasChairmanSigned = input<boolean>(false);

  // Input signals
  description = input<string>('');
  canEditDescription = input<boolean>(false);
  roleId = input<any>();
  statusId = input<any>();
  isDelegate = input<boolean>(false);
  currentMember = input<MeetingMember | null>();
  permissions = input<Set<string>>(new Set<string>());

  // Output signals
  descriptionSaved = output<string>();

  // Internal state signals
  private _editableDescription = signal<string>('');
  private _isEditingDescription = signal<boolean>(false);

  // Readonly accessors
  readonly editableDescription = this._editableDescription.asReadonly();
  readonly isEditingDescription = this._isEditingDescription.asReadonly();

  // Computed signals for business logic
  readonly canShowDescription = computed(() => {
    return !this._isEditingDescription() && this.description() !== '';
  });

  readonly canShowDescriptionTextArea = computed(() => {
    const permissions = this.permissions();
    const roleId = this.roleId();
    const statusId = this.statusId();
    const currentMember = this.currentMember();
    const isEditing = this._isEditingDescription();
    const hasDescription = this.description() !== '';
    const hasChairmanSigned = this.hasChairmanSigned();

    // اگر رئیس جلسه است و هنوز امضا نکرده
    const isUnsignedChairman = (roleId === 3 && !hasChairmanSigned);

    const hasEditPermission = permissions.has('MT_Descriptions_Edit');
    const isAuthorizedRole = [1, 2, 3].includes(roleId) &&
      !currentMember?.isDelegate;
    const isStatusAllowed = ![4, 6].includes(statusId) ||
      permissions.has('MT_Descriptions_Edit');

    const canEdit = isUnsignedChairman || hasEditPermission || (isAuthorizedRole && isStatusAllowed);

    return canEdit && (isEditing || hasDescription === false);
  });

  readonly descriptionValidation = computed((): DescriptionValidation => {
    const description = this._editableDescription();

    if (description.length === 0) {
      return {
        isValid: false,
        errorMessage: 'شرح جلسه نمی تواند خالی باشد.'
      };
    }

    if (description.length > 2000) {
      return {
        isValid: false,
        errorMessage: 'حداکثر تعداد مجاز ۲۰۰۰ کاراکتر است.'
      };
    }

    return { isValid: true };
  });

  readonly characterCount = computed(() => this._editableDescription().length);
  readonly remainingCharacters = computed(() => 2000 - this.characterCount());
  readonly isNearLimit = computed(() => this.remainingCharacters() < 100);
  readonly isOverLimit = computed(() => this.remainingCharacters() < 0);

  readonly canSaveDescription = computed(() => {
    return this.descriptionValidation().isValid &&
      this._editableDescription() !== this.description();
  });

  readonly hasChanges = computed(() => {
    return this._editableDescription() !== this.description();
  });

  constructor() {
    // Effect to sync editableDescription with description input
    effect(() => {
      const description = this.description();
      if (!this._isEditingDescription()) {
        this._editableDescription.set(description);
      }
    });

    // Effect for logging changes (optional)
    effect(() => {
      const isEditing = this._isEditingDescription();
      const hasChanges = this.hasChanges();

      if (isEditing && hasChanges) {
      }
    });
  }

  ngOnInit(): void {
    this._editableDescription.set(this.description());
  }

  editMeetingDescription(): void {
    this._editableDescription.set(this.description());
    this._isEditingDescription.set(true);
  }

  cancelEditMeetingDescription(): void {
    this._isEditingDescription.set(false);
    this._editableDescription.set(this.description());
  }

  saveMeetingDescription(): void {
    const validation = this.descriptionValidation();

    if (!validation.isValid) {
      this.toastService.error(validation.errorMessage!);
      return;
    }

    if (!this.hasChanges()) {
      this.toastService.warning('تغییری در شرح جلسه ایجاد نشده است.');
      this._isEditingDescription.set(false);
      return;
    }

    this.descriptionSaved.emit(this._editableDescription());
    this._isEditingDescription.set(false);
  }

  onDescriptionChange(newDescription: string): void {
    this._editableDescription.set(newDescription);
  }

  checkDescriptionLength(): void {
    const validation = this.descriptionValidation();

    if (this.isNearLimit() && validation.isValid) {
      this.toastService.warning(
        `تعداد کاراکترهای باقی‌مانده: ${this.remainingCharacters()}`
      );
    } else if (!validation.isValid && validation.errorMessage) {
      this.toastService.error(validation.errorMessage);
    }
  }

  // Helper methods for better UX
  getCharacterCountClass(): string {
    if (this.isOverLimit()) return 'text-danger';
    if (this.isNearLimit()) return 'text-warning';
    return 'text-muted';
  }

  getProgressBarClass(): string {
    const percentage = (this.characterCount() / 2000) * 100;
    if (percentage > 90) return 'bg-danger';
    if (percentage > 75) return 'bg-warning';
    return 'bg-success';
  }

  getProgressBarWidth(): string {
    const percentage = Math.min((this.characterCount() / 2000) * 100, 100);
    return `${percentage}%`;
  }

  // Validation helper methods
  hasPermission(permission: string): boolean {
    return this.permissions().has(permission);
  }

  isInRole(roles: number[]): boolean {
    return roles.includes(this.roleId());
  }

  isInStatus(statuses: number[]): boolean {
    return statuses.includes(this.statusId());
  }

  // Auto-save functionality (optional)
  readonly autoSaveEnabled = signal<boolean>(false);

  enableAutoSave(): void {
    this.autoSaveEnabled.set(true);

    // Auto-save effect
    effect(() => {
      if (!this.autoSaveEnabled()) return;

      const description = this._editableDescription();
      const isEditing = this._isEditingDescription();
      const hasChanges = this.hasChanges();
      const isValid = this.descriptionValidation().isValid;

      if (isEditing && hasChanges && isValid) {
        // Debounce auto-save here if needed
        setTimeout(() => {
          if (this.hasChanges() && this._isEditingDescription()) {
            // You could emit a different event for auto-save
          }
        }, 2000);
      }
    });
  }

  disableAutoSave(): void {
    this.autoSaveEnabled.set(false);
  }
}