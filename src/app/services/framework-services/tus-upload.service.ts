import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject, firstValueFrom, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import * as tus from 'tus-js-client';
import { environment } from '../../../environments/environment';
import { ACCESS_TOKEN_NAME } from '../../core/types/configuration';
import { getClientSettings } from './code-flow.service';

// ============================================
// Enums & Types
// ============================================

export enum UploadStatus {
  Pending = 0,
  Created = 1,
  InProgress = 2,
  Paused = 3,
  Completed = 4,
  Failed = 5,
  Cancelled = 6,
}

export interface FileItem {
  id: string;
  file: File | null;
  name: string;
  size: number;
  type: string;
  status: UploadStatus;
  progress: number;
  uploadedBytes: number;
  speed: number;
  remainingTime: number;
  errorMessage?: string;
  sessionGuid?: string;
  tusFileId?: string;
  realTusFileId?: string;
  fileGuid?: string;
  tusUpload?: tus.Upload;
  startTime?: number;
  previewUrl?: string;
  isExisting: boolean;
}

export interface ExistingFile {
  guid: string;
  fileName: string;
  originalFileName?: string;
  contentType: string;
  fileSize: number;
  path?: string;
}

export interface UploadOptions {
  folderPath: string;
  description?: string;
}

interface InitiateUploadResult {
  sessionGuid: string;
  tusFileId: string;
  uploadUrl: string;
  expiresAt: string;
}

interface CompleteUploadResult {
  fileGuid: string;
  fileName: string;
  fileSize: number;
  contentType: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

// ============================================
// Cache
// ============================================
const fileInfoCache = new Map<string, ExistingFile>();

// ============================================
// TUS Upload Service
// ============================================

@Injectable({ providedIn: 'root' })
export class TusUploadService {
  private readonly http = inject(HttpClient);

  private readonly uploadApiUrl = environment.fileManagementEndpoint + '/api/Upload';
  private readonly tusEndpoint = environment.fileManagementEndpoint + '/api/Upload/tus';
  private readonly attachmentUrl = environment.fileManagementEndpoint + '/api/Attachment';

  // State - همه فایل‌ها در یک Map
  private readonly _files = signal<Map<string, FileItem>>(new Map());
  private readonly _isLoadingExisting = signal(false);

  // Computed
  readonly files = computed(() => Array.from(this._files().values()));
  readonly isLoadingExisting = this._isLoadingExisting.asReadonly();

  readonly existingFiles = computed(() =>
    this.files().filter(f => f.isExisting)
  );

  readonly newFiles = computed(() =>
    this.files().filter(f => !f.isExisting)
  );

  readonly pendingFiles = computed(() =>
    this.files().filter(f => f.status === UploadStatus.Pending)
  );

  readonly uploadingFiles = computed(() =>
    this.files().filter(f => f.status === UploadStatus.InProgress || f.status === UploadStatus.Created)
  );

  readonly completedFiles = computed(() =>
    this.files().filter(f => f.status === UploadStatus.Completed)
  );

  readonly failedFiles = computed(() =>
    this.files().filter(f => f.status === UploadStatus.Failed)
  );

  readonly isUploading = computed(() => this.uploadingFiles().length > 0);

  readonly totalProgress = computed(() => {
    const uploading = this.uploadingFiles();
    if (uploading.length === 0) return 0;
    const total = uploading.reduce((sum, f) => sum + f.size, 0);
    const uploaded = uploading.reduce((sum, f) => sum + f.uploadedBytes, 0);
    return total > 0 ? Math.round((uploaded / total) * 100) : 0;
  });

  readonly totalFiles = computed(() => this.files().length);

  // Events
  private readonly _fileCompleted$ = new Subject<FileItem>();
  private readonly _fileFailed$ = new Subject<{ file: FileItem; error: string }>();
  private readonly _allCompleted$ = new Subject<FileItem[]>();

  readonly fileCompleted$ = this._fileCompleted$.asObservable();
  readonly fileFailed$ = this._fileFailed$.asObservable();
  readonly allCompleted$ = this._allCompleted$.asObservable();

  // ============================================
  // لود فایل‌های موجود
  // ============================================

