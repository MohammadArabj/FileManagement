import { NgIf } from '@angular/common';
import { Component } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';

@Component({
    selector: 'delegation-options-cell-renderer',
    imports:[NgIf],
    standalone:true,
    template: `
                        <span *ngIf="isActive == 2" class="text-danger bg-soft-danger px-1">غیرفعال</span>
                        <span *ngIf="isActive == 1" class="text-success bg-soft-success px-1">فعال</span>
  `,
    styles: ['.flex-parent{display:flex; gap:10px}'],
})
export class DelegationIsActiveCellComponent implements ICellRendererAngularComp {
    params: any
    public isActive!: number;

    agInit(params: any): void {
        if (params.data) {
            this.params = params
            this.isActive = params.data.isActive
        }
    }

    refresh(params: any) {
        return false
    }

}
