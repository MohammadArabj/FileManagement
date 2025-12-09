import {
  Component,
  inject,
  DestroyRef,
  signal,
  computed,
  effect,
  input,
  output,
  OutputEmitterRef
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FileService } from '../../../../services/file.service';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CodeFlowService } from '../../../../services/framework-services/code-flow.service';
import { CustomInputComponent } from "../../../../shared/custom-controls/custom-input";
import { AgendaService } from '../../../../services/agenda.service';
import { Modal } from 'bootstrap';
import { FileUploaderComponent } from "../../../../shared/file-uploader/file-uploader";

declare var Swal: any;

interface AgendaFormValue {
  id: number;
  text: string;
  fileGuid: string | null;
  fileUrl: string;
  fileObject: any;
  file: File | null;
  isRemoved: boolean;
}

@Component({
  selector: 'app-meeting-agendas',
  imports: [CustomInputComponent, ReactiveFormsModule, FileUploaderComponent],
  templateUrl: './meeting-agendas.html',
  styleUrl: './meeting-agendas.css'
})
export class MeetingAgendasComponent {

  // Injected services
  private readonly fb = inject(FormBuilder);
  private readonly fileService = inject(FileService);
  private readonly codeFlowService = inject(CodeFlowService);
  private readonly agendaService = inject(AgendaService);
  private readonly destroyRef = inject(DestroyRef);

  // Input signals
  readonly inputAgendas = input<FormArray | undefined>(undefined, { alias: 'agendas' });

  // Output signals
  readonly agendasUpdate: OutputEmitterRef<FormArray> = output<FormArray>();

  // Private writable signals
  private readonly _agendas = signal<FormArray>(new FormArray<FormGroup>([]));
  private readonly _fileUrl = signal<string>('');
  private readonly _fileContent = signal<string>('');
  private readonly _fileType = signal<'image' | 'pdf' | 'text' | 'other'>('other');
  private readonly _fileName = signal<string>('');
  private readonly _downloadUrl = signal<string>('');

  // Public readonly signals
  readonly agendas = this._agendas.asReadonly();
  readonly fileUrl = this._fileUrl.asReadonly();
  readonly fileContent = this._fileContent.asReadonly();
  readonly fileType = this._fileType.asReadonly();
  readonly fileName = this._fileName.asReadonly();
  readonly downloadUrl = this._downloadUrl.asReadonly();

  // Computed signals
  readonly agendaControls = computed(() => {
    const allControls = this._agendas().controls as FormGroup[];
    // فقط آیتم‌های حذف نشده را نشان بده
    return allControls.filter(control => !control.get('isRemoved')?.value);
  });

  readonly hasValidAgendas = computed(() => {
    return this.agendaControls().every(agenda =>
      agenda.get('text')?.value?.trim() && !agenda.get('isRemoved')?.value
    );
  });

  constructor() {
    this.setupEffects();
  }

  private setupEffects(): void {
    // Effect to handle input agendas changes
    effect(() => {
      const inputAgendas = this.inputAgendas();
      if (inputAgendas) {
        this._agendas.set(inputAgendas);
      } else {
        this._agendas.set(new FormArray<FormGroup>([]));
      }
    });
  }

  /**
   * ایجاد یک FormGroup جدید برای agenda
   */
  private createAgendaFormGroup(initialData?: Partial<AgendaFormValue>): FormGroup {
    return this.fb.group({
      id: [initialData?.id || 0],
      text: [initialData?.text || '', Validators.required],
      fileGuid: [initialData?.fileGuid || null],
      fileUrl: [initialData?.fileUrl || ''],
      fileObject: [initialData?.fileObject || null],
      file: [initialData?.file || null],
      isRemoved: [initialData?.isRemoved || false]
    });
  }