  async loadExistingFiles(fileGuids: string[]): Promise<void> {
    if (!fileGuids?.length) return;

    this._isLoadingExisting.set(true);

    try {
      const cached: ExistingFile[] = [];
      const toLoad: string[] = [];

      for (const guid of fileGuids) {
        const cachedFile = fileInfoCache.get(guid);
        if (cachedFile) {
          cached.push(cachedFile);
        } else {
          toLoad.push(guid);
        }
      }

      // اضافه کردن cache شده‌ها
      for (const file of cached) {
        this.addExistingFileToState(file);
      }

      // لود موازی فایل‌های جدید
      if (toLoad.length > 0) {
        const results = await this.batchLoadFileInfo(toLoad);
        for (const file of results) {
          if (file) {
            fileInfoCache.set(file.guid, file);
            this.addExistingFileToState(file);
          }
        }
      }
    } catch (err) {
      console.error('Error loading existing files:', err);
    } finally {
      this._isLoadingExisting.set(false);
    }
  }

  private async batchLoadFileInfo(guids: string[]): Promise<(ExistingFile | null)[]> {
    const requests = guids.map(guid =>
      this.http.get<ExistingFile>(`${this.attachmentUrl}/GetFile/${guid}`).pipe(
        map(file => ({ ...file, guid })),
        catchError(() => of(null))
      )
    );
    return firstValueFrom(forkJoin(requests));
  }

  private addExistingFileToState(file: ExistingFile): void {
    const item: FileItem = {
      id: file.guid,
      file: null,
      name: file.fileName,
      size: file.fileSize,
      type: file.contentType,
      status: UploadStatus.Completed,
      progress: 100,
      uploadedBytes: file.fileSize,
      speed: 0,
      remainingTime: 0,
      fileGuid: file.guid,
      isExisting: true,
      previewUrl: this.getPreviewUrl(file.guid)
    };

    this._files.update(files => {
      const newMap = new Map(files);
      newMap.set(item.id, item);
      return newMap;
    });
  }

  // ============================================
  // اضافه کردن فایل‌های جدید
  // ============================================

  addFiles(fileList: FileList | File[], options?: {
    maxFiles?: number;
    maxSizeMB?: number;
    acceptedTypes?: string[];
  }): FileItem[] {
    const added: FileItem[] = [];
    const fileArray = Array.from(fileList);

    for (const file of fileArray) {
      if (options?.maxFiles && this.totalFiles() >= options.maxFiles) break;

      if (options?.maxSizeMB && file.size > options.maxSizeMB * 1024 * 1024) continue;

      if (options?.acceptedTypes?.length) {
        const accepted = options.acceptedTypes.some(type => {
          if (type === '*') return true;
          if (type.startsWith('.')) return file.name.toLowerCase().endsWith(type.toLowerCase());
          if (type.endsWith('/*')) return file.type.startsWith(type.replace('/*', '/'));
          return file.type === type;
        });
        if (!accepted) continue;
      }

      const item = this.createFileItem(file);
      this.updateFile(item);
      added.push(item);
    }

    return added;
  }

  private createFileItem(file: File): FileItem {
    const id = crypto.randomUUID();
    const item: FileItem = {
      id,
      file,
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      status: UploadStatus.Pending,
      progress: 0,
      uploadedBytes: 0,
      speed: 0,
      remainingTime: 0,
      isExisting: false
    };

    if (file.type.startsWith('image/')) {
      item.previewUrl = URL.createObjectURL(file);
    }

    return item;
  }

  // ============================================
  // آپلود
  // ============================================

