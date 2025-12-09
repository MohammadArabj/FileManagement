import {
  Component,
  output,
  viewChild,
  OnInit,
  OnChanges,
  SimpleChanges,
  signal,
  computed,
  effect,
  inject,
  DestroyRef,
  input,
  OutputEmitterRef,
  ElementRef,
  untracked
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule, FormArray } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Resolution } from '../../../../../core/models/Resolution';
import { FileMeetingService } from '../../../../../services/file-meeting.service';
import { ToastService } from '../../../../../services/framework-services/toast.service';
import { ResolutionService } from '../../../../../services/resolution.service';
import { ComboBase } from '../../../../../shared/combo-base';
import { CustomInputComponent } from '../../../../../shared/custom-controls/custom-input';
import { CustomSelectComponent } from '../../../../../shared/custom-controls/custom-select';
import { base64ToArrayBuffer } from '../../../../../core/types/configuration';
import { NgStyle } from '@angular/common';
import { environment } from '../../../../../../environments/environment';
import { MeetingService } from '../../../../../services/meeting.service';
import { data } from 'jquery';
import { AgendaService } from '../../../../../services/agenda.service';
import { FileService } from '../../../../../services/file.service';
import { MeetingBehaviorService } from '../../meeting-behavior-service';

interface BoardFile {
  id?: number;
  name?: string;
  size?: number;
  sizeFormatted?: string;
  url: string;
  uploadDate: string;
  type: string;
  file?: File;
  guid?: string;
  isAgendaFile?: boolean; // برای تشخیص فایل‌های دستور جلسه
}

interface Assignment {
  id?: number;
  actorGuid: string;
  actorPositionGuid?: string;
  followerGuid?: string;
  followerPositionGuid?: string;
  dueDate: string;
  status: string;
  description: string;
  isNew?: boolean;
  isRemoved?: boolean;
}

@Component({
  selector: 'app-board-resolution-modal',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, CustomInputComponent, CustomSelectComponent, NgStyle],
  templateUrl: './board-resolution-modal.html',
  styleUrl: './board-resolution-modal.css',
})
export class BoardResolutionModalComponent implements OnInit, OnChanges {

  updateStatusBadge(_t120: number) {
    throw new Error('Method not implemented.');
  }

  // Injected services
  private readonly fb = inject(FormBuilder);
  private readonly toastService = inject(ToastService);
  private readonly meetingService = inject(MeetingService);
  private readonly resolutionService = inject(ResolutionService);
  private readonly fileMeetingService = inject(FileMeetingService);
  private readonly agendaService = inject(AgendaService);
  private readonly fileService = inject(FileService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);
  private readonly meetingBehaviorService = inject(MeetingBehaviorService); // اضافه کردن service

  // Input signals
  readonly isEditingResolution = input<boolean>(false);
  readonly selectedResolution = input<Resolution | null>(null);
  readonly meetingGuid = input<any>();
  readonly meetingDate = input<Date | null>(null);
  readonly users = input<ComboBase[]>([]);
  readonly positions = input<ComboBase[]>([]);

  // Output signals
  readonly boardResolutionSaved: OutputEmitterRef<void> = output<void>();
  readonly modalClosed: OutputEmitterRef<void> = output<void>();

  // ViewChild signals
  readonly boardFileInput = viewChild<ElementRef<HTMLInputElement>>('boardFileInput');
  readonly assignmentsContainer = viewChild<ElementRef>('assignmentsContainer');

  // Private writable signals for internal state
  private readonly _boardUploadedFiles = signal<BoardFile[]>([]);
  private readonly _selectedBoardFileId = signal<number | null>(null);
  private readonly _uploadingFile = signal<boolean>(false);
  private readonly _uploadProgress = signal<number>(0);
  private readonly _isPastMeeting = signal<boolean>(false);
  private readonly _boardPdfUrl = signal<SafeResourceUrl | null>(null);
  private readonly _assignments = signal<FormArray>(new FormArray<FormGroup>([]));
  private readonly _previousResolutions = signal<ComboBase[] | null>(null);
  private readonly _agendas = signal<any[]>([]);

  // Public readonly signals
  readonly boardUploadedFiles = this._boardUploadedFiles.asReadonly();
  readonly selectedBoardFileId = this._selectedBoardFileId.asReadonly();
  readonly uploadingFile = this._uploadingFile.asReadonly();
  readonly uploadProgress = this._uploadProgress.asReadonly();
  readonly boardPdfUrl = this._boardPdfUrl.asReadonly();
  readonly isPastMeeting = this._isPastMeeting.asReadonly();
  readonly assignments = this._assignments.asReadonly();
  readonly previousResolutions = this._previousResolutions.asReadonly();
  readonly agendas = this._agendas.asReadonly();

