import {
    Component, Input, Output, EventEmitter, inject, signal, computed,
    OnInit, OnDestroy, OnChanges, SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { TusUploadService, UploadStatus, FileItem } from '../../services/framework-services/tus-upload.service';

declare var Swal: any;
declare var bootstrap: any;

@Component({
    selector: 'app-file-uploader',
    standalone: true,
    imports: [CommonModule],
    template: `
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

                <!-- Preview Area - کلیک برای نمایش بزرگ -->
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
                    <div class="file-icon" [style.color]="service.getFileColor(file.type)">
                      <i class="fas {{ service.getFileIcon(file.type) }}"></i>
                    </div>
                  }

                  <!-- Status Badge -->
                  @switch (file.status) {
                    @case (Status.InProgress) {
                      <div class="file-badge uploading-badge">
                        <svg class="progress-ring" viewBox="0 0 36 36">
                          <circle class="bg" cx="18" cy="18" r="15.5"/>
                          <circle class="progress" cx="18" cy="18" r="15.5"
                            [style.stroke-dasharray]="'97.4'"
                            [style.stroke-dashoffset]="97.4 - (97.4 * file.progress / 100)"/>
                        </svg>
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

      <!-- Footer -->
      @if (hasFiles() && showFooter) {
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

    <!-- ✅ Preview Modal -->
    <div class="modal fade" [id]="previewModalId" tabindex="-1" data-bs-backdrop="static">
      <div class="modal-dialog modal-xl modal-dialog-centered">
        <div class="modal-content preview-modal-content">

          <!-- Header -->
          <div class="modal-header">
            <div class="preview-header-info">
              <i class="fas {{ service.getFileIcon(previewFile()?.type || '') }}"
                 [style.color]="service.getFileColor(previewFile()?.type || '')"></i>
              <div class="preview-header-text">
                <h6 class="modal-title">{{ previewFile()?.name }}</h6>
                <span class="preview-meta">{{ service.formatFileSize(previewFile()?.size || 0) }}</span>
              </div>
            </div>
            <div class="preview-header-actions">
              @if (previewFile()?.fileGuid) {
                <a [href]="service.getDownloadUrl(previewFile()!.fileGuid!)"
                   class="btn btn-sm btn-outline-light me-2"
                   download
                   title="دانلود">
                  <i class="fas fa-download"></i>
                </a>
              }
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
          </div>

          <!-- Body -->
          <div class="modal-body preview-body">
            @if (previewFile(); as file) {
              @switch (service.getPreviewType(file.type)) {
                @case ('image') {
                  <div class="preview-image">
                    <img [src]="getPreviewSrc(file)" [alt]="file.name">
                  </div>
                }
                @case ('video') {
                  <div class="preview-video">
                    <video controls autoplay [src]="getPreviewSrc(file)">
                      مرورگر شما از پخش ویدئو پشتیبانی نمی‌کند.
                    </video>
                  </div>
                }
                @case ('audio') {
                  <div class="preview-audio">
                    <div class="audio-icon-large">
                      <i class="fas fa-music"></i>
                    </div>
                    <p class="audio-name">{{ file.name }}</p>
                    <audio controls autoplay [src]="getPreviewSrc(file)">
                      مرورگر شما از پخش صوت پشتیبانی نمی‌کند.
                    </audio>
                  </div>
                }
                @case ('pdf') {
                  <div class="preview-pdf">
                    <iframe [src]="getSafePdfUrl(file)" frameborder="0"></iframe>
                  </div>
                }
                @default {
                  <div class="preview-unsupported">
                    <div class="unsupported-icon">
                      <i class="fas {{ service.getFileIcon(file.type) }}"
                         [style.color]="service.getFileColor(file.type)"></i>
                    </div>
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
            }
          </div>

          <!-- Footer Navigation -->
          @if (service.files().length > 1) {
            <div class="modal-footer preview-footer">
              <button class="btn btn-outline-light"
                      [disabled]="!canGoPrevious()"
                      (click)="showPreviousFile()">
                <i class="fas fa-chevron-right me-1"></i>
                قبلی
              </button>
              <span class="preview-counter">
                {{ currentPreviewIndex() + 1 }} از {{ service.files().length }}
              </span>
              <button class="btn btn-outline-light"
                      [disabled]="!canGoNext()"
                      (click)="showNextFile()">
                بعدی
                <i class="fas fa-chevron-left ms-1"></i>
              </button>
            </div>
          }

        </div>
      </div>
    </div>
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

    /* Drop Zone */
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

    /* Empty State */
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

    /* Files Container */
    .files-container {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 12px;
      padding: 12px;
    }

    .compact .files-container {
      grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
      gap: 8px;
      padding: 8px;
    }

    /* File Card */
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

    /* File Preview */
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

    .compact .file-preview { height: 60px; }

    .file-preview img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .file-icon { font-size: 32px; }
    .compact .file-icon { font-size: 24px; }

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

    /* Preview Overlay */
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

    /* Badges */
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
      width: 36px;
      height: 36px;
      background: white;
      position: relative;
    }

    .progress-ring {
      position: absolute;
      width: 100%;
      height: 100%;
      transform: rotate(-90deg);
    }

    .progress-ring .bg {
      fill: none;
      stroke: var(--gray-200);
      stroke-width: 3;
    }

    .progress-ring .progress {
      fill: none;
      stroke: var(--primary);
      stroke-width: 3;
      stroke-linecap: round;
      transition: stroke-dashoffset 0.3s;
    }

    .progress-text {
      font-size: 8px;
      font-weight: 700;
      color: var(--primary);
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

    /* File Info */
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

    /* File Actions */
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

    /* Add More Card */
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

    /* Footer */
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

    /* ========================================
       Preview Modal Styles
       ======================================== */

    .preview-modal-content {
      background: #1e293b;
      border: none;
    }

    .preview-modal-content .modal-header {
      background: rgba(0,0,0,0.3);
      border-bottom: 1px solid rgba(255,255,255,0.1);
      padding: 12px 16px;
    }

    .preview-header-info {
      display: flex;
      align-items: center;
      gap: 12px;
      color: white;
    }

    .preview-header-info > i { font-size: 24px; }

    .preview-header-text {
      display: flex;
      flex-direction: column;
    }

    .preview-modal-content .modal-title {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
      color: white;
    }

    .preview-meta {
      font-size: 12px;
      color: rgba(255,255,255,0.6);
    }

    .preview-header-actions {
      display: flex;
      align-items: center;
    }

    .preview-body {
      padding: 0;
      min-height: 60vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* Image Preview */
    .preview-image {
      max-height: 75vh;
      padding: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .preview-image img {
      max-width: 100%;
      max-height: 70vh;
      object-fit: contain;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    }

    /* Video Preview */
    .preview-video {
      width: 100%;
      padding: 16px;
    }

    .preview-video video {
      width: 100%;
      max-height: 70vh;
      border-radius: 8px;
    }

    /* Audio Preview */
    .preview-audio {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 40px;
      text-align: center;
      color: white;
    }

    .audio-icon-large {
      width: 120px;
      height: 120px;
      border-radius: 50%;
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;
    }

    .audio-icon-large i {
      font-size: 48px;
      color: white;
    }

    .audio-name {
      font-size: 16px;
      margin-bottom: 20px;
      max-width: 300px;
      word-break: break-word;
    }

    .preview-audio audio {
      width: 100%;
      max-width: 400px;
    }

    /* PDF Preview */
    .preview-pdf {
      width: 100%;
      height: 75vh;
    }

    .preview-pdf iframe {
      width: 100%;
      height: 100%;
      border: none;
    }

    /* Unsupported */
    .preview-unsupported {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px;
      text-align: center;
      color: white;
    }

    .unsupported-icon {
      width: 120px;
      height: 120px;
      border-radius: 20px;
      background: rgba(255,255,255,0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;
    }

    .unsupported-icon i { font-size: 48px; }
    .preview-unsupported h5 { margin-bottom: 8px; }
    .preview-unsupported p { margin-bottom: 20px; color: rgba(255,255,255,0.6); }

    /* Footer */
    .preview-footer {
      background: rgba(0,0,0,0.3);
      border-top: 1px solid rgba(255,255,255,0.1);
      justify-content: space-between;
    }

    .preview-counter {
      font-size: 13px;
      color: rgba(255,255,255,0.6);
    }

    /* Compact Mode */
    .compact .empty-state { padding: 20px 12px; }
    .compact .icon-wrapper { width: 48px; height: 48px; margin-bottom: 12px; }
    .compact .icon-wrapper i { font-size: 20px; }
    .compact .empty-state .title { font-size: 13px; }
    .compact .empty-state .subtitle { font-size: 11px; }
    .compact .file-info { padding: 6px; }
    .compact .file-name { font-size: 11px; }
    .compact .file-size { font-size: 10px; }

    @media (max-width: 576px) {
      .files-container { grid-template-columns: repeat(2, 1fr); }
    }
  `]
})
export class FileUploaderComponent implements OnInit, OnDestroy, OnChanges {
    // Inputs
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
    @Input() previewModalId = 'filePreviewModal_' + Math.random().toString(36).substr(2, 9);

