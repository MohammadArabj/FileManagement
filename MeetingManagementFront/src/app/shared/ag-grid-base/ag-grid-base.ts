import {
  Component,
  output,
  inject,
  signal,
  computed,
  effect,
  OnInit,
  DestroyRef
} from "@angular/core";
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AllEnterpriseModule, LicenseManager, ModuleRegistry } from "ag-grid-enterprise";
import { ConfirmationStateCellRenderer } from "../ag-grid/confirmation-state-label-cell";
import { EditDeleteCellRenderer } from "../ag-grid/edit-delete-cell-btn";
import { GoToDocumentCellBtnRenderer } from "../ag-grid/go-to-document-cell-btn-renderer";
import { ImageCellRenderer } from "../ag-grid/image-cell-renderer";
import { IsCanceledCellRenderer } from "../ag-grid/is-canceled-label-cell";
import { TaxStateCellRenderer } from "../ag-grid/tax-state-label-cell";
import { ValidateionStateCellRenderer } from "../ag-grid/validation-state-label-cell";
import { AppSharedDataComponent } from "../app-shared-data/app-shared-data";
import { AG_GRID_LOCALE_FA } from "./locale.fa";

declare var Swal: any;

interface CellBackgroundParams {
  data: {
    resultCode?: string;
    expertCode?: string;
    approverCode?: string;
    actionCode?: string;
    equipmentIdentificationStatuseCode?: string;
  };
}

@Component({
  selector: 'app-ag-grid-base',
  template: '',
  standalone: true,
})
export class AgGridBaseComponent extends AppSharedDataComponent implements OnInit {
  // Signals for reactive state
  public childName = signal<string>('');
  public gridApiReady = signal<boolean>(false);
  public gridOptions = signal<any>(null);

  // Computed signals
  public isGridReady = computed(() => this.gridApiReady() && this.gridApi() !== null);

  // Protected signals for internal state
  protected gridApi = signal<any>(null);
  protected modules = signal<any>(null);

  // Modern output events
  public afterGridReady = output<number>();

  // Inject DestroyRef for cleanup
  protected readonly destroyRef = inject(DestroyRef);

  // Component registry for AG Grid
  public readonly components: { [key: string]: any } = {
    editDeleteCellRenderer: EditDeleteCellRenderer,
    imageCellRenderer: ImageCellRenderer,
    validationStateCellRenderer: ValidateionStateCellRenderer,
    taxStateCellRenderer: TaxStateCellRenderer,
    confirmationStateCellRenderer: ConfirmationStateCellRenderer,
    isCanceledCellRenderer: IsCanceledCellRenderer,
    goToDocumentCellRenderer: GoToDocumentCellBtnRenderer
  };

  constructor() {
    super();
    this.initializeAgGrid();
    this.setupGridEffects();
  }

  override ngOnInit(): void {
    super.ngOnInit();
  }

  private initializeAgGrid(): void {
    // Set license and register modules
    LicenseManager.setLicenseKey("MjAwMDAwMDAwMDAwMA==5a5ea3be8a8aaa9b54ce7186663066431");
    ModuleRegistry.registerModules([AllEnterpriseModule]);

    // Initialize grid options with signal
    const options = {
      defaultColDef: {
        flex: 1,
        resizable: false,
        filter: true,
        sortable: true,
        minWidth: 150,
        enableValue: true,
        enableRowGroup: false,
        enablePivot: true,
      },
      autoGroupColumnDef: { minWidth: 200 },
      rowGroupPanelShow: 'none',
      pivotPanelShow: 'always',
      statusBar: {
        statusPanels: [
          { statusPanel: 'agTotalAndFilteredRowCountComponent', align: 'left' },
          { statusPanel: 'agTotalRowCountComponent', align: 'center' },
          { statusPanel: 'agFilteredRowCountComponent' },
          { statusPanel: 'agSelectedRowCountComponent' },
          { statusPanel: 'agAggregationComponent' },
        ]
      },
      icons: { filter: '<i class="fas fa-search"></i>' },
      context: { componentParent: this },
      localeText: AG_GRID_LOCALE_FA,
      enableRtl: true,
      animateRows: true,
      pagination: false,
      columnHoverHighlight: true,
    };

    this.gridOptions.set(options);
  }

