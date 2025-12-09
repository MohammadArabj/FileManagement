import { inject, Pipe, PipeTransform } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, catchError, shareReplay } from 'rxjs/operators';
import { FileService } from '../../services/file.service';
import { FileDetailsDto } from '../models/file';
import { base64ToArrayBuffer } from '../types/configuration';

@Pipe({
  name: 'imageLoader',
  standalone: true
})
export class ImageLoaderPipe implements PipeTransform {
  private cache = new Map<string, Observable<string | null>>();
  fileService=inject(FileService);
  constructor() { }

  transform(profileGuid: any): Observable<string | null> {
    if (!profileGuid) {
      return of(null);
    }

    // اگر در کش موجود است، آن را برگردان
    if (this.cache.has(profileGuid)) {
      return this.cache.get(profileGuid)!;
    }

    // ایجاد observable جدید و کش کردن آن
    const imageObservable = this.fileService.getFileDetails(profileGuid).pipe(
      map((data: any) => this.createPreviewUrl(data)),
      catchError(() => of(null)),
      shareReplay(1) // کش کردن نتیجه
    );

    this.cache.set(profileGuid, imageObservable);
    return imageObservable;
  }

  private createPreviewUrl(details: FileDetailsDto): string | null {
    if (details.file) {
      const blob = new Blob([base64ToArrayBuffer(details.file)], { type: details.contentType });
      return URL.createObjectURL(blob);
    }
    return null;
  }
}

// استفاده در HTML:
// <img [src]="item.profileImageGuid | imageLoader | async" alt="تصویر پروفایل" width="100" height="100" />