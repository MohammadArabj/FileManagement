import { Component, input, output, signal, computed, effect, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FileService } from '../../../../../services/file.service';
import { CodeFlowService } from '../../../../../services/framework-services/code-flow.service';
import { ToastService } from '../../../../../services/framework-services/toast.service';

declare var Swal: any;

interface FileAttachment {
id: string;
  guid: string;
  file: string; // base64
  contentType: string;
  fileName: string;
  fileSize?: number;
  uploadDate?: string;
}

interface FileViewData {
  guid?: string;
  url?: string;
  type?: string;
  name?: string;
  content?: string;
}

interface FileOperationState {
  downloadingFiles: Set<string>;
  deletingFiles: Set<string>;
  viewingFiles: Set<string>;
  errors: Map<string, string>;
}

type FileDisplayType = 'image' | 'pdf' | 'text' | 'video' | 'audio' | 'document' | 'other';

@Component({
  selector: 'app-file-management-modal',
  standalone: true,
  templateUrl: './file-management-modal.html',
  styleUrl: './file-management-modal.css',
})
export class FileManagementModalComponent {
  private fileService = inject(FileService);
  private codeFlowService = inject(CodeFlowService);
  private toastService = inject(ToastService);

  // Input signals
  attachments = input<FileAttachment[]>([]);
  roleId = input<any>();
  statusId = input<any>();

  // Output signals
  fileViewed = output<FileViewData>();
  fileDownloaded = output<string>();
  fileDeleted = output<string>();
  modalClosed = output<void>();

  // Internal state signals
  private _operationState = signal<FileOperationState>({
    downloadingFiles: new Set(),
    deletingFiles: new Set(),
    viewingFiles: new Set(),
    errors: new Map()
  });

  private _selectedFileGuid = signal<string | null>(null);
  private _sortBy = signal<'name' | 'size' | 'type' | 'date'>('name');
  private _sortDirection = signal<'asc' | 'desc'>('asc');
  private _filterType = signal<FileDisplayType | 'all'>('all');
  private _searchTerm = signal<string>('');

  // Readonly accessors
  readonly operationState = this._operationState.asReadonly();
  readonly selectedFileGuid = this._selectedFileGuid.asReadonly();
  readonly sortBy = this._sortBy.asReadonly();
  readonly sortDirection = this._sortDirection.asReadonly();
  readonly filterType = this._filterType.asReadonly();
  readonly searchTerm = this._searchTerm.asReadonly();

  // Computed signals for file operations
  readonly processedAttachments = computed(() => {
    return this.attachments().map(attachment => ({
      ...attachment,
      displayType: this.determineFileType(attachment.contentType, attachment.fileName),
      formattedSize: this.formatFileSize(attachment.fileSize || 0),
      isSelected: attachment.guid === this._selectedFileGuid()
    }));
  });

  readonly filteredAttachments = computed(() => {
    let files = this.processedAttachments();

    // Apply search filter
    const searchTerm = this._searchTerm().toLowerCase();
    if (searchTerm) {
      files = files.filter(file =>
        file.fileName.toLowerCase().includes(searchTerm)
      );
    }

    // Apply type filter
    const filterType = this._filterType();
    if (filterType !== 'all') {
      files = files.filter(file => file.displayType === filterType);
    }

    return files;
  });

  readonly sortedAttachments = computed(() => {
    const files = [...this.filteredAttachments()];
    const sortBy = this._sortBy();
    const direction = this._sortDirection();

    files.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortBy) {
        case 'name':
          aValue = a.fileName.toLowerCase();
          bValue = b.fileName.toLowerCase();
          break;
        case 'size':
          aValue = a.fileSize || 0;
          bValue = b.fileSize || 0;
          break;
        case 'type':
          aValue = a.displayType;
          bValue = b.displayType;
          break;
        case 'date':
          aValue = new Date(a.uploadDate || 0);
          bValue = new Date(b.uploadDate || 0);
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    return files;
  });

