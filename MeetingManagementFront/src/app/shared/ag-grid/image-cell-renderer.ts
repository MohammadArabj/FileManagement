import { NgIf } from "@angular/common";
import { Component } from "@angular/core";
import { ICellRendererAngularComp } from "ag-grid-angular";
declare var $: any;

@Component({
    standalone: true,
    imports: [NgIf],
    selector: 'image-cell-renderer',
    template: `
        <div *ngIf="photo; then specialPhoto else defaultPhoto"></div>
        <ng-template #specialPhoto>
            <img src="data:image/jpg;base64,{{photo}}" width="40" />
        </ng-template>
        <ng-template #defaultPhoto>
            <img src="./assets/media/logos/blanklogo.png" width="40" />
        </ng-template>`,
})
export class ImageCellRenderer implements ICellRendererAngularComp {
    params: any;
    photo: any;

    refresh(params: any): boolean {
        return true;
    }

    agInit(params: any): void {
        this.params = params;

        if (params.data) {
            this.photo = params.data.photo;
        }
    }
}