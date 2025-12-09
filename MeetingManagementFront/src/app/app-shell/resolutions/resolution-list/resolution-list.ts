import {
  AfterViewInit,
  Component,
  computed,
  effect,
  inject,
  OnInit,
  signal
} from '@angular/core';
import { MeetingService } from '../../../services/meeting.service';
import { BreadcrumbService } from '../../../services/framework-services/breadcrumb.service';
import { ActivatedRoute, Router } from '@angular/router';
import { POSITION_ID, USER_ID_NAME } from '../../../core/types/configuration';
import { SwalService } from '../../../services/framework-services/swal.service';
import { AgGridAngular } from 'ag-grid-angular';
import { AgGridBaseComponent } from '../../../shared/ag-grid-base/ag-grid-base';
import { AssignmentService } from '../../../services/assignment.service';
import { FormsModule } from '@angular/forms';
import { PasswordFlowService } from '../../../services/framework-services/password-flow.service';
import { ActionService } from '../../../services/action.service';
import { firstValueFrom } from 'rxjs';
import { AssignmentOptionsCellComponent } from './resolutionOptionsCellComponent';
import { Location, CommonModule } from '@angular/common';

export enum AssignmentViewType {
  All = 'All',
  OriginalAssignment = 'OriginalAssignment',
  ReceivedReferral = 'ReceivedReferral',
  GivenReferral = 'GivenReferral'
}

// Enums مطابق با بک‌اند
export enum ActionStatus {
  Pending = 1,
  InProgress = 2,
  End = 3,
  Overdue = 4
}

export enum ActionFollowStatus {
  Pending = 1,
  InProgress = 2,
  End = 3
}

export enum AssignmentResult {
  Done = 1,
  NotDone = 2
}

export interface ViewTypeOption {
  value: AssignmentViewType;
  label: string;
  description: string;
  icon: string;
  color: string;
}

@Component({
  selector: 'app-resolution-list',
  templateUrl: './resolution-list.html',
  styleUrl: './resolution-list.css',
  imports: [AgGridAngular, FormsModule, CommonModule],
  standalone: true
})
export class ResolutionListComponent extends AgGridBaseComponent implements OnInit, AfterViewInit {
  protected readonly AssignmentViewType = AssignmentViewType;
  protected readonly ActionStatus = ActionStatus;
  protected readonly ActionFollowStatus = ActionFollowStatus;
  protected readonly AssignmentResult = AssignmentResult;

