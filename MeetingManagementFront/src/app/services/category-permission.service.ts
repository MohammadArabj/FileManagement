import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { RequestConfig } from './framework-services/http.service';
import { ServiceBase } from './framework-services/service.base';

export interface CategoryPermissionDto {
  isViewAll: boolean;
  id: number;
  categoryId: number;
  positionGuid: string;
  positionName?: string;
  positionTitle?: string;
}

export interface SetCategoryPermissionDto {
  categoryId: number;
  positionGuids: string[];
}

@Injectable({
  providedIn: 'root',
})
export class CategoryPermissionService extends ServiceBase {

  constructor() {
    super('CategoryPermission');
  }

  getByCategoryId(categoryId: number): Observable<CategoryPermissionDto[]> {
    const path = `${this.baseUrl}/GetByCategory`;
    return this.httpService.get<CategoryPermissionDto[]>(path, categoryId);
  }
  getByCategoryGuid(categoryGuid: string) {
    const path = `${this.baseUrl}/GetByCategory`;
    return this.httpService.get<CategoryPermissionDto[]>(path, categoryGuid);
  }
  checkAccess(categoryId: number, positionGuid: string): Observable<boolean> {
    const path = `${this.baseUrl}/CheckAccess/${categoryId}/${positionGuid}`;
    return this.httpService.get<boolean>(path, {}, new RequestConfig({ noValidate: true }));
  }

  setPermissions(command: SetCategoryPermissionDto): Observable<boolean> {
    const path = `${this.baseUrl}/SetPermissions`;
    return this.httpService.post<boolean>(path, command, new RequestConfig({ formId: 'permissionForm' }));
  }
}