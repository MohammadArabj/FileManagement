import { NgIf } from "@angular/common";
import { Component } from "@angular/core";
import { ICellRendererAngularComp } from "ag-grid-angular";
declare var $: any;

@Component({
    selector: 'confirmation-state-cell-renderer',
    imports:[NgIf],
    standalone:true,
    template: `
    <span *ngIf="state == 'ثبت شده'">
        <span class="bg-soft-primary text-primary" style="padding: 3px">ثبت نهایی شده</span>
    </span>
    <span *ngIf="state == 'ثبت نشده'">
        <span class="bg-soft-warning text-warning" style="padding: 3px">ثبت نشده</span>
    </span>`,
})
export class ConfirmationStateCellRenderer implements ICellRendererAngularComp {
    params: any;
    state!: null;

    refresh(params: any): boolean {
        return true;
    }

    agInit(params: any): void {
        this.params = params;

        if (params.data) {
            if (params.data.confirmationState != null) {
                this.state = params.data.confirmationState;
            }
        }
    }
}