import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface AttachmentMetaDto {
    guid: string;
    fileName: string;
    originalFileName: string;
    contentType: string;
    fileSize: number;
    description?: string | null;
}

@Injectable({ providedIn: 'root' })
export class FileManagerApi {
    private readonly http = inject(HttpClient);
    private readonly base = environment.fileManagementEndpoint ?? environment.selfEndpoint; // تنظیم کنید

    getMetas(guids: string[]) {
        return this.http.post<AttachmentMetaDto[]>(`${this.base}/api/Attachment/GetMetas`, guids);
    }

    delete(guid: string) {
        return this.http.post<{ isSuccess?: boolean; success?: boolean }>(
            `${this.base}/api/Attachment/Delete/${guid}`,
            {}
        );
    }

    downloadUrl(guid: string) {
        return `${this.base}/api/Attachment/Download/${guid}`;
    }

    // برای preview از همان download استفاده کنید (با enableRangeProcessing در بک)
    previewUrl(guid: string) {
        return this.downloadUrl(guid);
    }
}
