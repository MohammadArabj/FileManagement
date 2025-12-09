import { Injectable } from '@angular/core';
import { ServiceBase } from './framework-services/service.base';

@Injectable({
  providedIn: 'root'
})
export default class UnitService extends ServiceBase{
  constructor() {
    super('Unit', 'um');
  }
}