  readonly fileTypeGroups = computed(() => {
    const attachments = this.processedAttachments();
    const groups = new Map<FileDisplayType, number>();

    attachments.forEach(file => {
      const count = groups.get(file.displayType) || 0;
      groups.set(file.displayType, count + 1);
    });

    return Array.from(groups.entries()).map(([type, count]) => ({
      type,
      count,
      label: this.getFileTypeLabel(type)
    }));
  });

  readonly totalFileSize = computed(() => {
    const total = this.attachments().reduce((sum, file) => sum + (file.fileSize || 0), 0);
    return this.formatFileSize(total);
  });

  readonly hasFiles = computed(() => this.attachments().length > 0);
  readonly filteredFileCount = computed(() => this.filteredAttachments().length);

  // Permission computed signals
  readonly canViewFiles = computed(() => {
    // Add your permission logic here
    return true; // For now, allow all
  });

  readonly canDownloadFiles = computed(() => {
    // Add your permission logic here based on roleId, statusId
    return true; // For now, allow all
  });

  readonly canDeleteFiles = computed(() => {
    const roleId = this.roleId();
    const statusId = this.statusId();
    // Add your permission logic here
    return [1, 2, 3].includes(roleId) && ![4, 6].includes(statusId);
  });

  constructor() {
    // Effect for logging file operations
    effect(() => {
      const state = this._operationState();
      const operationsCount = state.downloadingFiles.size +
                            state.deletingFiles.size +
                            state.viewingFiles.size;

      if (operationsCount > 0) {
      }
    });

    // Effect for error handling
    effect(() => {
      const errors = this._operationState().errors;
      errors.forEach((message, fileGuid) => {
        this.toastService.error(`خطا در پردازش فایل: ${message}`);
      });

      if (errors.size > 0) {
        // Clear errors after showing them
        this._operationState.update(state => ({
          ...state,
          errors: new Map()
        }));
      }
    });
  }

  viewFile(fileGuid: string, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (!this.canViewFiles()) {
      this.toastService.error('شما مجوز مشاهده فایل را ندارید.');
      return;
    }

    // Update operation state
    this._operationState.update(state => ({
      ...state,
      viewingFiles: new Set(state.viewingFiles).add(fileGuid)
    }));

    try {
      const attachment = this.attachments().find((file: any) => file.guid === fileGuid);

      if (!attachment) {
        this.handleFileError(fileGuid, 'فایل یافت نشد');
        return;
      }

      const blob = new Blob([this.base64ToArrayBuffer(attachment.file)], {
        type: attachment.contentType,
      });

      const fileUrl = URL.createObjectURL(blob);
      const fileType = this.determineFileType(attachment.contentType, attachment.fileName);

      if (fileType === 'text') {
        const reader = new FileReader();
        reader.onload = () => {
          const fileContent = reader.result as string;
          this.fileViewed.emit({
            guid: fileGuid,
            url: fileUrl,
            type: fileType,
            name: attachment.fileName,
            content: fileContent
          });
          this.completeOperation(fileGuid, 'viewing');
        };
        reader.onerror = () => {
          this.handleFileError(fileGuid, 'خطا در خواندن فایل متنی');
        };
        reader.readAsText(blob);
      } else {
        this.fileViewed.emit({
          guid: fileGuid,
          url: fileUrl,
          type: fileType,
          name: attachment.fileName
        });
        this.completeOperation(fileGuid, 'viewing');
      }

    } catch (error) {
      this.handleFileError(fileGuid, 'خطا در پردازش فایل');
      console.error('Error viewing file:', error);
    }
  }