  private setupGridEffects(): void {
    // Effect to handle grid API changes
    effect(() => {
      const api = this.gridApi();
      if (api) {
        this.gridApiReady.set(true);
        this.afterGridReady.emit(1);
      }
    });
  }

  // Auto-size columns with error handling
  autoSizeAllColumns(): void {
    const api = this.gridApi();
    if (api) {
      try {
        const allColumnIds: string[] = api.getColumnDefs()?.map((col: any) => col.field) || [];
        if (allColumnIds.length > 0) {
          api.autoSizeColumns(allColumnIds, true);
        }
      } catch (error) {
        console.error('Error auto-sizing columns:', error);
      }
    }
  }

  // Modern SweetAlert methods with better error handling
  async fireDeleteSwal(): Promise<any> {
    try {
      return await Swal.fire({
        title: "آیا از حذف این ردیف اطمینان دارید؟",
        text: "درصورت حذف دیگر قادر به بازیابی ردیف فوق نخواهید بود.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "بله، اطمینان دارم.",
        cancelButtonText: "خیر",
        confirmButtonClass: "btn btn-success mx-2",
        cancelButtonClass: "btn btn-danger",
        buttonsStyling: false,
      });
    } catch (error) {
      console.error('Error showing delete confirmation:', error);
      return { dismiss: true };
    }
  }

  fireDeleteSucceededSwal(): void {
    Swal.fire({
      title: "ردیف فوق با موفقیت حذف شد.",
      icon: "success",
    });
  }

  dismissDeleteSwal(result: any): boolean {
    return result.dismiss === Swal.DismissReason.cancel;
  }

  // Grid utility methods
  onClearRange(): void {
    const api = this.gridApi();
    api?.clearRangeSelection();
  }

  removeAllFilters(): void {
    const api = this.gridApi();
    api?.setFilterModel(null);
  }

  onExportExcel(): void {
    const api = this.gridApi();
    api?.exportDataAsExcel();
  }

  onExportCSV(): void {
    const api = this.gridApi();
    api?.exportDataAsCsv();
  }

  setColumnsVisible(colName: string, state: boolean): void {
    const api = this.gridApi();
    api?.setColumnsVisible(colName, state);
  }

  onGridReady(params: any): void {
    this.gridApi.set(params.api);
    params.api?.hideOverlay();
  }

  // Cell background styling with better type safety
  cellBackground = (params: CellBackgroundParams): { backgroundColor?: string } => {
    if (!params.data) return {};

    const { data } = params;
    const backgroundColors = {
      confirm: 'rgb(57 229 195 / 58%)',
      reject: 'rgb(229 57 57 / 25%)',
      edit: 'rgb(251 197 103 / 40%)',
    };

    // Simplified logic with early returns
    if (data.resultCode === 'Confirm') return { backgroundColor: backgroundColors.confirm };
    if (data.resultCode === 'Reject') return { backgroundColor: backgroundColors.reject };
    if (data.resultCode === 'Edit') return { backgroundColor: backgroundColors.edit };
    if (data.expertCode === 'ExpertSended') return { backgroundColor: backgroundColors.edit };

    if (data.approverCode === 'Confirm' && data.expertCode === 'SendedConfirmer2') {
      return { backgroundColor: backgroundColors.confirm };
    }

    if (data.actionCode === 'SendedConfirmer') {
      const statusCode = data.equipmentIdentificationStatuseCode;
      if (statusCode === 'Edit') return { backgroundColor: backgroundColors.edit };
      if (statusCode === 'Confirm') return { backgroundColor: backgroundColors.confirm };
      if (statusCode === 'Reject') return { backgroundColor: backgroundColors.reject };
    }

    return {};
  };
}