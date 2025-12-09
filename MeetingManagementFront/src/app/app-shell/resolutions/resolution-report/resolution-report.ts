import { Component, OnInit, signal, inject, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, FormControl, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { BreadcrumbService } from '../../../services/framework-services/breadcrumb.service';
import { firstValueFrom, Subject, debounceTime, takeUntil } from 'rxjs';
import { ToastService } from '../../../services/framework-services/toast.service';
import { ResolutionService } from '../../../services/resolution.service';
import UnitService from '../../../services/unit.service';
import { LocalStorageService } from '../../../services/framework-services/local.storage.service';
import { POSITION_ID, USER_ID_NAME } from '../../../core/types/configuration';
import { CategoryService } from '../../../services/category.service';
import { ComboBase } from '../../../shared/combo-base';
import { PasswordFlowService } from '../../../services/framework-services/password-flow.service';
import { environment } from '../../../../environments/environment';
import { PositionService } from '../../../services/position.service';
import { CustomSelectComponent } from '../../../shared/custom-controls/custom-select';
interface ResolutionReportDto {
  details: ResolutionDetailReportDto[];
  summary: ResolutionSummaryReportDto
}
// Interfaces
// تغییر DepartmentInfo به PositionInfo
interface PositionInfo {
  guid: string;
  title: string;
  id: number;
}

// تغییر DepartmentResolutionSummary به PositionResolutionSummary
interface PositionResolutionSummary {
  totalMeetings: any;
  positionName: string;
  positionGuid: string;
  totalResolutions: number;
  completedResolutions: number;
  inProgressResolutions: number;
  notStartedResolutions: number;
  overdueResolutions: number;
  completionPercentage: number;
}

// به‌روزرسانی ResolutionSummaryReportDto
interface ResolutionSummaryReportDto {
  totalMeetings: number;
  totalResolutions: number;
  positionSummaries: PositionResolutionSummary[];
}

// به‌روزرسانی ResolutionDetailReportDto
interface ResolutionDetailReportDto {
  meetingNumber: string;
  meetingTitle: string;
  meetingDate: Date;
  meetingCategory: string;
  resolutionNumber: string;
  resolutionTitle: string;
  resolutionSubject: string;
  resolutionText: string;
  position: string; // تغییر از departmentName
  actorName: string;
  followerName: string;
  dueDate: Date;
  actionStatus?: ActionStatus;
  followStatus?: ActionFollowStatus;
  result: string;
  description: string;
  lastActionDate?: Date;
  totalActions: number;
  decisionsMade: string;
  documentation: string;
}
interface PositionResolutionSummary {
  totalMeetings: any;
  positionName: string;
  positionGuid: string;
  totalResolutions: number;
  completedResolutions: number;
  inProgressResolutions: number;
  notStartedResolutions: number;
  overdueResolutions: number;
  completionPercentage: number;
}

// به‌روزرسانی ResolutionSummaryReportDto
interface ResolutionSummaryReportDto {
  totalMeetings: number;
  totalResolutions: number;
  positionSummaries: PositionResolutionSummary[];
}
interface DepartmentInfo {
  guid: string;
  title: string;
  id: number;
}
interface PositionInfo {
  guid: string;
  title: string;
  id: number;
}
enum ActionStatus {
  Pending = 1,
  InProgress = 2,
  End = 3,
}
enum ActionFollowStatus {
  Pending = 1,
  InProgress = 2,
  End = 3
}
@Component({
  selector: 'app-resolution-report',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './resolution-report.html',
  styleUrls: ['./resolution-report.css']
})
export class ResolutionReportComponent implements OnInit, OnDestroy {
  // Injected services
  private readonly fb = inject(FormBuilder);
  private readonly resolutionReportService = inject(ResolutionService);
  private readonly positionService = inject(PositionService);
  private readonly categoryService = inject(CategoryService);
  private readonly localStorageService = inject(LocalStorageService);
  private readonly toastr = inject(ToastService);
  private readonly breadcrumbService = inject(BreadcrumbService);
  private readonly passwordFlowService = inject(PasswordFlowService);
  // Destroy subject for cleanup
  private destroy$ = new Subject<void>();
  // Signals for reactive state management
  public activeTab = signal<'detail' | 'summary'>('detail');
  public reportResult = signal<ResolutionReportDto | null>(null);
  // Detail Report
  public detailResults = signal<ResolutionDetailReportDto[]>([]);
  public detailLoading = signal<boolean>(false);
  // Summary Report
  public isFilterCollapsed = signal(false);
  public summaryResult = signal<ResolutionSummaryReportDto | null>(null);
  public summaryLoading = signal<boolean>(false);
  private readonly _categories = signal<ComboBase[]>([]);
  readonly categories = this._categories.asReadonly();
  // Common data
  public positions = signal<PositionInfo[]>([]);
  // Unified form
  public reportForm!: FormGroup;
  // Debounce subject for preventing multiple rapid submissions
  private searchSubject = new Subject<void>();
  private isSubmitting = signal<boolean>(false);
  // Track if searches have been performed to manage empty states
  private searchPerformed = signal<boolean>(false);
  constructor() {
    this.setupBreadcrumb();
    this.initializeForm();
    this.setupSearchDebounce();
  }
  async ngOnInit(): Promise<void> {
    await this.loadPositions();
    await this.loadCategories();
    this.setDefaultDates();
  }
  public toggleFilterCollapse(): void {
    this.isFilterCollapsed.update(v => !v);
  }
  private async loadCategories(): Promise<void> {
    try {
      const hasPermission = await this.passwordFlowService.checkPermission('MT_Meetings_ViewAllMeetings');
      const categories = await this.categoryService.getForComboByCondition<ComboBase[]>(hasPermission).toPromise() || [];
      this._categories.set(categories);
    } catch (error) {
      console.error('Error loading categories:', error);
      this._categories.set([]);
    }
  }
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  private setupBreadcrumb(): void {
    this.breadcrumbService.setItems([
      { label: 'گزارش‌گیری مصوبات', routerLink: '/reports/resolutions' },
    ]);
  }
  private initializeForm(): void {
    this.reportForm = this.fb.group({
      fromDate: new FormControl(''),
      toDate: new FormControl(''),
      meetingNumber: new FormControl(''),
      meetingTitle: new FormControl(''),
      categoryGuid: new FormControl(''),
      resolutionNumber: new FormControl(''),
      resolutionTitle: new FormControl(''),
      resolutionText: new FormControl(''),
      dueDate: new FormControl(''),
      actionStatus: new FormControl(''),
      decisions: new FormControl(''),
      description: new FormControl(''),
      documentation: new FormControl(''),
      positionGuid: new FormControl('') // تغییر از departmentGuid
    });
  }
  private setupSearchDebounce(): void {
    this.searchSubject.pipe(
      debounceTime(500),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.performSearch();
    });
  }
  private setDefaultDates(): void {
    const today = new Date();
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
  }
  private formatDateForInput(date: Date): string {
    return date.toISOString().split('T')[0];
  }
  private async loadDepartments(): Promise<void> {
    try {
      const result = await firstValueFrom(this.positionService.getList<any>());
      if (result.isSuccess && result.data) {
        this.positions.set(result.data.map((dept: any) => ({
          guid: dept.guid,
          title: dept.title,
          id: dept.id
        })));
      }
    } catch (error) {
      console.error('خطا در بارگذاری ادارات:', error);
      this.toastr.error('خطا در بارگذاری لیست ادارات');
    }
  }
  public generateReport(): void {
    if (this.isSubmitting()) {
      this.toastr.warning('لطفاً منتظر تکمیل درخواست قبلی باشید');
      return;
    }
    this.isSubmitting.set(true);
    this.searchSubject.next();
  }
  private async performSearch(): Promise<void> {
    try {
      // هر دو گزارش را همزمان تولید کنیم
      await Promise.all([
        this.generateDetailReport(),
        // this.generateSummaryReport()
      ]);
      this.searchPerformed.set(true);
    } finally {
      this.isSubmitting.set(false);
    }
  }
  private async generateDetailReport(): Promise<void> {
    this.detailLoading.set(true);
    const userGuid = this.localStorageService.getItem(USER_ID_NAME);
    const positionGuid = this.localStorageService.getItem(POSITION_ID);
    try {
      const formValue = this.reportForm.value;
      const request = {
        fromDate: formValue.fromDate || undefined,
        toDate: formValue.toDate || undefined,
        meetingNumber: formValue.meetingNumber?.trim() || undefined,
        meetingTitle: formValue.meetingTitle?.trim() || undefined,
        meetingCategory: formValue.meetingCategory || undefined,
        resolutionNumber: formValue.resolutionNumber?.trim() || undefined,
        resolutionTitle: formValue.resolutionTitle?.trim() || undefined,
        resolutionText: formValue.resolutionText?.trim() || undefined,
        dueDate: formValue.dueDate || undefined,
        actionStatus: formValue.actionStatus || undefined,
        decisions: formValue.decisions?.trim() || undefined,
        description: formValue.description?.trim() || undefined,
        documentation: formValue.documentation?.trim() || undefined,
        positionGuid: formValue.positionGuid || undefined, // تغییر از departmentGuid
        categoryGuid: formValue.categoryGuid || undefined,
        userGuid: userGuid,
        positionMainGuid: positionGuid
      };
      const result = await firstValueFrom(
        this.resolutionReportService.getDetailReport(request)
      );
      if (result.details && result.details.length > 0) {
        this.detailResults.set(result.details);
      } else {
        this.detailResults.set([]);
      }
      if (result.summary) {
        this.summaryResult.set(result.summary);
      } else {
        this.summaryResult.set(null);
      }
    } catch (error) {
      console.error('خطا در تولید گزارش تفصیلی:', error);
      this.toastr.error('خطا در تولید گزارش تفصیلی');
      this.detailResults.set([]);
    } finally {
      this.detailLoading.set(false);
    }
  }
  private async loadPositions(): Promise<void> {
    try {
      const result = await firstValueFrom(this.positionService.getList<any>());
      if (result.isSuccess && result.data) {
        this.positions.set(result.data.map((pos: any) => ({
          guid: pos.guid,
          title: pos.title,
          id: pos.id
        })));
      }
    } catch (error) {
      console.error('خطا در بارگذاری سمت‌ها:', error);
      this.toastr.error('خطا در بارگذاری لیست سمت‌ها');
    }
  }
  // به‌روزرسانی generateSummaryReport
  private async generateSummaryReport(): Promise<void> {
    this.summaryLoading.set(true);
    const userGuid = this.localStorageService.getItem(USER_ID_NAME);
    const positionGuid = this.localStorageService.getItem(POSITION_ID);
    try {
      const formValue = this.reportForm.value;
      const request = {
        fromDate: formValue.fromDate || null,
        toDate: formValue.toDate || null,
        meetingCategory: formValue.meetingCategory || null,
        actionStatus: formValue.actionStatus || null,
        positionGuid: formValue.positionGuid || null, // تغییر از departmentGuid
        userGuid: userGuid,
        positionMainGuid: positionGuid
      };
      const result = await firstValueFrom(
        this.resolutionReportService.getSummaryReport(request)
      );
      if (result) {
        this.summaryResult.set(result);
      } else {
        this.summaryResult.set(null);
      }
    } catch (error) {
      console.error('خطا در تولید گزارش خلاصه:', error);
      this.toastr.error('خطا در تولید گزارش خلاصه');
      this.summaryResult.set(null);
    } finally {
      this.summaryLoading.set(false);
    }
  }
  public clearFilters(): void {
    this.reportForm.reset();
    this.detailResults.set([]);
    this.summaryResult.set(null);
    this.searchPerformed.set(false);
    this.setDefaultDates();
  }
  public switchTab(tab: 'detail' | 'summary'): void {
    this.activeTab.set(tab);
    // نتایج بین تب‌ها حفظ می‌شود
  }
  public printReport(): void {
    if (this.activeTab() === 'detail' && this.detailResults().length === 0) {
      this.toastr.warning('ابتدا گزارش تفصیلی را تولید کنید');
      return;
    }
    if (this.activeTab() === 'summary' && !this.summaryResult()) {
      this.toastr.warning('ابتدا گزارش خلاصه را تولید کنید');
      return;
    }
    this.openPrintWindow(false);
  }
  public printReportWithDecisions(): void {
    if (this.activeTab() === 'detail' && this.detailResults().length === 0) {
      this.toastr.warning('ابتدا گزارش تفصیلی را تولید کنید');
      return;
    }
    this.openPrintWindow(true);
  }
  private openPrintWindow(withDecisions: boolean = false): void {
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      this.toastr.error('امکان باز کردن پنجره چاپ وجود ندارد');
      return;
    }
    const printContent = this.generatePrintContent(withDecisions);
    printWindow.document.open();
    printWindow.document.write(printContent);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  }
  private generatePrintContent(withDecisions: boolean = false): string {
    const currentDate = new Date().toLocaleDateString('fa-IR');
    const reportTitle = this.activeTab() === 'detail'
      ? (withDecisions ? 'گزارش تفصیلی با تصمیمات متخذه' : 'گزارش تفصیلی')
      : 'گزارش خلاصه';
    return `
      <!DOCTYPE html>
      <html lang="fa" dir="rtl">
      <head>
          <meta charset="UTF-8">
          <title>${reportTitle} مصوبات</title>
          <style>
              /* تنظیم صفحه برای چاپ افقی */
              @page {
                  size: A4 landscape;
                  margin: 10mm;
              }
             
              /* تنظیمات کلی صفحه */
              @media print {
                  body {
                      print-color-adjust: exact;
                      -webkit-print-color-adjust: exact;
                  }
                  .page-break { page-break-before: always; }
                 
                  /* بهینه‌سازی برای چاپ افقی */
                  table {
                      font-size: 11px !important;
                      width: 100% !important;
                  }
                 
                  th, td {
                      padding: 6px 4px !important;
                      font-size: 10px !important;
                      word-wrap: break-word;
                      max-width: 120px;
                  }
                 
                  .print-header {
                      margin-bottom: 15px !important;
                      padding-bottom: 10px !important;
                  }
                 
                  .company-name {
                      font-size: 18px !important;
                  }
                 
                  .report-title {
                      font-size: 16px !important;
                  }
              }
             
              body {
                  margin: 0;
                  padding: 15px;
                  direction: rtl;
                  line-height: 1.4;
                  color: #333;
                  font-family: 'B Yekan', 'Iranian Sans', Tahoma, Arial, sans-serif;
              }
             
              .print-header {
                  text-align: center;
                  border-bottom: 3px solid #4f46e5;
                  padding-bottom: 15px;
                  margin-bottom: 20px;
              }
             
              .company-name {
                  font-size: 22px;
                  font-weight: bold;
                  color: #1f2937;
                  margin-bottom: 8px;
              }
             
              .report-title {
                  font-size: 18px;
                  font-weight: 600;
                  color: #4f46e5;
                  margin: 8px 0;
              }
             
              .print-info {
                  display: flex;
                  justify-content: space-between;
                  margin: 15px 0;
                  font-size: 12px;
                  color: #666;
              }
             
              table {
                  width: 100%;
                  border-collapse: collapse;
                  margin: 15px 0;
                  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                  font-size: 12px;
              }
             
              th, td {
                  border: 1px solid #e5e7eb;
                  padding: 8px 6px;
                  text-align: center;
                  font-size: 11px;
                  word-wrap: break-word;
                  vertical-align: middle;
              }
             
              th {
                  background: linear-gradient(135deg, #f8faff 0%, #e7eeff 100%);
                  font-weight: 600;
                  color: #374151;
                  font-size: 12px;
              }
             
              tbody tr:nth-child(even) {
                  background-color: #f9fafb;
              }
             
              tbody tr:hover {
                  background-color: #f3f4f6;
              }
             
              .meeting-category-badge {
                  padding: 3px 6px;
                  border-radius: 10px;
                  font-size: 9px;
                  font-weight: 600;
                  white-space: nowrap;
                  display: inline-block;
              }
             
              .category-board { background: #8b5cf6; color: white; }
              .category-management { background: #06b6d4; color: white; }
              .category-technical { background: #10b981; color: white; }
              .category-financial { background: #f59e0b; color: white; }
              .category-other { background: #64748b; color: white; }
             
              .badge {
                  padding: 3px 6px;
                  border-radius: 6px;
                  font-size: 9px;
                  font-weight: 600;
                  white-space: nowrap;
                  display: inline-block;
              }
             
              .bg-success { background: #10b981; color: white; }
              .bg-warning { background: #f59e0b; color: white; }
              .bg-danger { background: #ef4444; color: white; }
              .bg-secondary { background: #6b7280; color: white; }
              .bg-info { background: #3b82f6; color: white; }
             
              .stats-summary {
                  display: grid;
                  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                  gap: 15px;
                  margin: 20px 0;
                  padding: 15px;
                  background: #f8faff;
                  border-radius: 8px;
                  border: 1px solid #e5e7eb;
              }
             
              .stat-item {
                  text-align: center;
                  padding: 12px;
                  background: white;
                  border-radius: 6px;
                  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
              }
             
              .stat-number {
                  font-size: 1.5rem;
                  font-weight: bold;
                  color: #4f46e5;
                  margin-bottom: 4px;
              }
             
              .stat-label {
                  color: #666;
                  font-size: 12px;
                  font-weight: 500;
              }
             
              .filters-applied {
                  background: #f3f4f6;
                  padding: 12px;
                  border-radius: 6px;
                  margin: 15px 0;
                  border-right: 4px solid #4f46e5;
              }
             
              .filters-applied h4 {
                  margin: 0 0 8px 0;
                  color: #374151;
                  font-size: 14px;
              }
             
              .filter-item {
                  display: inline-block;
                  margin: 2px 4px;
                  padding: 2px 6px;
                  background: #e5e7eb;
                  border-radius: 3px;
                  font-size: 10px;
              }
             
              /* بهینه‌سازی ستون‌های جدول برای چاپ افقی */
              .detail-table th:nth-child(1),
              .detail-table td:nth-child(1) { width: 4%; } /* ردیف */
             
              .detail-table th:nth-child(2),
              .detail-table td:nth-child(2) { width: 8%; } /* تاریخ */
             
              .detail-table th:nth-child(3),
              .detail-table td:nth-child(3) { width: 6%; } /* شماره جلسه */
             
              .detail-table th:nth-child(4),
              .detail-table td:nth-child(4) { width: 6%; } /* شماره مصوبه */
             
              .detail-table th:nth-child(5),
              .detail-table td:nth-child(5) { width: 20%; } /* موضوع مصوبه */
             
              .detail-table th:nth-child(6),
              .detail-table td:nth-child(6) { width: 10%; } /* واحد */
             
              .detail-table th:nth-child(7),
              .detail-table td:nth-child(7) { width: 8%; } /* نتیجه */
             
              .detail-table th:nth-child(8),
              .detail-table td:nth-child(8) { width: 15%; } /* توضیحات */

              .detail-table th:nth-child(9),
              .detail-table td:nth-child(9) { width: 23%; } /* تصمیمات متخذه */
             
              /* محدود کردن ارتفاع متن */
              .text-truncate {
                  max-height: 40px;
                  overflow: hidden;
                  display: -webkit-box;
                  -webkit-line-clamp: 2;
                  -webkit-box-orient: vertical;
              }
              tr, td, th {
                  page-break-inside: avoid !important;
                }
          </style>
          <link rel="stylesheet" href="${environment.selfEndpoint}/css/custom.css"/>
      </head>
      <body>
          <div class="print-header">
              <div class="company-name">شرکت پتروشیمی اصفهان</div>
              <div class="report-title">${reportTitle} مصوبات</div>
              ${this.getAppliedFiltersHtml()}
            
          </div>
         
          ${this.activeTab() === 'detail' ? this.getDetailTableHtml(withDecisions) : this.getSummaryTableHtml()}
      </body>
      </html>
    `;
  }
  private getAppliedFiltersHtml(): string {
    const formValue = this.reportForm.value;
    let fromDate = formValue.fromDate;
    let toDate = formValue.toDate;
    // اگر تاریخ خالی بود، کوچکترین و بزرگترین تاریخ رو از دیتا بگیریم
    if (!fromDate || !toDate) {
      const results = this.detailResults();
      if (results.length > 0) {
        // Since meetingDate is already in Jalali format, we can directly use it
        const dates = results.map(r => r.meetingDate);
        fromDate = dates.reduce((min, curr) => curr < min ? curr : min);
        toDate = dates.reduce((max, curr) => curr > max ? curr : max);
      }
    }
    return `
    <div class="filters-applied">
        <span class="filter-item">از تاریخ: ${fromDate || '-'}</span>
        <span class="filter-item">تا تاریخ: ${toDate || '-'}</span>
    </div>
  `;
  }
  private getActionStatusTextForFilter(status: string): string {
    const statusMap: Record<string, string> = {
      'Done': 'اقدامات انجام‌شده',
      'InProgress': 'اقدامات در حال انجام',
      'NotDone': 'اقدامات انجام‌نشده',
      'End': 'اقدامات پایان یافته',
      'Impossible': 'اقدامات غیر قابل انجام'
    };
    return statusMap[status] || status;
  }
  private getDetailTableHtml(withDecisions: boolean = false): string {
    const results = this.detailResults();
    if (results.length === 0) {
      return '<div style="text-align: center; padding: 50px;">هیچ نتیجه‌ای یافت نشد</div>';
    }
    const tableRows = results.map((item, index) => `
    <tr>
        <td>${index + 1}</td>
        <td>${item.meetingDate}</td>
        <td>${item.meetingNumber || '-'}</td>
        <td>${item.resolutionNumber || '-'}</td>
        <td>${item.resolutionTitle || '-'}</td>
        <td>${item.position || '-'}</td>
        <td>${this.getActionStatus(item.actionStatus)}</td>
        <td>${item.description || '-'}</td>
        ${withDecisions ? `<td>${item.meetingCategory === 'هیئت مدیره' ? (item.decisionsMade || '-') : (item.resolutionText || '-')}</td>` : ''}
    </tr>
  `).join('');
    return `
    <table class="detail-table">
        <thead>
            <tr>
                <th>ردیف</th>
                <th>تاریخ جلسه</th>
                <th>شماره جلسه</th>
                <th>شماره مصوبه</th>
                <th>موضوع مصوبه</th>
                <th>سمت</th>
                <th>نتیجه</th>
                <th>توضیحات</th>
                ${withDecisions ? '<th>تصمیمات متخذه / متن مصوبه</th>' : ''}
            </tr>
        </thead>
        <tbody>
            ${tableRows}
        </tbody>
    </table>
  `;
  }

  private getSummaryTableHtml(): string {
    const result = this.summaryResult();
    if (!result) {
      return '<div style="text-align: center; padding: 50px;">هیچ داده‌ای یافت نشد</div>';
    }
    const tableRows = result.positionSummaries?.map(item => `
    <tr>
        <td class="fw-bold">${item.positionName}</td>
        <td>${item.totalMeetings}</td>
        <td>${item.totalResolutions}</td>
        <td>${item.completedResolutions}</td>
        <td>${item.inProgressResolutions}</td>
        <td>${item.notStartedResolutions}</td>
    </tr>
  `).join('') || '';
    return `
    <table>
        <thead>
            <tr>
                <th>نام سمت</th>
                <th>تعداد جلسات</th>
                <th>تعداد مصوبات</th>
                <th>انجام شده</th>
                <th>در حال انجام</th>
                <th>انجام نشده</th>
            </tr>
        </thead>
        <tbody>
            ${tableRows}
        </tbody>
    </table>
  `;
  }
  private getCurrentUserName(): string {
    // Get from localStorage or user service
    return 'کاربر سیستم'; // Replace with actual user name
  }
  public formatDate(date: Date | string): string {
    if (!date) return '-';
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      return new Intl.DateTimeFormat('fa-IR').format(dateObj);
    } catch {
      return '-';
    }
  }
  public getActionStatusText(status?: ActionStatus): string {
    if (!status) return 'نامشخص';
    const statusMap: Record<ActionStatus, string> = {
      [ActionStatus.InProgress]: 'در حال انجام',
      [ActionStatus.End]: 'پایان یافته',
      [ActionStatus.Pending]: 'در انتظار اقدام'
    };
    return statusMap[status] || 'نامشخص';
  }
  public getActionStatusBadge(status?: ActionStatus): string {
    if (!status) return '<span class="badge bg-secondary">نامشخص</span>';
    const badgeMap: Record<ActionStatus, string> = {
      [ActionStatus.InProgress]: '<span class="badge bg-warning">در حال انجام</span>',
      [ActionStatus.End]: '<span class="badge bg-success">پایان یافته</span>',
      [ActionStatus.Pending]: '<span class="badge bg-secondary">در انتظار اقدام</span>'
    };
    return badgeMap[status] || '<span class="badge bg-secondary">نامشخص</span>';
  }
  public getActionStatus(status?: ActionStatus): string {
    if (!status) return 'نامشخص';
    const badgeMap: Record<ActionStatus, string> = {
      [ActionStatus.InProgress]: 'در حال انجام',
      [ActionStatus.End]: 'پایان یافته',
      [ActionStatus.Pending]: 'در انتظار اقدام'
    };
    return badgeMap[status] || 'نامشخص';
  }
  public getActionStatusBadgeClass(status?: ActionStatus): string {
    if (!status) return 'badge bg-secondary';
    const classMap: Record<ActionStatus, string> = {
      [ActionStatus.End]: 'badge bg-success',
      [ActionStatus.InProgress]: 'badge bg-warning',
      [ActionStatus.Pending]: 'badge bg-secondary'
    };
    return classMap[status] || 'badge bg-secondary';
  }
  public getFollowStatusText(status?: ActionFollowStatus): string {
    if (!status) return 'نامشخص';
    const statusMap: Record<ActionFollowStatus, string> = {
      [ActionFollowStatus.InProgress]: 'در حال پیگیری',
      [ActionFollowStatus.Pending]: 'در انتظار پیگیری',
      [ActionFollowStatus.End]: 'پایان پیگیری'
    };
    return statusMap[status] || 'نامشخص';
  }
  // Getters for template
  public get isDetailTabEmpty(): boolean {
    return this.searchPerformed() && this.detailResults().length === 0;
  }
  public get isSummaryTabEmpty(): boolean {
    return this.searchPerformed() && !this.summaryResult();
  }
  public get isLoading(): boolean {
    return this.detailLoading() || this.summaryLoading() || this.isSubmitting();
  }
  // Template helpers
  public get ActionStatus() { return ActionStatus; }
  public get ActionFollowStatus() { return ActionFollowStatus; }
}