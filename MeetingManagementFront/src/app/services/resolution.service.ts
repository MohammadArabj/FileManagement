import { Injectable } from '@angular/core';
import { ServiceBase } from './framework-services/service.base';
import { RequestConfig } from './framework-services/http.service';
import { Resolution } from '../core/models/Resolution';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ResolutionService extends ServiceBase {

  constructor() {
    super("Resolution");
  }

  createOrEdit(formData: FormData) {
    const path = `${this.baseUrl}/CreateOrEdit`;
    return this.httpService.postFormData(path, formData)
  }
  createOrEditBoardMeeting(formData: FormData) {
    const path = `${this.baseUrl}/CreateOrEditBoardMeeting`;
    return this.httpService.postFormData(path, formData)
  }
  updateResolutionOrder(resolutions: Resolution[]) {
    const orderedResolutions = resolutions.map((r, index) => ({
      id: r.id,
      sortOrder: index + 1, // ترتیب را از 1 شروع می‌کنیم
    }));
    var path = `${this.baseUrl}/Order`;
    return this.httpService.post(path, { resolutions: orderedResolutions }, new RequestConfig({}), false);
  }
  deleteAssignment(id: any) {
    const path = `${this.baseUrl}/DeleteAssignment/${id}`
    return this.httpService.post(path, {}, new RequestConfig({ noValidate: true }));
  }
  getAssignment(assignId: number) {
    const path = `${this.baseUrl}/GetAssignment`
    return this.httpService.get(path, assignId)
  }
  getRelatedResolutions(meetingGuid: any) {
    const path = `${this.baseUrl}/GetRelatedResolutions/${meetingGuid}`;
    return this.httpService.getAll(path);
  }
  searchResolution(searchModel: any) {
    const path = `${this.baseUrl}/Search`
    return this.httpService.post<any>(path, searchModel, new RequestConfig({ submitted: false, noValidate: true }), false);
  }

  /**
   * دریافت گزارش تفصیلی مصوبات
   */
  public getDetailReport(request: ResolutionDetailReportRequestDto){
    return this.httpService.post<any>(`${this.baseUrl}/DetailReport`, request);
  }

  /**
   * دریافت گزارش خلاصه/آماری مصوبات
   */
  public getSummaryReport(request: ResolutionSummaryReportRequestDto) {
    return this.httpService.post<any>(`${this.baseUrl}/SummaryReport`, request);
  }


  // /**
  //  * خروجی اکسل گزارش تفصیلی
  //  */
  // public exportDetailReportToExcel(request: ResolutionDetailReportRequestDto): Observable<Blob> {
  //   return this.http.post(`${this.baseUrl}/DetailReport/Excel`, request, {
  //     responseType: 'blob',
  //     headers: {
  //       'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  //     }
  //   });
  // }

  // /**
  //  * خروجی اکسل گزارش خلاصه
  //  */
  // public exportSummaryReportToExcel(request: ResolutionSummaryReportRequestDto): Observable<Blob> {
  //   return this.http.post(`${this.baseUrl}/SummaryReport/Excel`, request, {
  //     responseType: 'blob',
  //     headers: {
  //       'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  //     }
  //   });
  // }

  // /**
  //  * خروجی PDF گزارش تفصیلی
  //  */
  // public exportDetailReportToPdf(request: ResolutionDetailReportRequestDto): Observable<Blob> {
  //   return this.http.post(`${this.baseUrl}/DetailReport/Pdf`, request, {
  //     responseType: 'blob',
  //     headers: {
  //       'Accept': 'application/pdf'
  //     }
  //   });
  // }

  // /**
  //  * خروجی PDF گزارش خلاصه
  //  */
  // public exportSummaryReportToPdf(request: ResolutionSummaryReportRequestDto): Observable<Blob> {
  //   return this.httpService.post(`${this.baseUrl}/SummaryReport/Pdf`, request, {
  //     responseType: 'blob',
  //     headers: {
  //       'Accept': 'application/pdf'
  //     }
  //   });
  // }

  /**
   * Helper methods for status display
   */
  public getActionStatusText(status?: ActionStatus): string {
    if (!status) return 'نامشخص';

    const statusMap: Record<ActionStatus, string> = {
      [ActionStatus.Done]: 'انجام شده',
      [ActionStatus.NotDone]: 'انجام نشده',
      [ActionStatus.InProgress]: 'در حال انجام',
      [ActionStatus.End]: 'پایان یافته',
      [ActionStatus.Impossible]: 'غیر قابل انجام'
    };

    return statusMap[status] || 'نامشخص';
  }

  public getFollowStatusText(status?: ActionFollowStatus): string {
    if (!status) return 'نامشخص';

    const statusMap: Record<ActionFollowStatus, string> = {
      [ActionFollowStatus.FollowingUp]: 'در حال پیگیری',
      [ActionFollowStatus.NotFollowedUp]: 'پیگیری نشده',
      [ActionFollowStatus.FollowUpEnd]: 'پایان پیگیری'
    };

    return statusMap[status] || 'نامشخص';
  }

  public getActionStatusOptions(): Array<{ value: number, label: string }> {
    return [
      { value: ActionStatus.Done, label: 'انجام شده' },
      { value: ActionStatus.NotDone, label: 'انجام نشده' },
      { value: ActionStatus.InProgress, label: 'در حال انجام' },
      { value: ActionStatus.End, label: 'پایان یافته' },
      { value: ActionStatus.Impossible, label: 'غیر قابل انجام' }
    ];
  }

  public getFollowStatusOptions(): Array<{ value: number, label: string }> {
    return [
      { value: ActionFollowStatus.FollowingUp, label: 'در حال پیگیری' },
      { value: ActionFollowStatus.NotFollowedUp, label: 'پیگیری نشده' },
      { value: ActionFollowStatus.FollowUpEnd, label: 'پایان پیگیری' }
    ];
  }

  /**
   * Utility method to format Persian date
   */
  public formatPersianDate(date: Date | string): string {
    if (!date) return '';

    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      return new Intl.DateTimeFormat('fa-IR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(dateObj);
    } catch {
      return '';
    }
  }

  /**
   * Utility method to convert Persian date to Gregorian
   */
  public convertPersianToGregorian(persianDate: string): string {
    // Implementation for Persian to Gregorian date conversion
    // This is a simplified version - you should use a proper Persian calendar library
    if (!persianDate) return '';

    try {
      // Assuming persianDate is in format YYYY/MM/DD
      const parts = persianDate.split('/');
      if (parts.length === 3) {
        const year = parseInt(parts[0]) + 621; // Simplified conversion
        const month = parseInt(parts[1]);
        const day = parseInt(parts[2]);
        return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      }
    } catch {
      // Fallback to current date format
    }

    return '';
  }

  /**
   * Validate date range
   */
  public validateDateRange(fromDate?: string, toDate?: string): { isValid: boolean; message?: string } {
    if (!fromDate && !toDate) {
      return { isValid: true };
    }

    if (fromDate && toDate) {
      const from = new Date(fromDate);
      const to = new Date(toDate);

      if (from > to) {
        return {
          isValid: false,
          message: 'تاریخ شروع نمی‌تواند بعد از تاریخ پایان باشد'
        };
      }

      // Check if date range is not too wide (e.g., more than 2 years)
      const diffInMonths = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24 * 30);
      if (diffInMonths > 24) {
        return {
          isValid: false,
          message: 'بازه زمانی انتخابی نمی‌تواند بیش از 2 سال باشد'
        };
      }
    }

    return { isValid: true };
  }

  /**
   * Build filter summary text for display
   */
  public buildFilterSummary(request: ResolutionDetailReportRequestDto | ResolutionSummaryReportRequestDto): string {
    const filters: string[] = [];

    if (request.fromDate) {
      filters.push(`از تاریخ: ${this.formatPersianDate(request.fromDate)}`);
    }

    if (request.toDate) {
      filters.push(`تا تاریخ: ${this.formatPersianDate(request.toDate)}`);
    }

    if ('meetingNumber' in request && request.meetingNumber) {
      filters.push(`شماره جلسه: ${request.meetingNumber}`);
    }

    if ('resolutionNumber' in request && request.resolutionNumber) {
      filters.push(`شماره مصوبه: ${request.resolutionNumber}`);
    }

    if ('resolutionTitle' in request && request.resolutionTitle) {
      filters.push(`عنوان مصوبه: ${request.resolutionTitle}`);
    }

    if (request.departmentGuid) {
      filters.push('اداره: انتخاب شده');
    }

    if ('actionStatus' in request && request.actionStatus) {
      filters.push(`وضعیت اقدام: ${this.getActionStatusText(request.actionStatus)}`);
    }

    if ('followStatus' in request && request.followStatus) {
      filters.push(`وضعیت پیگیری: ${this.getFollowStatusText(request.followStatus)}`);
    }

    return filters.length > 0 ? filters.join(' | ') : 'بدون فیلتر';
  }
}


