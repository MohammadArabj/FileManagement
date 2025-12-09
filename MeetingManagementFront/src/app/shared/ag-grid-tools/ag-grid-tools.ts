import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { AgGridStateService } from '../../services/framework-services/agGridState.service';
import { NgIf } from '@angular/common';
import { HasPermissionDirective } from '../../core/directives/has-permission.directive';

@Component({
  selector: 'ag-grid-tools',
  templateUrl: './ag-grid-tools.html',
  standalone: true,
  imports: [HasPermissionDirective]
})
export class AgGridToolsComponent implements OnInit, OnChanges {

  @Input() name!: string;
  @Input() gridApi: any;
  @Input() gridColumnApi: any;
  @Input() exportPermission: any;
  hasSavedState: boolean = false;

  constructor(private readonly agGridStateService: AgGridStateService) { }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.name && this.gridApi && this.gridColumnApi)
      this.restoreState();
  }

  ngOnInit(): void {
  }

  saveState() {
    this.agGridStateService.saveState(this.gridColumnApi, this.name)
    this.hasSavedState = true;
  }

  restoreState() {
    this.hasSavedState = this.agGridStateService.restoreState(this.gridColumnApi, this.name)
  }

  resetState() {
    this.agGridStateService.resetState(this.gridColumnApi, this.name);
    this.hasSavedState = false;
  }

  onExportExcel() {
    this.gridApi.exportDataAsExcel();
  }

  onExportCSV() {
    this.gridApi.exportDataAsCsv();
  }
}