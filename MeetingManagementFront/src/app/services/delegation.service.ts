import { Injectable } from '@angular/core';
import { ServiceBase } from './framework-services/service.base';
import { RequestConfig } from './framework-services/http.service';

@Injectable({
  providedIn: 'root'
})
export class DelegationService extends ServiceBase {

  constructor() {
    super("Delegation", "um");
  }

  getDelegationsByDelegator(userId: string) {
    const path = `${this.baseUrl}/GetDelegationsByDelegator`
    return this.httpService.get(path, userId);
  }
  getActiveDelegationsForDelegatee(body: any) {
    const path = `${this.baseUrl}/GetActiveDelegationsForDelegatee`
    return this.httpService.post(path, body, new RequestConfig({ noValidate: true, submitted: false }), false);
  }
  getDelegationPermissions(body: any) {

    const path = `${this.baseUrl}/GetDelegationPermissions`
    return this.httpService.post<any>(path, body, new RequestConfig({ noValidate: true, submitted: false }), false);
  }
}
