import { Injectable } from '@angular/core';
import { HttpService } from './http.service';
import { ServiceBase } from './service.base';

@Injectable({
  providedIn: 'root'
})
export class RefService extends ServiceBase {

  constructor() {
    super("Ref");
  }

  getListByMasterId(masterId: number, table: string) {
    let path = `${this.baseUrl}/GetList/${masterId}/${table}`;
    return this.httpService.getAll<any>(path);
  }

  deleteReference(table: any, id: any) {
    let path = `${this.baseUrl}/${table}/${id}`;
    return this.httpService.delete(path);
  }
}
