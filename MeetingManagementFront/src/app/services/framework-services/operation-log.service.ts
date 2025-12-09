import { Injectable } from '@angular/core';
import { SETTINGS_NAME } from '../../core/types/configuration';
import { ServiceBase } from './service.base';
import { HttpService } from './http.service';

@Injectable({
    providedIn: 'root'
})
export class OperationLogService extends ServiceBase {

    constructor() {
        super("OperationLog");
    }

    getOperationLog(searchModel: {} | undefined) {
        let path = `${this.baseUrl}/GetList`;
        return this.httpService.put(path, searchModel);
    }
}