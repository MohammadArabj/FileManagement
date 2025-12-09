export interface FileDetailsDto {
    file: any;
    path: string;
    contentType: string;
    fileName: string;
    guid: Guid;
    id: number;
}

export interface FileItem {
    id: string;
    guid?: Guid;
    name: string;
    size: any;
    type: string;
    progress: number;
    completed: boolean;
    url?: string | null;
    details?: FileDetailsDto;
    isNew?: boolean; // برای شناسایی فایل‌های جدید
    file?: File; // فقط برای فایل‌های جدید آپلود شده
}

export type Guid = any;