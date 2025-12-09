import { Injectable } from '@angular/core';
import { RequestConfig } from './framework-services/http.service';
import { ServiceBase } from './framework-services/service.base';
import { map } from 'rxjs';
import { normalizePersian } from '../core/types/configuration';
import { getServiceUrl } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class UserService extends ServiceBase {
  constructor() {
    super('User', 'um');
  }

  getToken(command: {} | undefined) {
    const path = `${this.baseUrl}/GetToken`;
    return this.httpService.put(path, command);
  }

  changePassword(command: {} | undefined) {
    const path = `${this.baseUrl}/ChangePassword`;
    return this.httpService.post(path, command, new RequestConfig({ formId: 'changePasswordForm' }));
  }

  changeCompanyId(companyGuid: any) {
    const path = `${this.baseUrl}/ChangeCompanyId/${companyGuid}`;
    return this.httpService.put(path);
  }

  healthCheck() {
    const path = `${getServiceUrl()}health`;
    return this.httpService.getWithParams(path, {});
  }

  getUserInformation(guid: any) {
    const path = `${this.baseUrl}/GetUserInformation/${guid}`;
    return this.httpService.get<any>(path);
  }

  getCurrentUserLastSessions() {
    const path = `${this.baseUrl}/getCurrentUserLastSessions`;
    return this.httpService.get<any>(path);
  }

  getCurrentSession() {
    const path = `${this.baseUrl}/GetCurrentSession`;
    return this.httpService.get<any>(path);
  }

  hasActiveSession(searchModel: {} | undefined) {
    const path = `${this.baseUrl}/hasActiveSession`;
    return this.httpService.getWithParams<any>(path, searchModel);
  }

  hasClientAccess(clientId: string | undefined) {
    const path = `${this.baseUrl}/HasClientAccess`;
    return this.httpService.get<any>(path, clientId);
  }

  closeSessions(userGuid: string) {
    const path = `${this.baseUrl}/closeSessions/${userGuid}`;
    return this.httpService.post<any>(path, {}, new RequestConfig({ noValidate: true }));
  }
  getUserSessionsLog<T>(body: any) {
    const path = `${this.baseUrl}/GetUserSessionsLog`;
    return this.httpService.post<T>(path, body, new RequestConfig({ noValidate: true }));
  }
  getAllWhitRoles() {
    const path = `${this.baseUrl}/GetAllRoles`;
    return this.httpService.get<any>(path, {}, new RequestConfig({ noValidate: true }))
  }

  getAllByClientId<T extends Array<any>>(clientId: string) {
    const path = `${this.baseUrl}/GetAllByClientId`;
    return this.httpService.get<T>(path, clientId, new RequestConfig({ noValidate: true, submitted: false }))
      .pipe(
        map(items =>
          items.map(item => ({
            ...item,
            name: item.name ? normalizePersian(item.name) : item.name,
            position: item.position ? normalizePersian(item.position) : item.position
          }))
        )
      );
  }

  getAll<T extends Array<any>>() {
    const path = `${this.baseUrl}/GetAll`;
    return this.httpService.get<T>(path)
      .pipe(
        map(items =>
          items.map(item => ({
            ...item,
            name: item.name ? normalizePersian(item.name) : item.name,
            position: item.position ? normalizePersian(item.position) : item.position
          }))
        )
      );
  }
}
