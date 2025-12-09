import {
  Component,
  OnInit,
  OnChanges,
  SimpleChanges,
  signal,
  computed,
  effect,
  inject,
  DestroyRef,
  input,
  output,
  OutputEmitterRef
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { NgIf } from '@angular/common';
import moment from 'jalali-moment';
import { Resolution } from '../../../../../core/models/Resolution';
import { SystemUser } from '../../../../../core/models/User';
import { fixPersianDigits } from '../../../../../core/types/configuration';
import { AssignmentService } from '../../../../../services/assignment.service';
import { ToastService } from '../../../../../services/framework-services/toast.service';
import { ComboBase } from '../../../../../shared/combo-base';
import { CustomInputComponent } from '../../../../../shared/custom-controls/custom-input';
import { CustomSelectComponent } from '../../../../../shared/custom-controls/custom-select';

@Component({
  selector: 'app-assignment-modal',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, CustomInputComponent, CustomSelectComponent],
  templateUrl: './assignment-modal.html',
  styleUrl: './assignment-modal.css',
})
export class AssignmentModalComponent implements OnInit, OnChanges {
  // Injected services
  private readonly fb = inject(FormBuilder);
  private readonly toastService = inject(ToastService);
  private readonly assignmentService = inject(AssignmentService);
  private readonly destroyRef = inject(DestroyRef);

  // Input signals
  readonly resolution = input<Resolution | null>(null);
  readonly assignment = input<any | null>(null);
  readonly users = input<ComboBase[]>([]);
  readonly assignmentTypes = input<{ guid: string; title: string }[]>([]);
  readonly meetingDate = input<string>('');
  readonly userList = input<SystemUser[]>([]);

  // Output signals
  readonly assignmentSaved: OutputEmitterRef<void> = output<void>();
  readonly modalClosed: OutputEmitterRef<void> = output<void>();

  // Private writable signals for internal state
  private readonly _isLoading = signal<boolean>(false);
  private readonly _isEditing = signal<boolean>(false);

  // Public readonly signals
  readonly isLoading = this._isLoading.asReadonly();
  readonly isEditing = this._isEditing.asReadonly();

  // Computed signals
  readonly hasResolution = computed(() => this.resolution() !== null);
  readonly hasAssignment = computed(() => this.assignment() !== null);
  readonly isFormValid = computed(() => this.assignForm?.valid ?? false);
  readonly canSave = computed(() => this.isFormValid() && !this.isLoading());

  // Form-related computed signals
  readonly selectedActor = computed(() => {
    const actorGuid = this.assignForm?.get('actorGuid')?.value;
    const userList = this.userList();
    return userList.find(user => user.guid === actorGuid) || null;
  });

  readonly selectedFollower = computed(() => {
    const followerGuid = this.assignForm?.get('followerGuid')?.value;
    const userList = this.userList();
    return userList.find(user => user.guid === followerGuid) || null;
  });

  readonly currentUserType = computed(() => {
    return this.assignForm?.get('userType')?.value || 'internal';
  });

  // Form
  assignForm!: FormGroup;

  constructor() {
    this.initializeForm();
    this.setupEffects();
  }

  private initializeForm(): void {
    this.assignForm = this.fb.group({
      actorGuid: [null, Validators.required],
      followerGuid: [null, Validators.required],
      type: [null, Validators.required],
      dueDate: [
        '',
        [Validators.required, this.futureOrAfterMeetingDateValidator.bind(this)],
      ],
      resolutionId: ['', Validators.required],
      userType: ['internal'], // Default to internal
      id: [''], // For editing existing assignment
    });
  }

  private setupEffects(): void {
    // Effect to handle resolution changes
    effect(() => {
      const resolution = this.resolution();
      if (resolution) {
        this.assignForm.patchValue({ resolutionId: resolution.id });
        if (!this.hasAssignment()) {
          this.resetFormForNewAssignment();
        }
      }
    });

    // Effect to handle assignment changes (editing mode)
    effect(() => {
      const assignment = this.assignment();
      if (assignment) {
        this._isEditing.set(true);
        this.patchFormForEdit();
      } else {
        this._isEditing.set(false);
        if (this.hasResolution()) {
          this.resetFormForNewAssignment();
        }
      }
    });

    // Effect to log form validity changes
    effect(() => {
      const isValid = this.isFormValid();
      const canSave = this.canSave();
    });

    // Effect to handle user type changes
    effect(() => {
      const userType = this.currentUserType();
      if (userType === 'external') {
        // Clear internal user selections when switching to external
        this.assignForm.get('actorGuid')?.setValue(null);
        this.assignForm.get('followerGuid')?.setValue(null);
      }
    });
  }

  ngOnInit(): void {
    const resolution = this.resolution();
    if (resolution && !this.hasAssignment()) {
      this.resetFormForNewAssignment();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Note: با input signals، effects خودکار handle می‌کنند
    // اما برای سازگاری با کدهای قدیمی نگه داشته شده
  }

  private resetFormForNewAssignment(): void {
    const resolution = this.resolution();
    this.assignForm.reset({
      resolutionId: resolution?.id || '',
      userType: 'internal',
      id: '',
    });
    this._isEditing.set(false);
  }

  private patchFormForEdit(): void {
    const assignment = this.assignment();
    if (!assignment) return;

    this.assignForm.patchValue({
      actorGuid: assignment.actorGuid,
      followerGuid: assignment.followerGuid,
      type: assignment.typeName, // Assuming typeName is the guid
      dueDate: assignment.dueDate,
      userType: assignment.actorGuid ? 'internal' : 'external', // Determine userType
      id: assignment.id,
      resolutionId: assignment.resolutionId,
    });
  }

  private futureOrAfterMeetingDateValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) return null;

