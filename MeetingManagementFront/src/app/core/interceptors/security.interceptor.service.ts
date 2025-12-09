import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpResponse, HttpErrorResponse } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable, tap } from "rxjs";
import { environment } from "../../../environments/environment";
import { CodeFlowService, getClientSettings } from "../../services/framework-services/code-flow.service";
import { PasswordFlowService } from "../../services/framework-services/password-flow.service";

@Injectable()
export class SecurityInterceptor implements HttpInterceptor {
  constructor(
    private readonly passwordFlowService: PasswordFlowService,
    private readonly codeFlowService: CodeFlowService) { }

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (request.headers.has('skip'))
      return next.handle(request)

    let token = ''
    if (environment.ssoAuthenticationFlow = 'code') {
      token = this.codeFlowService.getToken()
      if (!token)
        this.codeFlowService.logout();
    }
    else {
      token = this.passwordFlowService.getToken();
      if (!token)
        this.passwordFlowService.logout();
    }
    const clientId = getClientSettings().client_id;
    request = request.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
        'Client-Id': clientId ?? ""
      },
      responseType: 'json'
    });

    return next.handle(request).pipe(tap(
      {
        next: event => {
          if (event instanceof HttpResponse) { }
        },
        error: err => {
          if (err instanceof HttpErrorResponse) {
            if (err.status === 401 ||
              err.status === 402 ||
              err.status === 403) {
              if (environment.ssoAuthenticationFlow == 'code') {
                this.codeFlowService.logout()
              } else {
                this.passwordFlowService.logout()
              }
            }
          }
        }
      }
    ));
  }
}
