import { BehaviorSubject } from 'rxjs';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SharedService {

  data: any;
  _dataBS = new BehaviorSubject([]);

  constructor() {
    this._dataBS.next(this.data);
  }

  setData(data: never[]) {
    this.data = data;
    this._dataBS.next(data);
  }

  emptyData() {
    this.data = [];
    this._dataBS.next(this.data);
  }
}