import { NgIf } from "@angular/common";
import { Component } from "@angular/core";
import { ICellRendererAngularComp } from "ag-grid-angular";
declare var $: any;

@Component({
    selector: 'validation-state-cell-renderer',
    imports: [NgIf],
    standalone: true,
    template: `
    <span *ngIf="state == 'عدم تاييد'">
        <span class="bg-soft-danger text-danger" style="padding: 3px">عدم تاييد</span>
    </span>
    <span *ngIf="state == 'تاييد شده'">
        <span class="bg-soft-success text-success" style="padding: 3px">تایید شده</span>
    </span>
    <span *ngIf="state == 'بدون وضعيت'">
        <span class="bg-soft-primary text-primary" style="padding: 3px">بدون وضعيت</span>
    </span>`,
})
export class ValidateionStateCellRenderer implements ICellRendererAngularComp {
    params: any;
    state!: null;

    refresh(params: any): boolean {
        return true;
    }

    agInit(params: any): void {
        this.params = params;

        if (params.data) {
            if (params.data.validationState != null) {
                this.state = params.data.validationState;
            }
        }
    }
}