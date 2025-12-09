// challenge.guard.ts
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { map, catchError, switchMap } from 'rxjs/operators';
import { from, of } from 'rxjs';
import { DelegationService } from '../../services/delegation.service';
import { CodeFlowService } from '../../services/framework-services/code-flow.service';
import { IdentityService } from '../../services/framework-services/identity.service';
import { LocalStorageService } from '../../services/framework-services/local.storage.service';
import { PermissionService } from '../../services/permission.service';
import { UserService } from '../../services/user.service';
import { USER_ID_NAME, PERMISSIONS_NAME, POSITION_ID, POSITION_NAME, ROLE_TOKEN_NAME, ACCESS_TOKEN_NAME, Main_USER_ID, IsDeletage, USER_CURRENT_ACTIVE_SESSION_NAME } from '../types/configuration';

export const challengeGuard = () => {
  const router = inject(Router);
  const codeFlowService = inject(CodeFlowService);
  const userService = inject(UserService);
  const identityService = inject(IdentityService);
  const delegationService = inject(DelegationService);
  const localStorageService = inject(LocalStorageService);
  const permissionService = inject(PermissionService);

  // بررسی اینکه آیا کاربر از SSO آمده و نیاز به Challenge دارد یا نه
  const needsChallenge = checkIfNeedsChallenge();
  
  if (needsChallenge) {
    return from(performChallenge()).pipe(
      switchMap(obs => obs),
      map(() => true),
      catchError(() => {
        codeFlowService.logout();
        return of(false);
      })
    );
  }

  return true;
};

function checkIfNeedsChallenge(): boolean {
  const localStorageService = inject(LocalStorageService);
  const codeFlowService = inject(CodeFlowService);
  
  // بررسی اینکه آیا کاربر تازه لاگین کرده یا نه
  // می‌توانید از query parameter یا session storage استفاده کنید
  const urlParams = new URLSearchParams(window.location.search);
  const hasAuthCode = urlParams.has('code') || urlParams.has('state');
  
  // یا بررسی اینکه آیا اطلاعات کاربر کامل است یا نه
  const hasCompleteUserData = localStorageService.getItem(USER_ID_NAME) && 
                              localStorageService.getItem(PERMISSIONS_NAME);
  
  return hasAuthCode || !hasCompleteUserData;
}

function performChallenge() {
  const codeFlowService = inject(CodeFlowService);
  const userService = inject(UserService);
  const localStorageService = inject(LocalStorageService);
  const permissionService = inject(PermissionService);

  return codeFlowService.completeAuthentication().then(data => {
    // ذخیره اطلاعات کاربر
    localStorageService.setItem(USER_ID_NAME, codeFlowService.user?.profile['id'] ?? '');
    localStorageService.setItem(POSITION_ID, codeFlowService.user?.profile['activatedPosition']);
    localStorageService.setItem(POSITION_NAME, codeFlowService.user?.profile['positionTitle']);
    localStorageService.setItem(ROLE_TOKEN_NAME, codeFlowService.user?.profile['position']);
    localStorageService.setItem(ACCESS_TOKEN_NAME, codeFlowService.user?.access_token ?? '');
    localStorageService.setItem(Main_USER_ID, codeFlowService.user?.profile['id'] ?? '');
    localStorageService.setItem(IsDeletage, false.toString());

    return getUserPermissions();
  });
}

function getUserPermissions() {
  const localStorageService = inject(LocalStorageService);
  const userService = inject(UserService);
  const permissionService = inject(PermissionService);
  const codeFlowService = inject(CodeFlowService);

  const positionGuid = localStorageService.getItem(POSITION_ID);

  return userService.getCurrentSession().pipe(
    switchMap(data => {
      if (!data.sessionGuid) {
        codeFlowService.logout();
        throw new Error('No session');
      }
      
      localStorageService.setItem(USER_CURRENT_ACTIVE_SESSION_NAME, data.sessionGuid);
      
      return permissionService.getPositionPermissions(positionGuid);
    }),
    map(permissions => {
      localStorageService.removeItem(PERMISSIONS_NAME);
      localStorageService.setItem(PERMISSIONS_NAME, permissions);
      return true;
    })
  );
}