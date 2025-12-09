import {
  AfterViewInit,
  Component,
  OnInit,
  Renderer2,
  inject,
  signal,
  computed,
  effect,
  ChangeDetectionStrategy
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { AgGridAngular } from 'ag-grid-angular';
import { catchError, of } from 'rxjs';
import { SystemUser } from '../../core/models/User';
import { USER_ID_NAME, POSITION_ID, POSITION_NAME, ROLE_TOKEN_NAME, ACCESS_TOKEN_NAME, Main_USER_ID, IsDeletage, USER_CURRENT_ACTIVE_SESSION_NAME, PERMISSIONS_NAME } from '../../core/types/configuration';
import { BreadcrumbService } from '../../services/framework-services/breadcrumb.service';
import { CodeFlowService, getClientSettings } from '../../services/framework-services/code-flow.service';
import { LocalStorageService } from '../../services/framework-services/local.storage.service';
import { PasswordFlowService } from '../../services/framework-services/password-flow.service';
import { SwalService } from '../../services/framework-services/swal.service';
import { PermissionService } from '../../services/permission.service';
import { UserService } from '../../services/user.service';
import { AgGridBaseComponent } from '../../shared/ag-grid-base/ag-grid-base';
import { LabelButtonComponent } from '../../shared/custom-buttons/label-button';
import { environment } from '../../../environments/environment';

declare var Swal: any;

interface FilterModel {
  // اگر فیلتر خاصی نیاز باشد، اینجا تعریف شود
}

interface GridState {
  page: number;
  filters: any;
  highlightGuid?: string;
}

@Component({
  selector: 'app-user',
  templateUrl: './user.html',
  styleUrls: ['./user.css'],
  standalone: true,
  imports: [AgGridAngular, LabelButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserList extends AgGridBaseComponent implements OnInit, AfterViewInit {
  // Injected services using modern inject()
  private readonly renderer = inject(Renderer2);
  private readonly userService = inject(UserService);
  public readonly router = inject(Router);
  private readonly swalService = inject(SwalService);
  private readonly breadcrumbService = inject(BreadcrumbService);
  private readonly route = inject(ActivatedRoute);
  private readonly passwordFlowService = inject(PasswordFlowService);
  private readonly codeFlowService = inject(CodeFlowService);
  private readonly permissionService = inject(PermissionService);

  // Signals for reactive state management
  public records = signal<SystemUser[]>([]);
  public loading = signal<boolean>(false);
  public gridState = signal<GridState>({ page: 0, filters: {} });
  public isPermitted = signal<boolean>(false);

  // Computed signals
  public hasRecords = computed(() => this.records().length > 0);

  constructor() {
    super();
    this.setupBreadcrumb();
    this.setupRouteEffects();
  }

  private setupBreadcrumb(): void {
    this.breadcrumbService.setItems([
      { label: 'کاربران', routerLink: '/users/list' },
    ]);
  }

  private setupRouteEffects(): void {
    // Effect to handle route parameter changes if needed
    effect(() => {
      this.route.queryParams
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(params => {
          // فیلترهای احتمالی اینجا مدیریت شود
          if (this.isPermitted()) {
            this.getRecords();
          }
        });
    });
  }

  override async ngOnInit(): Promise<void> {
    super.ngOnInit();
    await this.checkPermissions();
    if (this.isPermitted()) {
      this.setupGridColumns();
      this.getRecords();
    }
  }

  private async checkPermissions(): Promise<void> {
    try {
      const checkPermission = await this.passwordFlowService.checkPermission('MT_Meetings_Search'); // فرض بر مجوز مشاهده لیست کاربران
      if (!checkPermission) {
        this.toastService.error('شما مجوز مشاهده این صفحه را ندارید');
        return;
      }
      this.isPermitted.set(true);
    } catch (error) {
      console.error('Error checking permissions:', error);
      this.toastService.error('خطا در بررسی مجوزها');
    }
  }

  ngAfterViewInit(): void {
    this.restoreGridState();
  }

  private restoreGridState(): void {
    // Restore page
    const pageStr = sessionStorage.getItem('userGridPage');
    if (pageStr) {
      const page = parseInt(pageStr, 10);
      setTimeout(() => {
        const api = this.gridApi();
        api?.paginationGoToPage(page);
      }, 100);
      sessionStorage.removeItem('userGridPage');
    }

    // Restore filters
    const savedFilters = sessionStorage.getItem('userGridFilters');
    if (savedFilters) {
      try {
        const filters = JSON.parse(savedFilters);
        setTimeout(() => {
          const api = this.gridApi();
          api?.setFilterModel(filters);
        }, 200);
        sessionStorage.removeItem('userGridFilters');
      } catch (error) {
        console.error('خطا در بازگردانی فیلترها:', error);
      }
    }
  }

  override onGridReady(params: any): void {
    super.onGridReady(params);
    setTimeout(() => {
      const api = this.gridApi();
      api?.redrawRows();
      this.autoSizeAllColumns();
    }, 20);
  }

  private setupGridColumns(): void {
    const options = this.gridOptions();
    if (!options) return;

    options.columnDefs = [
      {
        field: 'image',
        headerName: 'تصویر',
        filter: false,
        cellRenderer: this.imageCellRenderer,
      },
      {
        field: 'name',
        headerName: 'نام کاربر',
        filter: 'agTextColumnFilter',
        cellStyle: { 'font-family': 'Sahel' }
      },
      {
        field: 'userName',
        headerName: 'نام کاربری',
        filter: 'agTextColumnFilter',
        cellStyle: { 'font-family': 'Sahel' }
      },
      {
        field: 'position',
        headerName: 'سمت',
        filter: 'agTextColumnFilter',
        cellStyle: { 'font-family': 'Sahel' }
      },

      {
        colId: 'actions',
        headerName: 'عملیات',
        filter: false,
        cellRenderer: this.impersonateCellRenderer.bind(this),
        cellStyle: { textAlign: 'center', overflow: 'unset', 'font-family': 'Sahel' },
      }
    ];

    this.setupGridInteractions(options);
  }

  private impersonateCellRenderer = (params: any): string => {
    if (!params.data) return '';
    return `<button class="btn btn-sm btn-primary" onclick="impersonateUser('${params.data.guid}', '${params.data.positionGuid}')">
              ورود به عنوان کاربر
            </button>`;
  };

  private imageCellRenderer = (params: any): string => {
    const imageUrl = `${environment.fileManagementEndpoint}/photo/${params.data.userName}.jpg`;
    if (!imageUrl) return '<i class="fa fa-user"></i>';
    return `<img src="${imageUrl}" alt="تصویر کاربر" style="width: 40px; height: 40px; border-radius: 50%;">`;
  };

  private setupGridInteractions(options: any): void {
    options.rowStyle = { cursor: 'pointer' };
    options.rowClassRules = {
      'clickable-row': (params: any) => true
    };

    // اضافه کردن event listener برای دکمه impersonate
    (window as any).impersonateUser = (userGuid: string, positionGuid: string) => {
      this.impersonateUser(userGuid, positionGuid);
    };
    options.onCellClicked = (event: any) => {
      if (event.colDef.colId === 'actions') return; // جلوگیری از کلیک روی ستون عملیات

      if (event.colDef.field && event.data) {
        const clickableFields = ['name', 'userName', 'position'];
        if (clickableFields.includes(event.colDef.field)) {
          // اگر نیاز به جزئیات کاربر باشد، اینجا navigate کنید
          // this.goToUserDetails(event.data.guid);
        }
      }
    };
  }

  public async getRecords(): Promise<void> {
    this.loading.set(true);

    try {
      const clientId = getClientSettings().client_id ?? '';

      this.userService.getAllByClientId<SystemUser[]>(clientId)
        .pipe(
          takeUntilDestroyed(this.destroyRef),
          catchError(error => {
            console.error('Error loading users:', error);
            this.toastService.error('خطا در بارگذاری کاربران');
            return of([]);
          })
        )
        .subscribe((data: SystemUser[]) => {
          // اگر کاربر چند position داشته باشد، هر کدام را به عنوان رکورد جداگانه در نظر بگیرید
          const expandedRecords: SystemUser[] = [];
          data.forEach(user => {
            if (user.positions && user.positions.length >= 1) {
              user.positions.forEach(pos => {
                const clonedUser: SystemUser = { ...user, positionGuid: pos.positionGuid, position: pos.positionTitle };
                expandedRecords.push(clonedUser);
              });
            } else {
              expandedRecords.push(user);
            }
          });
          this.records.set(expandedRecords);
          this.loading.set(false);
        });
    } catch (error) {
      console.error('Error in getRecords:', error);
      this.loading.set(false);
    }
  }

  async impersonateUser(userGuid: string, positionGuid: string): Promise<void> {
    try {
      // تأیید از ادمین
      const result = await this.swalService.fireSwal('آیا از ورود به عنوان این کاربر اطمینان دارید؟');
      if (result.value !== true) return;

      // فرض بر این است که UserService متد impersonateUser دارد که اطلاعات لاگین را برمی‌گرداند
      // اگر وجود ندارد، باید اضافه شود: مثلاً POST به /Impersonate/{userGuid}/{positionGuid}
      // const impersonateResponse = await this.userService.impersonateUser(userGuid, positionGuid).toPromise();
      const user = this.records().find(x => x.positionGuid == positionGuid && x.guid == userGuid) as any;
      if (user) {
        // ذخیره اطلاعات مانند ChallengeComponent
        this.localStorageService.setItem(USER_ID_NAME, userGuid);
        this.localStorageService.setItem(POSITION_ID, positionGuid);
        this.localStorageService.setItem(POSITION_NAME, user.positionTitle || '');
        this.localStorageService.setItem(Main_USER_ID, userGuid);
        this.localStorageService.setItem(IsDeletage, 'false'); // یا بر اساس response

        // گرفتن مجوزها (بدون delegation، زیرا برای ادمین impersonate است)
        const session = await this.userService.getCurrentSession().toPromise();
        // if (!session.sessionGuid) {
        //   this.codeFlowService.logout();
        //   return;
        // }
        this.localStorageService.setItem(USER_CURRENT_ACTIVE_SESSION_NAME, session.sessionGuid);

        // گرفتن مجوزها برای position
        // const permissions = await this.permissionService.getPositionPermissions(positionGuid).toPromise();
        // this.localStorageService.removeItem(PERMISSIONS_NAME);
        // this.localStorageService.setItem(PERMISSIONS_NAME, permissions);

        // هدایت به داشبورد
        this.router.navigateByUrl('/dashboard');
        this.toastService.success('ورود به عنوان کاربر با موفقیت انجام شد');
      } else {
        this.toastService.error('خطا در ورود به عنوان کاربر');
      }
    } catch (error) {
      console.error('Error in impersonateUser:', error);
      this.toastService.error('خطا در فرآیند ورود');
    }
  }

  // Navigation methods
  saveGridState(): void {
    const api = this.gridApi();
    if (api) {
      const currentPage = api.paginationGetCurrentPage();
      sessionStorage.setItem('userGridPage', currentPage.toString());
    }
  }

  goToUserDetails(userGuid: string): void {
    this.saveGridState();
    this.router.navigate(['/users/details', userGuid]);
  }

  // Grid controls
  override removeAllFilters(): void {
    const api = this.gridApi();
    api?.setFilterModel(null);
  }

  override onExportExcel(): void {
    // پیاده‌سازی export به Excel اگر نیاز باشد
    this.toastService.info('خروجی Excel در حال توسعه است');
  }
}