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

import { Label } from '../../../core/models/Label';
import { ModalFormBaseComponent } from '../../../shared/modal/modal-form-base';
import { ModalConfig } from '../../../shared/modal/modal.config';
import { LabelService } from '../../../services/label.service';
import { ModalComponent } from "../../../shared/modal/modal";
import { CustomInputComponent } from "../../../shared/custom-controls/custom-input";
import { IconButtonComponent } from "../../../shared/custom-buttons/icon-button";
import { LabelButtonComponent } from "../../../shared/custom-buttons/label-button";
import { NgFor, NgIf, NgStyle } from '@angular/common';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';

@Component({
  selector: 'app-label',
  templateUrl: './label.html',
  styleUrls: ['./label.css'],
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
export class LabelComponent extends ModalFormBaseComponent<LabelService, Label> implements OnInit {
  // Injected services
  private readonly fb = inject(FormBuilder);
  private readonly labelService = inject(LabelService);

  constructor() {
    super();
    this.service = this.labelService;
    this.setupComponent();
    this.initializeForm();
  }

  private setupComponent(): void {
    // Set modal configuration
    const config = this.modalConfig();
    config.size = "medium";
    config.modalTitle = "ایجاد/ویرایش برچسب مصوبه";
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
      color: ['#ffffff', [Validators.required]],
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
