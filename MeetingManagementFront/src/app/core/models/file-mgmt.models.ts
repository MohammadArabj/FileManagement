export type FileManagerDisplayMode = 'embedded' | 'modal';
export type FileManagerViewMode = 'entity' | 'browser';

export interface InitiateUploadRequest {
    clientId: string;
    fileName: string;
    contentType: string;
    fileSize: number;
    folderPath?: string | null;       // "A{{Folder}}B"
    classificationId?: number | null; // optional
}

export interface InitiateUploadResult {
    sessionGuid: string;
    tusFileId: string;
    uploadUrl: string;   // e.g. "/api/Upload/tus/<id>"
    expiresAt: string;   // ISO
}

export interface CompleteUploadRequest {
    sessionGuid: string;
    tusFileId: string;
    description?: string | null;
}

export interface CompleteUploadResult {
    fileGuid: string;
    fileName: string;
    fileSize: number;
    contentType: string;
}

export interface AttachmentListItemVm {
    id?: number;              // folder id
    guid?: string;            // folder guid or file guid
    title: string;
    type: 'folder' | 'file';
    contentType?: string;
    description?: string | null;
    created?: string | null;
    createdBy?: string | null;
}

export interface AttachmentInfoVm {
    guid: string;
    fileName: string;
    originalFileName: string;
    contentType: string;
    fileSize: number;
    path: string;
    classificationId: number;
    description?: string | null;
}

export type UploadState = 'queued' | 'initiating' | 'uploading' | 'paused' | 'finalizing' | 'done' | 'failed' | 'canceled';

export interface UploadItemUi {
    key: string;              // stable key for @for track
    file: File;
    state: UploadState;

    sessionGuid?: string;
    tusFileId?: string;
    uploadUrl?: string;

    progressPct: number;      // 0..100
    uploadedBytes: number;
    totalBytes: number;

    speedBps: number;
    etaSec: number | null;

    error?: string | null;
    description?: string | null;
    createdAt: number;

    // tus upload instance (kept as unknown to avoid importing types everywhere)
    tusUpload?: unknown;
}

export interface FileRowUi {
    key: string;     // stable key
    guid: string;
    name: string;
    contentType: string;
    size?: number;   // optional
    description?: string | null;
}
