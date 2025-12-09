import { inject } from '@angular/core';
import { CodeFlowService } from '../../services/framework-services/code-flow.service';
import { USER_CURRENT_ACTIVE_SESSION_NAME } from '../types/configuration';
import { LocalStorageService } from '../../services/framework-services/local.storage.service';
import { PasswordFlowService } from '../../services/framework-services/password-flow.service';
import { UserService } from '../../services/user.service';
import { environment } from '../../../environments/environment';
import { map, catchError, of } from 'rxjs';
export const sessionGuard = () => {
    const passwordFlowService = inject(PasswordFlowService);
    const codeFlowService = inject(CodeFlowService);
    const userService = inject(UserService);
    const localStorageService = inject(LocalStorageService);

    const searchModel = {
        sessionGuid: localStorageService.getItem(USER_CURRENT_ACTIVE_SESSION_NAME)
    };

    return userService.hasActiveSession(searchModel).pipe(
        map(data => {
            if (data.isActive) {
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
            if (environment.ssoAuthenticationFlow === 'code') {
                codeFlowService.logout();
            } else {
                passwordFlowService.logout();
            }

            return of(false);
        })
    );
};

