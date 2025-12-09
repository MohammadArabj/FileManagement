import { Injectable } from '@angular/core';
import { HttpService } from './http.service';
import { ServiceBase } from './service.base';

@Injectable({
    providedIn: 'root'
})
export class CompListService extends ServiceBase {

    constructor() {
        super("CompList")
    }

    getCurrentCompanyName(dbName: string) {
        const path = `${this.baseUrl}/GetCurrentCompanyName`
        return this.httpService.get(path, dbName)
    }
}