  // Computed signals
  readonly fileCount = computed(() => this._boardUploadedFiles().length);
  readonly hasFiles = computed(() => this._boardUploadedFiles().length > 0);
  readonly hasAssignments = computed(() => this._assignments().length > 0);
  readonly canAddAssignment = computed(() => !this._isPastMeeting());
  readonly isFormValid = computed(() => this.boardResolutionForm?.valid ?? false);
  readonly assignmentControls = computed(() => {
    return this.assignments().controls as FormGroup[];
  });

  // Signal برای نگهداری اطلاعات جلسه
  readonly currentMeeting = computed(() => this.meetingBehaviorService.meeting());
  readonly meetingNumber = computed(() => this.currentMeeting()?.number || '');

  // Form
  boardResolutionForm!: FormGroup;

  // Other properties
  previousMeetings: ComboBase[] = [];
  previousCommitteMeetings: ComboBase[] = [];
  previousCommitteResolutions: ComboBase[] = [];
  readonly statusList = [
    { guid: 'Done', title: 'انجام شده' },
    { guid: 'NotDone', title: 'انجام نشده' },
    { guid: 'InProgress', title: 'در حال انجام' },
  ];

  onMeetingChange(meetingGuid: any) {
    this.resolutionService
      .getRelatedResolutions(meetingGuid)
      .subscribe((data: any) => {
        this._previousResolutions.set(data)
      })
  }

  constructor() {
    this.initializeForm();
    this.setupEffects();
  }

  private initializeForm(): void {
    this.boardResolutionForm = this.fb.group({
      id: [''],
      title: ['', Validators.required],
      description: [''],
      parentMeetingGuid: [],
      parentResolutionId: [],
      approvedPrice: [''],
      committeeMeetingGuid: [],
      committeeResolutionId: [],
      contractNumber: [''],
      documentation: [''],
    });
  }

  private _isPatching = false;
  private lastProcessedId = signal<number | null>(null);
  private lastRefreshToken: number | null = null;

  private setupEffects(): void {
    // Effect برای لود فایل‌های دستور جلسه هنگام باز شدن مدال
    effect(() => {
      const meetingGuid = this.meetingGuid();
      if (meetingGuid && !this.isEditingResolution()) {
        untracked(() => {
          this.loadAgendaFiles();
        });
      }
    });

    // Effect جداگانه برای مدیریت resolution انتخاب شده
    let lastPatchedId: number | null = null;

    effect(() => {
      const resolution = this.selectedResolution();
      const isEditing = this.isEditingResolution();

      // اگر resolution وجود دارد و در حالت ویرایش هستیم
      if (resolution && isEditing) {
        // اگر resolution جدید است یا refreshToken تغییر کرده
        if (this.lastProcessedId() !== resolution.id ||
          (resolution as any)._refreshToken !== this.lastRefreshToken) {

          this.lastProcessedId.set(resolution.id);
          this.lastRefreshToken = (resolution as any)._refreshToken;

          untracked(() => {
            this.patchFormForEdit();
          });
        }
      }
    });
  }

  ngOnInit(): void {
    const meetingDate = this.meetingDate();
    if (meetingDate) {
      this.checkIfPastMeeting(meetingDate);
    }

    this.meetingService.getParentMeetings()
      .subscribe((data: any) => {
        this.previousMeetings = data.map((meeting: any) => ({
          guid: meeting.guid,
          title: meeting.title,
        }));
      })

    if (!this.isEditingResolution()) {
      this.resetForm();
    }
  }

