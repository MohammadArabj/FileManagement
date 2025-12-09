import { Injectable } from '@angular/core';
import { ServiceBase } from './service.base';

@Injectable({
  providedIn: 'root'
})
export class FileService extends ServiceBase {

  constructor() {
    super("Attachment","file");
  }
}
