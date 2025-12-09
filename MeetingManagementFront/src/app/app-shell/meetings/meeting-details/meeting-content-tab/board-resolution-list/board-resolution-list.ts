import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { Component, computed, DestroyRef, effect, inject, input, output, signal, TemplateRef, ViewChild } from '@angular/core';
import { Collapse } from 'bootstrap';
import { MeetingDetails } from '../../../../../core/models/Meeting';
import { Resolution } from '../../../../../core/models/Resolution';
import { NgClass } from '@angular/common';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { FileMeetingService } from '../../../../../services/file-meeting.service';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { base64ToArrayBuffer } from '../../../../../core/types/configuration';
declare var Swal: any;
interface FileItem {
  id?: number;
  name?: string;
  size?: number;
  sizeFormatted?: string;
  url: string;
  uploadDate: string;
  type: string;
  file?: File;
  guid?: string;
  isAgendaFile?: boolean;
}

@Component({
  selector: 'app-board-resolution-list',
  templateUrl: './board-resolution-list.html',
  styleUrl: './board-resolution-list.css'
})
export class BoardResolutionList {
  private destroyRef = inject(DestroyRef);
  private fileMeetingService = inject(FileMeetingService);
  private sanitizer = inject(DomSanitizer);

  expandedResolutionIndex: number | null = null;
  @ViewChild('descriptionModal') descriptionModal!: TemplateRef<any>;
  @ViewChild('documentationModal') documentationModal!: TemplateRef<any>;
  private modalService = inject(NgbModal);
  modalRef: any = null;
  modalContent: string = '';

  // File management signals
  private readonly _selectedResolutionFiles = signal<Map<number, FileItem[]>>(new Map());
  private readonly _selectedFileForPreview = signal<FileItem | null>(null);
  private readonly _showFilePreview = signal<boolean>(false);
  private readonly _loadingFiles = signal<Set<number>>(new Set());
  private readonly _deletingFiles = signal<Set<number>>(new Set());
  private readonly _pdfUrl = signal<SafeResourceUrl | null>(null);

  // Public readonly signals
  readonly selectedResolutionFiles = this._selectedResolutionFiles.asReadonly();
  readonly selectedFileForPreview = this._selectedFileForPreview.asReadonly();
  readonly showFilePreview = this._showFilePreview.asReadonly();
  readonly loadingFiles = this._loadingFiles.asReadonly();
  readonly deletingFiles = this._deletingFiles.asReadonly();
  readonly pdfUrl = this._pdfUrl.asReadonly();

  // Input signals
  resolutions = input<Resolution[]>([]);
  canDrag = input<boolean>(false);
  canEditResolution = input<boolean>(false);
  canAddResolution = input<boolean>(false);
  canDeleteResolution = input<boolean>(false);
  canAddAssignment = input<boolean>(false);
  canViewFiles = input<boolean>(false);
  canDeleteFile = input<boolean>(false); // اضافه کردن permission برای حذف فایل
  roleId = input<any>();
  statusId = input<any>();
  meeting = input.required<MeetingDetails | null>();

  // Output signals
  resolutionDropped = output<CdkDragDrop<Resolution[]>>();
  addResolution = output<void>();
  editResolution = output<Resolution>();
  deleteResolution = output<Resolution>();
  assignResolution = output<Resolution>();
  showFiles = output<number>();
  printResolution = output<{ resolution: Resolution; index: number }>();
  editAssignment = output<number>();
  deleteAssignment = output<any>();
  printAllResolutions = output<void>();

  // Internal signals
  private collapseStates = signal<Map<string, boolean>>(new Map());

  // Computed signals
  hasResolutions = computed(() => this.resolutions().length > 0);
  dragEnabled = computed(() => this.canDrag() && this.hasResolutions());
  resolutionHasFiles = computed(() => {
    const filesMap = this._selectedResolutionFiles();
    return (resolutionId: number) => {
      const files = filesMap.get(resolutionId);
      return files && files.length > 0;
    };
  });

