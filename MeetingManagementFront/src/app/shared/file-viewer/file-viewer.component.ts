import { 
  Component, Input, Output, EventEmitter, inject, signal, computed,
  OnInit, OnChanges, SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

declare var bootstrap: any;

// ============================================
// Types
// ============================================

export interface FileInfo {
  guid: string;
  fileName: string;
  originalFileName?: string;
  contentType: string;
  fileSize: number;
  createdAt?: string;
  downloadUrl?: string;
  previewUrl?: string;
}

export type PreviewType = 
  | 'image' 
  | 'video' 
  | 'audio' 
  | 'pdf' 
  | 'office' 
  | 'text' 
  | 'unsupported';

// ============================================
// File Viewer Component
// ============================================

@Component({
  selector: 'app-file-viewer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Modal -->
    <div class="modal fade" [id]="modalId" tabindex="-1" data-bs-backdrop="static">
      <div class="modal-dialog" [class.modal-xl]="isLargePreview()" [class.modal-lg]="!isLargePreview()">
        <div class="modal-content">
          
          <!-- Header -->
          <div class="modal-header">
            <div class="header-info">
              <i class="fas {{ getFileIcon() }}" [style.color]="getFileColor()"></i>
              <div class="header-text">
                <h6 class="modal-title">{{ currentFile().originalFileName || currentFile().fileName || 'فایل' }}</h6>
                <span class="file-meta">
                  {{ formatFileSize(currentFile().fileSize || 0) }}
                  @if (currentFile().contentType) {
                    • {{ getFileTypeName() }}
                  }
                </span>
              </div>
            </div>
            <div class="header-actions">
              @if (currentFile()) {
                <a [href]="getDownloadUrl()" 
                   class="btn btn-sm btn-outline-primary me-2"
                   download
                   title="دانلود">
                  <i class="fas fa-download"></i>
                </a>
              }
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
          </div>
          
          <!-- Body -->
          <div class="modal-body">
            @if (isLoading()) {
              <div class="loading-state">
                <div class="spinner-border text-primary" role="status">
                  <span class="visually-hidden">در حال بارگذاری...</span>
                </div>
                <p>در حال بارگذاری فایل...</p>
              </div>
            } @else if (error()) {
              <div class="error-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>{{ error() }}</p>
                <button class="btn btn-outline-primary" (click)="retry()">
                  <i class="fas fa-redo me-1"></i>
                  تلاش مجدد
                </button>
              </div>
            } @else if (currentFile()) {
              <div class="preview-container" [ngSwitch]="previewType()">
                
                <!-- Image -->
                <ng-container *ngSwitchCase="'image'">
                  <div class="image-preview">
                    <img [src]="previewUrl()" 
                         [alt]="currentFile().fileName"
                         (load)="onMediaLoaded()"
                         (error)="onMediaError()">
                  </div>
                </ng-container>
                
                <!-- Video -->
                <ng-container *ngSwitchCase="'video'">
                  <div class="video-preview">
                    <video controls 
                           [src]="previewUrl()"
                           (loadeddata)="onMediaLoaded()"
                           (error)="onMediaError()">
                      مرورگر شما از پخش ویدئو پشتیبانی نمی‌کند.
                    </video>
                  </div>
                </ng-container>
                
                <!-- Audio -->
                <ng-container *ngSwitchCase="'audio'">
                  <div class="audio-preview">
                    <div class="audio-icon">
                      <i class="fas fa-music"></i>
                    </div>
                    <p class="audio-name">{{ currentFile().originalFileName || currentFile().fileName }}</p>
                    <audio controls 
                           [src]="previewUrl()"
                           (loadeddata)="onMediaLoaded()"
                           (error)="onMediaError()">
                      مرورگر شما از پخش صوت پشتیبانی نمی‌کند.
                    </audio>
                  </div>
                </ng-container>
                
                <!-- PDF -->
                <ng-container *ngSwitchCase="'pdf'">
                  <div class="pdf-preview">
                    <iframe [src]="safePreviewUrl()" 
                            frameborder="0"
                            (load)="onMediaLoaded()"
                            (error)="onMediaError()">
                    </iframe>
                  </div>
                </ng-container>
                
                <!-- Office Documents (via Microsoft Office Online) -->
                <ng-container *ngSwitchCase="'office'">
                  <div class="office-preview">
                    @if (officeViewerUrl()) {
                      <iframe [src]="officeViewerUrl()" 
                              frameborder="0"
                              (load)="onMediaLoaded()"
                              (error)="onOfficeError()">
                      </iframe>
                    } @else {
                      <div class="office-fallback">
                        <i class="fas {{ getFileIcon() }}" [style.color]="getFileColor()"></i>
                        <p>پیش‌نمایش آنلاین برای این فایل در دسترس نیست</p>
                        <a [href]="getDownloadUrl()" class="btn btn-primary" download>
                          <i class="fas fa-download me-1"></i>
                          دانلود فایل
                        </a>
                      </div>
                    }
                  </div>
                </ng-container>
                
                <!-- Text -->
                <ng-container *ngSwitchCase="'text'">
                  <div class="text-preview">
                    <pre>{{ textContent() }}</pre>
                  </div>
                </ng-container>
                
                <!-- Unsupported -->
                <ng-container *ngSwitchDefault>
                  <div class="unsupported-preview">
                    <div class="unsupported-icon">
                      <i class="fas {{ getFileIcon() }}" [style.color]="getFileColor()"></i>
                    </div>
                    <h5>{{ currentFile().originalFileName || currentFile().fileName }}</h5>
                    <p class="text-muted">این فرمت قابل پیش‌نمایش نیست</p>
                    <a [href]="getDownloadUrl()" class="btn btn-primary" download>
                      <i class="fas fa-download me-1"></i>
                      دانلود فایل
                    </a>
                  </div>
                </ng-container>
                
              </div>
            }
          </div>
          
          <!-- Footer with Navigation (for multiple files) -->
          @if (files().length > 1) {
            <div class="modal-footer justify-content-between">
              <button class="btn btn-outline-secondary" 
                      [disabled]="currentIndex() === 0"
                      (click)="showPrevious()">
                <i class="fas fa-chevron-right me-1"></i>
                قبلی
              </button>
              <span class="file-counter">
                {{ currentIndex() + 1 }} از {{ files().length }}
              </span>
              <button class="btn btn-outline-secondary"
                      [disabled]="currentIndex() === files().length - 1"
                      (click)="showNext()">
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
      direction: rtl;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      border-bottom: 1px solid #e2e8f0;
      padding: 12px 16px;
    }

    .header-info {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .header-info > i {
      font-size: 24px;
    }

    .header-text {
      display: flex;
      flex-direction: column;
    }

    .modal-title {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
      color: #334155;
      max-width: 300px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .file-meta {
      font-size: 12px;
      color: #64748b;
    }

    .header-actions {
      display: flex;
      align-items: center;
    }

    .modal-body {
      padding: 0;
      min-height: 400px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #1e293b;
    }

    /* Loading & Error States */
    .loading-state, .error-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      text-align: center;
      color: white;
    }

    .error-state i {
      font-size: 48px;
      color: #ef4444;
      margin-bottom: 16px;
    }

    .error-state p {
      margin-bottom: 16px;
    }

    /* Preview Container */
    .preview-container {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* Image Preview */
    .image-preview {
      max-height: 70vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }

    .image-preview img {
      max-width: 100%;
      max-height: 70vh;
      object-fit: contain;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    }

    /* Video Preview */
    .video-preview {
      width: 100%;
      padding: 16px;
    }

    .video-preview video {
      width: 100%;
      max-height: 70vh;
      border-radius: 8px;
    }

    /* Audio Preview */
    .audio-preview {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 40px;
      text-align: center;
      color: white;
    }

    .audio-icon {
      width: 100px;
      height: 100px;
      border-radius: 50%;
      background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;
    }

    .audio-icon i {
      font-size: 40px;
      color: white;
    }

    .audio-name {
      font-size: 16px;
      margin-bottom: 20px;
      max-width: 300px;
      word-break: break-word;
    }

    .audio-preview audio {
      width: 100%;
      max-width: 400px;
    }

    /* PDF Preview */
    .pdf-preview {
      width: 100%;
      height: 75vh;
    }

    .pdf-preview iframe {
      width: 100%;
      height: 100%;
      border: none;
    }

    /* Office Preview */
    .office-preview {
      width: 100%;
      height: 75vh;
    }

    .office-preview iframe {
      width: 100%;
      height: 100%;
      border: none;
      background: white;
    }

    .office-fallback {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px;
      text-align: center;
      color: white;
    }

    .office-fallback i {
      font-size: 64px;
      margin-bottom: 20px;
    }

    .office-fallback p {
      margin-bottom: 20px;
      color: #94a3b8;
    }

    /* Text Preview */
    .text-preview {
      width: 100%;
      height: 70vh;
      overflow: auto;
      background: #0f172a;
      padding: 20px;
    }

    .text-preview pre {
      color: #e2e8f0;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      white-space: pre-wrap;
      word-wrap: break-word;
      margin: 0;
      direction: ltr;
      text-align: left;
    }

    /* Unsupported Preview */
    .unsupported-preview {
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

    .unsupported-icon i {
      font-size: 48px;
    }

    .unsupported-preview h5 {
      margin-bottom: 8px;
      max-width: 300px;
      word-break: break-word;
    }

    .unsupported-preview p {
      margin-bottom: 20px;
    }

    /* Footer */
    .modal-footer {
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
    }

    .file-counter {
      font-size: 13px;
      color: #64748b;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .modal-body {
        min-height: 300px;
      }

      .image-preview img {
        max-height: 50vh;
      }

      .pdf-preview, .office-preview {
        height: 60vh;
      }
    }
  `]
})
export class FileViewerComponent implements OnInit, OnChanges {
  // Inputs
  @Input() modalId = 'fileViewerModal';
  @Input() fileGuids: string[] = [];
  @Input() initialIndex = 0;

  // Outputs
  @Output() closed = new EventEmitter<void>();

  // Services
  private readonly http = inject(HttpClient);
  private readonly sanitizer = inject(DomSanitizer);

  // API URLs
  private readonly attachmentUrl = environment.fileManagementEndpoint + '/api/Attachment';

  // State
  readonly files = signal<FileInfo[]>([]);
  readonly currentIndex = signal(0);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly textContent = signal<string>('');

  // Computed
  readonly currentFile = computed(() => this.files()[this.currentIndex()] || null);
  
  readonly previewType = computed((): PreviewType => {
    const file = this.currentFile();
    if (!file) return 'unsupported';
    return this.getPreviewType(file.contentType);
  });

  readonly previewUrl = computed(() => {
    const file = this.currentFile();
    if (!file) return '';
    return `${this.attachmentUrl}/Preview/${file.guid}`;
  });

  readonly isLargePreview = computed(() => {
    const type = this.previewType();
    return type === 'pdf' || type === 'office' || type === 'video';
  });

  private modalInstance: any;

  ngOnInit(): void {
    // Initial setup
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['fileGuids'] && this.fileGuids?.length > 0) {
      this.loadFiles();
    }
    if (changes['initialIndex']) {
      this.currentIndex.set(this.initialIndex);
    }
  }

  // ============================================
  // Public API
  // ============================================

  async open(fileGuids?: string[], index = 0): Promise<void> {
    if (fileGuids) {
      this.fileGuids = fileGuids;
    }
    this.currentIndex.set(index);
    
    await this.loadFiles();
    
    const modalElement = document.getElementById(this.modalId);
    if (modalElement) {
      this.modalInstance = new bootstrap.Modal(modalElement);
      this.modalInstance.show();
      
      modalElement.addEventListener('hidden.bs.modal', () => {
        this.closed.emit();
      }, { once: true });
    }
  }

  close(): void {
    this.modalInstance?.hide();
  }

  // ============================================
  // File Loading
  // ============================================

  private async loadFiles(): Promise<void> {
    if (!this.fileGuids?.length) return;

    this.isLoading.set(true);
    this.error.set(null);

    try {
      // ✅ بارگذاری همزمان همه فایل‌ها برای سرعت بیشتر
      const promises = this.fileGuids.map(guid => this.loadFileInfo(guid));
      const results = await Promise.all(promises);
      
      this.files.set(results.filter(f => f !== null) as FileInfo[]);
      
      // بارگذاری محتوای text اگر نیاز است
      const current = this.currentFile();
      if (current && this.previewType() === 'text') {
        await this.loadTextContent(current.guid);
      }
    } catch (err: any) {
      this.error.set('خطا در بارگذاری فایل‌ها');
      console.error('Error loading files:', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  private async loadFileInfo(guid: string): Promise<FileInfo | null> {
    try {
      const response = await firstValueFrom(
        this.http.get<FileInfo>(`${this.attachmentUrl}/GetFile/${guid}`)
      );
      return {
        ...response,
        guid,
        downloadUrl: `${this.attachmentUrl}/Download/${guid}`,
        previewUrl: `${this.attachmentUrl}/Preview/${guid}`
      };
    } catch {
      return null;
    }
  }

  private async loadTextContent(guid: string): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.http.get(`${this.attachmentUrl}/Preview/${guid}`, { responseType: 'text' })
      );
      this.textContent.set(response);
    } catch {
      this.textContent.set('خطا در بارگذاری محتوا');
    }
  }

  // ============================================
  // Navigation
  // ============================================

  showNext(): void {
    if (this.currentIndex() < this.files().length - 1) {
      this.currentIndex.update(i => i + 1);
      this.onFileChange();
    }
  }

  showPrevious(): void {
    if (this.currentIndex() > 0) {
      this.currentIndex.update(i => i - 1);
      this.onFileChange();
    }
  }

  private async onFileChange(): Promise<void> {
    const file = this.currentFile();
    if (file && this.previewType() === 'text') {
      await this.loadTextContent(file.guid);
    }
  }

  // ============================================
  // Preview Helpers
  // ============================================

  getPreviewType(contentType: string): PreviewType {
    if (!contentType) return 'unsupported';
    
    const type = contentType.toLowerCase();
    
    if (type.startsWith('image/')) return 'image';
    if (type.startsWith('video/')) return 'video';
    if (type.startsWith('audio/')) return 'audio';
    if (type === 'application/pdf') return 'pdf';
    if (type.startsWith('text/') || type === 'application/json') return 'text';
    
    // Office documents
    if (type.includes('word') || 
        type.includes('document') ||
        type.includes('excel') ||
        type.includes('spreadsheet') ||
        type.includes('powerpoint') ||
        type.includes('presentation')) {
      return 'office';
    }
    
    return 'unsupported';
  }

  safePreviewUrl(): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(this.previewUrl());
  }

  officeViewerUrl(): SafeResourceUrl | null {
    const file = this.currentFile();
    if (!file) return null;
    
    // ✅ استفاده از Microsoft Office Online Viewer
    // نیاز به URL عمومی دارد
    const downloadUrl = this.getDownloadUrl();
    if (!downloadUrl) return null;
    
    // اگر URL عمومی نیست، نمی‌توان از Office Viewer استفاده کرد
    if (downloadUrl.includes('localhost') || downloadUrl.includes('127.0.0.1')) {
      return null;
    }
    
    const encodedUrl = encodeURIComponent(downloadUrl);
    const viewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodedUrl}`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(viewerUrl);
  }

  getDownloadUrl(): string {
    const file = this.currentFile();
    return file ? `${this.attachmentUrl}/Download/${file.guid}` : '';
  }

  // ============================================
  // UI Helpers
  // ============================================

  getFileIcon(): string {
    const file = this.currentFile();
    if (!file) return 'fa-file';
    
    const type = file.contentType?.toLowerCase() || '';
    
    if (type.startsWith('image/')) return 'fa-image';
    if (type.startsWith('video/')) return 'fa-video';
    if (type.startsWith('audio/')) return 'fa-music';
    if (type.includes('pdf')) return 'fa-file-pdf';
    if (type.includes('word') || type.includes('document')) return 'fa-file-word';
    if (type.includes('excel') || type.includes('spreadsheet')) return 'fa-file-excel';
    if (type.includes('powerpoint') || type.includes('presentation')) return 'fa-file-powerpoint';
    if (type.includes('zip') || type.includes('rar') || type.includes('compressed')) return 'fa-file-archive';
    if (type.startsWith('text/')) return 'fa-file-alt';
    return 'fa-file';
  }

  getFileColor(): string {
    const file = this.currentFile();
    if (!file) return '#6b7280';
    
    const type = file.contentType?.toLowerCase() || '';
    
    if (type.startsWith('image/')) return '#10b981';
    if (type.startsWith('video/')) return '#8b5cf6';
    if (type.startsWith('audio/')) return '#f59e0b';
    if (type.includes('pdf')) return '#ef4444';
    if (type.includes('word')) return '#3b82f6';
    if (type.includes('excel')) return '#22c55e';
    if (type.includes('powerpoint')) return '#f97316';
    return '#6b7280';
  }

  getFileTypeName(): string {
    const file = this.currentFile();
    if (!file) return '';
    
    const type = file.contentType?.toLowerCase() || '';
    
    if (type.startsWith('image/')) return 'تصویر';
    if (type.startsWith('video/')) return 'ویدئو';
    if (type.startsWith('audio/')) return 'صوت';
    if (type.includes('pdf')) return 'PDF';
    if (type.includes('word')) return 'Word';
    if (type.includes('excel')) return 'Excel';
    if (type.includes('powerpoint')) return 'PowerPoint';
    if (type.includes('zip')) return 'فایل فشرده';
    if (type.startsWith('text/')) return 'متن';
    return 'فایل';
  }

  formatFileSize(bytes: number): string {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // ============================================
  // Event Handlers
  // ============================================

  onMediaLoaded(): void {
    // می‌توان اینجا loading state را غیرفعال کرد
  }

  onMediaError(): void {
    this.error.set('خطا در بارگذاری فایل');
  }

  onOfficeError(): void {
    // Office viewer خطا داد، fallback نشان داده می‌شود
  }

  retry(): void {
    this.loadFiles();
  }
}
