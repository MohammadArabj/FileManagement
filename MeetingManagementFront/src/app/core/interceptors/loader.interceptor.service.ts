import { Injectable } from '@angular/core'
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor, HttpResponse } from '@angular/common/http'
import { Observable } from 'rxjs'
import { tap } from 'rxjs/operators'
declare var $: any

@Injectable()
export class LoaderInterceptor implements HttpInterceptor {
  constructor() { }

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (request.headers.get("loading") == "true") {
      $(".loading-overlay").removeClass("d-none")
    }
    return next.handle(request).pipe(tap(event => {
      if (event instanceof HttpResponse) {
        $(".loading-overlay").addClass("d-none")
      }
    }, (err: any) => {
      $(".loading-overlay").addClass("d-none")
    }))
  }
}