  // متد جدید برای لود فایل‌های دستور جلسه
  private loadAgendaFiles(): void {
    this.agendaService.getListBy(this.meetingGuid()).subscribe({
      next: (data: any) => {
        this._agendas.set(data);

        // پردازش فایل‌های دستور جلسه
        const agendaFiles: BoardFile[] = [];

        data.forEach((agenda: any, index: number) => {
          if (agenda.fileGuid) {
            this.fileService.getFileDetails(agenda.fileGuid).subscribe({
              next: (file) => {
                const fileObj: BoardFile = {
                  id: Date.now() + index,
                  name: file.fileName || `دستور جلسه ${index + 1}`,
                  //sizeFormatted: this.formatFileSize(file.size || 0),
                  url: this.createFileUrl(file),
                  uploadDate: new Date().toLocaleDateString('fa-IR'),
                  type: 'pdf',
                  guid: file.guid,
                  isAgendaFile: true // مشخص کردن که این فایل مربوط به دستور جلسه است
                };

                agendaFiles.push(fileObj);

                // به‌روزرسانی لیست فایل‌ها
                this._boardUploadedFiles.update(current => {
                  // فقط فایل‌های غیر دستور جلسه را نگه دار و فایل‌های جدید دستور جلسه را اضافه کن
                  const nonAgendaFiles = current.filter(f => !f.isAgendaFile);
                  return [...nonAgendaFiles, ...agendaFiles];
                });
              }
            });
          }
        });
      }
    });
  }

  loadAgendas() {
    this.loadAgendaFiles(); // استفاده از متد جدید
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Note: با input signals، این method کمتر نیاز است چون effects خودکار handle می‌کنند
    // اما برای سازگاری با کدهای قدیمی نگه داشته شده
  }

  private checkIfPastMeeting(meetingDate: Date): void {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const meeting = new Date(meetingDate);
    meeting.setHours(0, 0, 0, 0);
    this._isPastMeeting.set(meeting < today);
  }

  private patchFormForEdit(): void {
    const resolution = this.selectedResolution();
    if (!resolution) return;

    // ایجاد یک کپی جدید برای جلوگیری از تغییرات ناخواسته
    const resolutionCopy = { ...resolution };

    // ریست فرم قبل از پر کردن مجدد
    this.resetForm();

    // پر کردن فرم با دیتای جدید
    this.boardResolutionForm.patchValue({
      id: resolutionCopy.id,
      title: resolutionCopy.title || '',
      description: resolutionCopy.description,
      parentResolutionId: resolutionCopy.parentResolutionId || '',
      committeeMeetingGuid: resolutionCopy.committeeMeetingGuid || '',
      committeeResolutionId: resolutionCopy.committeeResolutionId || '',
      approvedPrice: resolutionCopy.approvedPrice || '',
      contractNumber: resolutionCopy.contractNumber || '',
      documentation: resolutionCopy.documentation || '',
    }, { emitEvent: false }); // جلوگیری از فعال شدن validators

    // لود پیوست‌ها و تخصیص‌ها
    this.loadExistingAssignments();
    this.loadExistingFiles();
  }

  private loadExistingAssignments(): void {
    const resolution = this.selectedResolution();
    if (resolution?.id) {
      const formArray = this._assignments();
      formArray.clear();

      // Add existing assignments to FormArray
      resolution.assignments.forEach(assignment => {
        const assignmentGroup = this.fb.group({
          id: [assignment.id || 0],
          actorGuid: [assignment.actorGuid || '', Validators.required],
          //actorPositionGuid: [assignment.actorPositionGuid || ''],
          followerGuid: [assignment.followerGuid || environment.defaultFollowerGuid || ''],
          //followerPositionGuid: [assignment.followerPositionGuid || environment.defaultFollowerPositionGuid || ''],
          dueDate: [assignment.dueDate || '', Validators.required],
          status: [''],
          description: [''],
          isRemoved: [false]
        });
        formArray.push(assignmentGroup);
      });

      this._assignments.set(formArray);
    }
  }

  private loadExistingFiles(): void {
    const resolution = this.selectedResolution();
    if (resolution?.id) {
      this.fileMeetingService.getFiles(resolution.id, 'Resolution')
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((files: any) => {
          const processedFiles = files.map((file: any, index: number) => ({
            id: Date.now() + index,
            name: file.fileName,
            size: file.size || 0,
            sizeFormatted: this.formatFileSize(file.size || 0),
            url: this.createFileUrl(file),
            uploadDate: new Date().toLocaleDateString('fa-IR'),
            type: 'pdf',
            file: file,
            guid: file.guid,
            isAgendaFile: false // فایل‌های مصوبه نه دستور جلسه
          }));

          // فقط فایل‌های مصوبه را جایگزین کن، فایل‌های دستور جلسه را نگه دار
          this._boardUploadedFiles.update(current => {
            const agendaFiles = current.filter(f => f.isAgendaFile);
            return [...agendaFiles, ...processedFiles];
          });
        });
    }
  }

