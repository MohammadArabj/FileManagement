import { Injectable } from '@angular/core';
declare var Swal: any;
declare var $: any;

@Injectable(
    {
        providedIn: 'root'
    }
)
export class SwalService {

    fireSwal(text = '', title = '') {
        return Swal.fire({
            title: title,
            text: text,
            type: "warning",
            icon: "question",
            showCancelButton: !0,
            confirmButtonText: "بله، اطمینان دارم.",
            cancelButtonText: "خیر",
            confirmButtonClass: "btn btn-success mt-2",
            cancelButtonClass: "btn btn-danger ml-2 mt-2",
            buttonsStyling: !1,
        });
    }

    fireSucceddedSwal(title: any, text: string) {
        Swal.fire({
            title: title,
            icon: "success",
            html: text,
            confirmButtonText: "باشه",
        });
    }
    fireDangeredSwal(title: any, text: string) {
        Swal.fire({
            title: title,
            icon: "warning",
            html: text,
            confirmButtonText: "باشه",
        });
    }
    dismissSwal(t: { value?: boolean; dismiss?: any; }) {
        t.dismiss === Swal.DismissReason.cancel;
    }
}