import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { SystemUser } from '../../../core/models/User';
import { ComboBase } from '../../../shared/combo-base';
import { CategoryService } from '../../../services/category.service';
import { RoomService } from '../../../services/room.service';
import { UserService } from '../../../services/user.service';
import { MeetingStatusService } from '../../../services/meeting-status.service';
import { CustomSelectComponent } from "../../../shared/custom-controls/custom-select";
import { CustomInputComponent } from '../../../shared/custom-controls/custom-input';
import { AgGridAngular } from 'ag-grid-angular';
import { AgGridBaseComponent } from '../../../shared/ag-grid-base/ag-grid-base';
import { getClientSettings } from '../../../services/framework-services/code-flow.service';
import { MeetingService } from '../../../services/meeting.service';
import { POSITION_ID, USER_ID_NAME } from '../../../core/types/configuration';
import { MeetingOptionsCellComponent } from '../../meetings/meeting-list/meetingOptionsCellComponent';
import { catchError, firstValueFrom, of } from 'rxjs';
import { Router } from '@angular/router';
import { SwalService } from '../../../services/framework-services/swal.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PasswordFlowService } from '../../../services/framework-services/password-flow.service';
declare var Swal: any;

@Component({
  selector: 'app-meeting-search',
  standalone: true,
  imports: [ReactiveFormsModule, CustomInputComponent, CustomSelectComponent, AgGridAngular],
  templateUrl: './meeting-search.html',
  styleUrl:'./meeting-search.css'
})
export class MeetingSearchComponent extends AgGridBaseComponent implements OnInit {
  // Injected services
  private readonly fb = inject(FormBuilder);
  private readonly roomService = inject(RoomService);
  private readonly categoryService = inject(CategoryService);
  private readonly userService = inject(UserService);
  private readonly meetingService = inject(MeetingService);
  private readonly meetingStatusService = inject(MeetingStatusService);
  private readonly swalService = inject(SwalService);
  private readonly router = inject(Router);
  private readonly passwordFlowService = inject(PasswordFlowService);
  // State signals
  public records = signal<any[]>([]);
  public rooms = signal<ComboBase[]>([]);
  public categories = signal<ComboBase[]>([]);
  public users = signal<SystemUser[]>([]);
  public statuses = signal<ComboBase[]>([]);
  public userList = signal<ComboBase[]>([]);
  public loading = signal<boolean>(false);
  public isSearchEmpty = signal<boolean>(false);
  public isCollapsed = signal<boolean>(false);

  // Constants for sessionStorage keys
  private readonly SEARCH_FORM_KEY = 'meetingSearchForm';
  private readonly SEARCH_RESULTS_KEY = 'meetingSearchResults';
  private readonly COLLAPSE_STATE_KEY = 'meetingSearchCollapsed';

  // Form group
  public form = signal<FormGroup>(
    this.fb.group({
      categoryGuid: new FormControl(null),
      title: new FormControl(''),
      number: new FormControl(''),
      dateFrom: new FormControl(''),
      dateTo: new FormControl(''),
      roomGuid: new FormControl(null),
      agenda: new FormControl(''),
      statusGuid: new FormControl(null),
      secretaryGuid: new FormControl(null),
      chairmanGuid: new FormControl(null)
    })
  );

  override async ngOnInit(): Promise<void> {
    super.ngOnInit();
    await Promise.all([
      this.getRooms(),
      this.getCategories(),
      this.loadUsers(),
      this.getStatuses()
    ]);
    this.setupGridColumns();
    this.restoreSearchState();
  }

  private async getStatuses(): Promise<void> {
    try {
      const data = await firstValueFrom(this.meetingStatusService.getForCombo<ComboBase[]>());
      this.statuses.set(data);
    } catch (error) {
      console.error('Error loading statuses:', error);
      this.toastService.error('خطا در بارگذاری وضعیت‌ها');
    }
  }

  private async getRooms(): Promise<void> {
    try {
      const data = await firstValueFrom(this.roomService.getForCombo<ComboBase[]>());
      this.rooms.set(data);
    } catch (error) {
      console.error('Error loading rooms:', error);
      this.toastService.error('خطا در بارگذاری محل‌های برگزاری');
    }
  }

  private async getCategories(): Promise<void> {
    try {
      const data = await firstValueFrom(this.categoryService.getForCombo<ComboBase[]>());
      this.categories.set(data);
    } catch (error) {
      console.error('Error loading categories:', error);
      this.toastService.error('خطا در بارگذاری دسته‌بندی‌ها');
    }
  }

  onFirstDataRendered(event: any): void {
    const editedGuid = sessionStorage.getItem('editedMeetingGuid');
    if (editedGuid) {
      const api = this.gridApi();
      api?.forEachNode((node: any) => {
        if (node.data?.guid === editedGuid) {
          api.ensureIndexVisible(node.rowIndex, 'middle');
          api.redrawRows();
          sessionStorage.removeItem('editedMeetingGuid');
        }
      });
    }
  }