// Request DTOs
export interface ResolutionDetailReportRequestDto {
  fromDate?: string;
  toDate?: string;
  meetingNumber?: string;
  resolutionNumber?: string;
  resolutionTitle?: string;
  departmentGuid?: string;
  actionStatus?: number;
  followStatus?: number;
  userGuid?: string;
  positionGuid?: string;
}

export interface ResolutionSummaryReportRequestDto {
  fromDate?: string;
  toDate?: string;
  departmentGuid?: string;
  userGuid?: string;
  positionGuid?: string;
}

// Response DTOs
export interface ResolutionDetailReportDto {
  meetingNumber: string;
  meetingTitle: string;
  meetingDate: Date;
  resolutionNumber: string;
  resolutionTitle: string;
  resolutionSubject: string;
  departmentName: string;
  actorName: string;
  followerName: string;
  dueDate: Date;
  actionStatus?: ActionStatus;
  followStatus?: ActionFollowStatus;
  result: string;
  description: string;
  lastActionDate?: Date;
  totalActions: number;
}

export interface ResolutionSummaryReportDto {
  totalMeetings: number;
  totalResolutions: number;
  departmentSummaries: DepartmentResolutionSummary[];
}

export interface DepartmentResolutionSummary {
  departmentName: string;
  departmentGuid: string;
  totalResolutions: number;
  completedResolutions: number;
  inProgressResolutions: number;
  notStartedResolutions: number;
  overdueResolutions: number;
  completionPercentage: number;
}

export interface DepartmentInfo {
  guid: string;
  name: string;
  code: string;
}

export enum ActionStatus {
  Done = 1,
  NotDone = 2,
  InProgress = 3,
  End = 4,
  Impossible = 5
}

export enum ActionFollowStatus {
  FollowingUp = 1,
  NotFollowedUp = 2,
  FollowUpEnd = 3
}

// API Response wrapper
export interface Result<T> {
  isSuccess: boolean;
  data?: T;
  message?: string;
  errors?: string[];
}

