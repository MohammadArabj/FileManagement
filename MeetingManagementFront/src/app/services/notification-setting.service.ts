import { Injectable } from '@angular/core';
import { ServiceBase } from './framework-services/service.base';

@Injectable({
  providedIn: 'root'
})
export class NotificationSettingService extends ServiceBase {
  constructor() {
    super("NotificationSetting");
  }
}