  downloadFile(fileGuid: string): void {
    if (!this.canDownloadFiles()) {
      this.toastService.error('شما مجوز دانلود فایل را ندارید.');
      return;
    }

    // Update operation state
    this._operationState.update(state => ({
      ...state,
      downloadingFiles: new Set(state.downloadingFiles).add(fileGuid)
    }));

    try {
      const attachment = this.attachments().find((file: any) => file.guid === fileGuid);

      if (attachment) {
        // Download from local data
        this.downloadFromBlob(attachment, fileGuid);
      } else {
        // Fallback to server download
        this.downloadFromServer(fileGuid);
      }
    } catch (error) {
      this.handleFileError(fileGuid, 'خطا در دانلود فایل');
      console.error('Error downloading file:', error);
    }
  }

  private downloadFromBlob(attachment: FileAttachment, fileGuid: string): void {
    try {
      const blob = new Blob([this.base64ToArrayBuffer(attachment.file)], {
        type: attachment.contentType,
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = attachment.fileName || 'downloaded-file';
      document.body.appendChild(a);
      a.click();

      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      this.fileDownloaded.emit(fileGuid);
      this.completeOperation(fileGuid, 'downloading');

    } catch (error) {
      this.handleFileError(fileGuid, 'خطا در ایجاد فایل برای دانلود');
    }
  }

  private downloadFromServer(fileGuid: string): void {
    const token = this.codeFlowService.getToken();

    fetch(`${this.fileService.baseUrl}/Download/${fileGuid}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.blob();
    })
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = fileGuid;
      document.body.appendChild(a);
      a.click();

      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      this.fileDownloaded.emit(fileGuid);
      this.completeOperation(fileGuid, 'downloading');
    })
    .catch(error => {
      this.handleFileError(fileGuid, 'خطا در دانلود از سرور');
      console.error('Error downloading from server:', error);
    });
  }

  confirmDeleteFile(fileGuid: string): void {
    if (!this.canDeleteFiles()) {
      this.toastService.error('شما مجوز حذف فایل را ندارید.');
      return;
    }

    const attachment = this.attachments().find(file => file.guid === fileGuid);
    const fileName = attachment?.fileName || 'این فایل';

    Swal.fire({
      title: 'حذف فایل پیوست',
      text: `آیا از حذف "${fileName}" اطمینان دارید؟`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'بله، حذف شود',
      cancelButtonText: 'خیر',
      reverseButtons: true
    }).then((result: { isConfirmed: any }) => {
      if (result.isConfirmed) {
        this.deleteFile(fileGuid);
      }
    });
  }

  private deleteFile(fileGuid: string): void {
    // Update operation state
    this._operationState.update(state => ({
      ...state,
      deletingFiles: new Set(state.deletingFiles).add(fileGuid)
    }));

    // Simulate deletion process or call actual service
    setTimeout(() => {
      this.fileDeleted.emit(fileGuid);
      this.completeOperation(fileGuid, 'deleting');
    }, 500);
  }

  private completeOperation(fileGuid: string, operation: 'downloading' | 'deleting' | 'viewing'): void {
    this._operationState.update(state => {
      const newState = { ...state };

      switch (operation) {
        case 'downloading':
          newState.downloadingFiles = new Set(state.downloadingFiles);
          newState.downloadingFiles.delete(fileGuid);
          break;
        case 'deleting':
          newState.deletingFiles = new Set(state.deletingFiles);
          newState.deletingFiles.delete(fileGuid);
          break;
        case 'viewing':
          newState.viewingFiles = new Set(state.viewingFiles);
          newState.viewingFiles.delete(fileGuid);
          break;
      }

      return newState;
    });
  }

  private handleFileError(fileGuid: string, errorMessage: string): void {
    this._operationState.update(state => ({
      ...state,
      downloadingFiles: new Set([...state.downloadingFiles].filter(id => id !== fileGuid)),
      deletingFiles: new Set([...state.deletingFiles].filter(id => id !== fileGuid)),
      viewingFiles: new Set([...state.viewingFiles].filter(id => id !== fileGuid)),
      errors: new Map(state.errors).set(fileGuid, errorMessage)
    }));
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  private determineFileType(contentType: string, fileName: string): FileDisplayType {
    if (contentType.includes('image')) return 'image';
    if (contentType === 'application/pdf') return 'pdf';
    if (contentType.includes('text')) return 'text';
    if (contentType.includes('video')) return 'video';
    if (contentType.includes('audio')) return 'audio';
    if (contentType.includes('document') ||
        contentType.includes('word') ||
        contentType.includes('excel') ||
        contentType.includes('powerpoint')) return 'document';

    // Check by file extension
    const extension = fileName.toLowerCase().split('.').pop();
    switch (extension) {
      case 'jpg': case 'jpeg': case 'png': case 'gif': case 'bmp': case 'svg': case 'webp':
        return 'image';
      case 'pdf':
        return 'pdf';
      case 'txt': case 'json': case 'xml': case 'csv': case 'log':
        return 'text';
      case 'mp4': case 'avi': case 'mov': case 'wmv': case 'webm':
        return 'video';
      case 'mp3': case 'wav': case 'ogg': case 'aac':
        return 'audio';
      case 'doc': case 'docx': case 'xls': case 'xlsx': case 'ppt': case 'pptx':
        return 'document';
      default:
        return 'other';
    }
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private getFileTypeLabel(type: FileDisplayType): string {
    const labels: Record<FileDisplayType, string> = {
      image: 'تصاویر',
      pdf: 'فایل‌های PDF',
      text: 'فایل‌های متنی',
      video: 'ویدیوها',
      audio: 'فایل‌های صوتی',
      document: 'اسناد',
      other: 'سایر'
    };
    return labels[type];
  }

  closeModal(): void {
    this.modalClosed.emit();
  }

  // File selection methods
  selectFile(fileGuid: string): void {
    this._selectedFileGuid.set(fileGuid);
  }

  clearSelection(): void {
    this._selectedFileGuid.set(null);
  }

  // Sorting and filtering methods
  setSortBy(sortBy: 'name' | 'size' | 'type' | 'date'): void {
    if (this._sortBy() === sortBy) {
      // Toggle direction if same column
      this._sortDirection.update(current => current === 'asc' ? 'desc' : 'asc');
    } else {
      this._sortBy.set(sortBy);
      this._sortDirection.set('asc');
    }
  }

  setFilterType(filterType: FileDisplayType | 'all'): void {
    this._filterType.set(filterType);
  }

  setSearchTerm(searchTerm: string): void {
    this._searchTerm.set(searchTerm);
  }

  clearFilters(): void {
    this._filterType.set('all');
    this._searchTerm.set('');
  }

  // Bulk operations
  downloadAllFiles(): void {
    if (!this.canDownloadFiles()) {
      this.toastService.error('شما مجوز دانلود فایل‌ها را ندارید.');
      return;
    }

    const files = this.filteredAttachments();
    files.forEach(file => this.downloadFile(file.guid));
  }

  deleteSelectedFiles(): void {
    const selectedFile = this._selectedFileGuid();
    if (selectedFile) {
      this.confirmDeleteFile(selectedFile);
    } else {
      this.toastService.warning('لطفاً ابتدا فایلی را انتخاب کنید.');
    }
  }

  // Helper methods for template
  isFileOperationInProgress(fileGuid: string, operation: 'downloading' | 'deleting' | 'viewing'): boolean {
    const state = this._operationState();
    switch (operation) {
      case 'downloading':
        return state.downloadingFiles.has(fileGuid);
      case 'deleting':
        return state.deletingFiles.has(fileGuid);
      case 'viewing':
        return state.viewingFiles.has(fileGuid);
      default:
        return false;
    }
  }

  getFileIcon(type: FileDisplayType): string {
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

  getSortIcon(column: string): string {
    if (this._sortBy() !== column) return 'bi-arrow-up-down';
    return this._sortDirection() === 'asc' ? 'bi-arrow-up' : 'bi-arrow-down';
  }
}