  async uploadFile(fileId: string, options: UploadOptions): Promise<string | null> {
    const file = this._files().get(fileId);
    if (!file || !file.file) return null;

    try {
      this.updateFileStatus(fileId, UploadStatus.Created);

      const initResponse = await firstValueFrom(
        this.http.post<ApiResponse<InitiateUploadResult>>(`${this.uploadApiUrl}/Initiate`, {
          fileName: file.name,
          fileSize: file.size,
          contentType: file.type,
          clientId: getClientSettings().client_id ?? '',
          folderPath: options.folderPath,
          description: options.description
        })
      );

      if (!initResponse.success || !initResponse.data) {
        throw new Error(initResponse.message || 'خطا در شروع آپلود');
      }

      const session = initResponse.data;
      this.updateFile({
        ...file,
        sessionGuid: session.sessionGuid,
        tusFileId: session.tusFileId
      });

      return new Promise((resolve, reject) => {
        const upload = new tus.Upload(file.file!, {
          endpoint: this.tusEndpoint,
          retryDelays: [0, 1000, 3000, 5000, 10000],
          chunkSize: 5 * 1024 * 1024,
          metadata: {
            filename: file.name,
            filetype: file.type,
            sessionId: session.sessionGuid,
            folderPath: options.folderPath
          },
          headers: {
            'Authorization': `Bearer ${this.getAccessToken()}`
          },

          onError: (error) => {
            this.updateFileStatus(fileId, UploadStatus.Failed, error.message);
            this._fileFailed$.next({ file: this._files().get(fileId)!, error: error.message });
            reject(error);
          },

          onProgress: (bytesUploaded, bytesTotal) => {
            const currentFile = this._files().get(fileId);
            if (!currentFile) return;

            const progress = Math.round((bytesUploaded / bytesTotal) * 100);
            const elapsed = (Date.now() - (currentFile.startTime || Date.now())) / 1000;
            const speed = elapsed > 0 ? bytesUploaded / elapsed : 0;
            const remaining = speed > 0 ? (bytesTotal - bytesUploaded) / speed : 0;

            this.updateFile({
              ...currentFile,
              status: UploadStatus.InProgress,
              progress,
              uploadedBytes: bytesUploaded,
              speed,
              remainingTime: remaining
            });
          },

          onSuccess: async () => {
            const realTusFileId = upload.url?.split('/').pop() || '';

            try {
              const completeResponse = await firstValueFrom(
                this.http.post<ApiResponse<CompleteUploadResult>>(`${this.uploadApiUrl}/Complete`, {
                  sessionGuid: session.sessionGuid,
                  tusFileId: realTusFileId,
                  description: options.description
                })
              );

              if (!completeResponse.success || !completeResponse.data) {
                throw new Error(completeResponse.message || 'خطا در تکمیل آپلود');
              }

              const result = completeResponse.data;
              const currentFile = this._files().get(fileId);
              if (currentFile) {
                this.updateFile({
                  ...currentFile,
                  status: UploadStatus.Completed,
                  progress: 100,
                  uploadedBytes: currentFile.size,
                  realTusFileId,
                  fileGuid: result.fileGuid,
                  previewUrl: this.getPreviewUrl(result.fileGuid)
                });
              }

              this._fileCompleted$.next(this._files().get(fileId)!);
              resolve(result.fileGuid);

            } catch (err: any) {
              this.updateFileStatus(fileId, UploadStatus.Failed, err.message);
              reject(err);
            }
          }
        });

        this.updateFile({
          ...this._files().get(fileId)!,
          tusUpload: upload,
          startTime: Date.now(),
          status: UploadStatus.InProgress
        });

        upload.findPreviousUploads().then(prev => {
          if (prev.length > 0) upload.resumeFromPreviousUpload(prev[0]);
          upload.start();
        });
      });

    } catch (err: any) {
      this.updateFileStatus(fileId, UploadStatus.Failed, err.message);
      return null;
    }
  }

  async uploadAll(options: UploadOptions): Promise<string[]> {
    const pending = this.pendingFiles();
    const results: string[] = [];

    for (const file of pending) {
      const fileGuid = await this.uploadFile(file.id, options);
      if (fileGuid) results.push(fileGuid);
    }

    if (this.pendingFiles().length === 0 && this.uploadingFiles().length === 0) {
      this._allCompleted$.next(this.completedFiles());
    }

    return results;
  }

  pauseUpload(fileId: string): void {
    const file = this._files().get(fileId);
    if (file?.tusUpload && file.status === UploadStatus.InProgress) {
      file.tusUpload.abort();
      this.updateFileStatus(fileId, UploadStatus.Paused);
    }
  }

  resumeUpload(fileId: string): void {
    const file = this._files().get(fileId);
    if (file?.tusUpload && file.status === UploadStatus.Paused) {
      file.tusUpload.start();
      this.updateFileStatus(fileId, UploadStatus.InProgress);
    }
  }

  retryUpload(fileId: string, options: UploadOptions): void {
    const file = this._files().get(fileId);
    if (file && file.status === UploadStatus.Failed) {
      this.updateFileStatus(fileId, UploadStatus.Pending);
      this.uploadFile(fileId, options);
    }
  }

  async cancelUpload(fileId: string): Promise<void> {
    const file = this._files().get(fileId);
    if (!file) return;

    if (file.tusUpload) file.tusUpload.abort();

    if (file.sessionGuid) {
      try {
        await firstValueFrom(
          this.http.post(`${this.uploadApiUrl}/Cancel/${file.sessionGuid}`, {})
        );
      } catch { }
    }

    this.removeFile(fileId);
  }

  // ============================================
  // حذف فایل
  // ============================================

  removeFile(fileId: string): void {
    const file = this._files().get(fileId);
    if (!file) return;

    if (file.tusUpload) file.tusUpload.abort();
    if (file.previewUrl && !file.isExisting) URL.revokeObjectURL(file.previewUrl);

    this._files.update(files => {
      const newMap = new Map(files);
      newMap.delete(fileId);
      return newMap;
    });
  }

