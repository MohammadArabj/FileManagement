import { Component, ElementRef, EventEmitter, NgZone, Output, ViewChild, signal, computed, inject, input, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, forkJoin, fromEvent, interval } from 'rxjs';
import { finalize, map, takeWhile } from 'rxjs/operators';
import { Modal } from 'bootstrap';
import { FileService } from '../../services/file.service';
import { NgxExtendedPdfViewerModule } from 'ngx-extended-pdf-viewer';
import { generateGuid } from '../../core/types/configuration';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { FileDetailsDto, FileItem, Guid } from '../../core/models/file';

@Component({
  selector: 'app-file-uploader',
  standalone: true,
  imports: [CommonModule, NgxExtendedPdfViewerModule],
  templateUrl: './file-uploader.html',
  styleUrls: ['./file-uploader.css'],
})
export class FileUploaderComponent {
  // Inject services using modern DI
  private readonly fileService = inject(FileService);
  private readonly zone = inject(NgZone);

  // Using signals for reactive state management
  files = signal<FileItem[]>([]);
  previewFile = signal<FileItem | null>(null);
  isDragging = signal(false);
  uploadProgress = signal(0);
  errorMessage = signal('');
  showErrors = signal(false);
  isUploading = signal(false);

  // Add loading state
  private isLoadingFiles = signal(false);

  // Computed properties
  hasNewFiles = computed(() =>
    this.files() && this.files().some(f => f.isNew)
  );

  allowedFileTypesDisplay = computed(() =>
    this.allowedFileTypes().length > 0 ? this.getAllowedFileTypesText() : 'همه فرمت‌ها'
  );

  // Input signals
  modalId = input<string>('uploaderModal');
  previewModalId = input<string>('previewModal');
  uploadFiles = input<boolean>(true);
  fileGuids = input<any>([]);
  fileDetailsList = input<FileDetailsDto[]>([]);
  type = input<'default' | 'multiple'>('default');
  showUploadButton = input<boolean>(false);
  replaceExisting = input<boolean>(false);
  isConfirmDelete = input<boolean>(false);
  maxFileSize = input<number>(10000); // Maximum file size in MB
  allowedFileTypes = input<string[]>(['.pdf', '.jpg', '.png', '.docx', '.excel', 'image/', 'application/pdf', '.rar', '.zip']);
  compact = input<boolean>(false);
  customClass = input<string>('');
  showTitle = input<boolean>(true);
  title = input<string>('فایل‌های پیوست');
  private readonly _pdfUrl = signal<SafeResourceUrl | null>(null);
  readonly pdfUrl = this._pdfUrl.asReadonly();
  private sanitizer = inject(DomSanitizer);

  // Output events
  @Output() filesUploaded = new EventEmitter<FileItem[]>();
  @Output() filesRemoved = new EventEmitter<Guid>();
  @Output() confirmDeleteFiles = new EventEmitter<Guid>();
  @Output() fileUploadRequest = new EventEmitter<File>();
  @Output() uploadFilesRequest = new EventEmitter<File[]>();

  @ViewChild('fileInput') fileInput!: ElementRef;
  @ViewChild('previewModal') previewModal!: ElementRef;

  // Keep track of loaded guids to prevent re-loading
  private loadedGuids = new Set<string>();
  private loadedDetailsGuids = new Set<string>();

  constructor() {
    // Effect to watch fileGuids changes with better comparison
    effect(() => {
      const guids = this.fileGuids();

      // Convert to string array for comparison
      const currentGuids = this.normalizeGuids(guids);
      const loadedGuidsArray = Array.from(this.loadedGuids).sort();

      // Only process if guids actually changed
      if (!this.arraysEqual(currentGuids, loadedGuidsArray)) {

        if (currentGuids.length > 0) {
          this.loadFilesByGuids(currentGuids.map(g => g as Guid));
        } else {
          this.clearServerFiles();
        }
      }

    });

    // Effect to watch fileDetailsList changes
    effect(() => {
      const detailsList = this.fileDetailsList();

      if (detailsList && detailsList.length > 0) {
        // Check if details actually changed
        const currentDetailsGuids = detailsList.map(d => d.guid?.toString()).filter(Boolean).sort();
        const loadedDetailsArray = Array.from(this.loadedDetailsGuids).sort();

        if (!this.arraysEqual(currentDetailsGuids, loadedDetailsArray)) {
          this.loadFilesFromDetails(detailsList);
        }
      } else if (this.loadedDetailsGuids.size > 0) {
        this.loadedDetailsGuids.clear();
        // Only clear if no guids are present
        if (!this.fileGuids() || this.fileGuids().length === 0) {
          this.clearServerFiles();
        }
      }
    });
  }

