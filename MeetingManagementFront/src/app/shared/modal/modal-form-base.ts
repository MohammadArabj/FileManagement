import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  inject,
  signal,
  computed,
  effect,
  output,
  viewChild,
  input,
  DestroyRef,
  ChangeDetectionStrategy
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable, catchError, of, finalize } from 'rxjs';

import { AgGridBaseComponent } from '../ag-grid-base/ag-grid-base';
import { ModalComponent } from './modal';
import { ModalConfig } from './modal.config';
import { formGroupToFormData } from '../constants';
import { classificationLevelError } from '../app-messages';
import { BreadcrumbService } from '../../services/framework-services/breadcrumb.service';
import { USER_CLASSIFICATION_LEVEL_ID_NAME } from '../../core/types/configuration';
import { ServiceBase } from '../../services/framework-services/service.base';
import { PermissionService } from '../../services/permission.service';
import { ToastService } from '../../services/framework-services/toast.service';

declare var Swal: any;

interface PermissionSearchModel {
  permissionTitle: string;
  userClassificationLevelGuid: string;
}

@Component({
  selector: 'app-modal-form-base',
  template: '',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ModalFormBaseComponent<T extends ServiceBase, TModel> extends AgGridBaseComponent implements OnInit, AfterViewInit, OnDestroy {
  // Input signals
  public title = input<string>('');
  public permissionTitle = input<string>('');

  // State signals
  public form = signal<FormGroup | null>(null);
  public isModalShow = signal<boolean>(false);
  public records = signal<TModel[]>([]);
  public isLoading = signal<boolean>(false);
  public modalConfig = signal<ModalConfig>(new ModalConfig());

  // Computed signals
  public hasRecords = computed(() => this.records().length > 0);
  public isFormValid = computed(() => this.form()?.valid ?? false);
  public isFormDirty = computed(() => this.form()?.dirty ?? false);

  // Output events using modern output()
  public afterListFetch = output<void>();
  public afterModalOpened = output<void>();
  public afterModalClose = output<void>();
  public afterEntityFetch = output<any>();
  public afterFormSubmit = output<number>();
  public afterDelete = output<void>();
  public afterReset = output<void>();

  // ViewChild using modern viewChild()
  private opsModalComponent = viewChild<ModalComponent>('opsModal');

  // Injected services
  private readonly permissionService = inject(PermissionService);
  private readonly router = inject(Router);
  private readonly breadcrumbService = inject(BreadcrumbService);

  // Service injection - to be provided by child components
  protected service!: T;

  constructor() {
    super();
    this.setupEffects();
  }

  private setupEffects(): void {
    // Effect to set breadcrumb when title changes
    effect(() => {
      const currentTitle = this.title();
      if (currentTitle) {
        this.breadcrumbService.setItems([{ label: currentTitle, routerLink: '' }]);
      }
    });

    // Effect to handle permission changes
    effect(() => {
      const permission = this.permissionTitle();
      if (permission) {
        this.getClassificationLevel();
      } else {
        this.getList();
      }
    });
  }

  override ngOnInit(): void {
    super.ngOnInit();
    // Initial setup is handled by effects
  }

  ngAfterViewInit(): void {
    // Setup complete
  }

  ngOnDestroy(): void {
    // Cleanup is handled by takeUntilDestroyed
  }

  private getList(): void {
    if (!this.service) {
      console.error('Service not provided to ModalFormBaseComponent');
      return;
    }

    this.isLoading.set(true);
    this.records.set([]);

    this.service.getList<TModel[]>()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(error => {
          console.error('Error loading list:', error);
          this.toastService.error('خطا در بارگذاری لیست');
          return of([]);
        }),
        finalize(() => this.isLoading.set(false))
      )
      .subscribe(data => this.handleListSubscription(data));
  }

  private handleListSubscription(data: TModel[]): void {
    this.records.set(data);
    this.afterListFetch.emit();
  }

  private getClassificationLevel(): void {
    const userClassificationLevelGuid = this.localStorageService.getItem(USER_CLASSIFICATION_LEVEL_ID_NAME);
    const searchModel: PermissionSearchModel = {
      permissionTitle: this.permissionTitle(),
      userClassificationLevelGuid
    };

    this.permissionService.getClassificationLevelByTitle(searchModel)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(error => {
          console.error('Error checking classification level:', error);
          this.toastService.error('خطا در بررسی سطح دسترسی');
          return of(null);
        })
      )
      .subscribe(result => {
        if (!result) {
          this.toastService.error(classificationLevelError);
          this.router.navigateByUrl('/dashboard');
          return;
        }
        this.getList();
        this.breadcrumbService.setClassificationLevel(result.title);
      });
  }

  public async delete(id: any): Promise<void> {
    try {
      const result = await this.fireDeleteSwal();
      if (result.value === true) {
        this.deleteRecord(id);
      }
    } catch (error) {
      console.error('Error in delete confirmation:', error);
    }
  }

  private deleteRecord(id: string | number): void {
    if (!this.service) return;

    this.service.delete(id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(error => {
          console.error('Error deleting record:', error);
          this.toastService.error('خطا در حذف رکورد');
          return of(null);
        })
      )
      .subscribe(() => {
        this.getList();
        this.afterDelete.emit();
      });
  }

  public openOpsModal(guid: any = null): void {
    const modal = this.opsModalComponent();
    if (!modal) return;

    if (guid) {
      this.loadEntityForEdit(guid, modal);
    } else {
      this.resetFormForNew(modal);
    }
  }

  private loadEntityForEdit(guid: any, modal: ModalComponent): void {
    if (!this.service) return;

    this.service.getForEdit(guid)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(error => {
          console.error('Error loading entity for edit:', error);
          this.toastService.error('خطا در بارگذاری اطلاعات');
          return of(null);
        })
      )
      .subscribe(data => {
        if (data) {
          const currentForm = this.form();
          if (currentForm) {
            currentForm.patchValue(data as { [key: string]: any });
          }
          this.afterEntityFetch.emit(data);
          this.afterModalOpened.emit();
          this.isModalShow.set(true);
          modal.open();
        }
      });
  }

  private resetFormForNew(modal: ModalComponent): void {
    const currentForm = this.form();
    if (currentForm) {
      currentForm.reset();
    }
    this.afterReset.emit();
    this.afterModalOpened.emit();
    this.isModalShow.set(true);
    modal.open();
  }

  public activate(guid: string): void {
    if (!this.service) return;

    this.service.activate(guid)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(error => {
          console.error('Error activating record:', error);
          this.toastService.error('خطا در فعال سازی');
          return of(null);
        })
      )
      .subscribe(() => {
        this.getList();
      });
  }

  public deactivate(guid: string): void {
    if (!this.service) return;

    this.service.deactivate(guid)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(error => {
          console.error('Error deactivating record:', error);
          this.toastService.error('خطا در غیرفعال سازی');
          return of(null);
        })
      )
      .subscribe(() => {
        this.getList();
      });
  }

  public submit(action: any, hasFile = false): void {
    const currentForm = this.form();
    if (!currentForm || currentForm.invalid) {
      currentForm?.markAllAsTouched();
      this.toastService.error('لطفا فرم را به درستی تکمیل کنید');
      return;
    }

    if (hasFile) {
      this.submitWithFile(action);
    } else {
      this.submitWithJson(action);
    }
  }

  private submitWithJson(action: string): void {
    const currentForm = this.form();
    if (!currentForm || !this.service) return;

    const command = currentForm.value;
    const operation$ = command.guid
      ? this.service.edit(command)
      : this.service.create(command);

    operation$
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(error => {
          console.error('Error submitting form:', error);
          this.toastService.error('خطا در ثبت اطلاعات');
          return of(null);
        })
      )
      .subscribe(() => {
        this.handleCreateEditOps(action);
      });
  }

  private submitWithFile(action: string): void {
    const currentForm = this.form();
    if (!currentForm || !this.service) return;

    const guid = currentForm.value.guid;
    const formData = formGroupToFormData(currentForm);

    const operation$ = guid
      ? this.service.editWithFile(formData)
      : this.service.createWithFile(formData);

    operation$
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(error => {
          console.error('Error submitting form with file:', error);
          this.toastService.error('خطا در ثبت اطلاعات');
          return of(null);
        })
      )
      .subscribe(() => {
        this.handleCreateEditOps(action);
      });
  }

  private handleCreateEditOps(action: string): void {
    const currentForm = this.form();

    if (action === "new") {
      currentForm?.reset();
      // Remove jQuery dependency - handle select reset differently
      this.resetSelectElements();
    } else if (action === "exit") {
      const modal = this.opsModalComponent();
      modal?.close();
    }

    this.afterFormSubmit.emit(1);
    this.getList();
  }

  private resetSelectElements(): void {
    // Modern way to reset select elements without jQuery
    const selectElements = document.querySelectorAll('select');
    selectElements.forEach(select => {
      select.value = '';
      select.dispatchEvent(new Event('change'));
    });
  }

  public modalClosed(): void {
    const currentForm = this.form();
    if (currentForm) {
      currentForm.enable();
      currentForm.reset();
    }

    // Remove jQuery dependencies
    this.removeValidationClasses();
    this.removeActiveAttributes();

    this.isModalShow.set(false);
    this.afterModalClose.emit();
  }

  private removeValidationClasses(): void {
    const submitForm = document.getElementById('submitForm');
    submitForm?.classList.remove('was-validated');
  }

  private removeActiveAttributes(): void {
    const radioItems = document.querySelectorAll('.radioItem');
    radioItems.forEach(item => {
      item.removeAttribute('active');
    });
  }

  public navigateToExcelImportPage(id: any): void {
    this.router.navigate(['import-excel', id]);
  }

  // Helper method to refresh list
  public refreshList(): void {
    this.getList();
  }

  // Helper method to check if modal is open
  public isModalOpen(): boolean {
    return this.isModalShow();
  }
}