  getFilesCount = computed(() => {
    const filesMap = this._selectedResolutionFiles();
    return (resolutionId: number) => {
      const files = filesMap.get(resolutionId);
      return files ? files.length : 0;
    };
  });

  printAllResolutionsClicked() {
    this.printAllResolutions.emit();
  }

  refreshFilesForResolution(resolutionId: number): void {
    this._selectedResolutionFiles.update(filesMap => {
      const newMap = new Map(filesMap);
      const existingFiles = newMap.get(resolutionId) || [];

      existingFiles.forEach(file => {
        if (file.url && file.url.startsWith('blob:') && !file.isAgendaFile) {
          URL.revokeObjectURL(file.url);
        }
      });

      newMap.delete(resolutionId);
      return newMap;
    });

    this.loadFilesForResolution(resolutionId);
  }

  refreshFilesRequested = output<number>();

  public refreshFiles(resolutionId: number): void {
    this.refreshFilesForResolution(resolutionId);
  }

  constructor() {
    effect(() => {
      const resolutionCount = this.resolutions().length;
    });

    effect(() => {
      const resolutions = this.resolutions();
      if (resolutions.length > 0) {
        resolutions.forEach(resolution => {
          if (resolution.id) {
            const hasFiles = this._selectedResolutionFiles().has(resolution.id);
            if (!hasFiles && !this._loadingFiles().has(resolution.id)) {
              this.loadFilesForResolution(resolution.id);
            }
          }
        });
      }
    });
  }

  getFilesForResolution(resolutionId: number): FileItem[] {
    return this._selectedResolutionFiles().get(resolutionId) || [];
  }

  isLoadingFiles(resolutionId: number): boolean {
    return this._loadingFiles().has(resolutionId);
  }

