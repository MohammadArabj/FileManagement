import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable, throwError, catchError } from "rxjs";
import { ToastService } from "../../services/framework-services/toast.service";
import { isValidNationalCode } from "../../shared/constants";

@Injectable()
export class ValidationInterceptor implements HttpInterceptor {
  constructor(private readonly toastService: ToastService) { }

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const formId = `#${request.headers.get('formId')}`
    const isFormSubmission = request.headers.has('X-Form-Submitted');  // فقط وقتی درخواست واقعا ارسال شده است

    // بررسی اینکه درخواست POST یا PUT باشد و هدر مربوطه را داشته باشد
    if ((request.method === 'POST' || request.method === 'PUT') && isFormSubmission) {
      if (request.headers.get("noValidate") == "true") {
        return next.handle(request);
      }
      const form = $(formId);
      if (form[0]) {
        form.addClass("was-validated");
        const errors = this.logErrors(formId);
        if ((form[0] as HTMLFormElement).checkValidity()) {
          form.removeClass("was-validated");
          return next.handle(request);
        } else {
          this.toastService.error(`لطفا '${errors.join(" و ")}' را به درستی وارد کنید.`);
          throw new Error();
        }
      }
      else {
        return next.handle(request);
      }

    } else {
      return next.handle(request);
    }
  }
  logErrors(formId: string) {
    const errors: any[] = [];
    $(`${formId} input, ${formId} select`).each(
      function (index, item) {
        if (!(item as HTMLInputElement).validity.valid) {
          logItemError(item, errors);
        }

        if (typeof $(item).data('date') !== 'undefined') {
          controlValidity(dateRegex, item, errors);
          item.addEventListener("input", function (event) {
            controlValidity(dateRegex, item, errors);
          })
        }

        if (typeof $(item).data('mobile') !== 'undefined') {
          controlValidity(mobileRegex, item, errors);
          item.addEventListener("input", function (event) {
            controlValidity(mobileRegex, item, errors);
          })
        }

        if (typeof $(item).data('national-code') !== 'undefined') {
          controlNationalCodeValidity(item, errors);
          item.addEventListener("input", function (event) {
            controlNationalCodeValidity(item, errors);
          })
        }


      }
    );

    return errors;
  }
}

var mobileRegex = "^(0|0098|\\+98)9(0[1-5]|[1 3]\\d|2[0-2]|98)\\d{7}$";
var dateRegex = "^[12][0-9][0-9][0-9]\/(0[1-9]|1[012])\/(0[1-9]|[12][0-9]|3[01])$";

function controlValidity(regex: string, item: HTMLElement, errors: any[]) {
  let value = $(item).val();
  if (typeof value === 'string' && (value.match(regex) || value == "")) {
    (item as HTMLInputElement).setCustomValidity('');
  } else {
    logItemError(item, errors);
    (item as HTMLInputElement).setCustomValidity('invalid');
  }
}

function controlNationalCodeValidity(item: HTMLElement, errors: any[]) {
  let value = $(item).val();
  if (isValidNationalCode(value) || isValidLegalNationalCode(value) || value == "") {
    (item as HTMLInputElement).setCustomValidity('');
  } else {
    logItemError(item, errors);
    (item as HTMLInputElement).setCustomValidity('invalid');
  }
}

function logItemError(item: HTMLElement, errors: any[]) {
  const itemId = $(item).attr('id');
  const label = $(`label[for='${itemId}']`);
  var outerText = label[0].outerText.replace("*", "");
  if (!errors.includes(outerText)) {
    errors.push(outerText);
  }

}

function isValidLegalNationalCode(nationalCode: any) {
  if (nationalCode.length != 11)
    return false;

  return true;
}
