import { Injectable } from '@angular/core';
import { ServiceBase } from './framework-services/service.base';
import { RequestConfig } from './framework-services/http.service';
import { ConflictResult } from '../core/types/conflict-result';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class MeetingService extends ServiceBase {
  checkSign(meetingGuid: string) {
    const path = `${this.baseUrl}/CheckSign/${meetingGuid}`;
    return this.httpService.get<any>(path);
  }
  deleteRiderFile(meetingGuid: any) {
    const path = `${this.baseUrl}/DeleteRiderFile`;
    return this.httpService.get<any>(path, meetingGuid, new RequestConfig({ noValidate: true, submitted: false }), true);
  }
  searchMeetings(searchData: any) {
    const path = `${this.baseUrl}/Search`;
    return this.httpService.post<any>(path, searchData, new RequestConfig({ noValidate: true, submitted: false }), false);
  }
  getMeetingStatistics(data: any) {
    const path = `${this.baseUrl}/GetMeetingStatistic`;
    return this.httpService.post<any>(path, data, new RequestConfig({ noValidate: true, submitted: false }), false);
  }
  getTodayTommorrowMeetings(positionGuid: string): any {
    const path = `${this.baseUrl}/GetTodayTommorrowMeetings/${positionGuid}`;
    return this.httpService.getAll<any>(path);
  }
  updateRider(formData: FormData) {
    const path = `${this.baseUrl}/UpdateRider`;
    return this.httpService.postFormData<any>(path, formData);
  }
  checkMeeting(guid: any) {

    const path = `${this.baseUrl}/CheckMeeting/${guid}`;
    return this.httpService.get<any>(path);
  }
  getParentMeetings() {
    const path = `${this.baseUrl}/GetListByCategoryGuid/${environment.boardCategoryGuid}`;
    return this.httpService.getAll<any>(path);
  }
  getListByCategoryGuid(condition: any) {
    let path = `${this.baseUrl}/GetListByCategoryGuid/${environment.committeeGuid}`
    return this.httpService.getAll<any>(path)
  }

  saveFiles(formData: FormData) {
    const path = `${this.baseUrl}/UploadFiles`
    return this.httpService.postFormData<any>(path, formData)
  }
  deleteAgenda(meetingGuid: string) {
    const path = `${this.baseUrl}/DeleteAgenda/${meetingGuid}`
    return this.httpService.post(path, {}, new RequestConfig({ noValidate: true }))
  }
  editAgenda(formData: FormData) {
    const path = `${this.baseUrl}/EditAgenda`
    return this.httpService.postFormData<any>(path, formData)
  }
  getMeetingCounts(userGuid: string) {
    let path = `${this.baseUrl}/GetMeetingCounts/${userGuid}`
    return this.httpService.getAll<any>(path)
  }
  getMeetings(filterModel: any) {
    const path = `${this.baseUrl}/GetList`
    return this.httpService.post(path, filterModel, new RequestConfig({ noValidate: true }), false)
  }
  getCalendarMeetings(positionGuid: string, userName: string) {
    let model = {
      positionGuid: positionGuid,
      personalNo: userName
    };
    const path = `${this.baseUrl}/GetCalendarMeetings`;
    return this.httpService.post<any>(path, model, new RequestConfig({ noValidate: true }), false);
  }
  changeStatus(meetingGuid: string, status: number) {
    var statusModel = {
      meetingGuid: meetingGuid,
      statusId: status
    };
    const path = `${this.baseUrl}/ChangeStatus`
    return this.httpService.post(path, statusModel)
  }
  getAgendas(meetingGuid: string) {
    let path = `${this.baseUrl}/GetAgendas/${meetingGuid}`
    return this.httpService.getAll<any>(path)
  }
  addResolution(formData: FormData) {
    const path = `${this.baseUrl}/AddResolution`
    return this.httpService.postFormData(path, formData)
  }
  updateDescription(meetingGuid: string, description: string) {
    var descriptionData = {
      guid: meetingGuid,
      description: description
    };
    const path = `${this.baseUrl}/UpdateDescription`
    return this.httpService.post(path, descriptionData)
  }
  updateMeetingDescription(id: any, description: any) {
    let path = `${this.baseUrl}/updateDescription/${id}?description=${description}`;
    this.httpService.post(path);
  }
  addAgenda(meetingId: string, agenda: any) {
    let path = `${this.baseUrl}/AddAgenda/${meetingId}`;
    this.httpService.post(path, agenda);
  }
  getTemplates<T>() {
    let path = `${this.baseUrl}/GetTemplates`
    return this.httpService.getAll<T>(path)
  }
  getUserMeeting<MeetingDetails>(meetingGuid: any, userGuid: any, positionGuid: any, canView: any) {
    var userMeetingData = {
      meetingGuid: meetingGuid,
      userGuid: userGuid,
      positionGuid: positionGuid,
      canView: canView
    };
    const path = `${this.baseUrl}/GetBy`
    return this.httpService.post<MeetingDetails>(path, userMeetingData, new RequestConfig({ submitted: false }));
  }
  getGuestMeeting(meetingGuid: any) {

    const path = `${this.baseUrl}/GetGuests/${meetingGuid}`
    return this.httpService.getAll(path);
  }
  checkConflicts(arg0: any) {
    const path = `${this.baseUrl}/CheckConflicts`;
    return this.httpService.post<ConflictResult>(path, arg0, new RequestConfig({ submitted: false }), false);
  }
  
  constructor() { super("Meeting") }
}
