import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ServiceBase } from './service.base';
import { RequestConfig } from './http.service';

@Injectable({
    providedIn: 'root'
})
export class SmartSearchService extends ServiceBase {

    constructor(private readonly http: HttpClient) {
        super("SmartSearch");
    }

    search(searchModel: {} | undefined) {
        return this.httpService.getWithParams<any>(this.baseUrl, searchModel, new RequestConfig({ noValidate: true }));
    }
}