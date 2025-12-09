import { Injectable } from '@angular/core';
import { HttpService } from './http.service';
import { getIdentityUrl } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class IdentityService {
  controllerName = "Identity";
  baseUrl = `${getIdentityUrl()}${this.controllerName}`;
  constructor(private readonly httpService: HttpService) {
  }

  getIdAndRole() {
    const path = `${this.baseUrl}/GetUserIdAndRole`;
    return this.httpService.getAll<any>(path);
  }

  getFullname() {
    const path = `${this.baseUrl}/getFullname`;
    return this.httpService.getAll<string>(path);
  }
}