  /** * افزودن دستور جلسه جدید */
  addAgendaItem(): void {
    const currentAgendas = this._agendas();
    const activeAgendas = this.agendaControls(); // بررسی اینکه همه agenda های فعال متن دارند 
    const hasEmptyAgenda = activeAgendas.some(agenda => {
      const text = agenda.get('text')?.value?.trim();
      return !text;
    });

    if (hasEmptyAgenda) {
      // علامت‌گذاری همه فیلدهای خالی 
      activeAgendas.forEach(agenda => {
        const textControl = agenda.get('text');
        if (!textControl?.value?.trim()) {
          textControl?.markAsTouched();
        }
      });
      return;
    }

    // ایجاد agenda جدید 
    const newAgenda = this.createAgendaFormGroup();

    // اضافه کردن به ابتدای لیست با mutate 
    currentAgendas.insert(0, newAgenda);

    // ساخت FormArray جدید برای trigger signal 
    const updatedControls = [...currentAgendas.controls];
    this._agendas.set(new FormArray(updatedControls));

    this.emitAgendasUpdate();
  }

  /** * حذف منطقی دستور جلسه (soft delete) */
  removeAgendaItem(index: number): void {
    const currentAgendas = this._agendas();
    const activeAgendas = this.agendaControls();

    if (index < 0 || index >= activeAgendas.length) {
      console.error('Invalid agenda index');
      return;
    }

    const agendaToRemove = activeAgendas[index];
    const agendaId = agendaToRemove.get('id')?.value;
    const agendaText = agendaToRemove.get('text')?.value || 'این دستور جلسه';
    agendaToRemove.patchValue({ isRemoved: true });

    // ساخت FormArray جدید برای trigger signal 
    const updatedControls = [...currentAgendas.controls];
    this._agendas.set(new FormArray(updatedControls));

    this.emitAgendasUpdate();
  }

  /** * پاک کردن اطلاعات فایل از agenda */
  private clearFileFromAgenda(agenda: FormGroup): void {
    agenda.patchValue({
      fileGuid: null,
      fileUrl: '',
      fileObject: null,
      file: null
    });

    // ساخت FormArray جدید برای trigger signal 
    const updatedControls = [...this._agendas().controls];
    this._agendas.set(new FormArray(updatedControls));

    this.emitAgendasUpdate();
  }

  /** * تغییر فایل */
  onFileChange(file: File, index: number): void {
    if (!file) {
      console.error('No file provided');
      return;
    }

    const activeAgendas = this.agendaControls();

    if (index < 0 || index >= activeAgendas.length) {
      console.error('Invalid agenda index');
      return;
    }

    const agenda = activeAgendas[index];

    // خواندن فایل 
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      agenda.patchValue({
        fileGuid: null,
        fileUrl: URL.createObjectURL(file),
        fileObject: { file, base64 },
        file: file
      });

      // ساخت FormArray جدید برای trigger signal 
      const updatedControls = [...this._agendas().controls];
      this._agendas.set(new FormArray(updatedControls));

      this.emitAgendasUpdate();
    };

    reader.onerror = () => {
      Swal.fire('خطا', 'خطا در خواندن فایل', 'error');
    };