  isDeletingFile(fileId: number): boolean {
    return this._deletingFiles().has(fileId);
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 بایت';
    const k = 1024;
    const sizes = ['بایت', 'کیلوبایت', 'مگابایت', 'گیگابایت'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  closeFilePreview(): void {
    this._selectedFileForPreview.set(null);
    this._showFilePreview.set(false);
  }

  confirmDeleteFile(file: FileItem, resolutionId: number): void {
    if (!file.id) return;

    Swal.fire({
      title: 'حذف فایل پیوست',
      text: `آیا از حذف "${file.name}" اطمینان دارید؟`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'بله، حذف شود',
      cancelButtonText: 'خیر',
      reverseButtons: true
    }).then((result: { isConfirmed: any }) => {
      if (result.isConfirmed) {
        this._deletingFiles.update(deleting => new Set([...deleting, file.id!]));

        this.fileMeetingService.deleteFile(file.id).subscribe({
          next: () => {
            // حذف فایل از لیست
            this._selectedResolutionFiles.update(filesMap => {
              const newMap = new Map(filesMap);
              const files = newMap.get(resolutionId) || [];
              const updatedFiles = files.filter(f => f.id !== file.id);
              newMap.set(resolutionId, updatedFiles);
              return newMap;
            });

            // اگر فایل در حال preview است، پیش‌نمایش را ببند
            if (this._selectedFileForPreview()?.id === file.id) {
              this.closeFilePreview();
            }

            // پاک کردن blob URL اگر وجود دارد
            if (file.url && file.url.startsWith('blob:')) {
              URL.revokeObjectURL(file.url);
            }

            this._deletingFiles.update(deleting => {
              const newSet = new Set(deleting);
              newSet.delete(file.id!);
              return newSet;
            });
          },
          error: (error) => {
            console.error('Error deleting file:', error);
            this._deletingFiles.update(deleting => {
              const newSet = new Set(deleting);
              newSet.delete(file.id!);
              return newSet;
            });
            alert('خطا در حذف فایل');
          }
        });
      }
    });
  }


  openDescriptionModal(html: string) {
    this.modalContent = html;
    this.modalRef = this.modalService.open(this.descriptionModal, { centered: true, size: 'lg' });
  }

  openDocumentationModal(html: string) {
    this.modalContent = html;
    this.modalRef = this.modalService.open(this.documentationModal, { centered: true, size: 'lg' });
  }

  closeModal() {
    if (this.modalRef) {
      this.modalRef.close();
    }
  }

  toggleResolutionExpanded(index: number) {
    this.expandedResolutionIndex = this.expandedResolutionIndex === index ? null : index;
  }

  onDrop(event: CdkDragDrop<Resolution[]>) {
    this.resolutionDropped.emit(event);
  }

  openAddResolutionModal() {
    this.addResolution.emit();
  }

  openEditResolutionModal(resolution: Resolution) {
    this.editResolution.emit(resolution);
  }

  deleteResolutionClicked(resolution: Resolution) {
    this.deleteResolution.emit(resolution);
  }

  assignResolutionClicked(resolution: Resolution) {
    this.assignResolution.emit(resolution);
  }

  showFilesClicked(resolutionId: number) {
    this.showFiles.emit(resolutionId);
  }

  printResolutionClicked(resolution: Resolution, index: number) {
    this.printResolution.emit({ resolution, index });
  }

  toggleCollapse(id: string) {
    const collapseElement = document.getElementById(`${id}`);
    if (collapseElement) {
      const bsCollapse = new Collapse(collapseElement, {
        toggle: false,
      });

      const isCurrentlyOpen = collapseElement.classList.contains('show');

      this.collapseStates.update(states => {
        const newStates = new Map(states);
        newStates.set(id, !isCurrentlyOpen);
        return newStates;
      });

      if (isCurrentlyOpen) {
        bsCollapse.hide();
      } else {
        bsCollapse.show();
      }
    }
  }

  isCollapsed(id: string): boolean {
    return this.collapseStates().get(id) ?? false;
  }

  trackByFn(index: number, item: Resolution): any {
    return item.id ?? index;
  }

  editAssignmentClicked(assignId: number) {
    this.editAssignment.emit(assignId);
  }

  deleteAssignmentClicked(assign: any) {
    this.deleteAssignment.emit(assign);
  }

  canPerformActions = computed(() => ({
    edit: this.canEditResolution(),
    delete: this.canDeleteResolution(),
    assign: this.canAddAssignment(),
    viewFiles: this.canViewFiles(),
    deleteFile: this.canDeleteFile()
  }));

  getResolutionByIndex(index: number): Resolution | undefined {
    return this.resolutions()[index];
  }

  openFileInFullScreen(file: FileItem): void {
    if (!file) {
      console.error('فایل معتبر نیست');
      return;
    }

    let fileUrl = '';

    // اگر فایل base64 دارد، از آن استفاده کن
    if (file.file) {
      try {
        const base64Data = file.file;
        const contentType = 'application/pdf';
        fileUrl = `data:${contentType};base64,${base64Data}`;
      } catch (error) {
        console.error('خطا در تبدیل base64:', error);
      }
    }
    // اگر URL موجود است، از آن استفاده کن
    else if (file.url) {
      fileUrl = file.url;
    }

    // بررسی نهایی
    if (!fileUrl) {
      console.error('URL فایل در دسترس نیست');
      alert('خطا در باز کردن فایل. لطفاً دوباره تلاش کنید.');
      return;
    }

    console.log('Opening file in fullscreen:', {
      name: file.name,
      hasFile: !!file.file,
      hasUrl: !!file.url,
      urlType: fileUrl.startsWith('data:') ? 'data' : fileUrl.startsWith('blob:') ? 'blob' : 'other'
    });

    const newWindow = window.open('', '_blank', 'width=1200,height=800');

    if (!newWindow) {
      alert('مرورگر شما باز کردن پنجره جدید را مسدود کرده است.');
      return;
    }

    try {
      newWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${file.name || 'فایل PDF'}</title>
          <meta charset="UTF-8">
          <style>
            body { 
              margin: 0; 
              padding: 0; 
              height: 100vh; 
              overflow: hidden; 
              background: #525659;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .loading {
              color: white;
              font-family: Tahoma, sans-serif;
              font-size: 18px;
            }
            .error {
              color: #ff6b6b;
              font-family: Tahoma, sans-serif;
              font-size: 16px;
              text-align: center;
              padding: 20px;
            }
            embed, iframe { 
              width: 100%; 
              height: 100%; 
              border: none;
              display: block;
            }
          </style>
        </head>
        <body>
          <div class="loading" id="loading">در حال بارگذاری...</div>
          <embed id="pdfEmbed" style="display:none;" src="${fileUrl}#toolbar=1&navpanes=1&scrollbar=1" type="application/pdf">
          <script>
            window.onload = function() {
              const loading = document.getElementById('loading');
              const embed = document.getElementById('pdfEmbed');
              
              setTimeout(() => {
                if (embed) {
                  embed.style.display = 'block';
                  if (loading) loading.style.display = 'none';
                } else {
                  if (loading) {
                    loading.className = 'error';
                    loading.innerHTML = 'خطا در بارگذاری فایل PDF<br><a href="${fileUrl}" download style="color: white;">دانلود فایل</a>';
                  }
                }
              }, 500);
            };
          </script>
        </body>
        </html>
      `);
      newWindow.document.close();
    } catch (error) {
      console.error('خطا در ایجاد محتوای پنجره:', error);
      newWindow.close();
      alert('خطا در نمایش فایل');
    }
  }

  downloadFile(file: FileItem): void {
    if (file.url) {
      const link = document.createElement('a');
      link.href = file.url;
      link.download = file.name || 'file.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (file.file) {
      const base64Data = file.file;
      const contentType = 'application/pdf';
      const dataUrl = `data:${contentType};base64,${base64Data}`;

      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = file.name || 'file.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
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

  loadFilesForResolution(resolutionId: number): void {
    if (this._loadingFiles().has(resolutionId)) return;

    this._loadingFiles.update(loading => new Set([...loading, resolutionId]));

    this.fileMeetingService.getFiles(resolutionId, 'Resolution').subscribe({
      next: (files: any) => {
        console.log('Loading files for resolution:', resolutionId, files);

        const processedFiles: FileItem[] = files.map((file: any, index: any) => {
          const dataUrl = this.createFileUrl(file);

          return {
            id: file.id || (Date.now() + index + Math.random()),
            name: file.fileName,
            size: file.size || 0,
            sizeFormatted: this.formatFileSize(file.size || 0),
            url: dataUrl,
            uploadDate: new Date().toLocaleDateString('fa-IR'),
            type: 'pdf',
            file: file.file,
            guid: file.guid,
            isAgendaFile: false
          };
        });

        this._selectedResolutionFiles.update(filesMap => {
          const newMap = new Map(filesMap);
          newMap.set(resolutionId, processedFiles);
          return newMap;
        });

        this._loadingFiles.update(loading => {
          const newSet = new Set(loading);
          newSet.delete(resolutionId);
          return newSet;
        });
      },
      error: (error) => {
        console.error('Error loading files for resolution:', error);
        this._loadingFiles.update(loading => {
          const newSet = new Set(loading);
          newSet.delete(resolutionId);
          return newSet;
        });
      }
    });
  }

  selectFileForPreview(file: FileItem): void {
    console.log('Selected file:', file);

    if (file.file) {
      const dataUrl = file.url;
      const safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(dataUrl);
      this._pdfUrl.set(safeUrl);
    } else if (file.url) {
      console.log('Using existing URL:', file.url);
      const safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(file.url);
      this._pdfUrl.set(safeUrl);
    } else {
      console.warn('Neither file.file nor file.url is available');
    }

    this._selectedFileForPreview.set(file);
    this._showFilePreview.set(true);
  }
}