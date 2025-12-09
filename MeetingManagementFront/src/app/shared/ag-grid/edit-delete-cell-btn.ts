import { Component } from "@angular/core";
import { RouterLink } from "@angular/router";
import { ICellRendererAngularComp } from "ag-grid-angular";
declare var $: any;

@Component({
    selector: 'edit-delete-cell-renderer',
    standalone: true,
    imports: [RouterLink],
    template: `
    <span class="mr-1">
        <a [routerLink]="[params.editUrl, id]"> 
            <i class="la la-edit fs-4 me-1 cursor-pointer"></i>
        </a>
    </span>
    <span class="mr-1">
        <a (click)="btnDeleteClicked()"> 
            <i class="la la-trash fs-4 me-1 cursor-pointer"></i>
        </a>
    </span>`,
})
export class EditDeleteCellRenderer implements ICellRendererAngularComp {
    params: any;
    canEdit: false = false;
    canDelete: false = false;
    canView: false = false;
    id: 0 = 0;

    refresh(params: any): boolean {
        return true;
    }

    agInit(params: any): void {
        this.params = params;

        if (params.data) {
            if (params.data.canEdit) {
                this.canEdit = params.data.canEdit;
            }

            if (params.data.canDelete) {
                this.canDelete = params.data.canDelete;
            }

            if (params.data.canView) {
                this.canView = params.data.canView;
            }

            if (params.data.id) {
                this.id = params.data.id;
            }
        }
    }

    btnDeleteClicked() {
        this.params.context
            .componentParent
            .delete(this.params.data.id);
    }
}