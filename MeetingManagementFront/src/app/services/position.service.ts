import { Injectable } from '@angular/core';
import { ServiceBase } from './framework-services/service.base';

@Injectable({
  providedIn: 'root'
})
export class PositionService extends ServiceBase {
  constructor() {
    super('Position', 'um');
  }
}