    const date = control.value;
    const fixedDate = fixPersianDigits(date);
    const georgianDate = moment(fixedDate, 'jYYYY/jMM/jDD').format('YYYY-MM-DD');
    const inputDate = new Date(georgianDate);

    const meetingDate = this.meetingDate();
    if (!meetingDate) return null;

    const meetingFixedDate = fixPersianDigits(meetingDate);
    const meetingGeorgianDate = moment(meetingFixedDate, 'jYYYY/jMM/jDD').format('YYYY-MM-DD');
    const meetingDateObj = new Date(meetingGeorgianDate);

    return inputDate < meetingDateObj ? { beforeMeetingDate: true } : null;
  }

  // Validation helper methods
  readonly isFieldInvalid = (fieldName: string) => {
    const field = this.assignForm.get(fieldName);
    return field ? field.invalid && (field.dirty || field.touched) : false;
  };

  readonly getFieldError = (fieldName: string): string => {
    const field = this.assignForm.get(fieldName);
    if (!field || !field.errors) return '';

    if (field.errors['required']) {
      return 'این فیلد الزامی است';
    }
    if (field.errors['beforeMeetingDate']) {
      return 'تاریخ سررسید نمی‌تواند قبل از تاریخ جلسه باشد';
    }

    return 'مقدار وارد شده نامعتبر است';
  };

  // User type management
  onUserTypeChange(userType: string): void {
    this.assignForm.patchValue({ userType });

    // Clear user selections when changing type
    this.assignForm.patchValue({
      actorGuid: null,
      followerGuid: null
    });
  }

  // Actor/Follower selection helpers
  readonly getAvailableActors = computed(() => {
    const userType = this.currentUserType();
    const users = this.users();

    if (userType === 'internal') {
      return users;
    }

    // For external, you might want to return a different list or empty
    return [];
  });

  readonly getAvailableFollowers = computed(() => {
    const userType = this.currentUserType();
    const users = this.users();

    if (userType === 'internal') {
      return users;
    }

    // For external, you might want to return a different list or empty
    return [];
  });

  // Save assignment
  saveAssignment(): void {
    if (this.assignForm.invalid) {
      this.assignForm.markAllAsTouched();
      this.toastService.error('لطفاً تمام فیلدهای الزامی را پر کنید.');
      return;
    }

    this._isLoading.set(true);

    const formValue = this.assignForm.value;
    const userList = this.userList();

    const actor = userList.find((user) => user.guid === formValue.actorGuid);
    const follower = userList.find((user) => user.guid === formValue.followerGuid);

    const data = {
      ...formValue,
      actorPositionGuid: actor?.positionGuid || null,
      followerPositionGuid: follower?.positionGuid || null,
    };

    this.assignmentService.saveAssignment(data)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: any) => {
          this.toastService.success('تخصیص با موفقیت ذخیره شد.');
          this.resetForm();
          this.assignmentSaved.emit();
        },
        error: (error: any) => {
          console.error('Error saving assignment:', error);
          this.toastService.error('خطا در ثبت تخصیص.');
        },
        complete: () => {
          this._isLoading.set(false);
        }
      });
  }

  cancelForm(): void {
    this.resetForm();
    this.modalClosed.emit();
  }

  private resetForm(): void {
    const resolution = this.resolution();
    this.assignForm.reset({
      resolutionId: resolution?.id || '',
      userType: 'internal',
      id: '',
    });
    this._isEditing.set(false);
    this._isLoading.set(false);
  }

  // Helper methods for template
  getUserTitle(guid: string): string {
    const users = this.users();
    const user = users.find(u => u.guid === guid);
    return user ? user.title || '' : '';
  }

  getAssignmentTypeTitle(guid: string): string {
    const types = this.assignmentTypes();
    const type = types.find(t => t.guid === guid);
    return type ? type.title || '' : '';
  }

  // Form state helpers
  readonly hasUnsavedChanges = computed(() => {
    return this.assignForm?.dirty ?? false;
  });

  readonly formData = computed(() => {
    return this.assignForm?.value ?? {};
  });

  // Validation state computed signals
  readonly actorGuidInvalid = computed(() => this.isFieldInvalid('actorGuid'));
  readonly followerGuidInvalid = computed(() => this.isFieldInvalid('followerGuid'));
  readonly typeInvalid = computed(() => this.isFieldInvalid('type'));
  readonly dueDateInvalid = computed(() => this.isFieldInvalid('dueDate'));

  readonly actorGuidError = computed(() => this.getFieldError('actorGuid'));
  readonly followerGuidError = computed(() => this.getFieldError('followerGuid'));
  readonly typeError = computed(() => this.getFieldError('type'));
  readonly dueDateError = computed(() => this.getFieldError('dueDate'));
}
