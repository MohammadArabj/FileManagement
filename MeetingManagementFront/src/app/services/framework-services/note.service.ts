import { Injectable } from '@angular/core';
import { HttpService } from './http.service';
import { ServiceBase } from './service.base';

@Injectable({
  providedIn: 'root'
})
export class NoteService extends ServiceBase {

  constructor() {
    super("Note");
  }

  getListByMasterId(masterId: number, table: string) {
    let path = `${this.baseUrl}/GetList/${masterId}/${table}`;
    return this.httpService.getAll<any>(path);
  }

  deleteNote(table: string, id: any) {
    let path = `${this.baseUrl}/${table}/${id}`;
    return this.httpService.delete(path);
  }
}