    // Outputs
    @Output() filesChanged = new EventEmitter<string[]>();
    @Output() fileUploaded = new EventEmitter<FileItem>();
    @Output() fileDeleted = new EventEmitter<string>();
    @Output() allUploadsComplete = new EventEmitter<string[]>();

    // Service
    readonly service = inject(TusUploadService);
    private readonly sanitizer = inject(DomSanitizer);
    readonly Status = UploadStatus;

    // State
    readonly isDragOver = signal(false);
    readonly previewFile = signal<FileItem | null>(null);
    readonly currentPreviewIndex = signal(0);

    private previewModalInstance: any;

    readonly hasFiles = computed(() => this.service.files().length > 0);

    readonly canAddMore = computed(() => {
        if (!this.multiple && this.service.totalFiles() > 0) return false;
        if (this.maxFiles && this.service.totalFiles() >= this.maxFiles) return false;
        return true;
    });

    constructor() {
        this.service.fileCompleted$.subscribe((file: any) => {
            this.fileUploaded.emit(file);
            this.emitFilesChanged();
        });

        this.service.allCompleted$.subscribe(() => {
            this.allUploadsComplete.emit(this.service.getAllFileGuids());
        });
    }

    ngOnInit(): void {
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
    }

    // ============================================
    // Drag & Drop
    // ============================================

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

