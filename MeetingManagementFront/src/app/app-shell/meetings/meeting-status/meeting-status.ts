import {
  Component,
  OnInit,
  inject,
  signal,
  ChangeDetectionStrategy
} from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
  FormGroup
} from '@angular/forms';

import { MeetingStatus } from '../../../core/models/MeetingStatus';
import { ModalFormBaseComponent } from '../../../shared/modal/modal-form-base';
import { ModalConfig } from '../../../shared/modal/modal.config';
import { MeetingStatusService } from '../../../services/meeting-status.service';
import { ModalComponent } from "../../../shared/modal/modal";
import { CustomInputComponent } from "../../../shared/custom-controls/custom-input";
import { IconButtonComponent } from "../../../shared/custom-buttons/icon-button";
import { LabelButtonComponent } from "../../../shared/custom-buttons/label-button";
import { NgFor, NgIf } from '@angular/common';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';

@Component({
  selector: 'app-meeting-status',
  templateUrl: './meeting-status.html',
  styleUrls: ['./meeting-status.css'],
  standalone: true,
  imports: [
    ModalComponent,
    CustomInputComponent,
    IconButtonComponent,
    ReactiveFormsModule,
    LabelButtonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MeetingStatusComponent extends ModalFormBaseComponent<MeetingStatusService, MeetingStatus> implements OnInit {
  // Injected services
  private readonly fb = inject(FormBuilder);
  private readonly meetingStatusService = inject(MeetingStatusService);

  constructor() {
    super();
    this.service = this.meetingStatusService;
    this.setupComponent();
    this.initializeForm();
  }

  private setupComponent(): void {
    // Set modal configuration
    const config = this.modalConfig();
    config.size = "large";
    config.modalTitle = "ایجاد/ویرایش وضعیت جلسه";
    this.modalConfig.set(config);
  }

  private initializeForm(): void {
    const formGroup = this.fb.group({
      guid: [''],
      title: ['', [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(100)
      ]],
      description: ['']
    });

    this.form.set(formGroup);
  }

  override ngOnInit(): void {
    super.ngOnInit();
    // Additional initialization if needed
  }

  // Helper methods for form validation
  public isFieldInvalid(fieldName: string): boolean {
    const currentForm = this.form();
    if (!currentForm) return false;

    const field = currentForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  public getFieldError(fieldName: string): string {
    const currentForm = this.form();
    if (!currentForm) return '';

    const field = currentForm.get(fieldName);
    if (!field || !field.errors) return '';

    if (field.errors['required']) return `${fieldName} الزامی است`;
    if (field.errors['minlength']) return `حداقل ${field.errors['minlength'].requiredLength} کاراکتر وارد کنید`;
    if (field.errors['maxlength']) return `حداکثر ${field.errors['maxlength'].requiredLength} کاراکتر مجاز است`;

    return 'خطا در اعتبارسنجی';
  }
}
