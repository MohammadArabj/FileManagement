import { AfterViewInit, Component, inject, OnInit, Renderer2, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ResolutionService } from '../../../services/resolution.service';
import { UserService } from '../../../services/user.service';
import { AgGridBaseComponent } from '../../../shared/ag-grid-base/ag-grid-base';
import { SystemUser } from '../../../core/models/User';
import { getClientSettings } from '../../../services/framework-services/code-flow.service';
import { ComboBase } from '../../../shared/combo-base';
import { base64ToArrayBuffer, POSITION_ID, USER_ID_NAME } from '../../../core/types/configuration';
import { SearchResolutionSearchOptionsCellComponent } from './search-resolution-optionscell';
import { CustomSelectComponent } from '../../../shared/custom-controls/custom-select';
import { CustomInputComponent } from '../../../shared/custom-controls/custom-input';
import { AgGridAngular } from 'ag-grid-angular';
import { Router } from '@angular/router';
import { Collapse, Modal } from 'bootstrap';
import { GridState } from 'ag-grid-enterprise';
import { firstValueFrom } from 'rxjs';
import { BreadcrumbService } from '../../../services/framework-services/breadcrumb.service';
import { MeetingService } from '../../../services/meeting.service';
import { environment } from '../../../../environments/environment';
import { FileMeetingService } from '../../../services/file-meeting.service';
import { FileItem } from '../../../core/models/file';

@Component({
  selector: 'app-resolution-search',
  standalone: true,
  imports: [ReactiveFormsModule, CustomSelectComponent, CustomInputComponent, AgGridAngular],
  templateUrl: './resolution-search.html',
  styleUrls: ['./resolution-search.css']
})
export class ResolutionSearchComponent extends AgGridBaseComponent implements OnInit, AfterViewInit {
  // Injected services
  private readonly renderer = inject(Renderer2);
  private readonly resolutionService = inject(ResolutionService);
  private readonly userService = inject(UserService);
  private readonly meetingService = inject(MeetingService);
  private readonly fileMeetingService = inject(FileMeetingService);
  readonly router = inject(Router);
  private readonly breadcrumbService = inject(BreadcrumbService);

  // Enhanced signals for reactive state management
  public records = signal<any[]>([]);
  public users = signal<SystemUser[]>([]);
  public userList = signal<ComboBase[]>([]);
  public loading = signal<boolean>(false);
  public isSearchEmpty = signal<boolean>(false);
  public gridState = signal<GridState>({ filter: {} });
  public isCollapsed = signal<boolean>(false);

  // Slider modal signals
  public showSlider = signal<boolean>(false);
  public currentResolution = signal<any>(null);
  public currentIndex = signal<number>(0);

  // Quick Preview Tooltip signals
  public showQuickPreview = signal<boolean>(false);
  public previewResolution = signal<any>(null);
  public tooltipPosition = signal<{ top: number, left: number }>({ top: 0, left: 0 });
  private previewTimeout: any;

  // Constants for sessionStorage keys
  private readonly SEARCH_FORM_KEY = 'resolutionSearchForm';
  private readonly SEARCH_RESULTS_KEY = 'resolutionSearchResults';
  private readonly COLLAPSE_STATE_KEY = 'resolutionSearchCollapsed';

  modalInstance: any;

  // Enhanced form group
  public form = signal<FormGroup>(
    new FormGroup({
      text: new FormControl(''),
      meetingTitle: new FormControl(''),
      meetingNumber: new FormControl(''),
      followerGuid: new FormControl(''),
      actorGuid: new FormControl(''),
      assignmentType: new FormControl(null),
      approvalStatus: new FormControl(null),
      actionStatus: new FormControl(null),
      title: new FormControl(''),
      decisions: new FormControl(''),
      description: new FormControl(''),
      resolutionNumber: new FormControl(''),
      resolutionDate: new FormControl(''),
      meetingDate: new FormControl(''),
      documents: new FormControl(''),
    })
  );

  constructor() {
    super();
    this.setupBreadcrumb();
    this.setupKeyboardNavigation();
  }

  private setupBreadcrumb(): void {
    this.breadcrumbService.setItems([
      { label: 'جستجوی مصوبات', routerLink: '/resolutions/search' },
    ]);
  }

