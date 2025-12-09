import { Injectable } from '@angular/core';
import { ServiceBase } from './framework-services/service.base';
import { AgendaItem } from '../core/models/Meeting';
import { RequestConfig } from './framework-services/http.service';

@Injectable({
  providedIn: 'root'
})
export class AgendaService extends ServiceBase {


  constructor() {
    super("Agenda");
  }
  createOrEdit(formData: any) {
    const path = `${this.baseUrl}/CreateOrEdit`;
    return this.httpService.post(path, formData)
  }
  updateAgendaOrder(agendas: AgendaItem[]) {
    const orderedAgendas = agendas.map((r, index) => ({
      id: r.id,
      sortOrder: index + 1, // ترتیب را از 1 شروع می‌کنیم
    }));
    var path = `${this.baseUrl}/Order`;
    return this.httpService.post(path, { agendas: orderedAgendas }, new RequestConfig({}), false);
  }
  deleteFile(id: any) {
    const path = `${this.baseUrl}/DeleteFile/${id}`
    return this.httpService.post(path, {}, new RequestConfig({ noValidate: true }));
  }
}