  private readonly meetingService = inject(MeetingService);
  private readonly assignmentService = inject(AssignmentService);
  private readonly swalService = inject(SwalService);
  private readonly breadcrumbService = inject(BreadcrumbService);
  private readonly route = inject(ActivatedRoute);
  private readonly actionService = inject(ActionService);
  private readonly passwordFlowService = inject(PasswordFlowService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  // State signals
  public records = signal<any[]>([]);
  public isPermitted = signal<boolean>(false);
  public loading = signal<boolean>(false);
  public selectedRowId = signal<number | null>(null);

  // Filter signals - اصلی
  public selectedViewType = signal<AssignmentViewType>(AssignmentViewType.All);
  public selectedRole = signal<string>(''); // 'Action' | 'Follow' | ''
  public selectedActionStatus = signal<ActionStatus | null>(null);
  public selectedFollowStatus = signal<ActionFollowStatus | null>(null);
  public selectedResult = signal<AssignmentResult | null>(null);
  public showOverdueOnly = signal<boolean>(false);

  // Temporary filter signals - موقت
  public tempViewType = signal<AssignmentViewType>(AssignmentViewType.All);
  public tempRole = signal<string>('');
  public tempActionStatus = signal<ActionStatus | null>(null);
  public tempFollowStatus = signal<ActionFollowStatus | null>(null);
  public tempResult = signal<AssignmentResult | null>(null);
  public tempShowOverdue = signal<boolean>(false);

  // View Type Options
  public viewTypeOptions: ViewTypeOption[] = [
    {
      value: AssignmentViewType.All,
      label: 'همه تخصیص‌ها',
      description: 'نمایش کلیه مصوبه‌هایی که به عنوان اقدام‌کننده یا پیگیری‌کننده به شما مربوط می‌شوند.',
      icon: 'fa-list',
      color: 'primary'
    },
    {
      value: AssignmentViewType.OriginalAssignment,
      label: 'تخصیص‌های اصلی',
      description: 'مصوبه‌هایی که مستقیماً و بدون واسطه به شما محول شده‌اند.',
      icon: 'fa-user-circle',
      color: 'info'
    },
    {
      value: AssignmentViewType.ReceivedReferral,
      label: 'ارجاعات دریافتی',
      description: 'مصوبه‌هایی که توسط شخص دیگری به شما ارجاع داده شده است.',
      icon: 'fa-arrow-down',
      color: 'success'
    },
    {
      value: AssignmentViewType.GivenReferral,
      label: 'ارجاعات ارسالی',
      description: 'مصوبه‌هایی که شما به شخص دیگری ارجاع داده‌اید.',
      icon: 'fa-arrow-up',
      color: 'warning'
    }
  ];

  // Counts signal
  public counts = signal<any>({
    action: { all: 0, pending: 0, inProgress: 0, end: 0, overdue: 0 },
    follow: { all: 0, pending: 0, inProgress: 0, end: 0 },
    receivedReferrals: { total: 0 },
    sentReferrals: { total: 0 },
    originalAssignments: { total: 0 }
  });

  // Computed - نمایش فیلترها
  public showRoleFilter = computed(() => {
    const viewType = this.tempViewType();
    return viewType === AssignmentViewType.All ||
      viewType === AssignmentViewType.OriginalAssignment;
  });

  public showActionStatusFilter = computed(() => {
    const viewType = this.tempViewType();
    const role = this.tempRole();

    // نمایش فیلتر ActionStatus فقط برای اقدام‌کننده‌ها
    return (viewType === AssignmentViewType.All && role !== 'Follow') ||
      (viewType === AssignmentViewType.OriginalAssignment && role !== 'Follow') ||
      viewType === AssignmentViewType.ReceivedReferral;
  });

  public showFollowStatusFilter = computed(() => {
    const viewType = this.tempViewType();
    const role = this.tempRole();

    // نمایش فیلتر FollowStatus فقط برای پیگیری‌کننده‌ها
    return (viewType === AssignmentViewType.All && role !== 'Action') ||
      (viewType === AssignmentViewType.OriginalAssignment && role !== 'Action') ||
      viewType === AssignmentViewType.GivenReferral;
  });

  public showResultFilter = computed(() => {
    // فقط برای تخصیص‌های پایان یافته
    return this.tempActionStatus() === ActionStatus.End;
  });

  // Active filters computed
  public activeFilters = computed(() => {
    const filters: Array<{ type: string, label: string, value: any }> = [];

    const viewType = this.selectedViewType();
    if (viewType !== AssignmentViewType.All) {
      const option = this.viewTypeOptions.find(o => o.value === viewType);
      filters.push({
        type: 'viewType',
        label: option?.label || '',
        value: viewType
      });
    }

    const role = this.selectedRole();
    if (role) {
      filters.push({
        type: 'role',
        label: role === 'Action' ? 'اقدام‌کننده' : 'پیگیری‌کننده',
        value: role
      });
    }

    const actionStatus = this.selectedActionStatus();
    if (actionStatus !== null) {
      filters.push({
        type: 'actionStatus',
        label: `وضعیت اقدام: ${this.getActionStatusLabel(actionStatus)}`,
        value: actionStatus
      });
    }

    const followStatus = this.selectedFollowStatus();
    if (followStatus !== null) {
      filters.push({
        type: 'followStatus',
        label: `وضعیت پیگیری: ${this.getFollowStatusLabel(followStatus)}`,
        value: followStatus
      });
    }

    const result = this.selectedResult();
    if (result !== null) {
      filters.push({
        type: 'result',
        label: `نتیجه: ${this.getResultLabel(result)}`,
        value: result
      });
    }

    if (this.showOverdueOnly()) {
      filters.push({
        type: 'overdue',
        label: 'فقط گذشته از مهلت',
        value: true
      });
    }

    return filters;
  });

  public hasActiveFilters = computed(() => this.activeFilters().length > 0);

  // Count getters
  public getViewTypeCount = computed(() => {
    const counts = this.counts();
    const viewType = this.selectedViewType();

    switch (viewType) {
      case AssignmentViewType.All:
        return counts.action.all + counts.follow.all;
      case AssignmentViewType.OriginalAssignment:
        return counts.originalAssignments?.total || 0;
      case AssignmentViewType.ReceivedReferral:
        return counts.receivedReferrals?.total || 0;
      case AssignmentViewType.GivenReferral:
        return counts.sentReferrals?.total || 0;
      default:
        return 0;
    }
  });

  constructor() {
    super();
    this.breadcrumbService.setItems([
      { label: 'مصوبات', routerLink: '/resolutions/list' },
    ]);

    // Effect برای بارگذاری مجدد با تغییر فیلترهای اصلی
    effect(() => {
      const viewType = this.selectedViewType();
      const role = this.selectedRole();
      const actionStatus = this.selectedActionStatus();
      const followStatus = this.selectedFollowStatus();
      const result = this.selectedResult();
      const overdue = this.showOverdueOnly();

      if (this.isPermitted()) {
        this.getRecords();
      }
    });
  }

  override async ngOnInit(): Promise<void> {
    super.ngOnInit();

    const checkPermission = await this.passwordFlowService.checkPermission('MT_Followups');
    if (!checkPermission) {
      this.toastService.error('شما مجوز مشاهده این صفحه را ندارید');
      return;
    }

    this.isPermitted.set(true);

    // بارگذاری از Query Params
    this.route.queryParams.subscribe(params => {
      if (params['viewType']) {
        const viewType = params['viewType'] as AssignmentViewType;
        this.selectedViewType.set(viewType);
        this.tempViewType.set(viewType);
      }

      if (params['role']) {
        this.selectedRole.set(params['role']);
        this.tempRole.set(params['role']);
      }

      if (params['actionStatus']) {
        const status = parseInt(params['actionStatus'], 10) as ActionStatus;
        this.selectedActionStatus.set(status);
        this.tempActionStatus.set(status);
      }

      if (params['followStatus']) {
        const status = parseInt(params['followStatus'], 10) as ActionFollowStatus;
        this.selectedFollowStatus.set(status);
        this.tempFollowStatus.set(status);
      }

      if (params['result']) {
        const result = parseInt(params['result'], 10) as AssignmentResult;
        this.selectedResult.set(result);
        this.tempResult.set(result);
      }

      if (params['overdue']) {
        const overdue = params['overdue'] === 'true';
        this.showOverdueOnly.set(overdue);
        this.tempShowOverdue.set(overdue);
      }

      if (this.isPermitted()) {
        this.loadCounts();
      }
    });

    this.setupGridColumns();
  }

  ngAfterViewInit(): void {
    this.restoreGridState();
  }

  // ==================== Filter Methods ====================

  public applyFilters(): void {
    // انتقال مقادیر موقت به اصلی
    this.selectedViewType.set(this.tempViewType());
    this.selectedRole.set(this.tempRole());
    this.selectedActionStatus.set(this.tempActionStatus());
    this.selectedFollowStatus.set(this.tempFollowStatus());
    this.selectedResult.set(this.tempResult());
    this.showOverdueOnly.set(this.tempShowOverdue());

    // تنظیم خودکار فیلترهای ناسازگار
    const viewType = this.selectedViewType();

    if (viewType === AssignmentViewType.ReceivedReferral) {
      // ارجاعات دریافتی -> فقط اقدام‌کننده
      this.selectedRole.set('Action');
      this.tempRole.set('Action');
      this.selectedFollowStatus.set(null);
      this.tempFollowStatus.set(null);
    } else if (viewType === AssignmentViewType.GivenReferral) {
      // ارجاعات ارسالی -> فقط پیگیری‌کننده
      this.selectedRole.set('Follow');
      this.tempRole.set('Follow');
      this.selectedActionStatus.set(null);
      this.tempActionStatus.set(null);
      this.selectedResult.set(null);
      this.tempResult.set(null);
    }

    // اگر ActionStatus پایان یافته نیست، Result را پاک کن
    if (this.selectedActionStatus() !== ActionStatus.End) {
      this.selectedResult.set(null);
      this.tempResult.set(null);
    }

    this.updateUrlParams();
  }

  public removeFilter(filterType: string): void {
    switch (filterType) {
      case 'viewType':
        this.selectedViewType.set(AssignmentViewType.All);
        this.tempViewType.set(AssignmentViewType.All);
        break;
      case 'role':
        this.selectedRole.set('');
        this.tempRole.set('');
        break;
      case 'actionStatus':
        this.selectedActionStatus.set(null);
        this.tempActionStatus.set(null);
        this.selectedResult.set(null);
        this.tempResult.set(null);
        break;
      case 'followStatus':
        this.selectedFollowStatus.set(null);
        this.tempFollowStatus.set(null);
        break;
      case 'result':
        this.selectedResult.set(null);
        this.tempResult.set(null);
        break;
      case 'overdue':
        this.showOverdueOnly.set(false);
        this.tempShowOverdue.set(false);
        break;
    }
    this.updateUrlParams();
  }

  public clearAllFilters(): void {
    // پاک کردن موقت
    this.tempViewType.set(AssignmentViewType.All);
    this.tempRole.set('');
    this.tempActionStatus.set(null);
    this.tempFollowStatus.set(null);
    this.tempResult.set(null);
    this.tempShowOverdue.set(false);

    // پاک کردن اصلی
    this.selectedViewType.set(AssignmentViewType.All);
    this.selectedRole.set('');
    this.selectedActionStatus.set(null);
    this.selectedFollowStatus.set(null);
    this.selectedResult.set(null);
    this.showOverdueOnly.set(false);

    this.updateUrlParams();
  }

  public updateUrlParams(): void {
    const params: any = {};

    params.viewType = this.selectedViewType() !== AssignmentViewType.All ? this.selectedViewType() : null;
    params.role = this.selectedRole() || null;
    params.actionStatus = this.selectedActionStatus() !== null ? this.selectedActionStatus() : null;
    params.followStatus = this.selectedFollowStatus() !== null ? this.selectedFollowStatus() : null;
    params.result = this.selectedResult() !== null ? this.selectedResult() : null;
    params.overdue = this.showOverdueOnly() ? 'true' : null;

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      queryParamsHandling: 'merge'
    });
  }

  // ==================== Label Methods ====================

  public getActionStatusLabel(status: ActionStatus): string {
    const labels = {
      [ActionStatus.Pending]: 'در انتظار اقدام',
      [ActionStatus.InProgress]: 'در حال انجام',
      [ActionStatus.End]: 'پایان یافته',
      [ActionStatus.Overdue]: 'گذشته از مهلت'
    };
    return labels[status] || '';
  }

  public getFollowStatusLabel(status: ActionFollowStatus): string {
    const labels = {
      [ActionFollowStatus.Pending]: 'در انتظار پیگیری',
      [ActionFollowStatus.InProgress]: 'در حال پیگیری',
      [ActionFollowStatus.End]: 'پایان پیگیری'
    };
    return labels[status] || '';
  }

  public getResultLabel(result: AssignmentResult): string {
    const labels = {
      [AssignmentResult.Done]: 'انجام شده',
      [AssignmentResult.NotDone]: 'انجام نشده'
    };
    return labels[result] || '';
  }

  public getContextAlert(): { class: string, icon: string, title: string, description: string } {
    const viewType = this.selectedViewType();
    const option = this.viewTypeOptions.find(o => o.value === viewType);

    return {
      class: option?.color || 'primary',
      icon: option?.icon || 'fa-info-circle',
      title: option?.label || '',
      description: option?.description || ''
    };
  }

  // ==================== Data Loading Methods ====================

  public async loadCounts(): Promise<void> {
    try {
      const positionGuid = this.localStorageService.getItem(POSITION_ID);
      const userGuid = this.localStorageService.getItem(USER_ID_NAME);

      const [
        assignmentCounts,
        originalCounts,
        receivedCounts,
        sentCounts
      ] = await Promise.all([
        firstValueFrom(this.assignmentService.getCounts(positionGuid)),
        firstValueFrom(this.assignmentService.getOriginalAssignmentCounts(positionGuid)),
        firstValueFrom(this.assignmentService.getReceivedReferralCounts(positionGuid)),
        firstValueFrom(this.assignmentService.getSentReferralCounts(userGuid))
      ]);

      this.counts.set({
        action: assignmentCounts.actionCounts || { all: 0, pending: 0, inProgress: 0, end: 0, overdue: 0 },
        follow: assignmentCounts.followCounts || { all: 0, pending: 0, inProgress: 0, end: 0 },
        originalAssignments: originalCounts || { total: 0 },
        receivedReferrals: receivedCounts || { total: 0 },
        sentReferrals: sentCounts || { total: 0 }
      });
    } catch (error) {
      console.error('Error loading counts:', error);
    }
  }

  public async getRecords(): Promise<void> {
    this.loading.set(true);

    try {
      const userGuid = this.localStorageService.getItem(USER_ID_NAME);
      const positionGuid = this.localStorageService.getItem(POSITION_ID);

      const requestModel: any = {
        userGuid,
        positionGuid,
        viewType: this.selectedViewType()
      };

      if (this.selectedRole()) {
        requestModel.type = this.selectedRole();
      }

      if (this.selectedActionStatus() !== null) {
        requestModel.actionStatus = this.selectedActionStatus();
      }

      if (this.selectedFollowStatus() !== null) {
        requestModel.approvalStatus = this.selectedFollowStatus();
      }

      if (this.selectedResult() !== null) {
        requestModel.result = this.selectedResult();
      }

      if (this.showOverdueOnly()) {
        requestModel.overdueOnly = true;
      }

      const data = await firstValueFrom(this.assignmentService.getAll(requestModel));
      this.records.set(data);

      const api = this.gridApi();
      api?.sizeColumnsToFit();
      setTimeout(() => {
        this.highlightSelectedRow();
      }, 700);
    } catch (error) {
      console.error('Error loading records:', error);
      this.toastService.error('خطا در بارگذاری داده‌ها');
    } finally {
      this.loading.set(false);
    }
  }

  // ==================== Grid Methods ====================

  private restoreGridState(): void {
    const pageStr = sessionStorage.getItem('resolutionGridPage');
    if (pageStr) {
      const page = parseInt(pageStr, 10);
      setTimeout(() => {
        const api = this.gridApi();
        api?.paginationGoToPage(page);
        this.highlightSelectedRow();
      }, 500);
    }

    const savedFilters = sessionStorage.getItem('resolutionGridFilters');
    if (savedFilters) {
      try {
        const filters = JSON.parse(savedFilters);
        setTimeout(() => {
          const api = this.gridApi();
          api?.setFilterModel(filters);
          this.highlightSelectedRow();
        }, 600);
        sessionStorage.removeItem('resolutionGridFilters');
      } catch (error) {
        console.error('خطا در بازگردانی فیلترها:', error);
      }
    }
  }

  private highlightSelectedRow(): void {
    const api = this.gridApi();
    const id = parseInt(sessionStorage.getItem('editedAssignmentId') ?? '0', 10);

    if (!api || !id) return;

    api.forEachNode((node: any) => {
      if (node.data?.id === id) {
        node.setSelected(true);
        setTimeout(() => {
          api.ensureIndexVisible(node.rowIndex, 'middle');
          api.redrawRows();
        }, 100);
      } else {
        node.setSelected(false);
      }
    });
  }

  public onFirstDataRendered(event: any): void {
    setTimeout(() => {
      this.highlightSelectedRow();
      this.autoSizeAllColumns();
    }, 700);
  }

  private saveGridState(): void {
    const api = this.gridApi();
    if (api) {
      const currentPage = api.paginationGetCurrentPage();
      sessionStorage.setItem('resolutionGridPage', currentPage.toString());

      const filterModel = api.getFilterModel();
      if (filterModel && Object.keys(filterModel).length > 0) {
        sessionStorage.setItem('resolutionGridFilters', JSON.stringify(filterModel));
      }
    }
  }

  private setupGridColumns(): void {
    const options = this.gridOptions();
    if (!options) return;

    options.columnDefs = [
      {
        colId: 'actions',
        headerName: 'عملیات',
        cellRenderer: AssignmentOptionsCellComponent,
        cellStyle: { textAlign: 'center', overflow: 'unset', 'font-family': 'Sahel' },
        width: 120,
        pinned: 'right'
      },
      {
        field: 'statusDescription',
        headerName: 'نوع',
        cellRenderer: (params: any) => {
          const viewType = params.data?.viewType;
          const description = params.data?.statusDescription;

          let badgeClass = 'bg-secondary';
          let icon = 'fa-info';

          switch (viewType) {
            case 'OriginalAssignment':
              badgeClass = 'bg-primary';
              icon = 'fa-user-circle';
              break;
            case 'ReceivedReferral':
              badgeClass = 'bg-success';
              icon = 'fa-arrow-down';
              break;
            case 'GivenReferral':
              badgeClass = 'bg-warning';
              icon = 'fa-arrow-up';
              break;
          }

          return `<span class="badge ${badgeClass}" style="width:110px!important">
                    <i class="fa ${icon}"></i> ${description}
                  </span>`;
        },
        cellStyle: { textAlign: 'center', 'font-family': 'Sahel' },
        width: 150
      },
      {
        field: 'actionStatus',
        headerName: 'وضعیت اقدام',
        cellRenderer: this.actionStatusCellRenderer,
        cellStyle: { textAlign: 'center', 'font-family': 'Sahel' },
        width: 150
      },
      {
        field: 'followStatus',
        headerName: 'وضعیت پیگیری',
        cellRenderer: this.followStatusCellRenderer,
        cellStyle: { textAlign: 'center', 'font-family': 'Sahel' },
        width: 150
      },
      {
        field: 'actionResult',
        headerName: 'نتیجه اقدام',
        cellRenderer: (params: any) => {
          const result = params.data?.actionResult;
          const resultName = params.data?.resultName;

          if (!result || !resultName) {
            return '<span class="text-muted">-</span>';
          }

          const badgeClass = result === 'Done' ? 'bg-success' : 'bg-danger';
          const icon = result === 'Done' ? 'fa-check-circle' : 'fa-times-circle';

          return `<span class="badge ${badgeClass}">
                    <i class="fa ${icon}"></i> ${resultName}
                  </span>`;
        },
        cellStyle: { textAlign: 'center', 'font-family': 'Sahel' },
        width: 150
      },
      {
        field: 'resultDescription',
        headerName: 'توضیحات نتیجه',
        filter: 'agTextColumnFilter',
        cellStyle: { direction: 'rtl', 'font-family': 'Sahel' },
        width: 200,
        cellRenderer: (params: any) => {
          const desc = params.data?.resultDescription;
          if (!desc) return '<span class="text-muted">-</span>';
          return desc;
        }
      },
      {
        field: 'resultDate',
        headerName: 'تاریخ نتیجه',
        filter: 'agDateColumnFilter',
        cellStyle: { direction: 'ltr', 'font-family': 'Sahel' },
        width: 120,
        cellRenderer: (params: any) => {
          const date = params.data?.resultDate;
          if (!date) return '<span class="text-muted">-</span>';
          return date;
        }
      },
      {
        field: 'meetingNumber',
        headerName: 'شماره جلسه',
        filter: 'agTextColumnFilter',
        cellStyle: { 'font-family': 'Sahel' },
        width: 120
      },
      {
        field: 'meetingDate',
        headerName: 'تاریخ جلسه',
        filter: 'agDateColumnFilter',
        cellStyle: { direction: 'ltr', 'font-family': 'Sahel' },
        width: 120
      },
      {
        field: 'number',
        headerName: 'شماره مصوبه',
        filter: 'agTextColumnFilter',
        cellStyle: { 'font-family': 'Sahel' },
        width: 120
      },
      {
        field: 'title',
        headerName: 'عنوان مصوبه',
        filter: 'agTextColumnFilter',
        resizable: true,
        cellStyle: { direction: 'rtl', 'font-family': 'Sahel' },
        width: 250
      },
      {
        field: 'category',
        headerName: 'دسته‌بندی',
        filter: 'agTextColumnFilter',
        cellStyle: { direction: 'rtl', 'font-family': 'Sahel' },
        width: 150
      },
      {
        field: 'dueDate',
        headerName: 'مهلت اقدام',
        filter: 'agDateColumnFilter',
        cellStyle: { direction: 'ltr', 'font-family': 'Sahel' },
        width: 120,
        cellRenderer: (params: any) => {
          const dueDate = params.data?.dueDate;
          if (!dueDate) return '<span class="text-muted">نامشخص</span>';

          const today = new Date();
          const [year, month, day] = dueDate.split('/').map(Number);
          const due = new Date(year, month - 1, day);

          if (due < today && params.data?.status !== ActionStatus.End) {
            return `<span class="text-danger font-weight-bold">
                      <i class="fa fa-exclamation-triangle"></i> ${dueDate}
                    </span>`;
          }

          return dueDate;
        }
      },
      {
        field: 'resolution',
        headerName: 'متن مصوبه',
        filter: 'agTextColumnFilter',
        resizable: true,
        cellStyle: { direction: 'rtl', 'font-family': 'Sahel' },
        width: 300
      },
      {
        field: 'actor',
        headerName: 'اقدام‌کننده',
        filter: 'agTextColumnFilter',
        cellStyle: { direction: 'rtl', 'font-family': 'Sahel' },
        width: 150
      },
      {
        field: 'follower',
        headerName: 'پیگیری‌کننده',
        filter: 'agTextColumnFilter',
        cellStyle: { direction: 'rtl', 'font-family': 'Sahel' },
        width: 150
      },
      {
        field: 'referralsCount',
        headerName: 'تعداد ارجاع',
        cellRenderer: (params: any) => {
          const count = params.data?.referralsCount || 0;
          if (count > 0) {
            return `<span class="badge bg-info">${count}</span>`;
          }
          return '<span class="text-muted">-</span>';
        },
        cellStyle: { textAlign: 'center', 'font-family': 'Sahel' },
        width: 100
      }
    ];

    options.getRowStyle = (params: any) => {
      const id = parseInt(sessionStorage.getItem('editedAssignmentId') ?? '0', 10);
      if (params.data?.id === id) {
        return { background: '#ffffcc', transition: 'background-color 0.5s ease', fontWeight: 'bold' };
      }

      const dueDate = params.data?.dueDate;
      const status = params.data?.status;

      if (dueDate && status !== ActionStatus.End) {
        const today = new Date();
        const [year, month, day] = dueDate.split('/').map(Number);
        const due = new Date(year, month - 1, day);

        if (due < today) {
          return { background: '#ffebee' };
        }
      }

      return {};
    };

    this.setupGridInteractions(options);
  }

  private setupGridInteractions(options: any): void {
    options.rowStyle = { cursor: 'pointer' };

    options.onCellClicked = (event: any) => {
      if (event.colDef.colId !== 'actions' && event.data) {
        this.saveGridState();
        sessionStorage.setItem('editedAssignmentId', event.data.id);
        this.selectedRowId.set(event.data.id);
        this.openAssignmentManagement(event.data);
      }
    };

    options.onGridReady = (params: any) => {
      setTimeout(() => {
        this.highlightSelectedRow();
        this.autoSizeAllColumns();
      }, 500);
    };
  }

  public openAssignmentManagement(assignment: any): void {
    this.saveGridState();
    sessionStorage.setItem('editedAssignmentId', assignment.id);
    this.router.navigate(['/resolutions/details', assignment.id]);
  }

  private actionStatusCellRenderer = (params: any): string => {
    const statusId = params.data?.status;
    const status = params.data?.actionStatus;
    if (!statusId || !status) return '<span class="text-muted">-</span>';

    const colors: { [key: number]: string } = {
      [ActionStatus.Pending]: '#f27e63',
      [ActionStatus.InProgress]: '#f0ad4e',
      [ActionStatus.End]: '#5cb85c',
      [ActionStatus.Overdue]: '#d9534f'
    };

    const icons: { [key: number]: string } = {
      [ActionStatus.Pending]: 'fa-clock-o',
      [ActionStatus.InProgress]: 'fa-spinner',
      [ActionStatus.End]: 'fa-check-circle',
      [ActionStatus.Overdue]: 'fa-exclamation-triangle'
    };

    return `<span class="badge-status" style="background-color: ${colors[statusId] || 'gray'};">
              <i class="fa ${icons[statusId] || 'fa-info'}"></i> ${status}
            </span>`;
  };

  private followStatusCellRenderer = (params: any): string => {
    const statusId = params.data?.followStatusId;
    const status = params.data?.followStatus;
    if (!statusId || !status) return '<span class="text-muted">-</span>';

    const colors: { [key: number]: string } = {
      [ActionFollowStatus.Pending]: '#f27e63',
      [ActionFollowStatus.InProgress]: '#3dd456',
      [ActionFollowStatus.End]: '#5cb85c'
    };

    const icons: { [key: number]: string } = {
      [ActionFollowStatus.Pending]: 'fa-clock-o',
      [ActionFollowStatus.InProgress]: 'fa-eye',
      [ActionFollowStatus.End]: 'fa-check-circle'
    };

    return `<span class="badge-status" style="background-color: ${colors[statusId] || 'gray'};">
              <i class="fa ${icons[statusId] || 'fa-info'}"></i> ${status}
            </span>`;
  };
}
