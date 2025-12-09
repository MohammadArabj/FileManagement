import { Injectable } from '@angular/core';
import { ServiceBase } from './framework-services/service.base';
import { RequestConfig } from './framework-services/http.service';
import { MeetingMember } from '../core/models/Meeting';

@Injectable({
  providedIn: 'root'
})
export class MeetingMemberService extends ServiceBase {

  constructor() {
    super("MeetingMember");
  }
  getUserList(meetingGuid: any, userGuid: any) {
    var userMeetingData = {
      meetingGuid: meetingGuid,
      userGuid: userGuid
    };
    const path = `${this.baseUrl}/GetList`
    return this.httpService.post<MeetingMember[]>(path, userMeetingData, new RequestConfig({ submitted: false }));
  }
  getDetails(meetingGuid: any, userGuid: any) {
    var userMeetingData = {
      meetingGuid: meetingGuid,
      userGuid: userGuid
    };
    const path = `${this.baseUrl}/GetBy`
    return this.httpService.post(path, userMeetingData, new RequestConfig({ submitted: false }));
  }
  setComment(body: any, config = new RequestConfig({})) {
    const path = `${this.baseUrl}/SetComment`
    return this.httpService.post(path, body, config);
  }

  setGroupAttendance(body: any) {
    const path = `${this.baseUrl}/SetGroupAttendance`
    return this.httpService.post(path, body, new RequestConfig({ submitted: false }));
  }

  setSubstitute(body: any, config = new RequestConfig({})) {
    const path = `${this.baseUrl}/SetSubstitute`
    return this.httpService.post(path, body, config);
  }
  attendance(body: any, config = new RequestConfig({})) {
    const path = `${this.baseUrl}/Attendance`
    return this.httpService.post(path, body, config);
  }
  createOrEdit(body: any, config = new RequestConfig({})) {
    const path = `${this.baseUrl}/CreateOrEdit`
    return this.httpService.post(path, body, config);
  }

  createMember(body: any, config = new RequestConfig({})) {
    const path = `${this.baseUrl}/CreateMember`
    return this.httpService.post(path, body, config);
  }
}
