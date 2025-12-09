import { Injectable } from '@angular/core';
import { ServiceBase } from './framework-services/service.base';
import { Observable } from 'rxjs';
import { BoardMember } from '../core/models/BoardMember';
import { RequestConfig } from './framework-services/http.service';

@Injectable({
  providedIn: 'root'
})
export class BoardMemberService extends ServiceBase {


  constructor() {
    super("BoardMember");
  }
  getByGuids(guids: string[]): Observable<BoardMember[]> {
    return this.httpService.post<BoardMember[]>(`${this.baseUrl}/GetByGuids`, guids , new RequestConfig({ noValidate: false }), false);
  }
}
