import { inject, Injectable } from '@angular/core';
import { ServiceBase } from './framework-services/service.base';
import { environment } from '../../environments/environment';
import { RequestConfig } from './framework-services/http.service';
import { LocalStorageService } from './framework-services/local.storage.service';
import { POSITION_ID } from '../core/types/configuration';

@Injectable({
  providedIn: 'root'
})
export class CategoryService extends ServiceBase {

  private localStorageService = inject(LocalStorageService);
  constructor() {
    super("Category");
  }
  setPermission(categoryUpdateModel: { id: number; viewAll: boolean; }) {
    const path = `${this.baseUrl}/SetPermissions`;
    return this.httpService.post(path, categoryUpdateModel, new RequestConfig({ noValidate: true }));
  }
  getForComboByCondition<T>(showAll: boolean) {
    const positionGuid = this.localStorageService.getItem(POSITION_ID);
    const model = {
      positionGuid: positionGuid,
      showAll: showAll
    };
    const path = `${this.baseUrl}/GetForComboByCondition`;
    return this.httpService.post<T>(path, model, new RequestConfig({ noValidate: true }), false);
  }

}
