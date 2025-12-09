import { Injectable } from '@angular/core';
import { ServiceBase } from './framework-services/service.base';
import { getClientSettings } from './framework-services/code-flow.service';
import { RequestConfig } from './framework-services/http.service';

@Injectable({
  providedIn: 'root'
})
export class PermissionService extends ServiceBase {


  constructor() {
    super("Permission", 'um');
  }

  updateClassificationLevel(command: {} | undefined) {
    return this.httpService.post<any>(`${this.baseUrl}/UpdateClassificationLevel`, command);
  }

  getUserPermissions() {
    return this.httpService.get<any>(`${this.baseUrl}/GetUserPermissions`, getClientSettings().client_id);
  }

  getPositionPermissions(positionGuid: string) {
    const request = {
      clientId: getClientSettings().client_id,
      positionGuid: positionGuid
    }
    return this.httpService.post<any>(`${this.baseUrl}/GetPositionPermissions`, request, new RequestConfig({ noValidate: true, submitted: false }), false);
  }


  getForClassificationLevel(searchModel: {} | undefined) {
    return this.httpService.getWithParams<any>(`${this.baseUrl}/getForClassificationLevel`, searchModel);
  }

  getClassificationLevelByTitle(searchModel: {} | undefined) {
    return this.httpService.getWithParams<any>(`${this.baseUrl}/getClassificationLevelByTitle`, searchModel);
  }
  getGroupPermissionList(command: any) {
    return this.httpService.getWithParams<any>(`${this.baseUrl}/GetList/${command}`);

  }
  getDelegationPermissions(guid: string) {
    return this.httpService.getWithParams<any>(`${this.baseUrl}/GetDelegationPermissionList/${guid}`);
  }
}