  private async loadUsers(): Promise<void> {
    try {
      const clientId = getClientSettings().client_id ?? "";
      const data = await firstValueFrom(this.userService.getAllByClientId<SystemUser[]>(clientId));
      this.users.set(data);
      this.userList.set(data.map(user => ({
        guid: user.guid,
        title: user.name,
      })));
    } catch (error) {
      console.error('Error loading users:', error);
      this.toastService.error('خطا در بارگذاری کاربران');
    }
  }

  private setupGridColumns(): void {
    const options = this.gridOptions();
    if (!options) return;

    options.columnDefs = [
      {
        colId: 'actions',
        headerName: 'عملیات',
        cellRenderer: MeetingOptionsCellComponent,
        cellStyle: { textAlign: 'center', overflow: 'unset', 'font-family': 'Sahel' }
      },
      {
        field: 'number',
        headerName: 'شماره جلسه',
        filter: 'agTextColumnFilter',
        cellStyle: { 'font-family': 'Sahel' }
      },
      {
        field: 'title',
        headerName: 'عنوان جلسه',
        filter: 'agTextColumnFilter',
        cellStyle: { 'font-family': 'Sahel' },
      },
      {
        field: 'date',
        headerName: 'زمان',
        filter: 'agDateColumnFilter',
        cellStyle: { direction: 'ltr', 'font-family': 'Sahel' }
      },
      {
        field: 'status',
        headerName: 'وضعیت',
        valueGetter: (params: any) => params.data?.status ?? '',
        cellRenderer: this.statusCellRenderer,
        cellStyle: { textAlign: 'center', 'font-family': 'Sahel' }
      },
      {
        field: 'location',
        headerName: 'محل برگزاری',
        filter: 'agTextColumnFilter',
        cellStyle: { 'font-family': 'Sahel' }
      },
      {
        field: 'chairman',
        headerName: 'رئیس',
        filter: 'agTextColumnFilter',
        cellStyle: { 'font-family': 'Sahel' }
      },
      {
        field: 'secretary',
        headerName: 'دبیر',
        filter: 'agTextColumnFilter',
        cellStyle: { 'font-family': 'Sahel' }
      },
      {
        field: 'creator',
        headerName: 'ثبت کننده',
        filter: 'agTextColumnFilter',
        cellStyle: { 'font-family': 'Sahel' }
      },
    ];

    this.setupGridInteractions(options);
  }

  private statusCellRenderer = (params: any): string => {
    const statusId = params.data?.statusId;
    const status = params.data?.status;
    if (!statusId || !status) return '';

    const colors: { [key: number]: string } = {
      1: '#5bc0de', // ثبت اولیه
      2: '#337ab7', // در حال برگزاری
      3: '#f0ad4e', // برگزار شده
      4: '#5cb85c', // تأیید نهایی
      5: 'red',     // لغو شده
    };

    return `<span class="badge-status" style="background-color: ${colors[statusId] || 'gray'};">
              ${status}
            </span>`;
  };

  private setupGridInteractions(options: any): void {
    options.rowStyle = { cursor: 'pointer' };
    options.rowClassRules = {
      'clickable-row': (params: any) => true
    };

    options.onCellClicked = (event: any) => {
      if (!event.colDef.field || !event.data) return;

      const clickableFields = [
        'number', 'title', 'status', 'date',
        'location', 'chairman', 'secretary', 'creator'
      ];

      if (clickableFields.includes(event.colDef.field) && event.data.guid) {
        this.viewMeetingDetails(event.data.guid);
      }
    };
  }

  // NEW: Restore search state from sessionStorage
  private restoreSearchState(): void {
    try {
      // Restore form data
      const savedFormData = sessionStorage.getItem(this.SEARCH_FORM_KEY);
      if (savedFormData) {
        const formData = JSON.parse(savedFormData);
        this.form().patchValue(formData);
      }

      // Restore search results
      const savedResults = sessionStorage.getItem(this.SEARCH_RESULTS_KEY);
      if (savedResults) {
        const results = JSON.parse(savedResults);
        this.records.set(results);
        this.isSearchEmpty.set(results.length === 0);
      }

      // Restore collapse state
      const savedCollapseState = sessionStorage.getItem(this.COLLAPSE_STATE_KEY);
      if (savedCollapseState) {
        this.isCollapsed.set(JSON.parse(savedCollapseState));
      }
    } catch (error) {
      console.error('Error restoring search state:', error);
    }
  }

  // NEW: Save search state to sessionStorage
  private saveSearchState(): void {
    try {
      sessionStorage.setItem(this.SEARCH_FORM_KEY, JSON.stringify(this.form().value));
      sessionStorage.setItem(this.SEARCH_RESULTS_KEY, JSON.stringify(this.records()));
      sessionStorage.setItem(this.COLLAPSE_STATE_KEY, JSON.stringify(this.isCollapsed()));
    } catch (error) {
      console.error('Error saving search state:', error);
    }
  }

