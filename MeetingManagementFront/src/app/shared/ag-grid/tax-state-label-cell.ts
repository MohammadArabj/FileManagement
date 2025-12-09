import { NgIf } from "@angular/common";
import { Component } from "@angular/core";
import { ICellRendererAngularComp } from "ag-grid-angular";
declare var $: any;

@Component({
    selector: 'tax-state-cell-renderer',
    imports: [NgIf],
    standalone: true,
    template: `
    <span *ngIf="state == 0">
        <span class="bg-soft-dark text-dark" style="padding: 3px">بدون وضعیت</span>
    </span>
    <span *ngIf="state == 1">
        <span class="bg-soft-warning text-warning" style="padding: 3px">ارسال شده</span>
    </span>
    <span *ngIf="state == 2">
        <span class="bg-soft-success text-success" style="padding: 3px">تائید شده</span>
    </span>
    <span *ngIf="state == 3">
        <span class="bg-soft-danger text-danger" style="padding: 3px">دارای خطا</span>
    </span>`,
})
export class TaxStateCellRenderer implements ICellRendererAngularComp {
    params: any;
    state!: null;

    refresh(params: any): boolean {
        return true;
    }

    agInit(params: any): void {
        this.params = params;
        if (params.data) {
            if (params.data.taxState != null) {
                this.state = params.data.taxState;
            }
        }
    }
}