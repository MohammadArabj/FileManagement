import { Component } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { IconButtonComponent } from "../../../shared/custom-buttons/icon-button";
import { NgIf } from '@angular/common';

@Component({
    selector: 'group-options-cell-renderer',
    imports: [IconButtonComponent, NgIf],
    standalone: true,
    template: `
                <app-icon-button *ngIf="params.data.isLocked != 1" identifier="submitBtn" label="حذف" icon="fa fa-trash"
                    variant="danger" (click)="delete(guId)" style="padding-left: 10px;">
                </app-icon-button>
                <app-icon-button *ngIf="isActive == 2" identifier="submitBtn" label="فعال سازی"
                    icon="fa fa-check" className="success" style="padding-left: 10px;">
                </app-icon-button>
                <app-icon-button *ngIf="isActive == 1" identifier="submitBtn" label="غیر فعال سازی"
                    icon="fa fa-cancel" variant="warning" style="padding-left: 10px;">
                </app-icon-button>
                <app-icon-button identifier="submitBtn" label="ویرایش" icon="fa fa-edit"
                    variant="primary" (clicked)="navigateToEdit(guId)" style="padding-left: 10px;">
                </app-icon-button>
  `,
    styles: ['.flex-parent{display:flex; gap:10px}'],
})
export class DelegationListOptionsCellComponent implements ICellRendererAngularComp {
    params: any
    public guId!: any;
    public actionCode!: string;
    public isActive: number | undefined

    agInit(params: any): void {
        if (params.data) {
            this.params = params
            this.guId = params.data.guid
            this.isActive = params.data.isActive
        }
    }

    refresh(params: any) {
        return false
    }

    navigateToEdit(guid = null) {
        this.params.context.componentParent.navigateToEdit(guid)
    }
    openTimeRestrictionModal(guid = null) {
        this.params.context.componentParent.openTimeRestrictionModal(guid)

    }
    openIpRestrictionModal(guid = null) {
        this.params.context.componentParent.openIpRestrictionModal(guid)

    }
    delete(guid = null) {
        this.params.context.componentParent.delete(guid)
    }

}
