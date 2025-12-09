import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { FileDetails } from "../core/types/file";
import { ServiceBase } from "./framework-services/service.base";
import { RequestConfig } from "./framework-services/http.service";
import { HttpParams } from "@angular/common/http";

@Injectable({
    providedIn: 'root'
})
export class FileMeetingService extends ServiceBase {


    constructor() {
        super("File");
    }
    getFiles(meetingId: any, type: 'Meeting' | 'Resolution' = 'Meeting') {
        const params = new HttpParams()
            .set('moduleId', meetingId)
            .set('type', type.toString());
        const path = `${this.baseUrl}/GetFiles`
        return this.httpService.getWithParams(path, params);
    }
    deleteFile(id: any) {
        const path = `${this.baseUrl}/DeleteFile/${id}`
        return this.httpService.post(path, {}, new RequestConfig({ noValidate: true }))

    }

}
