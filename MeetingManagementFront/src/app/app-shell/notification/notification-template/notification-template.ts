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

import { NotificationTemplateDto } from '../../../core/models/notification-template-dto';
import { ModalFormBaseComponent } from '../../../shared/modal/modal-form-base';
import { ModalConfig } from '../../../shared/modal/modal.config';
import { NotificationTemplateService } from '../../../services/notification-template.service';
import { ModalComponent } from "../../../shared/modal/modal";
import { CustomInputComponent } from "../../../shared/custom-controls/custom-input";
import { IconButtonComponent } from "../../../shared/custom-buttons/icon-button";
import { LabelButtonComponent } from "../../../shared/custom-buttons/label-button";
import { NgFor, NgIf } from '@angular/common';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';

@Component({
  selector: 'app-notification-template',
  templateUrl: './notification-template.html',
  styleUrls: ['./notification-template.css'],
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
export class NotificationTemplateComponent extends ModalFormBaseComponent<NotificationTemplateService, NotificationTemplateDto> implements OnInit {
  // Template types for dropdown
  public templateTypes = signal([
    { value: 'EMAIL', label: 'ایمیل' },
    { value: 'SMS', label: 'پیامک' },
    { value: 'SYSTEM', label: 'سیستمی' },
    { value: 'PUSH', label: 'نوتیفیکیشن' }
  ]);

  // Injected services
  private readonly fb = inject(FormBuilder);
  private readonly notificationTemplateService = inject(NotificationTemplateService);

  constructor() {
    super();
    this.service = this.notificationTemplateService;
    this.setupComponent();
    this.initializeForm();
  }

  private setupComponent(): void {
    // Set modal configuration
    const config = this.modalConfig();
    config.size = "large";
    config.modalTitle = "ایجاد/ویرایش تمپلیت اعلان";
    this.modalConfig.set(config);
  }

  private initializeForm(): void {
    const formGroup = this.fb.group({
      id: [''],
      title: ['', [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(100)
      ]],
      type: ['', [Validators.required]],
      content: ['', [Validators.required]]
    });

    this.form.set(formGroup);
  }

  override ngOnInit(): void {
    super.ngOnInit();
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
