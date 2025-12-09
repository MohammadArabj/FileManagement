import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CodeFlowService, getClientSettings } from '../../services/framework-services/code-flow.service';
import { USER_ID_NAME, ROLE_TOKEN_NAME, ACCESS_TOKEN_NAME, USER_CURRENT_ACTIVE_SESSION_NAME, PERMISSIONS_NAME, POSITION_ID, POSITION_NAME, IsDeletage, Main_USER_ID } from '../../core/types/configuration';
import { IdentityService } from '../../services/framework-services/identity.service';
import { LocalStorageService } from '../../services/framework-services/local.storage.service';
import { PermissionService } from '../../services/permission.service';
import { UserService } from '../../services/user.service';
import { DelegationService } from '../../services/delegation.service';
import { NgFor, NgIf } from '@angular/common';

@Component({
  selector: 'app-challenge',
  templateUrl: './challenge.html',
  standalone: true
})
export class ChallengeComponent implements OnInit {
  delegations: any[] = [];
  selectedDelegationId!: string;
  constructor(
    private readonly router: Router,
    private readonly codeFlowService: CodeFlowService,
    private readonly userService: UserService,
    private readonly identityService: IdentityService,
    private readonly delegationService: DelegationService,
    private readonly localStorageService: LocalStorageService,
    private readonly permissionService: PermissionService) { }

  ngOnInit() {
    this.codeFlowService
      .completeAuthentication()
      .then(data => {
        this.localStorageService.setItem(USER_ID_NAME, this.codeFlowService.user?.profile['id'] ?? '');
        this.localStorageService.setItem(POSITION_ID, this.codeFlowService.user?.profile['activatedPosition'])
        this.localStorageService.setItem(POSITION_NAME, this.codeFlowService.user?.profile['positionTitle'])
        this.localStorageService.setItem(ROLE_TOKEN_NAME, this.codeFlowService.user?.profile['position']);
        this.localStorageService.setItem(ACCESS_TOKEN_NAME, this.codeFlowService.user?.access_token ?? '');
        this.localStorageService.setItem(Main_USER_ID, this.codeFlowService.user?.profile['id'] ?? '');
        this.localStorageService.setItem(IsDeletage, this.codeFlowService.user?.profile['isDelegate'] ?? '');
        this.getUserPermissions(this.codeFlowService.user?.profile['delegationId']);

      })

  }

  getUserPermissions(delegationId: any) {
    const positionGuid = this.localStorageService.getItem(POSITION_ID);
    const isDelegate = this.localStorageService.getItem(IsDeletage) === 'true';

    this.userService
      .getCurrentSession()
      .subscribe(data => {
        if (!data.sessionGuid) this.codeFlowService.logout()
        this.localStorageService.setItem(USER_CURRENT_ACTIVE_SESSION_NAME, data.sessionGuid)
        if (isDelegate) {
          const request = {
            delegationId: delegationId,
            clientId: getClientSettings().client_id
          };
          this.delegationService.getDelegationPermissions(request).subscribe({
            next: permissions => {
              this.localStorageService.removeItem(PERMISSIONS_NAME);
              this.localStorageService.setItem(PERMISSIONS_NAME, permissions);
              this.router.navigateByUrl('/dashboard');
              //location.reload();
            },
            error: () => this.codeFlowService.logout(),
          });
        }
        else {

          this.permissionService
            .getPositionPermissions(positionGuid)
            .subscribe({
              next: permissions => {
                this.localStorageService.removeItem(PERMISSIONS_NAME);
                this.localStorageService.setItem(PERMISSIONS_NAME, permissions)
                this.router.navigateByUrl('/dashboard');
                //location.reload();

              },
              error: () => this.codeFlowService.logout(),
            })
        }

      })
  }



}