    // ============================================
    // File Selection
    // ============================================

    openFilePicker(): void {
        if (this.disabled || !this.canAddMore()) return;
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = this.acceptedTypes;
        input.multiple = this.multiple;
        input.onchange = (e: any) => {
            const files = e.target?.files;
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
            Swal.fire({
                icon: 'warning',
                title: 'توجه',
                text: 'فایلی اضافه نشد. لطفاً محدودیت‌ها را بررسی کنید.',
                confirmButtonText: 'متوجه شدم'
            });
            return;
        }

        if (this.autoUpload) {
            this.startUpload();
        }
    }

    // ============================================
    // Upload Actions
    // ============================================

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

        if (this.confirmDelete) {
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
        } else {
            Swal.fire({
                icon: 'error',
                title: 'خطا',
                text: 'خطا در حذف فایل'
            });
        }
    }

    // ============================================
    // Preview Modal
    // ============================================

    async openPreview(file: FileItem): Promise<void> {
        if (!file.fileGuid && !file.previewUrl) return;
        if (!this.canPreview(file.type) && !file.previewUrl) return;

        const readyFile = await this.ensurePreviewReady(file);

        this.previewFile.set(readyFile);
        this.currentPreviewIndex.set(this.service.files().indexOf(file));

        const modalElement = document.getElementById(this.previewModalId);
        if (modalElement) {
            this.previewModalInstance = new bootstrap.Modal(modalElement);
            this.previewModalInstance.show();
        }
    }

    closePreview(): void {
        this.previewModalInstance?.hide();
        this.previewFile.set(null);
    }

    showPreviousFile(): void {
        const index = this.currentPreviewIndex();
        if (index > 0) {
            this.currentPreviewIndex.set(index - 1);
            const file = this.service.files()[index - 1];
            this.previewFile.set(file);
            void this.ensurePreviewReady(file);
        }
    }

    showNextFile(): void {
        const index = this.currentPreviewIndex();
        const files = this.service.files();
        if (index < files.length - 1) {
            this.currentPreviewIndex.set(index + 1);
            const file = files[index + 1];
            this.previewFile.set(file);
            void this.ensurePreviewReady(file);
        }
    }

    canGoPrevious(): boolean {
        return this.currentPreviewIndex() > 0;
    }

    canGoNext(): boolean {
        return this.currentPreviewIndex() < this.service.files().length - 1;
    }

    getPreviewSrc(file: FileItem): string {
        return file.previewUrl || '';
    }

    getSafePdfUrl(file: FileItem): SafeResourceUrl {
        const url = this.getPreviewSrc(file);
        return this.sanitizer.bypassSecurityTrustResourceUrl(url);
    }

    // ============================================
    // Helper Methods
    // ============================================

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

    private async ensurePreviewReady(file: FileItem): Promise<FileItem> {
        if (file.previewUrl || !file.fileGuid) return file;

        const resolved = await this.service.resolveAuthorizedPreview(file.fileGuid, file.id);
        if (resolved) {
            const readyFile = { ...file, previewUrl: resolved };
            this.previewFile.set(readyFile);
            return readyFile;
        }

        return file;
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

    // ============================================
    // Public API
    // ============================================

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