  public async search(): Promise<void> {
    this.loading.set(true);

    try {
      const searchData = this.form().value;
      const userGuid = this.localStorageService.getItem(USER_ID_NAME);
      const positionGuid = this.localStorageService.getItem(POSITION_ID);
      const canViewAll = await this.passwordFlowService.checkPermission('MT_Meetings_ViewAllMeetings');
      const searchModel = {
        ...searchData,
        userGuid,
        positionGuid,
        canViewAll
      };

      const response = await firstValueFrom(
        this.meetingService.searchMeetings(searchModel)
      );

      this.isSearchEmpty.set(response.length === 0);
      this.records.set(response);
      //this.toggleCollapse();

      // NEW: Save search state after successful search
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

    // NEW: Clear saved search state
    sessionStorage.removeItem(this.SEARCH_FORM_KEY);
    sessionStorage.removeItem(this.SEARCH_RESULTS_KEY);
    sessionStorage.removeItem(this.COLLAPSE_STATE_KEY);
  }

  public toggleCollapse(): void {
    this.isCollapsed.update(v => !v);
    // NEW: Save collapse state
    this.saveSearchState();
  }

  private viewMeetingDetails(meetingGuid: string): void {
    // NEW: Save current search state before navigation
    this.saveSearchState();
    this.router.navigate([`/meetings/details/${meetingGuid}`]);
  }

  override onGridReady(params: any): void {
    super.onGridReady(params);
    this.autoSizeAllColumns();
  }

  goToMeetingDetails(meetingGuid: string): void {
    this.saveGridState();
    // NEW: Save search state before navigation
    this.saveSearchState();
    sessionStorage.setItem('editedMeetingGuid', meetingGuid);
    this.router.navigate(['/meetings/details', meetingGuid]);
  }

  saveGridState(): void {
    const api = this.gridApi();
    if (api) {
      const currentPage = api.paginationGetCurrentPage();
      sessionStorage.setItem('meetingGridPage', currentPage.toString());

      const filterModel = api.getFilterModel();
      if (filterModel && Object.keys(filterModel).length > 0) {
        sessionStorage.setItem('meetingGridFilters', JSON.stringify(filterModel));
      }
    }
  }

  // CRUD operations with improved error handling
  async askForDelete(id: string | number): Promise<void> {
    try {
      const result = await this.swalService.fireSwal('آیا از حذف این جلسه اطمینان دارید؟');
      if (result.value === true) {
        this.meetingService.delete(id)
          .pipe(
            takeUntilDestroyed(this.destroyRef),
            catchError(error => {
              this.toastService.error('خطا در حذف جلسه');
              return of(null);
            })
          )
          .subscribe(() => {
            this.search(); // Re-search to refresh results
            this.toastService.success('جلسه با موفقیت حذف شد');
          });
      }
    } catch (error) {
      console.error('Error in delete operation:', error);
    }
  }

  async changeStatus(meetingGuid: string, status: number): Promise<void> {
    // Validation checks
    if (status === 6) {
      const signCheck = await this.meetingService.checkSign(meetingGuid).toPromise();
      if (signCheck === false) {
        Swal.fire({
          title: "خطا",
          text: "جهت اتمام جلسه وارسال مصوبات ،امضای همه اعضا جلسه الزامی است",
          icon: "error",
          confirmButtonText: "باشه",
        });
        return;
      }
    }

    if (status === 4) {
      const meetingCheck = await this.meetingService.checkMeeting(meetingGuid).toPromise();
      if (!meetingCheck.existResolution) {
        Swal.fire({
          title: "خطا",
          text: "بدون شرح جلسه یا ثبت مصوبه امکان ثبت نهایی جلسه وجود ندارد",
          icon: "error",
          confirmButtonText: "باشه",
        });
        return;
      }

      if (!meetingCheck.attendance) {
        Swal.fire({
          title: "خطا",
          text: 'بدون ثبت حضور وغیاب اعضای جلسه امکان ثبت نهایی جلسه وجود ندارد',
          icon: "error",
          confirmButtonText: "باشه",
        });
        return;
      }
    }

    try {
      const result = await this.swalService.fireSwal('آیا از انجام عملیات اطمینان دارید؟');
      if (result.value === true) {
        this.meetingService.changeStatus(meetingGuid, status)
          .pipe(
            takeUntilDestroyed(this.destroyRef),
            catchError(error => {
              this.toastService.error('خطا در تغییر وضعیت جلسه.');
              return of(null);
            })
          )
          .subscribe(() => {
            this.search(); // Re-search to refresh results
            this.toastService.success('وضعیت جلسه با موفقیت تغییر یافت');
          });
      }
    } catch (error) {
      console.error('Error changing status:', error);
    }
  }

  // Navigation methods
  addNewMeeting(): void {
    // NEW: Save search state before navigation
    this.saveSearchState();
    this.router.navigateByUrl('/meetings/create');
  }

  clone(guid: string): void {
    // NEW: Save search state before navigation
    this.saveSearchState();
    this.router.navigate([`/meetings/clone/${guid}`]);
  }
}
