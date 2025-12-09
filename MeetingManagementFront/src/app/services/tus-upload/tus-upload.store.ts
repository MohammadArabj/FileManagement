import { Injectable, signal, computed } from '@angular/core';

export enum UploadStatus {
    Pending = 0,
    InProgress = 1,
    Paused = 2,
    Completed = 3,
    Failed = 4,
}

export interface FileItem {
    id: string;              // internal id
    fileGuid?: string;       // guid از سرور بعد از complete
    name: string;
    type: string;
    size: number;

    isExisting?: boolean;

    status: UploadStatus;
    progress: number;
    uploadedBytes: number;
    speed: number;

    previewUrl?: string;     // فقط برای local objectURL یا وقتی لازم شد
    errorMessage?: string;
}

@Injectable()
export class TusUploadStore {
    readonly files = signal<FileItem[]>([]);
    readonly isUploading = signal(false);

    readonly totalFiles = computed(() => this.files().length);
    readonly pendingFiles = computed(() => this.files().filter(f => f.status === UploadStatus.Pending));
    readonly totalProgress = computed(() => {
        const list = this.files();
        if (!list.length) return 0;
        const avg = Math.round(list.reduce((s, f) => s + (f.progress ?? 0), 0) / list.length);
        return Number.isFinite(avg) ? avg : 0;
    });

    clearAll() { this.files.set([]); this.isUploading.set(false); }

    // این‌ها را با tus-js-client واقعی شما کامل کنید:
    addExisting(metas: Array<{ guid: string; originalFileName: string; contentType: string; fileSize: number }>) {
        const mapped: FileItem[] = metas.map(m => ({
            id: `existing_${m.guid}`,
            fileGuid: m.guid,
            name: m.originalFileName,
            type: m.contentType,
            size: m.fileSize,
            isExisting: true,
            status: UploadStatus.Completed,
            progress: 100,
            uploadedBytes: m.fileSize,
            speed: 0,
        }));
        this.files.update(curr => [...mapped, ...curr.filter(x => !x.isExisting)]);
    }

    getAllFileGuids(): string[] {
        return this.files().filter(f => !!f.fileGuid).map(f => f.fileGuid!);
    }
}
