import { Component } from "@angular/core";
import { ICellRendererAngularComp } from "ag-grid-angular";
declare var $: any;

@Component({
    selector: 'go-to-document-cell-btn-renderer',
    standalone: true,
    template: `
        <div class="btn-group">
            <button class="btn btn-sm btn-outline-success" type="button" (click)="showDocument()">
                مشاهده سند <i class="fas fa-eye"></i></button>
        </div>`
})
export class GoToDocumentCellBtnRenderer implements ICellRendererAngularComp {
    params: any;

    refresh(params: any): boolean {
        return true;
    }

    agInit(params: any): void {
        this.params = params;
    }

    showDocument() {
        this.params.context
            .componentParent
            .showDocument(this.params.data.masterId, this.params.data.docType);
    }
}