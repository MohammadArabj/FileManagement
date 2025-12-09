import { Component, inject, OnInit, signal } from '@angular/core';
import { LabelButtonComponent } from "../../../shared/custom-buttons/label-button";
import { Router, RouterLink } from '@angular/router';
import { AgGridBaseComponent } from '../../../shared/ag-grid-base/ag-grid-base';
import { AgGridAngular } from 'ag-grid-angular';
import { DelegationService } from '../../../services/delegation.service';
import { BreadcrumbService } from '../../../services/framework-services/breadcrumb.service';
import { USER_ID_NAME } from '../../../core/types/configuration';
import { PermissionService } from '../../../services/permission.service';
import { DelegationIsActiveCellComponent } from './is-active-cell';
import { DelegationListOptionsCellComponent } from './delegation-list-options-cell';
import { SwalService } from '../../../services/framework-services/swal.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-delegation-list',
  standalone: true,
  imports: [LabelButtonComponent, AgGridAngular],
  templateUrl: './delegation-list.html',
})
export class DelegationListComponent extends AgGridBaseComponent implements OnInit {
  // Injected services
  private readonly router = inject(Router);
  private readonly delegationService = inject(DelegationService);
  private readonly permissionService = inject(PermissionService);
  private readonly breadcrumbService = inject(BreadcrumbService);
  private readonly swalService = inject(SwalService);

  // State signals
  public title = signal<string>('لیست تفویض اختیار');
  public delegations = signal<any>([]);
  public loading = signal<boolean>(false);

  constructor() {
    super();
    this.breadcrumbService.setItems([{ label: 'تفویض اختیار', routerLink: '/delegation/list' }]);
    this.breadcrumbService.setTitle(this.title());
  }

  override ngOnInit(): void {
    super.ngOnInit();
    this.setupGridColumns();
    this.getList();
  }

  private setupGridColumns(): void {
    const options = this.gridOptions();
    if (!options) return;

    options.columnDefs = [
      {
        field: 'delegatee',
        headerName: 'کاربر تفویض شده',
        width: 200,
        filter: 'agSetColumnFilter',
        cellStyle: { 'font-family': 'Sahel' }
      },
      {
        field: 'startDate',
        headerName: 'تاریخ شروع',
        filter: 'agSetColumnFilter',
        cellStyle: { 'font-family': 'Sahel' }
      },
      {
        field: 'endDate',
        headerName: 'تاریخ پایان',
        filter: 'agSetColumnFilter',
        cellStyle: { 'font-family': 'Sahel' }
      },
      {
        field: 'isActive',
        headerName: 'وضعیت',
        filter: 'agSetColumnFilter',
        cellRenderer: DelegationIsActiveCellComponent,
        cellStyle: { 'font-family': 'Sahel' }
      },
      {
        colId: 'actions',
        headerName: 'عملیات',
        filter: 'agSetColumnFilter',
        cellRenderer: DelegationListOptionsCellComponent,
        cellStyle: { textAlign: 'center', overflow: 'unset', 'font-family': 'Sahel' }
      }
    ];

    this.setupGridInteractions(options);
  }

  private setupGridInteractions(options: any): void {
    options.rowStyle = { cursor: 'pointer' };
    options.onCellClicked = (event: any) => {
      if (event.colDef.colId === 'actions' && event.data?.id) {
        this.handleActionClick(event.data.id, event.event.target);
      }
    };
  }

  private handleActionClick(id: string, target: HTMLElement): void {
    // Handle action button clicks if needed
  }

  override onGridReady(params: any): void {
    super.onGridReady(params);
    this.autoSizeAllColumns();
  }

  public async getList(): Promise<void> {
    this.loading.set(true);
    try {
      const userGuid = this.localStorageService.getItem(USER_ID_NAME);
      const data = await firstValueFrom(
        this.delegationService.getDelegationsByDelegator(userGuid)
      );
      this.delegations.set(data);
    } catch (error) {
      console.error('Error loading delegations:', error);
      this.toastService.error('خطا در بارگذاری لیست تفویض اختیار');
    } finally {
      this.loading.set(false);
    }
  }

  public async delete(id: string): Promise<void> {
    const result = await this.swalService.fireSwal('آیا از حذف این تفویض اختیار اطمینان دارید؟');
    if (result.value === true) {
      await this.deleteRecord(id);
    }
  }

  private async deleteRecord(id: string): Promise<void> {
    try {
      await firstValueFrom(this.delegationService.delete(id));
      this.getList();
      this.toastService.success('تفویض اختیار با موفقیت حذف شد');
    } catch (error) {
      console.error('Error deleting delegation:', error);
      this.toastService.error('خطا در حذف تفویض اختیار');
    }
  }

  public navigateToEdit(id: string): void {
    this.router.navigate(['delegation/edit', id]);
  }

  public navigateToCreate(): void {
    this.router.navigate(['delegation/create']);
  }
}