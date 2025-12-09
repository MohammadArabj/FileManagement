import { Component, input, output, signal, computed, effect, inject } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { NgxExtendedPdfViewerModule } from 'ngx-extended-pdf-viewer';

interface FileData {
  guid?: string;
  url?: string;
  type?: string;
  name?: string;
  content?: string;
}

type FileDisplayType = 'image' | 'pdf' | 'text' | 'video' | 'audio' | 'document' | 'other';

interface FileViewerState {
  displayFileUrl: SafeResourceUrl | null;
  displayFileName: string;
  displayFileType: FileDisplayType;
  displayFileContent: string;
  selectedFileGuid: string;
  isLoading: boolean;
  hasError: boolean;
  errorMessage: string;
}

@Component({
  selector: 'app-file-viewer-modal',
  standalone: true,
  imports: [NgxExtendedPdfViewerModule],
  templateUrl: './file-viewer-modal.html',
  styleUrl: './file-viewer-modal.css',
})
export class FileViewerModalComponent {
  private sanitizer = inject(DomSanitizer);

  // Input signals
  fileData = input<FileData | null>(null);

  // Output signals
  downloadRequested = output<string>();
  modalClosed = output<void>();

  // Internal state signals
  private _viewerState = signal<FileViewerState>({
    displayFileUrl: null,
    displayFileName: '',
    displayFileType: 'other',
    displayFileContent: '',
    selectedFileGuid: '',
    isLoading: false,
    hasError: false,
    errorMessage: ''
  });

  // Readonly state accessor
  readonly viewerState = this._viewerState.asReadonly();

  // Computed signals for individual properties (for easier template access)
  readonly displayFileUrl = computed(() => this._viewerState().displayFileUrl);
  readonly displayFileName = computed(() => this._viewerState().displayFileName);
  readonly displayFileType = computed(() => this._viewerState().displayFileType);
  readonly displayFileContent = computed(() => this._viewerState().displayFileContent);
  readonly selectedFileGuid = computed(() => this._viewerState().selectedFileGuid);
  readonly isLoading = computed(() => this._viewerState().isLoading);
  readonly hasError = computed(() => this._viewerState().hasError);
  readonly errorMessage = computed(() => this._viewerState().errorMessage);

  // Computed signals for file type checking
  readonly isImageFile = computed(() => this.displayFileType() === 'image');
  readonly isPdfFile = computed(() => this.displayFileType() === 'pdf');
  readonly isTextFile = computed(() => this.displayFileType() === 'text');
  readonly isVideoFile = computed(() => this.displayFileType() === 'video');
  readonly isAudioFile = computed(() => this.displayFileType() === 'audio');
  readonly isDocumentFile = computed(() => this.displayFileType() === 'document');
  readonly isOtherFile = computed(() => this.displayFileType() === 'other');

  // Computed signals for UI states
  readonly canDownload = computed(() => {
    return this.selectedFileGuid() !== '' && !this.isLoading() && !this.hasError();
  });

  readonly hasFileToDisplay = computed(() => {
    const state = this._viewerState();
    return (state.displayFileUrl !== null || state.displayFileContent !== '') &&
      !state.hasError;
  });

  readonly fileSize = computed(() => {
    const content = this.displayFileContent();
    if (content) {
      // Estimate size from base64 content
      const sizeInBytes = Math.round((content.length * 3) / 4);
      return this.formatFileSize(sizeInBytes);
    }
    return null;
  });

  readonly fileInfo = computed(() => {
    const state = this._viewerState();
    return {
      name: state.displayFileName,
      type: state.displayFileType,
      size: this.fileSize(),
      hasContent: state.displayFileContent !== '',
      hasUrl: state.displayFileUrl !== null
    };
  });

  constructor() {
    // Main effect for handling fileData changes
    effect(() => {
      const fileData = this.fileData();

      if (fileData) {
        this.loadFileData(fileData);
      } else {
        this.resetViewer();
      }
    });

    // Effect for error handling
    effect(() => {
      const hasError = this.hasError();
      const errorMessage = this.errorMessage();

      if (hasError && errorMessage) {
        console.error('File viewer error:', errorMessage);
      }
    });
  }

  private loadFileData(fileData: FileData): void {
    this._viewerState.update(state => ({
      ...state,
      isLoading: true,
      hasError: false,
      errorMessage: ''
    }));

    try {
      const fileName = fileData.name || 'فایل پیوست';
      const fileType = this.determineFileType(fileData.type, fileName);
      const fileContent = fileData.content || '';
      const fileGuid = fileData.guid || '';

      let sanitizedUrl: SafeResourceUrl | null = null;

      if (fileData.url) {
        sanitizedUrl = this.sanitizer.bypassSecurityTrustResourceUrl(fileData.url);
      }

      this._viewerState.set({
        displayFileUrl: sanitizedUrl,
        displayFileName: fileName,
        displayFileType: fileType,
        displayFileContent: fileContent,
        selectedFileGuid: fileGuid,
        isLoading: false,
        hasError: false,
        errorMessage: ''
      });

    } catch (error) {
      this._viewerState.update(state => ({
        ...state,
        isLoading: false,
        hasError: true,
        errorMessage: 'خطا در بارگذاری فایل'
      }));
    }
  }

