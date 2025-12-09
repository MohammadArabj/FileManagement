import { Injectable } from '@angular/core';
import { ServiceBase } from './framework-services/service.base';

@Injectable({
  providedIn: 'root'
})
export class RoleService extends ServiceBase {

  constructor() {
    super("Role");
  }
}
