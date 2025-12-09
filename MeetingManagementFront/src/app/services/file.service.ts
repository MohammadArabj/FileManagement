import { Injectable } from '@angular/core';
import { ServiceBase } from './framework-services/service.base';
import { Observable } from 'rxjs';
import { FileDetails } from '../core/types/file';
import { CodeFlowService } from './framework-services/code-flow.service';

@Injectable({
  providedIn: 'root'
})
export class FileService extends ServiceBase {

  constructor(private readonly codeFlowService:CodeFlowService) {
    super("Attachment", "file");
  }
  getFileDetails(fileGuid: any): Observable<FileDetails> {
    const path = `${this.baseUrl}/GetFileDetails`
    return this.httpService.get<FileDetails>(path, fileGuid);
  }
  getFile(fileGuid: any) {
    const path = `${this.baseUrl}/GetFile`;
    return this.httpService.get(path, fileGuid);
  }
  getFileName(fileGuid: string) {
    const path=`${this.baseUrl}/GetFileName`;
    return this.httpService.get<any>(path, fileGuid);
  }
  
  // تبدیل Base64 به آرایه بایت
  base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  download(fileGuid?: string) {
    const token = this.codeFlowService.getToken();

    fetch(`${this.baseUrl}/Download/${fileGuid}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(resp => resp.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;

        // تعیین نام فایل برای دانلود
        a.download = fileGuid || 'downloaded-file';

        document.body.appendChild(a);
        a.click();

        // پاکسازی
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      })
      .catch(error => console.error('Error downloading file:', error));
  }
}