  private setupKeyboardNavigation(): void {
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (this.showSlider()) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
          e.preventDefault();
          this.previousResolution();
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
          e.preventDefault();
          this.nextResolution();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          this.closeSlider();
        }
      }
    });
  }

  override async ngOnInit(): Promise<void> {
    super.ngOnInit();
    await this.loadUsers();
    this.setupEnhancedGridColumns();
    this.restoreSearchState();
  }

  ngAfterViewInit(): void {
    this.restoreGridState();
  }

  private restoreSearchState(): void {
    try {
      const savedFormData = sessionStorage.getItem(this.SEARCH_FORM_KEY);
      if (savedFormData) {
        const formData = JSON.parse(savedFormData);
        this.form().patchValue(formData);
      }

      const savedResults = sessionStorage.getItem(this.SEARCH_RESULTS_KEY);
      if (savedResults) {
        const results = JSON.parse(savedResults);
        this.records.set(results);
        this.isSearchEmpty.set(results.length === 0);
      }

      const savedCollapseState = sessionStorage.getItem(this.COLLAPSE_STATE_KEY);
      if (savedCollapseState) {
        this.isCollapsed.set(JSON.parse(savedCollapseState));
      }
    } catch (error) {
      console.error('Error restoring search state:', error);
    }
  }

  private saveSearchState(): void {
    try {
      sessionStorage.setItem(this.SEARCH_FORM_KEY, JSON.stringify(this.form().value));
      sessionStorage.setItem(this.SEARCH_RESULTS_KEY, JSON.stringify(this.records()));
      sessionStorage.setItem(this.COLLAPSE_STATE_KEY, JSON.stringify(this.isCollapsed()));
    } catch (error) {
      console.error('Error saving search state:', error);
    }
  }

  private restoreGridState(): void {
    const pageStr = sessionStorage.getItem('resolutionGridPage');
    if (pageStr) {
      const page = parseInt(pageStr, 10);
      setTimeout(() => {
        const api = this.gridApi();
        api?.paginationGoToPage(page);
      }, 100);
      sessionStorage.removeItem('resolutionGridPage');
    }

    const savedFilters = sessionStorage.getItem('resolutionGridFilters');
    if (savedFilters) {
      try {
        const filters = JSON.parse(savedFilters);
        setTimeout(() => {
          const api = this.gridApi();
          api?.setFilterModel(filters);
        }, 200);
        sessionStorage.removeItem('resolutionGridFilters');
      } catch (error) {
        console.error('خطا در بازگردانی فیلترها:', error);
      }
    }
  }

  private async loadUsers(): Promise<void> {
    try {
      const clientId = getClientSettings().client_id ?? "";
      const data = await firstValueFrom(
        this.userService.getAllByClientId<SystemUser[]>(clientId)
      );

      this.users.set(data);
      this.userList.set(data.map(user => ({
        guid: user.guid,
        title: user.name,
      })));
    } catch (error) {
      console.error('Error loading users:', error);
      this.toastService.error('خطا در بارگذاری لیست کاربران');
    }
  }

  private setupEnhancedGridColumns(): void {
    const options = this.gridOptions();
    if (!options) return;

    options.columnDefs = [
      {
        colId: 'actions',
        headerName: 'عملیات',
        width: 120,
        maxWidth: 140,
        minWidth: 100,
        cellRenderer: SearchResolutionSearchOptionsCellComponent,
        cellStyle: {
          textAlign: 'center',
          overflow: 'unset',
          'font-family': 'Sahel',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }
      },
      {
        field: 'resolutionNumber',
        headerName: 'شماره مصوبه',
        filter: 'agTextColumnFilter',
        width: 130,
        maxWidth: 150,
        minWidth: 110,
        cellStyle: { 'font-family': 'Sahel', fontWeight: 'bold', color: '#4f46e5' },
        cellClass: 'text-center'
      },
      {
        field: 'title',
        headerName: 'عنوان',
        filter: 'agTextColumnFilter',
        width: 300,
        maxWidth: 350,
        minWidth: 250,
        cellStyle: { 'font-family': 'Sahel', fontWeight: '500' },
        cellRenderer: (params: any) => {
          if (params.value && params.value.length > 50) {
            return `<span title="${params.value}">${params.value.substring(0, 50)}...</span>`;
          }
          return params.value;
        }
      },
      {
        field: 'decisions',
        headerName: 'تصمیمات متخذه',
        filter: 'agTextColumnFilter',
        width: 250,
        maxWidth: 300,
        minWidth: 200,
        cellStyle: { 'font-family': 'Sahel' },
        cellRenderer: (params: any) => {
          if (params.value && params.value.length > 40) {
            return `<span title="${params.value}">${params.value.substring(0, 40)}...</span>`;
          }
          return params.value;
        }
      },
      {
        field: 'description',
        headerName: 'توضیحات',
        filter: 'agTextColumnFilter',
        width: 200,
        maxWidth: 250,
        minWidth: 150,
        cellStyle: { 'font-family': 'Sahel', color: '#6b7280' }
      },
      {
        field: 'resolutionDate',
        headerName: 'تاریخ',
        filter: 'agDateColumnFilter',
        width: 120,
        maxWidth: 140,
        minWidth: 100,
        cellStyle: { 'font-family': 'Sahel', direction: 'ltr' },
        cellClass: 'text-center'
      },
      {
        field: 'documents',
        headerName: 'سوابق و مستندات',
        filter: 'agTextColumnFilter',
        width: 180,
        maxWidth: 220,
        minWidth: 150,
        cellStyle: { 'font-family': 'Sahel' },
        cellRenderer: (params: any) => {
          if (params.value) {
            return `<i class="fas fa-paperclip text-success me-1"></i>${params.value}`;
          }
          return '<span class="text-muted">ندارد</span>';
        }
      },
      {
        field: 'meetingTitle',
        headerName: 'عنوان جلسه',
        filter: 'agTextColumnFilter',
        width: 250,
        maxWidth: 300,
        minWidth: 200,
        cellStyle: { 'font-family': 'Sahel' }
      },
      {
        field: 'meetingNumber',
        headerName: 'شماره جلسه',
        filter: 'agTextColumnFilter',
        width: 130,
        maxWidth: 150,
        minWidth: 110,
        cellStyle: { 'font-family': 'Sahel' },
        cellClass: 'text-center'
      }
    ];

    this.setupGridInteractions(options);
  }

  private setupGridInteractions(options: any): void {
    options.rowStyle = { cursor: 'pointer' };
    options.rowClassRules = {
      'clickable-row': (params: any) => true,
      'high-priority-row': (params: any) => params.data?.priority === 'High' || params.data?.priority === 'Critical',
      'completed-row': (params: any) => params.data?.actionStatus === 'Completed'
    };

    options.getRowStyle = (params: any) => {
      if (params.data?.priority === 'Critical') {
        return { backgroundColor: 'rgba(239, 68, 68, 0.05)', borderLeft: '3px solid #ef4444' };
      }
      if (params.data?.priority === 'High') {
        return { backgroundColor: 'rgba(245, 158, 11, 0.05)', borderLeft: '3px solid #f59e0b' };
      }
      if (params.data?.actionStatus === 'Completed') {
        return { backgroundColor: 'rgba(16, 185, 129, 0.05)', borderLeft: '3px solid #10b981' };
      }
      return null;
    };

    // استفاده از onCellMouseOver به جای onRowMouseEnter
    options.onCellMouseOver = (event: any) => {
      if (event.data && !this.showSlider()) {
        clearTimeout(this.previewTimeout);
        this.previewTimeout = setTimeout(() => {
          this.showQuickPreviewTooltip(event);
        }, 500);
      }
    };

    // استفاده از onCellMouseOut به جای onRowMouseLeave
    options.onCellMouseOut = () => {
      clearTimeout(this.previewTimeout);
      this.hideQuickPreviewTooltip();
    };
  }

  private showQuickPreviewTooltip(event: any): void {
    if (!event.data || this.showSlider()) return;

    this.previewResolution.set(event.data);

    // Calculate tooltip position
    const mouseEvent = event.event as MouseEvent;
    const tooltipWidth = 400;
    const tooltipHeight = 250;
    const padding = 20;

    let top = mouseEvent.clientY + 10;
    let left = mouseEvent.clientX + 10;

    // Adjust if tooltip goes off screen
    if (left + tooltipWidth > window.innerWidth) {
      left = mouseEvent.clientX - tooltipWidth - 10;
    }

    if (top + tooltipHeight > window.innerHeight) {
      top = mouseEvent.clientY - tooltipHeight - 10;
    }

    this.tooltipPosition.set({ top, left });
    this.showQuickPreview.set(true);
  }

  private hideQuickPreviewTooltip(): void {
    this.showQuickPreview.set(false);
    setTimeout(() => {
      this.previewResolution.set(null);
    }, 300);
  }

  public onRowClicked(event: any): void {
    // بررسی می‌کنیم که آیا روی ستون عملیات کلیک شده یا خیر
    const isActionsColumn = event.column?.colId === 'actions';

    // اگر روی دکمه، منوی dropdown یا ستون عملیات کلیک شده، هیچ کاری نکن
    if (event.data &&
      !event.event.target.closest('button') &&
      !event.event.target.closest('.dropdown-menu') &&
      !event.event.target.closest('.dropdown') &&
      !isActionsColumn) {

      // Hide quick preview when opening slider
      this.hideQuickPreviewTooltip();

      const clickedIndex = this.records().findIndex(r => r.id === event.data.id);
      if (clickedIndex !== -1) {
        this.openSlider(clickedIndex);
      }
    }
  }

  public openSlider(index: number): void {
    // Hide quick preview
    this.hideQuickPreviewTooltip();

    this.currentIndex.set(index);
    this.currentResolution.set(this.records()[index]);
    this.showSlider.set(true);
    document.body.style.overflow = 'hidden';
  }

  public closeSlider(): void {
    this.showSlider.set(false);
    this.currentResolution.set(null);
    document.body.style.overflow = '';
  }

  public closeSliderOnBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeSlider();
    }
  }

  public nextResolution(): void {
    const nextIndex = this.currentIndex() + 1;
    if (nextIndex < this.records().length) {
      this.currentIndex.set(nextIndex);
      this.currentResolution.set(this.records()[nextIndex]);

      // Add smooth transition animation
      const sliderBody = document.querySelector('.slider-body');
      if (sliderBody) {
        sliderBody.scrollTop = 0;
        sliderBody.classList.add('slide-transition');
        setTimeout(() => sliderBody.classList.remove('slide-transition'), 300);
      }
    }
  }

  public previousResolution(): void {
    const prevIndex = this.currentIndex() - 1;
    if (prevIndex >= 0) {
      this.currentIndex.set(prevIndex);
      this.currentResolution.set(this.records()[prevIndex]);

      // Add smooth transition animation
      const sliderBody = document.querySelector('.slider-body');
      if (sliderBody) {
        sliderBody.scrollTop = 0;
        sliderBody.classList.add('slide-transition');
        setTimeout(() => sliderBody.classList.remove('slide-transition'), 300);
      }
    }
  }

  public toggleCollapse(): void {
    this.isCollapsed.update(v => !v);
    this.saveSearchState();
  }

  public onQuickFilter(event: any): void {
    const api = this.gridApi();
    if (api) {
      this.gridApi()?.setGridOption('quickFilterText', event.target.value);
    }
  }

  public async search(): Promise<void> {
    const formValue = this.form().value;
    const hasSearchCriteria = Object.values(formValue).some(value =>
      value !== null && value !== undefined && value !== ''
    );

    this.loading.set(true);

    try {
      const searchData = formValue;
      const userGuid = this.localStorageService.getItem(USER_ID_NAME);
      const positionGuid = this.localStorageService.getItem(POSITION_ID);

      const searchModel = {
        ...searchData,
        userGuid: userGuid,
        positionGuid: positionGuid
      };

      const response = await firstValueFrom(
        this.resolutionService.searchResolution(searchModel)
      );

      this.isSearchEmpty.set(response.length === 0);
      this.records.set(response);

      this.saveSearchState();
    } catch (error) {
      console.error('Error in search:', error);
      this.toastService.error('خطا در انجام جستجو');
    } finally {
      this.loading.set(false);
    }
  }

  public clearForm(): void {
    this.form().reset();
    this.records.set([]);
    this.isSearchEmpty.set(false);

    sessionStorage.removeItem(this.SEARCH_FORM_KEY);
    sessionStorage.removeItem(this.SEARCH_RESULTS_KEY);
    sessionStorage.removeItem(this.COLLAPSE_STATE_KEY);
  }

  saveGridState(): void {
    const api = this.gridApi();
    if (api) {
      const currentPage = api.paginationGetCurrentPage();
      sessionStorage.setItem('resolutionGridPage', currentPage.toString());

      const filterModel = api.getFilterModel();
      if (filterModel && Object.keys(filterModel).length > 0) {
        sessionStorage.setItem('resolutionGridFilters', JSON.stringify(filterModel));
      }

      const columnState = api.getColumnState();
      sessionStorage.setItem('resolutionGridColumns', JSON.stringify(columnState));
    }
  }

  viewMeeting(meetingGuid: string): void {
    this.saveGridState();
    this.saveSearchState();
    this.closeSlider();
    this.router.navigate([`/meetings/details/${meetingGuid}`]);
  }

  // async viewResolution(resolutionId: string): Promise<void> {
  //   try {
  //     const resolution = this.records().find(r => r.id === resolutionId);
  //     if (!resolution) {
  //       this.toastService.error('مصوبه یافت نشد');
  //       return;
  //     }
  //     const positionGuid = this.localStorageService.getItem(POSITION_ID);
  //     const userGuid = this.localStorageService.getItem(USER_ID_NAME);

  //     const meeting = await firstValueFrom(
  //       this.meetingService.getUserMeeting(resolution.meetingGuid, userGuid, positionGuid, false)
  //     );

  //     if (!meeting) {
  //       this.toastService.error('اطلاعات جلسه یافت نشد');
  //       return;
  //     }

  //     const index = this.records().findIndex(r => r.id === resolutionId);
  //     this.printResolution(resolution, meeting, index);
  //   } catch (error) {
  //     console.error('Error viewing resolution:', error);
  //     this.toastService.error('خطا در نمایش مصوبه');
  //   }
  // }

  private printResolution(resolution: any, meeting: any, index: number): void {
    const newWin = window.open('', '_blank', 'width=900,height=700');
    if (!newWin) {
      this.toastService.error('لطفاً popup blocker را غیرفعال کنید');
      return;
    }

    const isBoardMeeting = meeting.categoryGuid === environment.boardCategoryGuid;
    if (isBoardMeeting) {
      this.printBoardResolution(newWin, resolution, meeting, index);
    } else {
      this.printNormalResolution(newWin, resolution, meeting, index);
    }
  }

  private printNormalResolution(newWin: Window, resolution: any, meeting: any, index: number): void {
    let assignmentRows = '';
    if (resolution.assignments && resolution.assignments.length > 0) {
      resolution.assignments.forEach((assignment: any, i: number) => {
        assignmentRows += `
        <tr>
          <td>${i + 1}</td>
          <td>${assignment.actorName || '-'}</td>
          <td>${assignment.type || '-'}</td>
          <td>${assignment.followerName || '-'}</td>
          <td>${assignment.dueDate || '-'}</td>
        </tr>
      `;
      });
    } else {
      assignmentRows = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 20px;">تخصیصی برای این مصوبه تعریف نشده است</td>
      </tr>
    `;
    }

    const resolutionTitle = `مصوبه شماره ${resolution.number || (index + 1)} - ${meeting?.title || 'جلسه'}`;

    newWin.document.open();
    newWin.document.write(`
    <html>
      <head>
        <title>چاپ مصوبه شماره ${resolution.number || (index + 1)}</title>
        <meta charset="UTF-8">
        <style>
          body { direction: rtl; font-family: 'Tahoma', Arial, sans-serif; background-color: #f8f9fa; padding: 0; margin: 0; }
          .container { max-width: 26cm; margin: 0 auto; background-color: #fff; padding: 20px; border-radius: 15px; }
          header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
          .header-content { flex: 1; }
          .name-of-god { text-align: center; font-size: 18px; font-weight: bold; margin-bottom: 10px; }
          .resolution-title { border: 2px solid #6d8dab; padding: 15px; border-radius: 20px; font-weight: 700; font-size: 17px; text-align: center; background: linear-gradient(to left, #e1d4cd, #f7ddd0, #e0e9f3); }
          .meeting-info { margin: 20px 0; border: 2px solid #6e6e6e; border-radius: 15px; overflow: hidden; }
          .meeting-info table { width: 100%; border-collapse: collapse; }
          .meeting-info th { background: #d9d9d9; border: 1px solid black; padding: 10px; font-weight: bold; text-align: center; font-size: 14px; }
          .meeting-info td { border: 1px solid black; padding: 10px; text-align: center; font-size: 13px; }
          .resolution-content { margin: 20px 0; border: 2px solid #6e6e6e; border-radius: 10px; }
          .resolution-header { background: #fbe5d5; padding: 12px; border-bottom: 1px solid #6e6e6e; font-weight: bold; text-align: center; font-size: 16px; }
          .resolution-text { padding: 20px; line-height: 1.8; font-size: 14px; text-align: justify; }
          .assignments-section { margin: 20px 0; border: 2px solid #6e6e6e; border-radius: 10px; }
          .assignments-header { background: #fbe5d5; padding: 12px; border-bottom: 1px solid #6e6e6e; font-weight: bold; text-align: center; font-size: 16px; }
          .assignments-table { width: 100%; border-collapse: collapse; }
          .assignments-table th { background: #d9d9d9; border: 1px solid black; padding: 10px; font-weight: bold; text-align: center; font-size: 14px; }
          .assignments-table td { border: 1px solid black; padding: 10px; text-align: center; font-size: 13px; }
          * { -webkit-print-color-adjust: exact !important; color-adjust: exact !important; }
          @media print { body { background-color: white; } .container { box-shadow: none; border: none; } }
        </style>
      </head>
      <body>
        <div class="container">
          <header>
            <div class="header-content">
              <div class="name-of-god">به نام خدا</div>
              <div class="resolution-title">${resolutionTitle}</div>
            </div>
          </header>

          <div class="meeting-info">
            <table>
              <thead>
                <tr>
                  <th>موضوع جلسه</th>
                  <th>تاریخ</th>
                  <th>زمان</th>
                  <th>شماره جلسه</th>
                  <th>رئیس جلسه</th>
                  <th>دبیر جلسه</th>
                  <th>محل تشکیل</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${meeting?.title || '-'}</td>
                  <td>${meeting?.mtDate || '-'}</td>
                  <td>${meeting?.startTime || '-'}</td>
                  <td>${meeting?.number || '-'}</td>
                  <td>${meeting?.chairman || '-'}</td>
                  <td>${meeting?.secretary || '-'}</td>
                  <td>${meeting?.location || '-'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="resolution-content">
            <div class="resolution-header">متن مصوبه</div>
            <div class="resolution-text">
              ${resolution.description || resolution.text || 'متن مصوبه در دسترس نیست'}
            </div>
          </div>

          <div class="assignments-section">
            <div class="assignments-header">تخصیص‌های مصوبه</div>
            <table class="assignments-table">
              <thead>
                <tr>
                  <th>ردیف</th>
                  <th>اقدام کننده</th>
                  <th>نوع تخصیص</th>
                  <th>پیگیری کننده</th>
                  <th>تاریخ سررسید</th>
                </tr>
              </thead>
              <tbody>
                ${assignmentRows}
              </tbody>
            </table>
          </div>
        </div>

        <script>
          window.onload = function() {
            window.print();
            setTimeout(() => window.close(), 100);
          };
        </script>
      </body>
    </html>
  `);
    newWin.document.close();
  }

  // private async printBoardResolution(newWin: Window, resolution: any, meeting: any, index: number): Promise<void> {
  //   try {
  //     const userGuid = this.localStorageService.getItem(USER_ID_NAME);
  //     const members = await firstValueFrom(
  //       this.memberService.getUserList(meeting.guid, userGuid)
  //     );

  //     const boardMembers = members.filter((m: any) => m.boardMemberGuid);
  //     const userMembers = members.filter((m: any) => m.userGuid && !m.boardMemberGuid);

  //     let attendees: any[] = [];
  //     if (boardMembers.length > 0) {
  //       const boardMemberGuids = boardMembers.map((m: any) => m.boardMemberGuid);
  //       attendees = await firstValueFrom(
  //         this.boardMemberService.getByGuids(boardMemberGuids)
  //       );
  //       attendees = attendees.filter(member => member.position !== 'دبیر هیئت مدیره');
  //     }

  //     this.generateBoardResolutionDocument(newWin, resolution, meeting, index, attendees, userMembers);
  //   } catch (error) {
  //     console.error('Error loading board members:', error);
  //     this.generateBoardResolutionDocument(newWin, resolution, meeting, index, [], []);
  //   }
  // }

  private generateBoardResolutionDocument(newWin: Window, resolution: any, meeting: any, index: number, attendees: any[], userMembers: any[]): void {
    let attendeesHtml = '';
    attendees.forEach(member => {
      attendeesHtml += `
      <div class="attendee">
        <div class="checkbox">✓</div>
        <span>${member.fullName || member.name || ''}</span>
      </div>
    `;
    });

    userMembers.forEach(member => {
      attendeesHtml += `
      <div class="attendee">
        <div class="checkbox">✓</div>
        <span>${member.name || ''}</span>
      </div>
    `;
    });

    const signaturesHtml = this.generateBoardSignaturesGrid(attendees, userMembers);

    const documentsSection = resolution.documents?.trim() ? `
    <div class="row">
      <div class="row-title">سوابق و مستندات:</div>
      <div class="resolution-content">${resolution.documents}</div>
    </div>
  ` : '';

    const descriptionSection = (resolution.description?.trim() || resolution.text?.trim()) ? `
    <div class="row">
      <div class="row-title">توضیحات:</div>
      <div class="resolution-content">
        ${resolution.description || resolution.text}
      </div>
    </div>
  ` : '';

    const decisionsMadeSection = resolution.decisions?.trim() ? `
    <div class="row">
      <div class="row-title">تصمیمات متخذه:</div>
      <div class="resolution-content">${resolution.decisions}</div>
    </div>
  ` : '';

    newWin.document.open();
    newWin.document.write(`
    <!DOCTYPE html>
    <html lang="fa" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <title>صورتجلسه هیئت مدیره - مصوبه ${resolution.number || (index + 1)}</title>
        <style>
            body {
                font-family: 'B Nazanin', 'Tahoma', sans-serif;
                margin: 0;
                padding: 20px;
                direction: rtl;
                text-align: right;
                background-color: white;
                font-size: 14px;
                line-height: 1.6;
            }
            .container {
                margin: 0 auto;
                background-color: white;
                border: 2px solid black;
            }
            .header { text-align: center; }
            .logo {
                width: 85px;
                height: 65px;
                margin: 0 auto 10px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .company-name {
                font-size: 18px;
                font-weight: bold;
                margin-bottom: 20px;
            }
            .row1 {
                width: 100%;
                border-bottom: 1px solid black;
                padding: 15px 0;
                align-items: center;
                justify-content: space-between;
            }
            .title {
                font-size: 18px;
                font-weight: bold;
                flex: 1;
                text-align: center;
            }
            .info-group {
                display: flex;
                gap: 30px;
                flex: 1;
                justify-content: space-between;
                padding-right: 14px;
                padding-left: 34px;
            }
            .info-item {
                font-size: 16px;
                white-space: nowrap;
            }
            .row {
                padding-bottom: 5px;
                border-bottom: 1px solid black;
            }
            .row-title {
                font-family:'B Titr';
                font-weight: bold;
                padding-right: 10px;
            }
            .attendees {
                display: flex;
                gap: 5px;
                padding-right: 10px;
                font-weight: 900;
                flex-wrap: wrap;
            }
            .attendee {
                display: flex;
                align-items: center;
                gap: 5px;
                margin-bottom: 10px;
            }
            .checkbox {
                width: 10px;
                height: 10px;
                border: 2px solid #000;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                background-color: white;
            }
            .signatures {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 20px;
                padding: 20px 0;
                border-bottom: 1px solid black;
            }
            .signature {
                text-align: center;
            }
            .signature-name {
                font-weight: bold;
                font-size: 14px;
                margin-top: 25px;
            }
            .signature-position {
                font-size: 12px;
                font-weight: bold;
                margin-top: 5px;
            }
            .footer-note {
                font-size: 12px;
                text-align: justify;
                line-height: 1.5;
                padding: 10px;
            }
            .underline {
                display: inline-block;
                width: 100px;
                border-bottom: 1px solid black;
                margin: 0 5px;
            }
            .resolution-content {
                padding-right: 15px;
                padding-left: 15px;
                text-align: justify;
                line-height: 1.8;
                font-size: 16px;
                font-weight: 600;
            }
            @media print {
                * { -webkit-print-color-adjust: exact !important; color-adjust: exact !important; }
            }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="logo">
                <img src="${environment.selfEndpoint}/img/MainLogo.png" alt="لوگو" style="width:100%" />
            </div>
            <div class="company-name">شرکت پتروشیمی اصفهان</div>
        </div>
        <div class="container">
            <div class="row1">
                <div class="title">صورتجلسه هیئت مدیره</div>
                <div class="info-group">
                    <div class="info-item">تاریخ جلسه: ${meeting.mtDate || ''}</div>
                    <div class="info-item">شماره صورتجلسه: ${meeting.number || ''}</div>
                    <div class="info-item">شماره مصوبه: ${resolution.number || (index + 1).toString().padStart(2, '0')}</div>
                </div>
            </div>

            <div class="row">
                <div class="attendees">
                    <div class="attendee">
                        <span>حاضرین:</span>
                    </div>
                    ${attendeesHtml}
                </div>
            </div>

            <div class="row">
                <div class="row-title" style="display:inline">موضوع: </div>
                <span>${resolution.title || ''}</span>
            </div>

            ${documentsSection}
            ${descriptionSection}
            ${decisionsMadeSection}

            <div class="signatures">
                ${signaturesHtml}
            </div>

            <div class="footer-note">
                در راستای رعایت مفاد ماده 129 اصلاحیه قانون تجارت، جناب آقای <span class="underline"></span> در تصمیم گیری
                بند <span class="underline"></span> مشارکت نداشته اند / امضاء
            </div>
        </div>

        <script>
            window.onload = function() {
                window.print();
                setTimeout(() => window.close(), 100);
            };
        </script>
    </body>
    </html>
  `);
    newWin.document.close();
  }

  private generateBoardSignaturesGrid(attendees: any[], userMembers: any[]): string {
    let signaturesHtml = '';
    let allMembers = [...attendees, ...userMembers];

    for (let i = 0; i < 6; i++) {
      if (i < allMembers.length) {
        const member = allMembers[i];
        signaturesHtml += `
        <div class="signature">
          <div class="signature-name">${member.fullName || member.name || ''}</div>
          <div class="signature-position">${member.position || 'عضو هیئت مدیره'}</div>
        </div>
      `;
      } else {
        signaturesHtml += `<div class="signature"></div>`;
      }
    }

    return signaturesHtml;
  }

  exportToExcel(): void {
    const api = this.gridApi();
    if (api) {
      api.exportDataAsExcel({
        fileName: `مصوبات_${new Date().toISOString().split('T')[0]}.xlsx`,
        sheetName: 'مصوبات'
      });
      this.toastService.success('فایل اکسل با موفقیت دانلود شد');
    }
  }

  printResults(): void {
    const api = this.gridApi();
    if (api) {
      window.print();
    }
  }

  override onGridReady(params: any): void {
    super.onGridReady(params);

    const savedColumns = sessionStorage.getItem('resolutionGridColumns');
    if (savedColumns) {
      try {
        const columnState = JSON.parse(savedColumns);
        params.api.applyColumnState({ state: columnState });
      } catch (error) {
        console.error('Error restoring column state:', error);
      }
    }

    this.autoSizeAllColumns();
  }

  public _selectedResolutionFiles = signal<Map<number, FileItem[]>>(new Map());
  public _loadingFiles = signal<Set<number>>(new Set());

  // متد viewResolution را به این صورت تغییر دهید:
  async viewResolution(resolutionId: string): Promise<void> {
    try {
      const resolution = this.records().find(r => r.id === resolutionId);
      if (!resolution) {
        this.toastService.error('مصوبه یافت نشد');
        return;
      }

      const positionGuid = this.localStorageService.getItem(POSITION_ID);
      const userGuid = this.localStorageService.getItem(USER_ID_NAME);

      const meeting = await firstValueFrom(
        this.meetingService.getUserMeeting(resolution.meetingGuid, userGuid, positionGuid, false)
      ) as any;

      if (!meeting) {
        this.toastService.error('اطلاعات جلسه یافت نشد');
        return;
      }

      const isBoardMeeting = meeting.categoryGuid === environment.boardCategoryGuid;

      if (isBoardMeeting) {
        // برای جلسات هیئت مدیره، فایل‌های PDF را بارگذاری و نمایش دهید
        await this.viewBoardResolutionPDF(resolution);
      } else {
        // برای جلسات عادی، چاپ HTML
        const index = this.records().findIndex(r => r.id === resolutionId);
        this.printResolution(resolution, meeting, index);
      }
    } catch (error) {
      console.error('Error viewing resolution:', error);
      this.toastService.error('خطا در نمایش مصوبه');
    }
  }
  private async viewBoardResolutionPDF(resolution: any): Promise<void> {
    try {
      this._loadingFiles.update(loading => {
        const newSet = new Set(loading);
        newSet.add(resolution.id);
        return newSet;
      });

      const files = await firstValueFrom(
        this.fileMeetingService.getFiles(resolution.id, 'Resolution')
      );

      console.log('Files response:', files);

      const filesArray = this.normalizeFilesResponse(files);

      if (filesArray.length === 0) {
        this.toastService.warning('فایل PDF برای این مصوبه وجود ندارد');
        this._loadingFiles.update(loading => {
          const newSet = new Set(loading);
          newSet.delete(resolution.id);
          return newSet;
        });
        return;
      }

      const pdfFiles = this.filterPDFFiles(filesArray);

      if (pdfFiles.length === 0) {
        const fileTypes = filesArray.map(f => f.contentType || f.mimeType || 'unknown');
        console.log('No PDF files found. Available types:', fileTypes);
        this.toastService.warning(`فایل PDF یافت نشد. فایل‌های موجود: ${fileTypes.join(', ')}`);
        this._loadingFiles.update(loading => {
          const newSet = new Set(loading);
          newSet.delete(resolution.id);
          return newSet;
        });
        return;
      }

      let selectedFile = pdfFiles[0];
      if (pdfFiles.length > 1) {
        selectedFile = await this.showFileSelectionModal(pdfFiles);
      }

      const fileData = selectedFile.file || selectedFile.content || selectedFile.data;
      if (!fileData) {
        this.toastService.error('محتوای فایل یافت نشد');
      }
      // تبدیل Base64 به Blob و باز کردن در تب جدید
      const blob = new Blob([base64ToArrayBuffer(selectedFile.file)], {
        type: 'application/pdf'
      });
      const fileUrl = URL.createObjectURL(blob);

      // باز کردن PDF در تب جدید
      const newWindow = window.open(fileUrl, '_blank', 'width=1200,height=800');

      if (!newWindow) {
        this.toastService.error('لطفاً popup blocker را غیرفعال کنید');
        URL.revokeObjectURL(fileUrl);
      } else {
        // پاکسازی URL بعد از 1 دقیقه
        setTimeout(() => {
          URL.revokeObjectURL(fileUrl);
        }, 60000);
      }

      this._loadingFiles.update(loading => {
        const newSet = new Set(loading);
        newSet.delete(resolution.id);
        return newSet;
      });

    } catch (error) {
      console.error('Error loading PDF files:', error);
      this.toastService.error('خطا در بارگذاری فایل PDF');

      this._loadingFiles.update(loading => {
        const newSet = new Set(loading);
        newSet.delete(resolution.id);
        return newSet;
      });
    }
  }

  // در صورت نیاز به نمایش پیش‌نمایش PDF در modal (اختیاری):
  async showPDFPreviewInModal(resolution: any): Promise<void> {
    try {
      const files = await firstValueFrom(
        this.fileMeetingService.getFiles(resolution.id, 'Resolution')
      ) as FileItem[];

      const pdfFiles = files.filter((file: any) =>
        file.contentType === 'application/pdf' ||
        file.fileName?.toLowerCase().endsWith('.pdf')
      );

      if (pdfFiles.length === 0) {
        this.toastService.warning('فایل PDF موجود نیست');
        return;
      }

      const selectedFile = pdfFiles[0];
      const blob = new Blob([base64ToArrayBuffer(selectedFile.details?.file)], {
        type: 'application/pdf'
      });
      const fileUrl = URL.createObjectURL(blob);

      // نمایش PDF در iframe داخل modal
      const modalHtml = `
      <div class="modal fade" id="pdfPreviewModal" tabindex="-1" data-bs-backdrop="static">
        <div class="modal-dialog modal-xl modal-dialog-centered">
          <div class="modal-content" style="height: 90vh;">
            <div class="modal-header">
              <h5 class="modal-title">پیش‌نمایش PDF - ${resolution.title || 'مصوبه'}</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body p-0">
              <iframe src="${fileUrl}" style="width: 100%; height: 100%; border: none;"></iframe>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-primary" onclick="window.open('${fileUrl}', '_blank')">
                <i class="fas fa-external-link-alt me-2"></i>باز کردن در تب جدید
              </button>
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">بستن</button>
            </div>
          </div>
        </div>
      </div>
    `;

      const modalElement = document.createElement('div');
      modalElement.innerHTML = modalHtml;
      document.body.appendChild(modalElement.firstElementChild as HTMLElement);

      const modal = new Modal(document.getElementById('pdfPreviewModal')!);
      modal.show();

      document.getElementById('pdfPreviewModal')?.addEventListener('hidden.bs.modal', () => {
        setTimeout(() => {
          URL.revokeObjectURL(fileUrl);
          document.getElementById('pdfPreviewModal')?.remove();
        }, 300);
      });

    } catch (error) {
      console.error('Error showing PDF preview:', error);
      this.toastService.error('خطا در نمایش پیش‌نمایش PDF');
    }
  }
  private async showFileSelectionModal(files: any[]): Promise<any> {
    return new Promise((resolve) => {
      // ایجاد modal با Bootstrap
      const modalHtml = `
      <div class="modal fade" id="fileSelectionModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">انتخاب فایل PDF</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <p class="mb-3">چند فایل PDF برای این مصوبه موجود است. لطفاً یکی را انتخاب کنید:</p>
              <div class="list-group" id="fileList">
                ${files.map((file, index) => `
                  <button type="button" class="list-group-item list-group-item-action" data-index="${index}">
                    <i class="fas fa-file-pdf text-danger me-2"></i>
                    ${file.fileName || `فایل ${index + 1}`}
                  </button>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

      const modalElement = document.createElement('div');
      modalElement.innerHTML = modalHtml;
      document.body.appendChild(modalElement.firstElementChild as HTMLElement);

      const modal = new Modal(document.getElementById('fileSelectionModal')!);
      modal.show();

      document.getElementById('fileList')?.addEventListener('click', (e: Event) => {
        const target = e.target as HTMLElement;
        const button = target.closest('button[data-index]') as HTMLButtonElement;
        if (button) {
          const index = parseInt(button.dataset['index'] || '0');
          modal.hide();
          setTimeout(() => {
            document.getElementById('fileSelectionModal')?.remove();
            resolve(files[index]);
          }, 300);
        }
      });

      document.getElementById('fileSelectionModal')?.addEventListener('hidden.bs.modal', () => {
        setTimeout(() => {
          document.getElementById('fileSelectionModal')?.remove();
          resolve(files[0]); // اگر کاربر بدون انتخاب بسته باشد
        }, 300);
      });
    });
  }

  // متد helper برای لاگ اطلاعات دیباگ
  private logFileDebugInfo(files: any, stage: string): void {
    console.group(`🔍 Debug Info - ${stage}`);
    console.log('Raw response:', files);
    console.log('Is Array:', Array.isArray(files));
    console.log('Type:', typeof files);

    if (files) {
      if (Array.isArray(files)) {
        console.log('Length:', files.length);
        files.forEach((file, index) => {
          console.log(`File ${index}:`, {
            fileName: file?.fileName,
            contentType: file?.contentType,
            mimeType: file?.mimeType,
            hasContent: !!(file?.file || file?.content || file?.data),
            size: file?.size
          });
        });
      } else if (typeof files === 'object') {
        console.log('Object keys:', Object.keys(files));
        console.log('Object values:', Object.values(files));
      }
    }
    console.groupEnd();
  }

  // متد helper برای بررسی خالی بودن response
  private isEmptyResponse(data: any): boolean {
    if (!data) return true;
    if (Array.isArray(data)) return data.length === 0;
    if (typeof data === 'object') return Object.keys(data).length === 0;
    return false;
  }

  // متد helper برای تبدیل response به آرایه
  private normalizeFilesResponse(files: any): any[] {
    if (this.isEmptyResponse(files)) return [];

    let filesArray: any[] = Array.isArray(files) ? files : [files];

    // فیلتر کردن آیتم‌های خالی و نامعتبر
    return filesArray.filter(file =>
      file &&
      file.fileName &&
      (file.file || file.content || file.data)
    );
  }

  // متد helper برای فیلتر فایل‌های PDF
  private filterPDFFiles(files: any[]): any[] {
    return files.filter((file: any) =>
      file.contentType === 'application/pdf' ||
      file.mimeType === 'application/pdf' ||
      file.fileName?.toLowerCase().endsWith('.pdf')
    );
  }

  // متد تغییر یافته printBoardResolution با استفاده از helper ها
  // متد تغییر یافته printBoardResolution با استفاده از helper ها
  private async printBoardResolution(newWin: any, resolution: any, meeting: any, index: number): Promise<void> {
    try {
      this._loadingFiles.update(loading => {
        const newSet = new Set(loading);
        newSet.add(resolution.id);
        return newSet;
      });

      this.toastService.info('در حال بارگذاری فایل PDF...');

      const files = await firstValueFrom(
        this.fileMeetingService.getFiles(resolution.id, 'Resolution')
      );

      // لاگ اطلاعات دیباگ
      this.logFileDebugInfo(files, 'Print Board Resolution');

      // استفاده از helper برای normalize کردن
      const filesArray = this.normalizeFilesResponse(files);

      if (filesArray.length === 0) {
        this.toastService.warning('فایل PDF برای این مصوبه هیئت مدیره وجود ندارد');
        this._loadingFiles.update(loading => {
          const newSet = new Set(loading);
          newSet.delete(resolution.id);
          return newSet;
        });
        return;
      }

      // استفاده از helper برای فیلتر PDF ها
      const pdfFiles = this.filterPDFFiles(filesArray);

      if (pdfFiles.length === 0) {
        const fileTypes = filesArray.map(f => f.contentType || f.mimeType || 'unknown');
        console.log('No PDF files found. Available types:', fileTypes);
        this.toastService.warning(`فایل PDF یافت نشد. فایل‌های موجود: ${fileTypes.join(', ')}`);
        this._loadingFiles.update(loading => {
          const newSet = new Set(loading);
          newSet.delete(resolution.id);
          return newSet;
        });
        return;
      }

      // انتخاب فایل
      let selectedFile = pdfFiles[0];
      if (pdfFiles.length > 1) {
        selectedFile = await this.showFileSelectionModal(pdfFiles);
      }

      // استخراج محتوای فایل
      const fileData = selectedFile.file || selectedFile.content || selectedFile.data;
      if (!fileData) {
        this.toastService.error('محتوای فایل یافت نشد');
        console.error('File data is empty:', selectedFile);
        this._loadingFiles.update(loading => {
          const newSet = new Set(loading);
          newSet.delete(resolution.id);
          return newSet;
        });
        return;
      }

      // تبدیل و نمایش PDF
      const blob = new Blob([base64ToArrayBuffer(fileData)], { type: 'application/pdf' });
      const fileUrl = URL.createObjectURL(blob);

      const pdfWindow = window.open(fileUrl, '_blank');

      if (!pdfWindow) {
        this.toastService.error('لطفاً popup blocker را غیرفعال کنید');
        URL.revokeObjectURL(fileUrl);
      } else {
        this.toastService.success('فایل PDF باز شد. می‌توانید از منوی مرورگر چاپ کنید (Ctrl+P)');
        setTimeout(() => URL.revokeObjectURL(fileUrl), 120000);
      }

      this._loadingFiles.update(loading => {
        const newSet = new Set(loading);
        newSet.delete(resolution.id);
        return newSet;
      });

    } catch (error) {
      console.error('Error loading board resolution PDF:', error);
      this.toastService.error('خطا در بارگذاری فایل PDF مصوبه هیئت مدیره');
      this._loadingFiles.update(loading => {
        const newSet = new Set(loading);
        newSet.delete(resolution.id);
        return newSet;
      });
    }
  }
}