  resetForm(): void {
    this.boardResolutionForm.reset();

    // Clean up file URLs
    this._boardUploadedFiles().forEach((file) => {
      if (file.url && file.url.startsWith('blob:')) {
        URL.revokeObjectURL(file.url);
      }
    });

    // Reset assignments FormArray
    const formArray = this._assignments();
    formArray.clear();

    // Reset all signals
    this._assignments.set(formArray);
    this._boardUploadedFiles.set([]);
    this._selectedBoardFileId.set(null);
    this._boardPdfUrl.set('');
    this._uploadingFile.set(false);
    this._uploadProgress.set(0);

    this.hidePdfPreview();

    // بعد از ریست، فایل‌های دستور جلسه را دوباره لود کن (اگر در حالت ثبت هستیم)
    if (!this.isEditingResolution() && this.meetingGuid()) {
      setTimeout(() => {
        this.loadAgendaFiles();
      }, 100);
    }
  }

  addAssignment(): void {
    const currentAssignments = this._assignments();

    // بررسی اینکه همه assignment های موجود معتبر هستند
    for (const assignment of currentAssignments.controls) {
      if (!assignment.get('actorGuid')?.value || !assignment.get('dueDate')?.value) {
        assignment.get('actorGuid')?.markAsTouched();
        assignment.get('dueDate')?.markAsTouched();
        return;
      }
    }

    const assignmentGroup = this.fb.group({
      id: [0],
      actorGuid: ['', Validators.required],
      actorPositionGuid: [''],
      followerGuid: [environment.defaultFollowerGuid || ''],
      followerPositionGuid: [environment.defaultFollowerPositionGuid || ''],
      dueDate: ['', Validators.required],
      status: [''],
      description: [''],
      isRemoved: [false]
    });

    // اضافه کردن به FormArray
    currentAssignments.push(assignmentGroup);
    currentAssignments.insert(0, currentAssignments.controls.pop()!);

    // به‌روزرسانی signal
    this._assignments.set(currentAssignments);

    setTimeout(() => {
      this.scrollToLatestAssignment();
    }, 100);
  }

  removeAssignment(index: number): void {
    const currentAssignments = this._assignments();
    const assignmentControl = currentAssignments.at(index) as FormGroup;

    // اگر assignment جدید است، از FormArray حذف کن
    if (assignmentControl.get('id')?.value === 0) {
      currentAssignments.removeAt(index);
    } else {
      // اگر assignment موجود است، فقط isRemoved را true کن
      assignmentControl.get('isRemoved')?.setValue(true);
    }

    // به‌روزرسانی signal
    this._assignments.set(currentAssignments);
  }

  // Helper method to get user's position
  private getUserPosition(userGuid: string): string {
    const users = this.users();
    const user = users.find(u => u.guid === userGuid);
    return user?.other || ''; // فرض می‌کنیم positionGuid در ComboBase موجود است
  }

  // Method to handle actor selection and automatically set position
  onActorChange(assignmentIndex: number, actorGuid: string): void {
    const assignmentControl = this._assignments().at(assignmentIndex) as FormGroup;

    const user = this.users().find(u => u.guid === actorGuid);

    const actorPositionGuid = user?.other || ''; // بررسی کن این مقدار واقعاً چیزی هست

    assignmentControl.patchValue({
      actorGuid: actorGuid,
      actorPositionGuid: actorPositionGuid
    });
  }

  getSelectedUserTitle(guid: string): string {
    const users = this.users();
    const user = users.find(u => u.guid === guid);
    return user ? user.title ?? '' : '';
  }

  // File management methods
  triggerFileInput(): void {
    this.boardFileInput()?.nativeElement?.click();
  }

  handleDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const uploadArea = event.currentTarget as HTMLElement;
    uploadArea.classList.add('dragover');
  }

  handleDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const uploadArea = event.currentTarget as HTMLElement;
    uploadArea.classList.remove('dragover');
  }

  handleDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const uploadArea = event.currentTarget as HTMLElement;
    uploadArea.classList.remove('dragover');

    const files = Array.from(event.dataTransfer?.files || []);
    this.processBoardFiles(files);
  }

  handleBoardFiles(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      const files = Array.from(input.files);
      this.processBoardFiles(files);
      input.value = '';
    }
  }

  processBoardFiles(files: File[]): void {
    const pdfFiles = files.filter((file) => file.type === 'application/pdf');
    const invalidFiles = files.filter((file) => file.type !== 'application/pdf');

    if (invalidFiles.length > 0) {
      this.toastService.error('فقط فایل‌های PDF پذیرفته می‌شوند');
    }

    if (pdfFiles.length > 0) {
      pdfFiles.forEach((file) => this.uploadBoardFile(file));
    }
  }

  async uploadBoardFile(file: File): Promise<void> {
    const fileId = Date.now() + Math.random();
    const fileSize = this.formatFileSize(file.size);

    const fileObj: BoardFile = {
      id: fileId,
      name: file.name,
      size: file.size,
      sizeFormatted: fileSize,
      url: URL.createObjectURL(file),
      uploadDate: new Date().toLocaleDateString('fa-IR'),
      type: 'pdf',
      file: file,
      isAgendaFile: false // فایل‌های آپلود شده توسط کاربر
    };

    this._uploadingFile.set(true);

    try {
      await this.simulateBoardUpload();
      this._boardUploadedFiles.update(current => [...current, fileObj]);
    } finally {
      this._uploadingFile.set(false);
      this._uploadProgress.set(0);
    }
  }

  private simulateBoardUpload(): Promise<void> {
    return new Promise((resolve) => {
      this._uploadProgress.set(0);
      const interval = setInterval(() => {
        this._uploadProgress.update(current => {
          const newProgress = current + Math.random() * 20;
          if (newProgress >= 100) {
            clearInterval(interval);
            setTimeout(resolve, 200);
            return 100;
          }
          return newProgress;
        });
      }, 150);
    });
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 بایت';
    const k = 1024;
    const sizes = ['بایت', 'کیلوبایت', 'مگابایت', 'گیگابایت'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  selectBoardFile(fileId: number): void {
    this._selectedBoardFileId.set(fileId);
    const file = this._boardUploadedFiles().find((f) => f.id === fileId);
    if (file) {
      this.showPdfPreview(file.url, file.name??'');
    }
  }

  deleteBoardFile(fileId: number): void {
    const file = this._boardUploadedFiles().find(f => f.id === fileId);

    // جلوگیری از حذف فایل‌های دستور جلسه
    if (file?.isAgendaFile) {
      this.toastService.error('فایل‌های دستور جلسه قابل حذف نیستند');
      return;
    }

    if (confirm('آیا از حذف این فایل اطمینان دارید؟')) {
      if (file) {
        if (file.url && file.url.startsWith('blob:')) {
          URL.revokeObjectURL(file.url);
        }

        this._boardUploadedFiles.update(current => current.filter(f => f.id !== fileId));

        if (this._selectedBoardFileId() === fileId) {
          this._selectedBoardFileId.set(null);
          this.hidePdfPreview();
        }

        this.toastService.success('فایل حذف شد');
      }
    }
  }

  showPdfPreview(url: string, name: string): void {
    const pdfPanel = document.getElementById('boardPdfPanel');
    const mainContainer = document.getElementById('mainContainer');

    this._boardPdfUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
    const pdfTitleElem = document.getElementById('pdf-title');
    if (pdfTitleElem) {
      pdfTitleElem.innerHTML = name;
    }
    if (pdfPanel) {
      pdfPanel.classList.remove('hidden');
    }
    if (mainContainer) {
      mainContainer.classList.remove('no-pdf');
    }
  }

  hidePdfPreview(): void {
    const pdfPanel = document.getElementById('boardPdfPanel');
    const mainContainer = document.getElementById('mainContainer');

    this._boardPdfUrl.set('');
    if (pdfPanel) {
      pdfPanel.classList.add('hidden');
    }
    if (mainContainer) {
      mainContainer.classList.add('no-pdf');
    }
    this._selectedBoardFileId.set(null);
  }

  // Save and validation methods
  saveBoardResolution(): void {
    if (this.boardResolutionForm.invalid) {
      this.boardResolutionForm.markAllAsTouched();
      // مارک کردن assignments نیز برای نمایش خطاها
      this._assignments().controls.forEach((control) =>
        control.markAllAsTouched()
      );
      this.toastService.error('لطفاً تمام فیلدهای الزامی را پر کنید');
      return;
    }

    // Validate assignments
    if (!this.validateAssignments()) {
      return;
    }

    const formData = new FormData();
    const formValue = this.boardResolutionForm.value;

    // Add basic form fields to FormData (excluding assignments)
    Object.keys(formValue).forEach((key) => {
      if (key === 'assignments') return; // Skip assignments - will handle separately

      if (formValue[key] !== null && formValue[key] !== '' && formValue[key] !== undefined) {
        formData.append(key, formValue[key]);
      }
    });

    formData.append('meetingGuid', this.meetingGuid());

    // Handle assignments with proper FormData indexing
    const assignments = this._assignments().controls;
    let assignmentIndex = 0;

    assignments.forEach((control) => {
      const assignment = control.value;

      // Skip completely new assignments that are marked as removed
      if (!assignment.id && assignment.isRemoved) return;

      // Add assignment data with proper indexing
      formData.append(
        `items[${assignmentIndex}].id`,
        (assignment.id || 0).toString()
      );
      formData.append(
        `items[${assignmentIndex}].actorGuid`,
        assignment.actorGuid || ''
      );
      formData.append(
        `items[${assignmentIndex}].actorPositionGuid`,
        assignment.actorPositionGuid || ''
      );
      formData.append(
        `items[${assignmentIndex}].followerGuid`,
        assignment.followerGuid || environment.defaultFollowerGuid
      );
      formData.append(
        `items[${assignmentIndex}].followerPositionGuid`,
        assignment.followerPositionGuid || environment.defaultFollowerPositionGuid
      );
      formData.append(
        `items[${assignmentIndex}].dueDate`,
        assignment.dueDate || ''
      );
      formData.append(
        `items[${assignmentIndex}].status`,
        assignment.status || ''
      );
      formData.append(
        `items[${assignmentIndex}].description`,
        assignment.description || ''
      );
      formData.append(
        `items[${assignmentIndex}].isRemoved`,
        assignment.isRemoved ? 'true' : 'false'
      );

      assignmentIndex++;
    });

    // فقط فایل‌های جدید (غیر دستور جلسه) را اضافه کن
    this._boardUploadedFiles()
      .filter(fileObj => !fileObj.guid && !fileObj.isAgendaFile) // فقط فایل‌های جدید آپلود شده
      .forEach((fileObj) => {
        formData.append('files', fileObj.file??'');
      });

    // Optional: Log FormData for debugging
    if (environment.production === false) {
      for (let [key, value] of formData.entries()) {
        console.log(key, value);
      }
    }

    this.resolutionService.createOrEditBoardMeeting(formData)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: any) => {
          // this.toastService.success(
          //   this.isEditingResolution()
          //     ? 'مصوبه هیئت مدیره با موفقیت ویرایش شد'
          //     : 'مصوبه هیئت مدیره با موفقیت ثبت شد'
          // );
          this.boardResolutionSaved.emit();
          this.resetForm();
        },
        error: (error: any) => {
          console.error('Error saving board resolution:', error);
          this.toastService.error('خطا در ثبت مصوبه هیئت مدیره');
        }
      });
  }

  private validateAssignments(): boolean {
    const assignments = this._assignments().controls.filter(control => !control.get('isRemoved')?.value);

    if (assignments.length === 0) {
      this.toastService.error('لطفاً حداقل یک اقدام کننده تعیین کنید');
      return false;
    }

    const incompleteAssignments = assignments.filter(assignment =>
      !assignment.get('actorGuid')?.value ||
      !assignment.get('dueDate')?.value
    );

    if (incompleteAssignments.length > 0) {
      this.toastService.error('لطفاً تمام فیلدهای الزامی اقدام کنندگان را پر کنید');
      return false;
    }

    return true;
  }

  cancelForm(): void {
    this._isPatching = false;
    this.resetForm();
    this.modalClosed.emit();
  }

  private createFileUrl(file: any): string {
    if (file.file) {
      const blob = new Blob([base64ToArrayBuffer(file.file)], {
        type: file.contentType
      });
      return URL.createObjectURL(blob);
    }
    return '';
  }

  private scrollToLatestAssignment(): void {
    const container = this.assignmentsContainer()?.nativeElement;
    if (container) {
      const cards = container.querySelectorAll('.assignment-card-modern');

      if (cards.length > 0) {
        const lastCard = cards[cards.length - 1] as HTMLElement;
        lastCard.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });

        // Add highlight effect
        lastCard.style.transform = 'scale(1.02)';
        lastCard.style.boxShadow = '0 20px 60px rgba(72, 187, 120, 0.2)';
        lastCard.style.borderColor = '#48bb78';

        setTimeout(() => {
          lastCard.style.transform = '';
          lastCard.style.boxShadow = '';
          lastCard.style.borderColor = '';
        }, 2000);
      }
    }
  }
}
