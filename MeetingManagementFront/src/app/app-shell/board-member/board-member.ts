import {
  Component,
  OnInit,
  inject,
  signal,
  ChangeDetectionStrategy,
  ViewChild
} from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
  FormGroup
} from '@angular/forms';
import { AsyncPipe } from '@angular/common';
import { BoardMember } from '../../core/models/BoardMember';
import { FileService } from '../../services/file.service';
import { BoardMemberService } from '../../services/board-member.service';
import { IconButtonComponent } from '../../shared/custom-buttons/icon-button';
import { LabelButtonComponent } from '../../shared/custom-buttons/label-button';
import { CustomInputComponent } from '../../shared/custom-controls/custom-input';
import { ModalFormBaseComponent } from '../../shared/modal/modal-form-base';
import { ModalComponent } from '../../shared/modal/modal';
import { ModalConfig } from '../../shared/modal/modal.config';
import { ImageLoaderPipe } from '../../core/pipes/image-loader.pipe';
import { HasPermissionDirective } from '../../core/directives/has-permission.directive';

@Component({
  selector: 'app-board-member',
  templateUrl: './board-member.html',
  styleUrls: ['./board-member.css'],
  standalone: true,
  imports: [
    LabelButtonComponent,
    IconButtonComponent,
    ModalComponent,
    CustomInputComponent,
    ReactiveFormsModule,
    ImageLoaderPipe,
    AsyncPipe
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BoardMemberComponent extends ModalFormBaseComponent<BoardMemberService, BoardMember> implements OnInit {
  @ViewChild('opsModal') opsModal!: ModalComponent;

  // Signals for state management
  previewUrl = signal<string | null>(null);
  helpModalConfig = signal<ModalConfig>(new ModalConfig());

  // Injected services
  private readonly fb = inject(FormBuilder);
  private readonly boardMemberService = inject(BoardMemberService);
  private readonly fileService = inject(FileService);

  constructor() {
    super();
    this.service = this.boardMemberService;
    this.setupComponent();
    this.initializeForm();
  }

  private setupComponent(): void {
    // Set modal configuration
    const config = this.modalConfig();
    config.size = "large";
    config.modalTitle = "ایجاد/ویرایش عضو هیئت مدیره";
    this.modalConfig.set(config);

    // Set help modal configuration
    const helpConfig = new ModalConfig();
    helpConfig.id = "helpModal";
    helpConfig.hideFooter = true;
    helpConfig.modalTitle = "راهنمای فرمت شماره گذاری";
    this.helpModalConfig.set(helpConfig);
  }

  private initializeForm(): void {
    const formGroup = this.fb.group({
      guid: [''],
      firstName: ['', [
        Validators.required,
        Validators.maxLength(100)
      ]],
      lastName: ['', [
        Validators.required,
        Validators.maxLength(100)
      ]],
      mobile: ['', [
        Validators.minLength(11),
        Validators.maxLength(11)
      ]],
      position: ['', [Validators.required, Validators.maxLength(200)]],
      startDate: [''],
      endDate: [''],
      company: [''],
      profileImage: [null]
    });

    this.form.set(formGroup);
  }

  onImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      this.form()?.patchValue({ profileImage: file });
      this.form()?.get('profileImage')?.updateValueAndValidity();

      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        this.previewUrl.set(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
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

  // override submit(action: string, hasFile = true): void {
  //   // if (!this.isFormValid()) {
  //   //   return;
  //   // }
  //   super.submit(action, hasFile);
  // }
}
