import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { HttpService } from './http.service';
import { ServiceBase } from './service.base';

@Injectable({
    providedIn: 'root'
})
export class AttachService extends ServiceBase {

    constructor(private readonly http: HttpClient) {
        super("Attach");
    }

    getListByMasterId(table: any, masterId: string) {
        return this.http.get<any>(`${this.baseUrl}/GetList/${table}/${masterId}`);
    }

    deleteAttach(table: string, id: any) {
        return this.http.delete(`${this.baseUrl}/${table}/${id}`)
    }

    downloadAttach(schema: any, table: any, id: any) {
        return this.http.get(`${this.baseUrl}/Download/${schema}/${table}/${id}`,
            { responseType: 'blob', observe: 'response' });
    }
}