    reader.readAsDataURL(file);
  }

  /** * بازگرداندن آیتم حذف شده (undo delete) */
  restoreAgendaItem(agendaId: number): void {
    const currentAgendas = this._agendas();
    const agenda = currentAgendas.controls.find(
      control => control.get('id')?.value === agendaId
    );

    if (agenda) {
      agenda.patchValue({ isRemoved: false });

      // ساخت FormArray جدید برای trigger signal 
      const updatedControls = [...currentAgendas.controls];
      this._agendas.set(new FormArray(updatedControls));

      this.emitAgendasUpdate();
    }
  } 
  /**
   * مشاهده فایل
   */
  viewFile(fileData: any): void {
    if (!fileData) {
      Swal.fire('خطا', 'فایلی برای نمایش وجود ندارد', 'error');
      return;
    }

    // حالت فایل تازه انتخاب‌شده
    if (typeof fileData !== 'string' && fileData.file && fileData.base64) {
      const { file, base64 } = fileData;
      this.setFileData(file.name, '', file.type, base64);
      this.showModal();
      return;
    }

    // حالت فایل از سرور
    if (typeof fileData === 'string') {
      this.fileService.getFileDetails(fileData)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (file) => {
            const downloadUrl = `${this.fileService.baseUrl}/Download/${fileData}`;
            this.setFileData(file.fileName, downloadUrl, file.contentType, file.file);
            this.showModal();
          },
          error: () => {
            Swal.fire('خطا', 'خطا در دریافت اطلاعات فایل', 'error');
          }
        });
    }
  }

  /**
   * تنظیم داده‌های فایل برای نمایش
   */
  private setFileData(fileName: string, downloadUrl: string, contentType: string, fileData: string): void {
    this._fileName.set(fileName);
    this._downloadUrl.set(downloadUrl);

    try {
      const arrayBuffer = this.base64ToArrayBuffer(fileData);
      const blob = new Blob([arrayBuffer], { type: contentType });
      const fileUrl = URL.createObjectURL(blob);
      this._fileUrl.set(fileUrl);

      if (contentType.startsWith('image')) {
        this._fileType.set('image');
      } else if (contentType === 'application/pdf') {
        this._fileType.set('pdf');
      } else if (contentType.startsWith('text')) {
        this._fileType.set('text');
        this.readTextFile(blob);
      } else {
        this._fileType.set('other');
      }
    } catch (error) {
      console.error('Error processing file:', error);
      Swal.fire('خطا', 'خطا در پردازش فایل', 'error');
    }
  }

  /**
   * تبدیل base64 به ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * دانلود فایل
   */
  download(fileGuid?: string): void {
    if (!fileGuid) {
      Swal.fire('خطا', 'شناسه فایل معتبر نیست', 'error');
      return;
    }

    const token = this.codeFlowService.getToken();

    fetch(`${this.fileService.baseUrl}/Download/${fileGuid}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(resp => {
        if (!resp.ok) throw new Error('Download failed');
        return resp.blob();
      })
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = this._fileName() || 'download';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      })
      .catch(() => {
        Swal.fire('خطا', 'خطا در دانلود فایل', 'error');
      });
  }

  /**
   * خواندن محتوای فایل متنی
   */
  private readTextFile(blob: Blob): void {
    const reader = new FileReader();
    reader.onload = () => {
      this._fileContent.set(reader.result as string);
    };
    reader.onerror = () => {
      Swal.fire('خطا', 'خطا در خواندن فایل', 'error');
    };
    reader.readAsText(blob);
  }

  /**
   * نمایش modal
   */
  private showModal(): void {
    const modalElement = document.getElementById('fileViewerModal');
    if (modalElement) {
      const modal = new Modal(modalElement);
      modal.show();
    }
  }

  /**
   * نمایش تصویر در modal
   */
  showImageModal(imageUrl: string): void {
    Swal.fire({
      imageUrl: imageUrl,
      imageAlt: "فایل پیوست",
      showConfirmButton: false,
      showCloseButton: true,
      width: '80%'
    });
  }

  /**
   * حذف فایل با تایید
   */
  confirmDeleteFile(index: number): void {
    Swal.fire({
      title: "حذف فایل پیوست",
      text: "آیا از حذف این فایل اطمینان دارید؟",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "بله، حذف شود",
      cancelButtonText: "خیر",
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6'
    }).then((result: { isConfirmed: boolean }) => {
      if (result.isConfirmed) {
        this.deleteFile(index);
      }
    });
  }

  /**
   * حذف فایل
   */
  deleteFile(index: number): void {
    const activeAgendas = this.agendaControls();

    if (index < 0 || index >= activeAgendas.length) {
      console.error('Invalid agenda index');
      return;
    }

    const agenda = activeAgendas[index];
    const fileGuid = agenda.get('fileGuid')?.value;
    const id = agenda.get('id')?.value;
    const fileObject = agenda.get('fileObject')?.value;

    if (fileGuid && id) {
      // حذف فایل از روی سرور
      this.agendaService.deleteFile(id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.clearFileFromAgenda(agenda);
            Swal.fire({
              icon: 'success',
              title: 'حذف شد',
              text: 'فایل با موفقیت حذف شد',
              timer: 1500,
              showConfirmButton: false
            });
          },
          error: () => {
            Swal.fire('خطا', 'حذف فایل با مشکل مواجه شد', 'error');
          }
        });
    } else if (fileObject) {
      // فقط پاک کردن فایل محلی از فرم
      this.clearFileFromAgenda(agenda);
    }
  }


  
  /**
   * باز کردن modal آپلود فایل
   */
  openUploaderModal(i: number): void {
    const modalElement = document.getElementById(`uploaderModal${i}`);
    if (modalElement) {
      const uploaderModal = new Modal(modalElement);
      uploaderModal.show();
    }
  }

 

  /**
   * دریافت تمام agenda ها شامل حذف شده‌ها
   */
  getAllAgendas(): FormGroup[] {
    return this._agendas().controls as FormGroup[];
  }

  /**
   * دریافت فقط agenda های حذف شده
   */
  getRemovedAgendas(): FormGroup[] {
    return this.getAllAgendas().filter(
      control => control.get('isRemoved')?.value === true
    );
  }

  /**
   * بررسی داشتن فایل
   */
  hasFile(agenda: FormGroup): boolean {
    return !!(agenda.get('fileGuid')?.value || agenda.get('file')?.value);
  }

  /**
   * دریافت تعداد فایل‌های پیوست شده
   */
  getFileCount(agenda: FormGroup): number {
    return this.hasFile(agenda) ? 1 : 0;
  }

  /**
   * emit کردن تغییرات agenda ها
   */
  private emitAgendasUpdate(): void {
    this.agendasUpdate.emit(this._agendas());
  }

  // ==================== Helper methods for template ====================

  /**
   * trackBy function برای بهینه‌سازی rendering
   */
  trackByIndex(index: number, item: any): number {
    return index;
  }

  /**
   * trackBy با استفاده از id
   */
  trackById(index: number, item: FormGroup): number {
    return item.get('id')?.value || index;
  }

  /**
   * بررسی معتبر نبودن متن agenda
   */
  isAgendaTextInvalid(index: number): boolean {
    const activeAgendas = this.agendaControls();
    if (index < 0 || index >= activeAgendas.length) return false;

    const agenda = activeAgendas[index];
    const textControl = agenda.get('text');
    return !!(textControl && textControl.invalid && textControl.touched);
  }

  /**
   * دریافت پیغام خطای متن agenda
   */
  getAgendaTextError(index: number): string {
    const activeAgendas = this.agendaControls();
    if (index < 0 || index >= activeAgendas.length) return '';

    const agenda = activeAgendas[index];
    const textControl = agenda.get('text');

    if (textControl && textControl.errors && textControl.touched) {
      if (textControl.errors['required']) {
        return 'متن دستور جلسه الزامی است';
      }
      if (textControl.errors['minlength']) {
        return `حداقل ${textControl.errors['minlength'].requiredLength} کاراکتر وارد کنید`;
      }
      if (textControl.errors['maxlength']) {
        return `حداکثر ${textControl.errors['maxlength'].requiredLength} کاراکتر مجاز است`;
      }
    }
    return '';
  }

  /**
   * بررسی وجود agenda های معتبر
   */
  hasAnyValidAgendas(): boolean {
    return this.agendaControls().length > 0;
  }

  /**
   * دریافت تعداد agenda های فعال
   */
  getActiveAgendasCount(): number {
    return this.agendaControls().length;
  }

  /**
   * پاکسازی memory leaks
   */
  ngOnDestroy(): void {
    // پاکسازی URLs ایجاد شده
    if (this._fileUrl()) {
      URL.revokeObjectURL(this._fileUrl());
    }
  }
}