  private normalizeGuids(guids: any): string[] {
    if (!guids || !Array.isArray(guids)) return [];
    return guids
      .filter((guid: any) => guid != null && guid !== '')
      .map((guid: any) => guid.toString())
      .sort();
  }

  private arraysEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((val, index) => val === b[index]);
  }

  private clearServerFiles() {
    // Only remove server files, keep new files
    this.files.update(currentFiles => currentFiles.filter(f => f.isNew));
    this.loadedGuids.clear();
    this.loadedDetailsGuids.clear();
  }

  closeUploaderModal() {
    const modalElement = document.getElementById(this.modalId());
    if (modalElement) {
      const modalInstance = Modal.getInstance(modalElement);
      modalInstance?.hide();
    }
  }

  trackByGuid(index: number, file: any) {
    return file.guid || file.id;
  }

  private loadFilesByGuids(guids: Guid[]) {

    if (this.isLoadingFiles()) {
      return;
    }

    this.isLoadingFiles.set(true);

    // Clear current server files if replacing
    if (this.replaceExisting()) {
      this.clearServerFiles();
    }

    // Filter out already loaded guids
    const newGuids = guids.filter(guid => !this.loadedGuids.has(guid.toString()));

    if (newGuids.length === 0) {
      this.isLoadingFiles.set(false);
      return;
    }


    const loadObservables = newGuids.map(guid => {
      return this.fileService.getFileDetails(guid);
    });

    forkJoin(loadObservables).subscribe({
      next: (detailsArray: any[]) => {

        const newFiles = detailsArray.map(details => {
          const fileItem = this.createFileItemFromDetails(details);
          this.loadedGuids.add(details.guid?.toString());
          return fileItem;
        });

        this.files.update(files => {
          const existingFiles = this.replaceExisting() ? files.filter(f => f.isNew) : files;
          const updatedFiles = [...existingFiles, ...newFiles];
          return updatedFiles;
        });

        this.sortFiles();
        this.isLoadingFiles.set(false);
      },
      error: (error: any) => {
        this.showError('خطا در بارگذاری فایل‌ها');
        this.isLoadingFiles.set(false);
      }
    });
  }

  private loadFilesFromDetails(detailsList: FileDetailsDto[]) {

    const currentFiles = this.replaceExisting() ? [] : this.files().filter(f => f.isNew);

    // Clear loaded details guids
    this.loadedDetailsGuids.clear();

    const newFiles = detailsList
      .filter(details => {
        const guidStr = details.guid?.toString();
        if (!guidStr || this.files().some(f => f.guid?.toString() === guidStr)) {
          return false;
        }
        this.loadedDetailsGuids.add(guidStr);
        return true;
      })
      .map(details => this.createFileItemFromDetails(details));


    this.files.set([...currentFiles, ...newFiles]);
    this.sortFiles();
  }

  private createFileItemFromDetails(details: FileDetailsDto): FileItem {
    return {
      id: details.guid,
      guid: details.guid,
      name: details.fileName,
      size: details.file?.length || 0,
      type: details.contentType,
      progress: 100,
      completed: true,
      url: this.createPreviewUrl(details),
      details: details,
      isNew: false
    };
  }

  private createPreviewUrl(details: FileDetailsDto): string | null {
    if (details.file) {
      const blob = new Blob([this.base64ToArrayBuffer(details.file)], { type: details.contentType });
      return URL.createObjectURL(blob);
    }
    return null;
  }

  base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  removeFile(fileId: string, event?: Event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const fileIndex = this.files().findIndex(f => f.id === fileId);
    if (fileIndex > -1) {
      const file = this.files()[fileIndex];

      // اگر فایل از سرور آمده و باید تأیید حذف شود
      if (this.isConfirmDelete() && !file.isNew && file.guid) {
        // ارسال رویداد تأیید حذف به کامپوننت والد
        this.confirmDeleteFiles.emit(file.guid);
        return; // خروج از متد - حذف توسط کامپوننت والد انجام می‌شود
      }

      // اگر فایل جدید است یا نیازی به تأیید نیست
      this.performFileRemoval(fileIndex, file);
    }
  }

  private performFileRemoval(fileIndex: number, file: FileItem) {
    // Remove from tracking sets
    if (file.guid) {
      this.loadedGuids.delete(file.guid.toString());
      this.loadedDetailsGuids.delete(file.guid.toString());
    }

    // Free up object URL to prevent memory leaks
    if (file.url && file.url.startsWith('blob:')) {
      URL.revokeObjectURL(file.url);
    }

    // Remove from files array
    this.files.update(files => files.filter((_, i) => i !== fileIndex));

    // Emit events based on file type
    if (file.isNew) {
      // برای فایل‌های جدید که هنوز آپلود نشده‌اند
      this.filesRemoved.emit([file.id]);
    } else if (file.guid) {
      // برای فایل‌های سرور که باید از سرور حذف شوند
      this.deleteFromServer(file.guid);
    }

    // اطلاع‌رسانی به کامپوننت والد
    this.filesUploaded.emit(this.files());
  }

  private deleteFromServer(fileGuid: Guid) {
    // اگر سرویس حذف فایل در دسترس است
    if (this.fileService && typeof this.fileService.delete === 'function') {
      this.fileService.delete(fileGuid).subscribe({
        next: () => {
          console.log('فایل با موفقیت از سرور حذف شد');
          // اطلاع‌رسانی به کامپوننت والد
          this.filesRemoved.emit([fileGuid]);
        },
        error: (error) => {
          console.error('خطا در حذف فایل از سرور:', error);
          this.showError('خطا در حذف فایل از سرور');
          // در صورت خطا، فایل را دوباره به لیست اضافه کنیم
          this.loadFilesByGuids([fileGuid]);
        }
      });
    } else {
      // اگر سرویس حذف در دسترس نیست، از کامپوننت والد بخواهیم حذف کند
      this.confirmDeleteFiles.emit(fileGuid);
    }
  }
  onFileSelected(event: any) {
    const selectedFiles = event.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      if (this.replaceExisting()) {
        // Only clear new files, keep server files
        this.files.update(files => files.filter(f => !f.isNew));
      }
      this.handleFiles(selectedFiles);
    }
    this.fileInput.nativeElement.value = ''; // Reset input to allow selecting the same file again
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
    const droppedFiles = event.dataTransfer?.files;
    if (droppedFiles && droppedFiles.length > 0) {
      this.handleFiles(droppedFiles);
    }
  }

  handleFiles(files: FileList) {
    if (files.length === 0) return;

    // If not multiple and there are already files, either replace or show error
    if (this.type() !== 'multiple' && this.files().length > 0) {
      if (this.replaceExisting()) {
        // Remove existing files that are new (not from server)
        this.files.update(currentFiles => currentFiles.filter(f => !f.isNew));
      } else if (files.length > 1 || this.files().some(f => f.isNew)) {
        this.showError('فقط یک فایل می‌توانید انتخاب کنید');
        return;
      }
    }

    const uploadObservables: Observable<any>[] = [];
    let hasErrors = false;

    // Validate and process each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Check file size
      if (file.size > this.maxFileSize() * 1024 * 1024) {
        this.showError(`فایل ${file.name} بزرگتر از حد مجاز است (${this.maxFileSize()} مگابایت)`);
        hasErrors = true;
        continue;
      }

      // بهبود بررسی فرمت فایل
      if (this.allowedFileTypes().length > 0) {
        const isValidFileType = this.isValidFileType(file);
        if (!isValidFileType) {
          const allowedTypesText = this.getAllowedFileTypesText();
          this.showError(`فرمت فایل "${file.name}" مجاز نیست. فرمت‌های مجاز: ${allowedTypesText}`);
          hasErrors = true;
          continue;
        }
      }

      // Generate a unique ID for this file
      const fileId = generateGuid();

      // Create file item
      const fileItem: FileItem = {
        id: fileId,
        guid: null, // Will be set after upload
        name: file.name,
        size: file.size,
        type: file.type,
        url: URL.createObjectURL(file),
        progress: 0,
        completed: false,
        file: file,
        isNew: true
      };

      // Add to files array
      if (this.replaceExisting()) {
        this.zone.run(() => {
          this.files.set([fileItem]);
        });
      } else {
        this.files.update(files => [...files, fileItem]);
      }

      // Emit file for parent awareness
      this.fileUploadRequest.emit(file);

      // Add simulated upload observable
      const upload$ = this.simulateUpload(fileItem).pipe(
        finalize(() => {
          fileItem.progress = 100;
          fileItem.completed = true;
        })
      );

      uploadObservables.push(upload$);
    }

    if (uploadObservables.length > 0) {
      this.isUploading.set(true);

      // Track overall progress
      forkJoin(uploadObservables).subscribe({
        next: () => {
          this.isUploading.set(false);
          this.uploadProgress.set(100);
          this.sortFiles();
          this.filesUploaded.emit(this.files());

          // If we have an upload button, prepare files for actual upload
          if (this.showUploadButton()) {
            const filesToUpload = this.files()
              .filter(f => f.isNew && f.file)
              .map(f => f.file as File);

            if (filesToUpload.length > 0) {
              //this.uploadFilesRequest.emit(filesToUpload);
            }
          }
        },
        error: (err) => {
          this.isUploading.set(false);
          this.showError('خطا در آپلود فایل‌ها');
          console.error('Upload error:', err);
        }
      });
    } else if (hasErrors) {
      // Only show errors if we didn't process any files successfully
      this.showErrors.set(true);
    }
  }

  // اضافه کردن این فانکشن‌های کمکی
  private isValidFileType(file: File): boolean {
    const fileName = file.name.toLowerCase();
    const fileType = file.type.toLowerCase();

    return this.allowedFileTypes().some(allowedType => {
      const normalizedAllowedType = allowedType.toLowerCase().trim();

      // بررسی پسوند فایل
      if (normalizedAllowedType.startsWith('.')) {
        return fileName.endsWith(normalizedAllowedType);
      }

      // بررسی MIME type
      if (normalizedAllowedType.includes('/')) {
        return fileType === normalizedAllowedType || fileType.startsWith(normalizedAllowedType.split('/')[0] + '/');
      }

      // بررسی دسته‌بندی کلی (مثل image, video, etc.)
      return fileType.startsWith(normalizedAllowedType + '/');
    });
  }

  private getAllowedFileTypesText(): string {
    return this.allowedFileTypes().map(type => {
      // اگر پسوند است، همان‌طور نمایش بده
      if (type.startsWith('.')) {
        return type;
      }

      // اگر MIME type است، به فرمت قابل فهم تبدیل کن
      const mimeTypeMap: { [key: string]: string } = {
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/gif': '.gif',
        'application/pdf': '.pdf',
        'application/msword': '.doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
        'application/vnd.ms-excel': '.xls',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
        'video/mp4': '.mp4',
        'audio/mpeg': '.mp3'
      };

      return mimeTypeMap[type] || type;
    }).join(', ');
  }

  simulateUpload(file: FileItem): Observable<number> {
    let progress = 0;
    return interval(100).pipe(
      map(() => {
        // More realistic progress simulation
        const increment = 5 + Math.random() * 15; // Between 5-20% increment
        progress += increment;
        if (progress > 100) progress = 100;
        file.progress = Math.floor(progress);
        return file.progress;
      }),
      takeWhile(p => p < 100, true)
    );
  }

  uploadSelected() {
    const newFiles = this.files()
      .filter(f => f.isNew && f.file)
      .map(f => f.file as File);

    if (newFiles.length > 0) {
      this.uploadFilesRequest.emit(newFiles);
    }
  }

  triggerFileInput() {
    this.fileInput.nativeElement.click();
  }

  formatFileSize(bytes: number) {
    if (bytes === 0) return '0 بایت';
    const sizes = ['بایت', 'کیلوبایت', 'مگابایت', 'گیگابایت', 'ترابایت'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
  }

  isImage(file: FileItem) {
    return file.type.startsWith('image/');
  }

  isPdf(file: FileItem) {
    return file.type === 'application/pdf';
  }

  isVideo(file: FileItem) {
    return file.type.startsWith('video/');
  }

  isAudio(file: FileItem) {
    return file.type.startsWith('audio/');
  }

  canPreview(file: FileItem) {
    return this.isImage(file) || this.isPdf(file) || this.isVideo(file) || this.isAudio(file);
  }

  getFileIcon(fileType: string): string {
    if (fileType.startsWith('image/')) {
      return 'image';
    } else if (fileType.startsWith('application/pdf')) {
      return 'pdf';
    } else if (fileType.startsWith('video/')) {
      return 'video';
    } else if (fileType.startsWith('audio/')) {
      return 'audio';
    } else if (fileType.startsWith('application/vnd.openxmlformats-officedocument.wordprocessingml.document') ||
      fileType.startsWith('application/msword')) {
      return 'word';
    } else if (fileType.startsWith('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') ||
      fileType.startsWith('application/vnd.ms-excel')) {
      return 'excel';
    } else {
      return 'file';
    }
  }

  getFileIconColor(fileType: string): string {
    if (fileType.startsWith('image/')) {
      return 'text-primary';
    } else if (fileType === 'application/pdf') {
      return 'text-danger';
    } else if (fileType.startsWith('video/')) {
      return 'text-success';
    } else if (fileType.startsWith('audio/')) {
      return 'text-info';
    } else if (fileType.startsWith('application/vnd.openxmlformats-officedocument.wordprocessingml.document') ||
      fileType === 'application/msword') {
      return 'text-primary';
    } else if (fileType.startsWith('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') ||
      fileType === 'application/vnd.ms-excel') {
      return 'text-success';
    } else if (fileType.startsWith('application/vnd.openxmlformats-officedocument.presentationml.presentation') ||
      fileType === 'application/vnd.ms-powerpoint') {
      return 'text-warning';
    } else {
      return 'text-secondary';
    }
  }

  // Open file preview
  openPreview(file: FileItem, event?: Event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (!this.canPreview(file)) {
      this.openFileWithSystem(file);
      return;
    }
    const dataUrl = file.url??'';
    const safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(dataUrl);
    this._pdfUrl.set(safeUrl);
    this.previewFile.set(file);

    // Use Bootstrap Modal API
    const previewModalElement = document.getElementById(this.previewModalId());
    if (previewModalElement) {
      const previewModalInstance = new Modal(previewModalElement);
      previewModalInstance.show();
    }
  }

  closePreview() {
    this.previewFile.set(null);
    const previewModalElement = document.getElementById(this.previewModalId());
    if (previewModalElement) {
      const previewModalInstance = Modal.getInstance(previewModalElement);
      previewModalInstance?.hide();
    }
  }

  openFileWithSystem(file: FileItem) {
    if (file.url) {
      window.open(file.url, '_blank');
    }
  }

  downloadFile(file: FileItem, event?: Event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (file.url) {
      const link = document.createElement('a');
      link.href = file.url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  showError(message: string) {
    this.errorMessage.set(message);
    this.showErrors.set(true);

    // Auto-hide after 5 seconds
    setTimeout(() => {
      this.showErrors.set(false);
      this.errorMessage.set('');
    }, 5000);
  }

  closeError() {
    this.showErrors.set(false);
    this.errorMessage.set('');
  }

  private sortFiles() {
    // Sort files: new files first, then by name
    const currentFiles = this.files();
    const sortedFiles = currentFiles.sort((a, b) => {
      if (a.isNew && !b.isNew) return -1;
      if (!a.isNew && b.isNew) return 1;
      return a.name.localeCompare(b.name);
    });
    this.files.set([...sortedFiles]);
  }
}