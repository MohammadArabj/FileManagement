import {
    Component,
    Input,
    Output,
    EventEmitter,
    inject,
    signal,
    computed,
    OnInit,
    OnDestroy,
    ViewChild,
    ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { TusUploadService, UploadStatus, FileItem } from '../../services/framework-services/tus-upload.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

declare const Swal: any;
declare const bootstrap: any;

type ViewMode = 'grid' | 'list';
@Component({
    selector: 'app-file-manager-modal',
    standalone: true,
    imports: [CommonModule],
    template: `
    <!-- Main Modal -->
    <div class="modal fade" [id]="modalId" tabindex="-1" data-bs-backdrop="static">
      <div class="modal-dialog modal-xl modal-fullscreen-lg-down">
        <div class="modal-content">
          <!-- Header -->
          <div class="modal-header">
            <div class="header-right">
              <div class="header-icon">
                <i class="fas fa-folder-open"></i>
              </div>
              <div class="header-text">
                <h5 class="modal-title">{{ title }}</h5>
                <span class="file-count">{{ service.totalFiles() }} فایل</span>
              </div>
            </div>

            <div class="header-actions">
              <div class="view-toggle" title="تغییر نمای فایل ها">
                <button
                  class="view-btn"
                  [class.active]="viewMode() === 'grid'"
                  (click)="viewMode.set('grid')"
                  type="button">
                  <i class="fas fa-th-large"></i>
                </button>
                <button
                  class="view-btn"
                  [class.active]="viewMode() === 'list'"
                  (click)="viewMode.set('list')"
                  type="button">
                  <i class="fas fa-list"></i>
                </button>
              </div>

              @if (service.isUploading()) {
                <div class="upload-indicator">
                  <div class="spinner-border spinner-border-sm text-white"></div>
                  <span>{{ service.totalProgress() }}%</span>
                </div>
              }

              <button type="button" class="btn-close" (click)="onClose()"></button>
            </div>
          </div>

          <!-- Body -->
          <div class="modal-body">
            <div class="body-shell" [class.preview-open]="showPreview() && selectedFile()">
              <div
                class="file-area"
                [class.drag-over]="isDragOver()"
                [class.has-files]="hasFiles()"
                (dragover)="onDragOver($event)"
                (dragleave)="onDragLeave($event)"
                (drop)="onDrop($event)">

                @if (!hasFiles()) {
                  <div class="empty-state" (click)="openFilePicker()">
                    <div class="empty-icon">
                      <i class="fas fa-cloud-upload-alt"></i>
                    </div>
                    <h6>فایل‌ها را بکشید و اینجا رها کنید</h6>
                    <p>یا کلیک کنید تا فایل انتخاب کنید</p>
                    <div class="upload-limits">
                      @if (maxFileSizeMB) {
                        <span><i class="fas fa-weight-hanging"></i> حداکثر {{ maxFileSizeMB }} مگابایت</span>
                      }
                      @if (maxFiles && multiple) {
                        <span><i class="fas fa-layer-group"></i> حداکثر {{ maxFiles }} فایل</span>
                      }
                    </div>
                    <button class="btn btn-light mt-2 shadow-sm">
                      <i class="fas fa-plus ms-2"></i>
                      انتخاب فایل
                    </button>
                  </div>
                } @else {
                  <div class="files-wrapper">
                    @if (viewMode() === 'grid') {
                      <div class="files-grid">
                        @for (file of service.files(); track file.id) {
                          <div
                            class="file-card"
                            [class.selected]="selectedFile()?.id === file.id"
                            [class.uploading]="file.status === Status.InProgress"
                            [class.completed]="file.status === Status.Completed"
                            [class.failed]="file.status === Status.Failed"
                            (click)="selectFile(file)">

                            <div class="file-thumb" (click)="togglePreview(file, $event)">
                              @if (isImage(file.type) && file.previewUrl) {
                                <img [src]="file.previewUrl" [alt]="file.name" />
                              } @else if (isVideo(file.type)) {
                                <div class="file-icon-wrapper video">
                                  <i class="fas fa-play"></i>
                                </div>
                              } @else if (isAudio(file.type)) {
                                <div class="file-icon-wrapper audio">
                                  <i class="fas fa-music"></i>
                                </div>
                              } @else if (isPdf(file.type)) {
                                <div class="file-icon-wrapper pdf">
                                  <i class="fas fa-file-pdf"></i>
                                </div>
                              } @else {
                                <div class="file-icon-wrapper" [style.color]="service.getFileColor(file.type)">
                                  <i class="fas {{ service.getFileIcon(file.type) }}"></i>
                                </div>
                              }

                              <div class="preview-overlay">
                                <i class="fas fa-eye"></i>
                              </div>

                              @if (file.status === Status.InProgress) {
                                <div class="status-badge uploading">
                                  <div class="progress-circle">
                                    <svg viewBox="0 0 36 36">
                                      <circle class="bg" cx="18" cy="18" r="15.5" />
                                      <circle
                                        class="progress"
                                        cx="18"
                                        cy="18"
                                        r="15.5"
                                        [style.stroke-dasharray]="'97.4'"
                                        [style.stroke-dashoffset]="97.4 - (97.4 * file.progress / 100)" />
                                    </svg>
                                    <span>{{ file.progress }}%</span>
                                  </div>
                                </div>
                              } @else if (file.status === Status.Completed) {
                                <div class="status-badge success">
                                  <i class="fas fa-check"></i>
                                </div>
                              } @else if (file.status === Status.Failed) {
                                <div class="status-badge error">
                                  <i class="fas fa-exclamation"></i>
                                </div>
                              }

                              @if (file.isExisting) {
                                <div class="existing-badge">
                                  <i class="fas fa-link"></i>
                                </div>
                              }
                            </div>

                            <div class="file-info">
                              <div class="file-name" [title]="file.name">{{ file.name }}</div>
                              <div class="file-meta">
                                <span>{{ service.formatFileSize(file.size) }}</span>
                                @if (file.status === Status.InProgress && file.speed > 0) {
                                  <span class="file-speed">{{ service.formatSpeed(file.speed) }}</span>
                                }
                              </div>
                              @if (file.errorMessage) {
                                <div class="file-error">{{ file.errorMessage }}</div>
                              }
                            </div>

                            <div class="file-actions" (click)="$event.stopPropagation()">
                              @switch (file.status) {
                                @case (Status.Pending) {
                                  <button class="action-btn" (click)="removeFile(file.id)" title="حذف">
                                    <i class="fas fa-times"></i>
                                  </button>
                                }
                                @case (Status.InProgress) {
                                  <button class="action-btn" (click)="pauseUpload(file.id)" title="توقف">
                                    <i class="fas fa-pause"></i>
                                  </button>
                                }
                                @case (Status.Paused) {
                                  <button class="action-btn" (click)="resumeUpload(file.id)" title="ادامه">
                                    <i class="fas fa-play"></i>
                                  </button>
                                  <button class="action-btn" (click)="cancelUpload(file.id)" title="لغو">
                                    <i class="fas fa-times"></i>
                                  </button>
                                }
                                @case (Status.Completed) {
                                  @if (file.fileGuid) {
                                    <button class="action-btn" (click)="downloadFile(file)" title="دانلود">
                                      <i class="fas fa-download"></i>
                                    </button>
                                  }
                                  @if (!disabled) {
                                    <button class="action-btn delete" (click)="deleteFile(file)" title="حذف">
                                      <i class="fas fa-trash"></i>
                                    </button>
                                  }
                                }
                                @case (Status.Failed) {
                                  <button class="action-btn" (click)="retryUpload(file.id)" title="تلاش مجدد">
                                    <i class="fas fa-redo"></i>
                                  </button>
                                  <button class="action-btn" (click)="removeFile(file.id)" title="حذف">
                                    <i class="fas fa-times"></i>
                                  </button>
                                }
                              }
                            </div>
                          </div>
                        }

                        @if (canAddMore() && !disabled) {
                          <div class="add-more-card" (click)="openFilePicker()">
                            <i class="fas fa-plus"></i>
                            <span>افزودن فایل</span>
                          </div>
                        }
                      </div>
                    }

                    @if (viewMode() === 'list') {
                      <div class="files-list">
                        <table class="table">
                          <thead>
                            <tr>
                              <th style="width: 40px"></th>
                              <th>نام فایل</th>
                              <th style="width: 120px">حجم</th>
                              <th style="width: 140px">وضعیت</th>
                              <th style="width: 120px">عملیات</th>
                            </tr>
                          </thead>
                          <tbody>
                            @for (file of service.files(); track file.id) {
                              <tr class="file-row" [class.selected]="selectedFile()?.id === file.id" (click)="selectFile(file)">
                                <td>
                                  <div class="file-icon-sm" [style.color]="service.getFileColor(file.type)">
                                    <i class="fas {{ service.getFileIcon(file.type) }}"></i>
                                  </div>
                                </td>
                                <td>
                              <div class="file-name-cell" (click)="togglePreview(file, $event)">
                                    <span class="name">{{ file.name }}</span>
                                    @if (file.isExisting) {
                                      <span class="badge bg-info">موجود</span>
                                    }
                                  </div>
                                </td>
                                <td class="text-muted">{{ service.formatFileSize(file.size) }}</td>
                                <td>
                                  @switch (file.status) {
                                    @case (Status.Pending) {
                                      <span class="status-label pending">در انتظار</span>
                                    }
                                    @case (Status.InProgress) {
                                      <div class="progress-bar-wrapper">
                                        <div class="progress">
                                          <div class="progress-bar" [style.width.%]="file.progress"></div>
                                        </div>
                                        <span>{{ file.progress }}%</span>
                                      </div>
                                    }
                                    @case (Status.Paused) {
                                      <span class="status-label paused">متوقف شده</span>
                                    }
                                    @case (Status.Completed) {
                                      <span class="status-label completed">کامل</span>
                                    }
                                    @case (Status.Failed) {
                                      <span class="status-label failed">خطا</span>
                                    }
                                  }
                                </td>
                                <td>
                                  <div class="list-actions" (click)="$event.stopPropagation()">
                                    @switch (file.status) {
                                      @case (Status.Pending) {
                                        <button class="btn btn-sm btn-outline-danger" (click)="removeFile(file.id)">
                                          <i class="fas fa-times"></i>
                                        </button>
                                      }
                                      @case (Status.InProgress) {
                                        <button class="btn btn-sm btn-outline-warning" (click)="pauseUpload(file.id)">
                                          <i class="fas fa-pause"></i>
                                        </button>
                                      }
                                      @case (Status.Paused) {
                                        <button class="btn btn-sm btn-outline-success" (click)="resumeUpload(file.id)">
                                          <i class="fas fa-play"></i>
                                        </button>
                                        <button class="btn btn-sm btn-outline-danger" (click)="cancelUpload(file.id)">
                                          <i class="fas fa-times"></i>
                                        </button>
                                      }
                                      @case (Status.Completed) {
                                        @if (file.fileGuid) {
                                          <button class="btn btn-sm btn-outline-primary" (click)="downloadFile(file)">
                                            <i class="fas fa-download"></i>
                                          </button>
                                        }
                                        @if (!disabled) {
                                          <button class="btn btn-sm btn-outline-danger" (click)="deleteFile(file)">
                                            <i class="fas fa-trash"></i>
                                          </button>
                                        }
                                      }
                                      @case (Status.Failed) {
                                        <button class="btn btn-sm btn-outline-primary" (click)="retryUpload(file.id)">
                                          <i class="fas fa-redo"></i>
                                        </button>
                                        <button class="btn btn-sm btn-outline-danger" (click)="removeFile(file.id)">
                                          <i class="fas fa-times"></i>
                                        </button>
                                      }
                                    }
                                  </div>
                                </td>
                              </tr>
                            }
                          </tbody>
                        </table>

                        @if (canAddMore() && !disabled) {
                          <div class="add-more-list" (click)="openFilePicker()">
                            <i class="fas fa-plus ms-2"></i>
                            افزودن فایل جدید
                          </div>
                        }
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
                  hidden />
              </div>

              <!-- Inline Preview -->
              <div
                class="preview-sidebar"
                [class.visible]="showPreview() && selectedFile()"
                [class.floating]="!dockPreview">
                <div class="preview-header">
                  <div class="preview-title">
                    <i class="fas fa-eye"></i>
                    <span>پیش‌نمایش</span>
                  </div>
                  <div class="preview-header-actions">
                    <button class="btn btn-sm btn-outline-secondary" (click)="dockPreview = !dockPreview">
                      <i class="fas" [class.fa-thumbtack]="dockPreview" [class.fa-grip-horizontal]="!dockPreview"></i>
                    </button>
                    <button class="btn-close-preview" (click)="closePreviewSidebar()">
                      <i class="fas fa-times"></i>
                    </button>
                  </div>
                </div>

                @if (selectedFile(); as file) {
                  <div class="preview-content">
                    <div class="preview-area">
                      @switch (service.getPreviewType(file.type)) {
                        @case ('image') {
                          <img [src]="getPreviewSrc(file)" [alt]="file.name" class="preview-image" />
                        }
                        @case ('video') {
                          <video controls [src]="getPreviewSrc(file)" class="preview-video"></video>
                        }
                        @case ('audio') {
                          <div class="preview-audio">
                            <div class="audio-icon">
                              <i class="fas fa-music"></i>
                            </div>
                            <audio controls [src]="getPreviewSrc(file)"></audio>
                          </div>
                        }
                        @case ('pdf') {
                          <iframe [src]="getSafePdfUrl(file)" class="preview-pdf"></iframe>
                        }
                        @default {
                          <div class="preview-unsupported">
                            <i class="fas {{ service.getFileIcon(file.type) }}" [style.color]="service.getFileColor(file.type)"></i>
                            <p>پیش‌نمایش در دسترس نیست</p>
                          </div>
                        }
                      }
                    </div>

                    <div class="file-details">
                      <div class="detail-item">
                        <label>نام فایل:</label>
                        <span>{{ file.name }}</span>
                      </div>
                      <div class="detail-item">
                        <label>حجم:</label>
                        <span>{{ service.formatFileSize(file.size) }}</span>
                      </div>
                      <div class="detail-item">
                        <label>نوع:</label>
                        <span>{{ file.type || 'نامشخص' }}</span>
                      </div>
                      @if (file.status === Status.InProgress) {
                        <div class="detail-item">
                          <label>پیشرفت:</label>
                          <span>{{ file.progress }}%</span>
                        </div>
                        @if (file.speed > 0) {
                          <div class="detail-item">
                            <label>سرعت:</label>
                            <span>{{ service.formatSpeed(file.speed) }}</span>
                          </div>
                        }
                      }
                    </div>

                    <div class="preview-actions">
                      @if (file.fileGuid) {
                        <button class="btn btn-primary w-100 mb-2" (click)="downloadFile(file)">
                          <i class="fas fa-download ms-2"></i>
                          دانلود
                        </button>
                      }
                      @if (file.status === Status.Completed && !disabled) {
                        <button class="btn btn-outline-danger w-100" (click)="deleteFile(file)">
                          <i class="fas fa-trash ms-2"></i>
                          حذف
                        </button>
                      }
                    </div>
                  </div>
                }
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="modal-footer">
            <div class="footer-info">
              @if (service.isUploading()) {
                <span class="text-primary">
                  <i class="fas fa-spinner fa-spin ms-1"></i>
                  در حال آپلود... {{ service.totalProgress() }}%
                </span>
              } @else {
                <span class="text-muted">
                  <i class="fas fa-file ms-1"></i>
                  {{ service.totalFiles() }} فایل
                  @if (service.completedFiles().length > 0) {
                    <span class="text-success ms-2">({{ service.completedFiles().length }} کامل)</span>
                  }
                </span>
              }
            </div>

            <div class="footer-actions">
              @if (service.pendingFiles().length > 0 && !autoUpload) {
                <button class="btn btn-primary ms-2" (click)="startUpload()">
                  <i class="fas fa-upload ms-1"></i>
                  شروع آپلود
                </button>
              }
              <button class="btn btn-outline-secondary ms-2" (click)="onClose()">انصراف</button>
              <button class="btn btn-success" [disabled]="service.isUploading()" (click)="onConfirm()">
                <i class="fas fa-check ms-1"></i>
                تأیید
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
    styles: [
        `
      :host {
        direction: rtl;
        font-family: 'Vazirmatn', Tahoma, sans-serif;
        background: radial-gradient(circle at 10% 10%, #eef2ff, #ffffff 45%);
      }

      .modal-header {
        background: linear-gradient(135deg, #0f172a 0%, #1e293b 40%, #2563eb 100%);
        color: #f8fafc;
        border: none;
        padding: 18px 26px;
        border-top-left-radius: 18px;
        border-top-right-radius: 18px;
        box-shadow: 0 14px 32px rgba(15, 23, 42, 0.35);
      }

      .header-right {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .header-icon {
        width: 46px;
        height: 46px;
        background: linear-gradient(135deg, rgba(255, 255, 255, 0.25), rgba(255, 255, 255, 0.08));
        border-radius: 14px;
        display: grid;
        place-items: center;
        font-size: 20px;
        box-shadow: 0 10px 18px rgba(0, 0, 0, 0.18);
      }

      .header-text {
        display: flex;
        flex-direction: column;
      }

      .modal-title {
        margin: 0;
        font-size: 19px;
        font-weight: 800;
        letter-spacing: -0.2px;
      }

      .file-count {
        font-size: 12px;
        opacity: 0.9;
        color: #cbd5f5;
      }

      .header-actions {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .view-toggle {
        display: inline-flex;
        background: rgba(255, 255, 255, 0.12);
        padding: 4px;
        border-radius: 14px;
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.2), 0 6px 16px rgba(0, 0, 0, 0.25);
      }

      .view-btn {
        width: 38px;
        height: 38px;
        border: none;
        background: transparent;
        color: #fff;
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.2s ease;
        display: grid;
        place-items: center;
      }

      .view-btn.active {
        background: #fff;
        color: #667eea;
      }

      .view-btn:hover {
        background: rgba(255, 255, 255, 0.12);
      }

      .upload-indicator {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: rgba(255, 255, 255, 0.18);
        padding: 6px 12px;
        border-radius: 14px;
        font-size: 13px;
      }

      .btn-close {
        filter: brightness(0) invert(1);
      }

      .modal-body {
        padding: 0;
        background: linear-gradient(180deg, #f7f9fc 0%, #ffffff 80%);
      }

      .body-shell {
        display: grid;
        grid-template-columns: 1fr;
        min-height: 520px;
        max-height: 70vh;
        transition: grid-template-columns 0.25s ease;
      }

      .body-shell.preview-open {
        grid-template-columns: 1fr 360px;
      }

      .file-area {
        position: relative;
        overflow-y: auto;
        padding: 22px;
        background: #f7f9fb;
        transition: background 0.2s, border 0.2s;
        border-left: 1px solid #eef1f7;
      }

      .file-area.drag-over {
        background: #e8f1ff;
        border: 2px dashed #6e7ff3;
      }

      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 430px;
        text-align: center;
        gap: 10px;
        cursor: pointer;
      }

      .empty-icon {
        width: 100px;
        height: 100px;
        background: linear-gradient(145deg, #22d3ee 0%, #6366f1 50%, #a855f7 100%);
        border-radius: 28px;
        display: grid;
        place-items: center;
        color: #fff;
        font-size: 40px;
        box-shadow: 0 18px 42px rgba(99, 102, 241, 0.3);
      }

      .upload-limits {
        display: flex;
        gap: 16px;
        color: #5d6475;
        font-size: 13px;
      }

      .files-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
        gap: 18px;
      }

      .file-card {
        background: linear-gradient(165deg, #ffffff 0%, #f8fafc 70%);
        border-radius: 16px;
        overflow: hidden;
        border: 1px solid #e5e7eb;
        box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
        transition: all 0.25s ease;
        cursor: pointer;
      }

      .file-card:hover {
        transform: translateY(-6px);
        box-shadow: 0 18px 38px rgba(15, 23, 42, 0.15);
        border-color: #c7d2fe;
      }

      .file-card.selected {
        border-color: #22d3ee;
        box-shadow: 0 18px 40px rgba(34, 211, 238, 0.25);
      }

      .file-card.uploading {
        background: linear-gradient(160deg, #eef2ff, #e0f2fe);
      }

      .file-card.completed {
        background: linear-gradient(160deg, #ecfdf3, #f8fafc);
      }

      .file-card.failed {
        background: linear-gradient(160deg, #fff1f2, #fff7ed);
      }

      .file-thumb {
        position: relative;
        height: 140px;
        background: radial-gradient(circle at 30% 30%, #f1f5f9, #e2e8f0 55%, #e0f2fe);
        display: grid;
        place-items: center;
        overflow: hidden;
      }

      .file-thumb img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .file-icon-wrapper {
        font-size: 48px;
        color: #5d6475;
        width: 100%;
        height: 100%;
        display: grid;
        place-items: center;
      }

      .file-icon-wrapper.video {
        background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
        color: #fff;
      }

      .file-icon-wrapper.audio {
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        color: #fff;
      }

      .file-icon-wrapper.pdf {
        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
        color: #fff;
      }

      .preview-overlay {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        background: rgba(0, 0, 0, 0.55);
        color: #fff;
        font-size: 28px;
        opacity: 0;
        transition: opacity 0.2s ease;
      }

      .file-thumb:hover .preview-overlay {
        opacity: 1;
      }

      .status-badge {
        position: absolute;
        bottom: 8px;
        right: 8px;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        color: #fff;
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
      }

      .status-badge.uploading {
        background: #fff;
        color: #667eea;
      }

      .status-badge.success {
        background: #10b981;
      }

      .status-badge.error {
        background: #ef4444;
      }

      .progress-circle {
        position: relative;
        width: 100%;
        height: 100%;
      }

      .progress-circle svg {
        width: 100%;
        height: 100%;
        transform: rotate(-90deg);
      }

      .progress-circle .bg {
        fill: none;
        stroke: #e5e7eb;
        stroke-width: 3;
      }

      .progress-circle .progress {
        fill: none;
        stroke: #667eea;
        stroke-width: 3;
        stroke-linecap: round;
        transition: stroke-dashoffset 0.3s ease;
      }

      .progress-circle span {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        font-size: 10px;
        font-weight: 700;
      }

      .existing-badge {
        position: absolute;
        top: 8px;
        left: 8px;
        width: 26px;
        height: 26px;
        border-radius: 50%;
        background: #3b82f6;
        color: #fff;
        display: grid;
        place-items: center;
        font-size: 12px;
      }

      .file-info {
        padding: 12px 12px 14px;
      }

      .file-name {
        font-size: 14px;
        font-weight: 600;
        color: #111827;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .file-meta {
        display: flex;
        gap: 10px;
        font-size: 12px;
        color: #6b7280;
        margin-top: 4px;
      }

      .file-error {
        margin-top: 6px;
        color: #ef4444;
        font-size: 12px;
      }

      .file-actions {
        position: absolute;
        top: 10px;
        right: 10px;
        display: flex;
        gap: 6px;
        opacity: 0;
        transition: opacity 0.2s ease;
      }

      .file-card:hover .file-actions {
        opacity: 1;
      }

      .action-btn {
        width: 30px;
        height: 30px;
        border: none;
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.96);
        color: #374151;
        display: grid;
        place-items: center;
        cursor: pointer;
        box-shadow: 0 3px 8px rgba(0, 0, 0, 0.1);
        transition: transform 0.15s ease, box-shadow 0.15s ease;
      }

      .action-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 6px 14px rgba(0, 0, 0, 0.16);
      }

      .action-btn.delete {
        background: #fef2f2;
        color: #ef4444;
      }

      .add-more-card {
        border: 2px dashed #cbd5e1;
        border-radius: 14px;
        min-height: 200px;
        display: grid;
        place-items: center;
        text-align: center;
        color: #94a3b8;
        gap: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .add-more-card:hover {
        border-color: #667eea;
        color: #667eea;
        background: #f3f6ff;
      }

      .files-list .table {
        margin: 0;
        background: #fff;
        border-radius: 12px;
        overflow: hidden;
      }

      .files-list thead th {
        background: #f7f8fb;
        border-bottom: 1px solid #e5e7eb;
        font-size: 13px;
        color: #4b5563;
      }

      .file-row {
        cursor: pointer;
      }

      .file-row:hover {
        background: #f7f9ff;
      }

      .file-row.selected {
        background: #eef2ff;
      }

      .file-name-cell {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .file-name-cell .name {
        font-weight: 600;
      }

      .file-name-cell:hover .name {
        color: #667eea;
        text-decoration: underline;
      }

      .status-label {
        padding: 4px 10px;
        border-radius: 10px;
        font-size: 11px;
        font-weight: 600;
      }

      .status-label.pending {
        background: #f3f4f6;
        color: #6b7280;
      }

      .status-label.paused {
        background: #fef3c7;
        color: #d97706;
      }

      .status-label.completed {
        background: #dcfce7;
        color: #16a34a;
      }

      .status-label.failed {
        background: #fee2e2;
        color: #dc2626;
      }

      .progress-bar-wrapper {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .progress-bar-wrapper .progress {
        flex: 1;
        height: 8px;
        background: #e5e7eb;
        border-radius: 8px;
        overflow: hidden;
      }

      .progress-bar-wrapper .progress-bar {
        background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
        height: 100%;
      }

      .list-actions {
        display: flex;
        gap: 6px;
      }

      .add-more-list {
        padding: 16px;
        text-align: center;
        border: 2px dashed #cbd5e1;
        border-radius: 10px;
        color: #94a3b8;
        cursor: pointer;
        margin: 16px;
        transition: all 0.2s ease;
      }

      .add-more-list:hover {
        border-color: #667eea;
        color: #667eea;
        background: #eef2ff;
      }

      .preview-sidebar {
        background: linear-gradient(160deg, #ffffff 0%, #f8fafc 60%, #eef2ff 100%);
        border-right: 1px solid #e5e7eb;
        display: flex;
        flex-direction: column;
        transform: translateX(100%);
        transition: transform 0.25s ease, width 0.25s ease, opacity 0.2s ease;
        box-shadow: -8px 0 30px rgba(15, 23, 42, 0.12);
        position: relative;
        z-index: 2;
        width: 0;
        opacity: 0;
        pointer-events: none;
      }

      .preview-sidebar.visible {
        transform: translateX(0);
        width: 380px;
        opacity: 1;
        pointer-events: auto;
      }

      .preview-sidebar.floating {
        position: absolute;
        inset: 0;
        max-width: 520px;
        margin-left: auto;
        border-left: 1px solid #eef1f7;
        box-shadow: -8px 0 24px rgba(0, 0, 0, 0.25);
      }

      .preview-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 14px 16px;
        border-bottom: 1px solid #e5e7eb;
        background: rgba(255, 255, 255, 0.9);
        backdrop-filter: blur(10px);
      }

      .preview-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 700;
        color: #0f172a;
      }

      .preview-header-actions {
        display: flex;
        gap: 6px;
      }

      .btn-close-preview {
        width: 32px;
        height: 32px;
        border: none;
        background: #eef1f7;
        border-radius: 10px;
        display: grid;
        place-items: center;
        cursor: pointer;
        color: #475569;
      }

      .preview-content {
        padding: 14px 16px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .preview-area {
        min-height: 220px;
        background: #f8fafc;
        border-radius: 12px;
        display: grid;
        place-items: center;
        overflow: hidden;
      }

      .preview-image {
        width: 100%;
        height: auto;
        max-height: 320px;
        object-fit: contain;
      }

      .preview-video {
        width: 100%;
        max-height: 320px;
      }

      .preview-audio {
        width: 100%;
        padding: 20px;
        text-align: center;
        display: grid;
        gap: 12px;
      }

      .audio-icon {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        display: grid;
        place-items: center;
        color: #fff;
        font-size: 32px;
        justify-self: center;
      }

      .preview-pdf {
        width: 100%;
        height: 380px;
        border: none;
      }

      .preview-unsupported {
        padding: 28px;
        text-align: center;
        color: #475569;
      }

      .file-details {
        display: grid;
        gap: 10px;
      }

      .detail-item {
        display: flex;
        justify-content: space-between;
        font-size: 13px;
        color: #475569;
        border-bottom: 1px dashed #e5e7eb;
        padding-bottom: 8px;
      }

      .preview-actions {
        display: grid;
        gap: 10px;
      }

      .modal-footer {
        background: #f8f9fa;
        border-top: 1px solid #e5e7eb;
        padding: 14px 24px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      @media (max-width: 1200px) {
        .body-shell {
          grid-template-columns: 1fr;
        }

        .preview-sidebar {
          position: absolute;
          inset: 0;
          max-width: 520px;
          margin-left: auto;
          border-left: 1px solid #eef1f7;
          box-shadow: -8px 0 24px rgba(0, 0, 0, 0.2);
        }
      }

      @media (max-width: 576px) {
        .files-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
    `
    ]
})
export class FileManagerModalComponent implements OnInit, OnDestroy {
    @Input() modalId = 'fileManagerModal';
    @Input() title = 'مدیریت فایل‌ها';
    @Input() folderPath = '';
    @Input() existingFileGuids: string[] = [];
    @Input() multiple = true;
    @Input() maxFiles = 10;
    @Input() maxFileSizeMB = 100;
    @Input() acceptedTypes = '*';
    @Input() autoUpload = true;
    @Input() disabled = false;
    @Input() confirmDelete = true;
    @Input() confirmOnClose = true;

    @Output() confirmed = new EventEmitter<string[]>();
    @Output() cancelled = new EventEmitter<void>();
    @Output() filesChanged = new EventEmitter<string[]>();
    @Output() fileUploaded = new EventEmitter<FileItem>();
    @Output() fileDeleted = new EventEmitter<string>();

    @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

    readonly service = inject(TusUploadService);
    private readonly sanitizer = inject(DomSanitizer);
    readonly Status = UploadStatus;

    readonly viewMode = signal<ViewMode>('grid');
    readonly isDragOver = signal(false);
    readonly selectedFile = signal<FileItem | null>(null);
    readonly showPreview = signal(false);
    readonly currentPreviewIndex = signal(0);
    dockPreview = true;

    private modalInstance: any;
    private initialFileGuids: string[] = [];
    private readonly destroy$ = new Subject<void>();

    readonly hasFiles = computed(() => this.service.files().length > 0);
    readonly canAddMore = computed(() => {
        if (!this.multiple && this.service.totalFiles() > 0) return false;
        if (this.maxFiles && this.service.totalFiles() >= this.maxFiles) return false;
        return true;
    });

    constructor() {
        this.service.fileCompleted$
            .pipe(takeUntil(this.destroy$))
            .subscribe((file: FileItem) => {
                this.fileUploaded.emit(file);
                this.emitFilesChanged();
            });
    }

    ngOnInit(): void {
        this.initializeState();
    }

    ngOnDestroy(): void {
        this.modalInstance?.dispose();
        this.destroy$.next();
        this.destroy$.complete();
        this.service.clearAll();
    }

    open(): void {
        this.initializeState();
        const modalElement = document.getElementById(this.modalId);
        if (modalElement) {
            this.modalInstance = new bootstrap.Modal(modalElement);
            this.modalInstance.show();
        }
    }

    close(): void {
        this.modalInstance?.hide();
        this.selectedFile.set(null);
        this.showPreview.set(false);
    }

    async onClose(): Promise<void> {
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
                await this.resetAfterClose(true);
                this.cancelled.emit();
                this.close();
                return;
            } else {
                return;
            }
        }

        this.cancelled.emit();
        await this.resetAfterClose(true);
        this.close();
    }

    async onConfirm(): Promise<void> {
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
        await this.finalizeClose(false);
    }

    selectFile(file: FileItem): void {
        this.selectedFile.set(file);
        this.currentPreviewIndex.set(this.service.files().indexOf(file));
    }

    async togglePreview(file: FileItem, event?: Event): Promise<void> {
        event?.stopPropagation();
        await this.ensurePreviewReady(file);

        if (this.selectedFile()?.id !== file.id) {
            this.selectFile(file);
            this.showPreview.set(true);
            return;
        }

        this.showPreview.set(!this.showPreview());
    }

    closePreviewSidebar(): void {
        this.showPreview.set(false);
    }

    getPreviewSrc(file: FileItem): string {
        return file.previewUrl || '';
    }

    getSafePdfUrl(file: FileItem): SafeResourceUrl {
        const url = this.getPreviewSrc(file);
        return this.sanitizer.bypassSecurityTrustResourceUrl(url);
    }

    private async ensurePreviewReady(file: FileItem): Promise<void> {
        if (file.previewUrl || !file.fileGuid) return;
        const resolved = await this.service.resolveAuthorizedPreview(file.fileGuid, file.id);
        if (resolved && this.selectedFile()?.id === file.id) {
            this.selectedFile.set({ ...file, previewUrl: resolved });
        }
    }

    async downloadFile(file: FileItem): Promise<void> {
        if (!file.fileGuid) return;
        const blob = await this.service.downloadWithAuth(file.fileGuid);
        if (!blob) return;

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

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

    openFilePicker(): void {
        if (this.disabled || !this.canAddMore()) return;
        this.fileInput.nativeElement.click();
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

    startUpload(): void {
        this.service.uploadAll({ folderPath: this.folderPath });
    }

    pauseUpload(id: string): void {
        this.service.pauseUpload(id);
    }

    resumeUpload(id: string): void {
        this.service.resumeUpload(id);
    }

    retryUpload(id: string): void {
        this.service.retryUpload(id, { folderPath: this.folderPath });
    }

    cancelUpload(id: string): void {
        this.service.cancelUpload(id);
    }

    removeFile(id: string): void {
        this.service.removeFile(id);
        if (this.selectedFile()?.id === id) {
            this.closePreviewSidebar();
        }
        this.emitFilesChanged();
    }

    async deleteFile(file: FileItem): Promise<void> {
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
            if (this.selectedFile()?.id === file.id) {
                this.closePreviewSidebar();
            }
            this.emitFilesChanged();
        } else {
            Swal.fire({
                icon: 'error',
                title: 'خطا',
                text: 'خطا در حذف فایل'
            });
        }
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

    private emitFilesChanged(): void {
        this.filesChanged.emit(this.service.getAllFileGuids());
    }

    getFileGuids(): string[] {
        return this.service.getAllFileGuids();
    }

    async cleanup(): Promise<void> {
        await this.service.cleanupUploadedFiles();
    }

    async reset(): Promise<void> {
        await this.resetAfterClose(false);
    }

    private initializeState(): void {
        this.service.clearAll();
        this.selectedFile.set(null);
        this.showPreview.set(false);
        this.isDragOver.set(false);
        this.initialFileGuids = [...this.existingFileGuids];
        if (this.existingFileGuids?.length > 0) {
            this.service.loadExistingFiles(this.existingFileGuids);
        }
    }

    private async resetAfterClose(cleanupNewUploads: boolean): Promise<void> {
        if (cleanupNewUploads) {
            await this.service.cleanupUploadedFiles();
        } else {
            this.service.clearAll();
        }

        this.selectedFile.set(null);
        this.showPreview.set(false);
        this.isDragOver.set(false);
    }

    private async finalizeClose(cleanupNewUploads: boolean): Promise<void> {
        this.close();
        await this.resetAfterClose(cleanupNewUploads);
    }
}