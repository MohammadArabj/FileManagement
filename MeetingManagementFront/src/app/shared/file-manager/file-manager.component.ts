import {
    Component, Input, Output, EventEmitter,
    OnInit, OnDestroy, OnChanges, SimpleChanges,
    inject, signal, computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { TusUploadService, UploadStatus, FileItem } from '../../services/framework-services/tus-upload.service';

declare var Swal: any;
declare var bootstrap: any;

@Component({
    selector: 'app-file-manager',
    standalone: true,
    imports: [CommonModule],
    template: `
    <!-- اگر به صورت مودال استفاده شود -->
    @if (presentation === 'modal') {
      <div class="modal fade" [id]="modalId" tabindex="-1" data-bs-backdrop="static">
        <div class="modal-dialog" [class.modal-lg]="size === 'large'" [class.modal-xl]="size === 'xlarge'">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">
                <i class="fas fa-paperclip me-2"></i>
                {{ title }}
              </h5>
              <button type="button" class="btn-close" (click)="onModalCloseClick()"></button>
            </div>

            <div class="modal-body">
              <ng-container *ngTemplateOutlet="uploaderBody"></ng-container>
            </div>

            <div class="modal-footer">
              <div class="footer-info">
                @if (service.isUploading()) {
                  <span class="uploading-text">
                    <i class="fas fa-spinner fa-spin me-1"></i>
                    در حال آپلود... {{ service.totalProgress() }}%
                  </span>
                } @else {
                  <span class="files-count">
                    {{ service.totalFiles() }} فایل
                  </span>
                }
              </div>
              <div class="footer-actions">
                <button type="button" class="btn btn-outline-secondary" (click)="onModalCloseClick()">
                  <i class="fas fa-times me-1"></i>
                  بستن
                </button>
                <button type="button" class="btn btn-primary"
                        [disabled]="service.isUploading()"
                        (click)="confirm()">
                  <i class="fas fa-check me-1"></i>
                  تأیید
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    } @else {
      <!-- حالت داخل صفحه (inline) -->
      <ng-container *ngTemplateOutlet="uploaderBody"></ng-container>
    }

    <!-- بدن اصلی آپلودر -->
    <ng-template #uploaderBody>
      <div class="file-uploader" [class.compact]="mode === 'compact'" [class.disabled]="disabled">

        <!-- Drop Zone -->
        <div
          class="drop-zone"
          [class.drag-over]="isDragOver()"
          [class.has-files]="hasFiles()"
          (dragover)="onDragOver($event)"
          (dragleave)="onDragLeave($event)"
          (drop)="onDrop($event)"
          (click)="openFilePicker()">

          @if (!hasFiles() && !service.isUploading()) {
            <!-- Empty State -->
            <div class="empty-state">
              <div class="icon-wrapper">
                <i class="fas fa-cloud-upload-alt"></i>
              </div>
              <p class="title">{{ multiple ? 'فایل‌ها را بکشید و رها کنید' : 'فایل را بکشید و رها کنید' }}</p>
              <p class="subtitle">یا کلیک کنید</p>
              <div class="hints">
                @if (maxFileSizeMB) {
                  <span><i class="fas fa-weight-hanging"></i> حداکثر {{ maxFileSizeMB }} MB</span>
                }
                @if (maxFiles && multiple) {
                  <span><i class="fas fa-layer-group"></i> حداکثر {{ maxFiles }} فایل</span>
                }
              </div>
            </div>
          } @else {
            <!-- Files Grid -->
            <div class="files-container" (click)="$event.stopPropagation()">

              @for (file of service.files(); track file.id) {
                <div class="file-card"
                     [class.existing]="file.isExisting"
                     [class.uploading]="file.status === Status.InProgress"
                     [class.completed]="file.status === Status.Completed"
                     [class.failed]="file.status === Status.Failed"
                     [class.paused]="file.status === Status.Paused"
                     [class.pending]="file.status === Status.Pending">

                  <!-- Preview Area -->
                  <div class="file-preview" (click)="openPreview(file)">
                    @if (isImage(file.type) && file.previewUrl) {
                      <img [src]="file.previewUrl" [alt]="file.name">
                    } @else if (isVideo(file.type) && file.fileGuid) {
                      <div class="video-thumb">
                        <i class="fas fa-play-circle"></i>
                      </div>
                    } @else if (isAudio(file.type)) {
                      <div class="audio-thumb">
                        <i class="fas fa-music"></i>
                      </div>
                    } @else if (isPdf(file.type)) {
                      <div class="pdf-thumb">
                        <i class="fas fa-file-pdf"></i>
                      </div>
                    } @else {
                      <div class="file-icon">
                        <i class="fas fa-file"></i>
                      </div>
                    }

                    <!-- Status Badge -->
                    @switch (file.status) {
                      @case (Status.InProgress) {
                        <div class="file-badge uploading-badge">
                          <span class="progress-text">{{ file.progress }}%</span>
                        </div>
                      }
                      @case (Status.Completed) {
                        <div class="file-badge success-badge">
                          <i class="fas fa-check"></i>
                        </div>
                      }
                      @case (Status.Failed) {
                        <div class="file-badge error-badge">
                          <i class="fas fa-exclamation"></i>
                        </div>
                      }
                      @case (Status.Paused) {
                        <div class="file-badge paused-badge">
                          <i class="fas fa-pause"></i>
                        </div>
                      }
                    }

                    <!-- Existing Badge -->
                    @if (file.isExisting) {
                      <div class="existing-badge">
                        <i class="fas fa-link"></i>
                      </div>
                    }

                    <!-- Preview Icon Overlay -->
                    @if (file.fileGuid && canPreview(file.type)) {
                      <div class="preview-overlay">
                        <i class="fas fa-eye"></i>
                      </div>
                    }
                  </div>

                  <!-- File Info -->
                  <div class="file-info">
                    <span class="file-name" [title]="file.name">{{ truncateName(file.name) }}</span>
                    <span class="file-size">
                      @if (file.status === Status.InProgress) {
                        {{ service.formatFileSize(file.uploadedBytes) }} / {{ service.formatFileSize(file.size) }}
                      } @else {
                        {{ service.formatFileSize(file.size) }}
                      }
                    </span>
                    @if (file.status === Status.InProgress && file.speed > 0) {
                      <span class="file-speed">{{ service.formatSpeed(file.speed) }}</span>
                    }
                    @if (file.status === Status.Failed && file.errorMessage) {
                      <span class="file-error">{{ file.errorMessage }}</span>
                    }
                  </div>

                  <!-- File Actions -->
                  <div class="file-actions">
                    @switch (file.status) {
                      @case (Status.Pending) {
                        <button class="action-btn delete"
                                (click)="removeFile(file.id, $event)"
                                title="حذف">
                          <i class="fas fa-times"></i>
                        </button>
                      }
                      @case (Status.InProgress) {
                        <button class="action-btn pause"
                                (click)="pauseUpload(file.id, $event)"
                                title="توقف">
                          <i class="fas fa-pause"></i>
                        </button>
                      }
                      @case (Status.Paused) {
                        <button class="action-btn resume"
                                (click)="resumeUpload(file.id, $event)"
                                title="ادامه">
                          <i class="fas fa-play"></i>
                        </button>
                        <button class="action-btn delete"
                                (click)="cancelUpload(file.id, $event)"
                                title="لغو">
                          <i class="fas fa-times"></i>
                        </button>
                      }
                      @case (Status.Completed) {
                        @if (file.fileGuid) {
                          <a [href]="service.getDownloadUrl(file.fileGuid)"
                             target="_blank"
                             class="action-btn download"
                             (click)="$event.stopPropagation()"
                             title="دانلود">
                            <i class="fas fa-download"></i>
                          </a>
                        }
                        @if (!disabled) {
                          <button class="action-btn delete"
                                  (click)="deleteFile(file, $event)"
                                  title="حذف">
                            <i class="fas fa-trash"></i>
                          </button>
                        }
                      }
                      @case (Status.Failed) {
                        <button class="action-btn retry"
                                (click)="retryUpload(file.id, $event)"
                                title="تلاش مجدد">
                          <i class="fas fa-redo"></i>
                        </button>
                        <button class="action-btn delete"
                                (click)="removeFile(file.id, $event)"
                                title="حذف">
                          <i class="fas fa-times"></i>
                        </button>
                      }
                    }
                  </div>
                </div>
              }

              <!-- Add More Button -->
              @if (canAddMore() && !disabled) {
                <div class="add-more-card" (click)="openFilePicker(); $event.stopPropagation()">
                  <i class="fas fa-plus"></i>
                  <span>افزودن</span>
                </div>
              }
            </div>
          }

          <input
            #fileInput
            type="file"
            [accept]="acceptedTypes"
            [multiple]="multiple"
            (change)="onFilesSelected($event)"
            hidden>
        </div>

        <!-- Footer (فقط اگر inline و showFooter=true) -->
        @if (hasFiles() && showFooter && presentation === 'inline') {
          <div class="uploader-footer">
            <div class="stats">
              <span class="stat">
                <i class="fas fa-file"></i>
                {{ service.totalFiles() }} فایل
              </span>
              @if (service.isUploading()) {
                <span class="stat uploading">
                  <i class="fas fa-spinner fa-spin"></i>
                  {{ service.totalProgress() }}%
                </span>
              }
            </div>
            <div class="actions">
              @if (service.pendingFiles().length > 0 && !autoUpload) {
                <button class="btn-upload" (click)="startUpload()">
                  <i class="fas fa-upload"></i>
                  شروع آپلود
                </button>
              }
            </div>
          </div>
        }
      </div>

      <!-- Preview Modal -->
      <div class="modal fade" [id]="previewModalId" tabindex="-1" data-bs-backdrop="static">
        <div class="modal-dialog modal-xl modal-dialog-centered">
          <div class="modal-content preview-modal-content">
            <div class="modal-header">
              <div class="preview-header-text">
                <h6 class="modal-title">{{ previewFile()?.name }}</h6>
                <span class="preview-meta">{{ service.formatFileSize(previewFile()?.size || 0) }}</span>
              </div>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body preview-body">
              @if (previewFile(); as file) {
                @if (isImage(file.type)) {
                  <div class="preview-image">
                    <img [src]="getPreviewSrc(file)" [alt]="file.name">
                  </div>
                } @else if (isPdf(file.type)) {
                  <div class="preview-pdf">
                    <iframe [src]="getSafePdfUrl(file)" frameborder="0"></iframe>
                  </div>
                } @else {
                  <div class="preview-unsupported">
                    <h5>{{ file.name }}</h5>
                    <p>این فرمت قابل پیش‌نمایش نیست</p>
                    @if (file.fileGuid) {
                      <a [href]="service.getDownloadUrl(file.fileGuid)" class="btn btn-primary" download>
                        <i class="fas fa-download me-1"></i>
                        دانلود فایل
                      </a>
                    }
                  </div>
                }
              }
            </div>
          </div>
        </div>
      </div>
    </ng-template>
  `,
    styles: [`
    :host {
      display: block;
      direction: rtl;
      font-family: 'Vazirmatn', Tahoma, sans-serif;
    }

    .file-uploader {
      --primary: #3b82f6;
      --primary-light: #eff6ff;
      --success: #10b981;
      --success-light: #d1fae5;
      --danger: #ef4444;
      --danger-light: #fee2e2;
      --warning: #f59e0b;
      --warning-light: #fef3c7;
      --gray-50: #f9fafb;
      --gray-100: #f3f4f6;
      --gray-200: #e5e7eb;
      --gray-300: #d1d5db;
      --gray-400: #9ca3af;
      --gray-500: #6b7280;
      --gray-600: #4b5563;
      --gray-700: #374151;
      --radius: 12px;
      --shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    .file-uploader.disabled {
      opacity: 0.6;
      pointer-events: none;
    }

    .drop-zone {
      border: 2px dashed var(--gray-300);
      border-radius: var(--radius);
      background: var(--gray-50);
      min-height: 160px;
      transition: all 0.2s ease;
      cursor: pointer;
      position: relative;
      overflow: hidden;
    }

    .drop-zone:hover:not(.has-files) {
      border-color: var(--primary);
      background: var(--primary-light);
    }

    .drop-zone.drag-over {
      border-color: var(--primary);
      background: var(--primary-light);
      transform: scale(1.01);
    }

    .drop-zone.has-files {
      border-style: solid;
      border-color: var(--gray-200);
      background: white;
      cursor: default;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 32px 16px;
      text-align: center;
    }

    .icon-wrapper {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: var(--primary-light);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 16px;
    }

    .icon-wrapper i {
      font-size: 28px;
      color: var(--primary);
    }

    .empty-state .title {
      margin: 0 0 4px;
      font-size: 15px;
      font-weight: 600;
      color: var(--gray-700);
    }

    .empty-state .subtitle {
      margin: 0 0 12px;
      font-size: 13px;
      color: var(--gray-400);
    }

    .hints {
      display: flex;
      gap: 16px;
      font-size: 12px;
      color: var(--gray-400);
    }

    .hints span {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .files-container {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 12px;
      padding: 12px;
    }

    .file-card {
      background: var(--gray-50);
      border-radius: 10px;
      overflow: hidden;
      transition: all 0.2s;
      position: relative;
    }

    .file-card:hover {
      box-shadow: var(--shadow);
    }

    .file-card.uploading { background: var(--primary-light); }
    .file-card.completed { background: var(--success-light); }
    .file-card.failed { background: var(--danger-light); }
    .file-card.paused { background: var(--warning-light); }
    .file-card.existing { background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); }

    .file-preview {
      position: relative;
      height: 80px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: white;
      cursor: pointer;
      overflow: hidden;
    }

    .file-preview img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .file-icon { font-size: 32px; }

    .video-thumb, .audio-thumb, .pdf-thumb {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 32px;
    }

    .video-thumb { background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); color: white; }
    .audio-thumb { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; }
    .pdf-thumb { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; }

    .preview-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.2s;
    }

    .preview-overlay i {
      font-size: 24px;
      color: white;
    }

    .file-preview:hover .preview-overlay {
      opacity: 1;
    }

    .file-badge {
      position: absolute;
      bottom: 6px;
      right: 6px;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      color: white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }

    .success-badge { background: var(--success); }
    .error-badge { background: var(--danger); }
    .paused-badge { background: var(--warning); }

    .uploading-badge {
      background: white;
      color: var(--primary);
      font-weight: 600;
    }

    .existing-badge {
      position: absolute;
      top: 6px;
      left: 6px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: var(--primary);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 9px;
    }

    .file-info {
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .file-name {
      font-size: 12px;
      font-weight: 500;
      color: var(--gray-700);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .file-size, .file-speed {
      font-size: 11px;
      color: var(--gray-400);
    }

    .file-speed { color: var(--primary); }
    .file-error { font-size: 10px; color: var(--danger); }

    .file-actions {
      position: absolute;
      top: 4px;
      left: 4px;
      display: flex;
      gap: 4px;
      opacity: 0;
      transition: opacity 0.2s;
    }

    .file-card:hover .file-actions {
      opacity: 1;
    }

    .action-btn {
      width: 26px;
      height: 26px;
      border: none;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 11px;
      transition: all 0.2s;
      text-decoration: none;
    }

    .action-btn.download { background: var(--primary); color: white; }
    .action-btn.delete { background: var(--danger); color: white; }
    .action-btn.pause { background: var(--warning); color: white; }
    .action-btn.resume, .action-btn.retry { background: var(--success); color: white; }
    .action-btn:hover { transform: scale(1.1); }

    .add-more-card {
      border: 2px dashed var(--gray-300);
      border-radius: 10px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      min-height: 80px;
      cursor: pointer;
      transition: all 0.2s;
      color: var(--gray-400);
    }

    .add-more-card:hover {
      border-color: var(--primary);
      color: var(--primary);
      background: var(--primary-light);
    }

    .add-more-card i { font-size: 20px; }
    .add-more-card span { font-size: 12px; }

    .uploader-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 0 0;
      border-top: 1px solid var(--gray-200);
      margin-top: 12px;
    }

    .stats {
      display: flex;
      gap: 16px;
    }

    .stat {
      font-size: 13px;
      color: var(--gray-500);
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .stat.uploading { color: var(--primary); }

    .btn-upload {
      padding: 8px 16px;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      background: var(--primary);
      color: white;
      transition: all 0.2s;
    }

    .btn-upload:hover { background: #2563eb; }

    .preview-modal-content {
      background: #1e293b;
      border: none;
    }

    .preview-body {
      padding: 0;
      min-height: 60vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .preview-image img {
      max-width: 100%;
      max-height: 70vh;
      object-fit: contain;
      border-radius: 8px;
    }

    .preview-pdf iframe {
      width: 100%;
      height: 75vh;
      border: none;
      background: white;
    }

    .preview-unsupported {
      text-align: center;
      color: white;
    }
  `]
})
export class FileManagerComponent implements OnInit, OnDestroy, OnChanges {

    // حالت استفاده: داخل صفحه یا مودال
    @Input() presentation: 'inline' | 'modal' = 'inline';
    @Input() modalId = 'fileManagerModal';
    @Input() title = 'مدیریت فایل‌ها';
    @Input() size: 'normal' | 'large' | 'xlarge' = 'large';
    @Input() confirmOnClose = true;

    // تنظیمات آپلود
    @Input() folderPath = '';
    @Input() existingFileGuids: string[] = [];
    @Input() multiple = true;
    @Input() maxFiles = 10;
    @Input() maxFileSizeMB = 100;
    @Input() acceptedTypes = '*';
    @Input() autoUpload = true;
    @Input() disabled = false;
    @Input() mode: 'normal' | 'compact' = 'normal';
    @Input() showFooter = true;
    @Input() confirmDelete = true;

    // خروجی‌ها
    @Output() confirmed = new EventEmitter<string[]>();     // فقط در حالت مودال مهم است
    @Output() cancelled = new EventEmitter<void>();
    @Output() filesChanged = new EventEmitter<string[]>();
    @Output() fileUploaded = new EventEmitter<FileItem>();
    @Output() fileDeleted = new EventEmitter<string>();
    @Output() allUploadsComplete = new EventEmitter<string[]>();

    readonly service = inject(TusUploadService);
    private readonly sanitizer = inject(DomSanitizer);
    readonly Status = UploadStatus;

    readonly isDragOver = signal(false);
    readonly previewFile = signal<FileItem | null>(null);
    readonly currentPreviewIndex = signal(0);
    readonly previewModalId = 'filePreviewModal_' + Math.random().toString(36).substr(2, 9);

    readonly hasFiles = computed(() => this.service.files().length > 0);
    readonly canAddMore = computed(() => {
        if (!this.multiple && this.service.totalFiles() > 0) return false;
        if (this.maxFiles && this.service.totalFiles() >= this.maxFiles) return false;
        return true;
    });

    private previewModalInstance: any;
    private modalInstance: any;
    private initialFileGuids: string[] = [];

    constructor() {
        this.service.fileCompleted$.subscribe((file: FileItem) => {
            this.fileUploaded.emit(file);
            this.emitFilesChanged();
        });

        this.service.allCompleted$.subscribe(() => {
            this.allUploadsComplete.emit(this.service.getAllFileGuids());
        });
    }

    ngOnInit(): void {
        this.initialFileGuids = [...(this.existingFileGuids ?? [])];
        if (this.existingFileGuids?.length > 0) {
            this.service.loadExistingFiles(this.existingFileGuids);
        }
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['existingFileGuids'] && !changes['existingFileGuids'].firstChange) {
            this.service.clearAll();
            if (this.existingFileGuids?.length > 0) {
                this.service.loadExistingFiles(this.existingFileGuids);
            }
        }
    }

    ngOnDestroy(): void {
        this.previewModalInstance?.dispose();
        this.modalInstance?.dispose();
    }

    // ===================== مودال =====================

    open(): void {
        if (this.presentation !== 'modal') return;
        this.initialFileGuids = [...this.service.getAllFileGuids()];
        const el = document.getElementById(this.modalId);
        if (el) {
            this.modalInstance = new bootstrap.Modal(el);
            this.modalInstance.show();
        }
    }

    close(): void {
        this.modalInstance?.hide();
    }

    async onModalCloseClick(): Promise<void> {
        if (this.presentation !== 'modal') {
            return;
        }

        // اگر فایل pending داریم
        if (this.confirmOnClose && this.service.pendingFiles().length > 0 && Swal) {
            const result = await Swal.fire({
                title: 'فایل‌های آپلود نشده',
                text: 'برخی فایل‌ها هنوز آپلود نشده‌اند. آیا مطمئن هستید؟',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'بله، خارج شو',
                cancelButtonText: 'انصراف'
            });
            if (!result.isConfirmed) return;
        }

        const currentGuids = this.service.getAllFileGuids().slice().sort();
        const initial = this.initialFileGuids.slice().sort();
        const hasChanges = JSON.stringify(currentGuids) !== JSON.stringify(initial);

        if (hasChanges && this.confirmOnClose && Swal) {
            const result = await Swal.fire({
                title: 'تغییرات ذخیره نشده',
                text: 'تغییراتی در فایل‌ها ایجاد شده. آیا می‌خواهید بدون ذخیره خارج شوید؟',
                icon: 'question',
                showCancelButton: true,
                showDenyButton: true,
                confirmButtonText: 'ذخیره و خروج',
                denyButtonText: 'خروج بدون ذخیره',
                cancelButtonText: 'انصراف'
            });

            if (result.isConfirmed) {
                this.confirm();
                return;
            } else if (result.isDenied) {
                await this.cleanup();
                this.cancelled.emit();
                this.close();
                return;
            } else {
                return;
            }
        }

        this.cancelled.emit();
        this.close();
    }

    confirm(): void {
        if (this.service.isUploading()) {
            if (Swal) {
                Swal.fire({
                    icon: 'warning',
                    title: 'صبر کنید',
                    text: 'آپلود فایل‌ها هنوز تمام نشده است.'
                });
            }
            return;
        }

        const fileGuids = this.service.getAllFileGuids();
        this.confirmed.emit(fileGuids);
        if (this.presentation === 'modal') {
            this.close();
        }
    }

    // ===================== Drag & Drop =====================

    onDragOver(event: DragEvent): void {
        event.preventDefault();
        event.stopPropagation();
        if (!this.disabled) this.isDragOver.set(true);
    }

    onDragLeave(event: DragEvent): void {
        event.preventDefault();
        event.stopPropagation();
        this.isDragOver.set(false);
    }

    onDrop(event: DragEvent): void {
        event.preventDefault();
        event.stopPropagation();
        this.isDragOver.set(false);

        if (this.disabled) return;
        const files = event.dataTransfer?.files;
        if (files && files.length > 0) {
            this.handleFiles(files);
        }
    }

    // ===================== انتخاب فایل =====================

    openFilePicker(): void {
        if (this.disabled || !this.canAddMore()) return;
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = this.acceptedTypes;
        input.multiple = this.multiple;
        input.onchange = (e: any) => {
            const files = e.target?.files as FileList;
            if (files) this.handleFiles(files);
        };
        input.click();
    }

    onFilesSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        if (input.files) {
            this.handleFiles(input.files);
            input.value = '';
        }
    }

    private handleFiles(fileList: FileList): void {
        const added = this.service.addFiles(fileList, {
            maxFiles: this.maxFiles,
            maxSizeMB: this.maxFileSizeMB,
            acceptedTypes: this.acceptedTypes ? this.acceptedTypes.split(',') : undefined
        });

        if (added.length === 0) {
            if (Swal) {
                Swal.fire({
                    icon: 'warning',
                    title: 'توجه',
                    text: 'فایلی اضافه نشد. لطفاً محدودیت‌ها را بررسی کنید.',
                    confirmButtonText: 'متوجه شدم'
                });
            }
            return;
        }

        if (this.autoUpload) {
            this.startUpload();
        }
    }

    // ===================== اکشن‌های آپلود =====================

    startUpload(): void {
        this.service.uploadAll({ folderPath: this.folderPath });
    }

    pauseUpload(id: string, event: Event): void {
        event.stopPropagation();
        this.service.pauseUpload(id);
    }

    resumeUpload(id: string, event: Event): void {
        event.stopPropagation();
        this.service.resumeUpload(id);
    }

    retryUpload(id: string, event: Event): void {
        event.stopPropagation();
        this.service.retryUpload(id, { folderPath: this.folderPath });
    }

    cancelUpload(id: string, event: Event): void {
        event.stopPropagation();
        this.service.cancelUpload(id);
    }

    removeFile(id: string, event: Event): void {
        event.stopPropagation();
        this.service.removeFile(id);
        this.emitFilesChanged();
    }

    async deleteFile(file: FileItem, event: Event): Promise<void> {
        event.stopPropagation();

        if (this.confirmDelete && Swal) {
            const result = await Swal.fire({
                title: 'حذف فایل',
                text: 'آیا از حذف این فایل اطمینان دارید؟',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'بله، حذف شود',
                cancelButtonText: 'انصراف',
                confirmButtonColor: '#ef4444'
            });

            if (!result.isConfirmed) return;
        }

        const success = await this.service.deleteFile(file.id);
        if (success) {
            if (file.fileGuid) this.fileDeleted.emit(file.fileGuid);
            this.emitFilesChanged();
        } else if (Swal) {
            Swal.fire({
                icon: 'error',
                title: 'خطا',
                text: 'خطا در حذف فایل'
            });
        }
    }

    // ===================== پیش‌نمایش =====================

    openPreview(file: FileItem): void {
        if (!file.fileGuid && !file.previewUrl) return;
        if (!this.canPreview(file.type) && !file.previewUrl) return;

        this.previewFile.set(file);
        this.currentPreviewIndex.set(this.service.files().indexOf(file));

        const modalElement = document.getElementById(this.previewModalId);
        if (modalElement) {
            this.previewModalInstance = new bootstrap.Modal(modalElement);
            this.previewModalInstance.show();
        }
    }

    getPreviewSrc(file: FileItem): string {
        if (file.fileGuid) {
            return this.service.getPreviewUrl(file.fileGuid);
        }
        return file.previewUrl || '';
    }

    getSafePdfUrl(file: FileItem): SafeResourceUrl {
        const url = this.getPreviewSrc(file);
        return this.sanitizer.bypassSecurityTrustResourceUrl(url);
    }

    // ===================== Helper =====================

    canPreview(type: string): boolean {
        return this.isImage(type) || this.isVideo(type) || this.isAudio(type) || this.isPdf(type);
    }

    isImage(type: string): boolean {
        return type?.startsWith('image/') || false;
    }

    isVideo(type: string): boolean {
        return type?.startsWith('video/') || false;
    }

    isAudio(type: string): boolean {
        return type?.startsWith('audio/') || false;
    }

    isPdf(type: string): boolean {
        return type === 'application/pdf';
    }

    truncateName(name: string, maxLength = 15): string {
        if (!name || name.length <= maxLength) return name || '';
        const ext = name.split('.').pop() || '';
        const base = name.slice(0, maxLength - ext.length - 4);
        return `${base}...${ext}`;
    }

    private emitFilesChanged(): void {
        this.filesChanged.emit(this.service.getAllFileGuids());
    }

    getFileGuids(): string[] {
        return this.service.getAllFileGuids();
    }

    async cleanup(): Promise<void> {
        await this.service.cleanupUploadedFiles();
    }

    reset(): void {
        this.service.clearAll();
    }
}
