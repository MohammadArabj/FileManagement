import { inject } from '@angular/core';
import { CodeFlowService, getClientSettings } from '../../services/framework-services/code-flow.service';
import { PasswordFlowService } from '../../services/framework-services/password-flow.service';
import { UserService } from '../../services/user.service';
import { environment } from '../../../environments/environment';
import { catchError, map, of } from 'rxjs';

export const clientAccessGuard = () => {
  const passwordFlowService = inject(PasswordFlowService);
  const codeFlowService = inject(CodeFlowService);
  const userService = inject(UserService);

  return userService.hasClientAccess(getClientSettings().client_id).pipe(
    map(data => {
      if (data.hasAccess) {
        return true;
      }

      if (environment.ssoAuthenticationFlow === 'code') {
        codeFlowService.logout();
      } else {
        passwordFlowService.logout();
      }

      return false;
    }),
    catchError(() => {
      // در صورت خطا هم بهتره logout کنیم
      if (environment.ssoAuthenticationFlow === 'code') {
        codeFlowService.logout();
      } else {
        passwordFlowService.logout();
      }
      return of(false);
    })
  );
};
