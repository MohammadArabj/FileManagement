import {
    Component, Input, Output, EventEmitter, inject, ViewChild,
    OnInit, OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TusUploadService, FileItem } from '../../services/framework-services/tus-upload.service';
import { FileUploaderComponent } from './file-uploader.component';

declare var bootstrap: any;
declare var Swal: any;

@Component({
    selector: 'app-file-uploader-modal',
    standalone: true,
    imports: [CommonModule, FileUploaderComponent],
    template: `
    <div class="modal fade" [id]="modalId" tabindex="-1" data-bs-backdrop="static">
      <div class="modal-dialog" [class.modal-lg]="size === 'large'" [class.modal-xl]="size === 'xlarge'">
        <div class="modal-content">

          <div class="modal-header">
            <h5 class="modal-title">
              <i class="fas fa-paperclip me-2"></i>
              {{ title }}
            </h5>
            <button type="button" class="btn-close" (click)="onClose()"></button>
          </div>

          <div class="modal-body">
            <app-file-uploader
              #uploader
              [folderPath]="folderPath"
              [existingFileGuids]="existingFileGuids"
              [multiple]="multiple"
              [maxFiles]="maxFiles"
              [maxFileSizeMB]="maxFileSizeMB"
              [acceptedTypes]="acceptedTypes"
              [autoUpload]="autoUpload"
              [mode]="mode"
              [showFooter]="false"
              [confirmDelete]="confirmDelete"
              (filesChanged)="onFilesChanged($event)"
              (fileUploaded)="onFileUploaded($event)"
              (fileDeleted)="onFileDeleted($event)">
            </app-file-uploader>
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
              <button type="button" class="btn btn-outline-secondary" (click)="onClose()">
                <i class="fas fa-times me-1"></i>
                بستن
              </button>
              <button type="button" class="btn btn-primary"
                      [disabled]="service.isUploading()"
                      (click)="onConfirm()">
                <i class="fas fa-check me-1"></i>
                تأیید
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  `,
    styles: [`
    :host {
      direction: rtl;
    }

    .modal-header {
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      border-bottom: 1px solid #e2e8f0;
    }

    .modal-title {
      font-weight: 600;
      color: #334155;
    }

    .modal-body {
      padding: 16px;
      max-height: 60vh;
      overflow-y: auto;
    }

    .modal-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
    }

    .footer-info {
      font-size: 13px;
      color: #64748b;
    }

    .uploading-text {
      color: #3b82f6;
    }

    .footer-actions {
      display: flex;
      gap: 8px;
    }

    .btn {
      display: flex;
      align-items: center;
      gap: 6px;
    }
  `]
})
export class FileUploaderModalComponent implements OnInit, OnDestroy {
    // Inputs
    @Input() modalId = 'fileUploaderModal';
    @Input() title = 'مدیریت فایل‌ها';
    @Input() size: 'normal' | 'large' | 'xlarge' = 'large';
    @Input() folderPath = '';
    @Input() existingFileGuids: string[] = [];
    @Input() multiple = true;
    @Input() maxFiles = 10;
    @Input() maxFileSizeMB = 100;
    @Input() acceptedTypes = '*';
    @Input() autoUpload = true;
    @Input() mode: 'normal' | 'compact' = 'normal';
    @Input() confirmDelete = true;
    @Input() confirmOnClose = true;

    // Outputs
    @Output() confirmed = new EventEmitter<string[]>();
    @Output() cancelled = new EventEmitter<void>();
    @Output() filesChanged = new EventEmitter<string[]>();
    @Output() fileUploaded = new EventEmitter<FileItem>();
    @Output() fileDeleted = new EventEmitter<string>();

    @ViewChild('uploader') uploader!: FileUploaderComponent;

    readonly service = inject(TusUploadService);
    private modalInstance: any;
    private initialFileGuids: string[] = [];

    ngOnInit(): void {
        this.initialFileGuids = [...this.existingFileGuids];
    }

    ngOnDestroy(): void {
        this.modalInstance?.dispose();
    }

    // ============================================
    // Public API
    // ============================================

    open(): void {
        // ذخیره وضعیت اولیه
        this.initialFileGuids = [...this.existingFileGuids];

        const modalElement = document.getElementById(this.modalId);
        if (modalElement) {
            this.modalInstance = new bootstrap.Modal(modalElement);
            this.modalInstance.show();
        }
    }

    close(): void {
        this.modalInstance?.hide();
    }

    // ============================================
    // Event Handlers
    // ============================================

    async onClose(): Promise<void> {
        // بررسی فایل‌های pending
        if (this.confirmOnClose && this.service.pendingFiles().length > 0) {
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

        // بررسی تغییرات
        const currentGuids = this.service.getAllFileGuids();
        const hasChanges = JSON.stringify(currentGuids.sort()) !== JSON.stringify(this.initialFileGuids.sort());

        if (hasChanges && this.confirmOnClose) {
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
                this.onConfirm();
                return;
            } else if (result.isDenied) {
                // حذف فایل‌های جدید آپلود شده
                await this.uploader.cleanup();
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

    onConfirm(): void {
        if (this.service.isUploading()) {
            Swal.fire({
                icon: 'warning',
                title: 'صبر کنید',
                text: 'آپلود فایل‌ها هنوز تمام نشده است.'
            });
            return;
        }

        const fileGuids = this.service.getAllFileGuids();
        this.confirmed.emit(fileGuids);
        this.close();
    }

    onFilesChanged(guids: string[]): void {
        this.filesChanged.emit(guids);
    }

    onFileUploaded(file: FileItem): void {
        this.fileUploaded.emit(file);
    }

    onFileDeleted(guid: string): void {
        this.fileDeleted.emit(guid);
    }

    // ============================================
    // Helper
    // ============================================

    getFileGuids(): string[] {
        return this.service.getAllFileGuids();
    }
}