  async deleteFile(fileId: string): Promise<boolean> {
    const file = this._files().get(fileId);
    if (!file || !file.fileGuid) {
      this.removeFile(fileId);
      return true;
    }

    try {
      await firstValueFrom(
        this.http.post(`${this.attachmentUrl}/Delete/${file.fileGuid}`, {})
      );
      fileInfoCache.delete(file.fileGuid);
      this.removeFile(fileId);
      return true;
    } catch {
      return false;
    }
  }

  clearAll(): void {
    for (const file of this.files()) {
      if (file.tusUpload) file.tusUpload.abort();
      if (file.previewUrl && !file.isExisting) URL.revokeObjectURL(file.previewUrl);
    }
    this._files.set(new Map());
  }

  clearCompleted(): void {
    this._files.update(files => {
      const newMap = new Map(files);
      for (const [id, file] of newMap) {
        if (file.status === UploadStatus.Completed && !file.isExisting) {
          if (file.previewUrl) URL.revokeObjectURL(file.previewUrl);
          newMap.delete(id);
        }
      }
      return newMap;
    });
  }

  // ============================================
  // Cleanup
  // ============================================

  async cleanupUploadedFiles(): Promise<void> {
    const newCompleted = this.completedFiles().filter(f => !f.isExisting);

    for (const file of newCompleted) {
      if (file.fileGuid) {
        try {
          await firstValueFrom(
            this.http.post(`${this.attachmentUrl}/Delete/${file.fileGuid}`, {})
          );
          fileInfoCache.delete(file.fileGuid);
        } catch (err) {
          console.error(`Error deleting file ${file.fileGuid}:`, err);
        }
      }
    }

    this.clearAll();
  }

  // ============================================
  // Getters
  // ============================================

  getAllFileGuids(): string[] {
    return this.files()
      .filter(f => f.fileGuid && f.status === UploadStatus.Completed)
      .map(f => f.fileGuid!);
  }

  getNewFileGuids(): string[] {
    return this.completedFiles()
      .filter(f => !f.isExisting && f.fileGuid)
      .map(f => f.fileGuid!);
  }

  getDownloadUrl(guid: string): string {
    return `${this.attachmentUrl}/Download/${guid}`;
  }

  getPreviewUrl(guid: string): string {
    return `${this.attachmentUrl}/Preview/${guid}`;
  }

  // ============================================
  // Helpers
  // ============================================

  private updateFile(file: FileItem): void {
    this._files.update(files => {
      const newMap = new Map(files);
      newMap.set(file.id, file);
      return newMap;
    });
  }

  private updateFileStatus(id: string, status: UploadStatus, errorMessage?: string): void {
    const file = this._files().get(id);
    if (file) {
      this.updateFile({ ...file, status, errorMessage });
    }
  }

  private getAccessToken(): string {
    return localStorage.getItem(ACCESS_TOKEN_NAME) ?? '';
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  formatSpeed(bytesPerSecond: number): string {
    return this.formatFileSize(bytesPerSecond) + '/s';
  }

  formatTime(seconds: number): string {
    if (!seconds || !isFinite(seconds)) return '--:--';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  getFileIcon(type: string): string {
    if (!type) return 'fa-file';
    if (type.startsWith('image/')) return 'fa-image';
    if (type.startsWith('video/')) return 'fa-video';
    if (type.startsWith('audio/')) return 'fa-music';
    if (type.includes('pdf')) return 'fa-file-pdf';
    if (type.includes('word') || type.includes('document')) return 'fa-file-word';
    if (type.includes('excel') || type.includes('spreadsheet')) return 'fa-file-excel';
    if (type.includes('powerpoint') || type.includes('presentation')) return 'fa-file-powerpoint';
    if (type.includes('zip') || type.includes('rar') || type.includes('compressed')) return 'fa-file-archive';
    if (type.includes('text')) return 'fa-file-alt';
    return 'fa-file';
  }

  getFileColor(type: string): string {
    if (!type) return '#6b7280';
    if (type.startsWith('image/')) return '#10b981';
    if (type.startsWith('video/')) return '#8b5cf6';
    if (type.startsWith('audio/')) return '#f59e0b';
    if (type.includes('pdf')) return '#ef4444';
    if (type.includes('word')) return '#3b82f6';
    if (type.includes('excel')) return '#22c55e';
    if (type.includes('powerpoint')) return '#f97316';
    return '#6b7280';
  }

  getPreviewType(type: string): 'image' | 'video' | 'audio' | 'pdf' | 'unsupported' {
    if (!type) return 'unsupported';
    if (type.startsWith('image/')) return 'image';
    if (type.startsWith('video/')) return 'video';
    if (type.startsWith('audio/')) return 'audio';
    if (type === 'application/pdf') return 'pdf';
    return 'unsupported';
  }
}
