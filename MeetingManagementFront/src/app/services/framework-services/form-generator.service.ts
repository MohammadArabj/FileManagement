import { Injectable } from '@angular/core';
import { HttpService } from './http.service';
import { ServiceBase } from './service.base';

@Injectable({
    providedIn: 'root'
})
export class FormGeneratorService extends ServiceBase {

    constructor() {
        super("FormGenerator");
    }

    getTableReferenceItems(tableName: any, listFieldGroupId: any) {
        const path = `${this.baseUrl}/GetTableReferenceItems/${tableName}/${listFieldGroupId}`;
        return this.httpService.getAll<any>(path);
    }

    getStatementBy(id: any, tableName: any) {
        const path = `${this.baseUrl}/GetBy/${tableName}/${id}`;
        return this.httpService.getAll<any>(path);
    }

    getTableInfo(tableName: any) {
        const path = `${this.baseUrl}/GetTableInfo/${tableName}`;
        return this.httpService.getAll<any>(path);
    }

    setOrder(command: {} | undefined) {
        const path = `${this.baseUrl}/SetOrder`;
        return this.httpService.put(path, command);
    }
}