  private determineFileType(mimeType?: string, fileName?: string): FileDisplayType {
    if (!mimeType && !fileName) return 'other';

    // Check by MIME type first
    if (mimeType) {
      if (mimeType.startsWith('image/')) return 'image';
      if (mimeType.includes('pdf')) return 'pdf';
      if (mimeType.startsWith('text/')) return 'text';
      if (mimeType.startsWith('video/')) return 'video';
      if (mimeType.startsWith('audio/')) return 'audio';
      if (mimeType.includes('document') ||
        mimeType.includes('word') ||
        mimeType.includes('excel') ||
        mimeType.includes('powerpoint')) return 'document';
    }

    // Check by file extension
    if (fileName) {
      const extension = fileName.toLowerCase().split('.').pop();

      switch (extension) {
        case 'jpg':
        case 'jpeg':
        case 'png':
        case 'gif':
        case 'bmp':
        case 'svg':
        case 'webp':
          return 'image';

        case 'pdf':
          return 'pdf';

        case 'txt':
        case 'json':
        case 'xml':
        case 'csv':
        case 'log':
          return 'text';

        case 'mp4':
        case 'avi':
        case 'mov':
        case 'wmv':
        case 'webm':
          return 'video';

        case 'mp3':
        case 'wav':
        case 'ogg':
        case 'aac':
          return 'audio';

        case 'doc':
        case 'docx':
        case 'xls':
        case 'xlsx':
        case 'ppt':
        case 'pptx':
          return 'document';

        default:
          return 'other';
      }
    }

    return 'other';
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  downloadFile(): void {
    const fileGuid = this.selectedFileGuid();

    if (!fileGuid) {
      this._viewerState.update(state => ({
        ...state,
        hasError: true,
        errorMessage: 'شناسه فایل موجود نیست'
      }));
      return;
    }

    if (!this.canDownload()) {
      return;
    }

    this.downloadRequested.emit(fileGuid);
  }

  closeModal(): void {
    this.resetViewer();
    this.modalClosed.emit();
  }

  retryLoading(): void {
    const fileData = this.fileData();
    if (fileData) {
      this.loadFileData(fileData);
    }
  }

  private resetViewer(): void {
    this._viewerState.set({
      displayFileUrl: null,
      displayFileName: '',
      displayFileType: 'other',
      displayFileContent: '',
      selectedFileGuid: '',
      isLoading: false,
      hasError: false,
      errorMessage: ''
    });
  }

  // Helper methods for template
  getFileTypeIcon(): string {
    const type = this.displayFileType();
    const iconMap: Record<FileDisplayType, string> = {
      image: 'bi-image',
      pdf: 'bi-file-earmark-pdf',
      text: 'bi-file-earmark-text',
      video: 'bi-camera-video',
      audio: 'bi-music-note',
      document: 'bi-file-earmark-word',
      other: 'bi-file-earmark'
    };

    return iconMap[type];
  }

  getFileTypeDescription(): string {
    const type = this.displayFileType();
    const descriptionMap: Record<FileDisplayType, string> = {
      image: 'تصویر',
      pdf: 'فایل PDF',
      text: 'فایل متنی',
      video: 'ویدیو',
      audio: 'فایل صوتی',
      document: 'سند',
      other: 'فایل'
    };

    return descriptionMap[type];
  }

  isPreviewSupported(): boolean {
    const type = this.displayFileType();
    return ['image', 'pdf', 'text'].includes(type);
  }

  // Advanced features
  readonly zoomLevel = signal<number>(100);
  readonly rotation = signal<number>(0);

  zoomIn(): void {
    this.zoomLevel.update(current => Math.min(current + 25, 200));
  }

  zoomOut(): void {
    this.zoomLevel.update(current => Math.max(current - 25, 50));
  }

  resetZoom(): void {
    this.zoomLevel.set(100);
  }

  rotateClockwise(): void {
    this.rotation.update(current => (current + 90) % 360);
  }

  rotateCounterClockwise(): void {
    this.rotation.update(current => (current - 90 + 360) % 360);
  }

  resetRotation(): void {
    this.rotation.set(0);
  }

  // Computed styles for transformations
  readonly transformStyle = computed(() => {
    const zoom = this.zoomLevel() / 100;
    const rotate = this.rotation();
    return `transform: scale(${zoom}) rotate(${rotate}deg);`;
  });

  // Fullscreen functionality
  readonly isFullscreen = signal<boolean>(false);

  toggleFullscreen(): void {
    this.isFullscreen.update(current => !current);
  }

  exitFullscreen(): void {
    this.isFullscreen.set(false);
  }
}