

import { Injectable, signal, computed, effect } from '@angular/core';
import { MeetingMember } from '../../../core/models/Meeting';
import { LocalStorageService } from '../../../services/framework-services/local.storage.service';
import { USER_ID_NAME } from '../../../core/types/configuration';

@Injectable({
  providedIn: 'root'
})
export class MeetingBehaviorService {

  private _meeting = signal<any>(null);
  meeting = this._meeting.asReadonly();
  private _isBoardMeeting = signal<boolean>(false);
  isBoardMeeting = this._isBoardMeeting.asReadonly();

  private _members = signal<MeetingMember[]>([]);
  members = this._members.asReadonly();

  private _currentMember = signal<any | null>(null);
  currentMember = this._currentMember.asReadonly();

  private _resolutions = signal<any>(null);
  resolutions = this._resolutions.asReadonly();

  constructor(private readonly localStorageService: LocalStorageService) {
    effect(() => {
      this._members();
      this.updateCurrentMember();
    });
  }

  setBoardMeetingResult(result: boolean) {
    this._isBoardMeeting.set(result);
  }

  getBoardMeetingResultValue(): boolean {
    return this._isBoardMeeting();
  }

  setResolutions(meeting: any) {
    this._resolutions.set(meeting);
  }

  updateResolutions(updateResolutions: any) {
    const currentResolutions = this._resolutions();
    if (currentResolutions) {
      this._resolutions.set(updateResolutions);
    }
  }

  hasChairmanSigned(): boolean {
    const meeting = this._meeting();
    const members = this._members();

    if (!meeting || !members) return false;

    // پیدا کردن رئیس جلسه (roleId = 3)
    const chairman = members.find(m => m.roleId === 3);

    if (!chairman) return false;

    // بررسی وضعیت امضا رئیس
    return chairman.isSign === true;
  }
  getMembersValue(): MeetingMember[] {
    return this._members();
  }
  setMembers(members: MeetingMember[]) {
    members.forEach(member => {
      const delegate = members.find(m => m.userGuid === member.replacementUserGuid);
      if (delegate) {
        delegate.isDelegate = true;
      }
      else {
        member.isDelegate = false;
      }
    });
    this._members.set(members);
    this.updateCurrentMember();
  }

  updateMember(updatedMember: Partial<any>, index: number) {
    this._members.update(currentMembers => {
      if (currentMembers && currentMembers[index]) {
        const newMembers = [...currentMembers];
        newMembers[index] = { ...newMembers[index], ...updatedMember };
        return newMembers;
      }
      return currentMembers;
    });
    this.updateCurrentMember();
  }

  setMeeting(meeting: any) {
    this._meeting.set(meeting);
  }

  updateMeeting(updatedData: Partial<any>) {
    this._meeting.update(currentMeeting => {
      if (currentMeeting) {
        return { ...currentMeeting, ...updatedData };
      }
      return currentMeeting;
    });
  }

  updateMembers(updatedMembers: MeetingMember[]) {
    this._members.set(updatedMembers);
    this.updateCurrentMember();
  }

  setCurrentMember(member: MeetingMember) {
    this._currentMember.set(member);
  }

  private updateCurrentMember() {
    const userGuid = this.localStorageService.getItem(USER_ID_NAME);
    if (!userGuid) {
      this._currentMember.set(null);
      return;
    }
    const members = this._members();
    const currentMember = members.find(m => m.userGuid === userGuid);
    this._currentMember.set(currentMember || null);
  }
}