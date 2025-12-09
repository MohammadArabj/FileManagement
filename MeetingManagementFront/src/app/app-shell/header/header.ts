// header.component.ts
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { environment } from '../../../environments/environment';
import { CodeFlowService, getClientSettings } from '../../services/framework-services/code-flow.service';
import { PasswordFlowService } from '../../services/framework-services/password-flow.service';
import { SidebarService } from '../../services/framework-services/sidebar.service';
import { DelegationService } from '../../services/delegation.service';
import { LocalStorageService } from '../../services/framework-services/local.storage.service';
import { UserService } from '../../services/user.service';
import { PermissionService } from '../../services/permission.service';
import {
  IsDeletage,
  ISSP,
  Main_USER_ID,
  PERMISSIONS_NAME,
  POSITION_ID,
  POSITION_NAME,
  USER_CLASSIFICATION_LEVEL_ID_NAME,
  USER_COMPANY_ID_NAME,
  USER_ID_NAME,
  USER_ORGANIZATION_CHART_ID_NAME
} from '../../core/types/configuration';

interface UserInformation {
  fullname: string;
  companyTitle: string;
  organizationChartTitle: string;
  classificationLevel: string;
  needChangePassword: boolean;
  companyGuid: string;
  organizationChartGuid: string;
  userName: string;
  classificationLevelGuid?: string;
}

interface Delegation {
  positionGuid: string;
  userGuid: string;
  position: string;
  userName: string;
  id: string;
  isDelegate: boolean;
  isSuperAdmin: boolean;
}

@Component({
  selector: 'app-header',
  templateUrl: './header.html',
  styleUrls: ['./header.css'],
  standalone: true,
  imports: [CommonModule]
})
export class HeaderComponent implements OnInit {
  // Injected services
  private readonly router = inject(Router);
  private readonly passwordFlowService = inject(PasswordFlowService);
  private readonly codeFlowService = inject(CodeFlowService);
  private readonly sidebarService = inject(SidebarService);
  private readonly delegationService = inject(DelegationService);
  private readonly localStorageService = inject(LocalStorageService);
  private readonly userService = inject(UserService);
  private readonly permissionService = inject(PermissionService);

  // State signals
  currentDate = signal<string>('');
  currentTime = signal<string>('');
  currentDay = signal<string>('');
  isRoleSwitcherOpen = signal<boolean>(false);
  position = signal<string>('');
  selectedDelegation = signal<string>('');
  isDelegate = signal<boolean>(false);
  delegations = signal<Delegation[]>([]);
  information = signal<UserInformation>({
    fullname: '',
    companyTitle: '',
    organizationChartTitle: '',
    classificationLevel: '',
    needChangePassword: false,
    companyGuid: '',
    organizationChartGuid: '',
    userName: ''
  });

  // Computed signals
  readonly fileManagementUrl = computed(() => {
    const userName = this.information().userName;
    return userName ? `${environment.fileManagementEndpoint}/photo/${userName}.jpg` : 'assets/img/default-avatar.png';
  });

  readonly hasMultipleDelegations = computed(() => {
    return this.delegations().length > 1;
  });

  ngOnInit(): void {
    this.initializeFromStorage();
    this.loadUserInformation();
    this.updateDateTime();
    setInterval(() => this.updateDateTime(), 1000);

    // بستن dropdown با کلیک خارج از آن
    document.addEventListener('click', (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.role-switcher')) {
        this.isRoleSwitcherOpen.set(false);
      }
    });
  }

  private initializeFromStorage(): void {
    const positionName = this.localStorageService.getItem(POSITION_NAME);
    const positionGuid = this.localStorageService.getItem(POSITION_ID);
    const isDelegateStr = this.localStorageService.getItem(IsDeletage);

    if (positionName) this.position.set(positionName);
    if (positionGuid) this.selectedDelegation.set(positionGuid);
    this.isDelegate.set(isDelegateStr === 'true');
  }

  private loadUserInformation(): void {
    const userGuid = this.localStorageService.getItem(USER_ID_NAME);
    if (!userGuid) return;

    this.userService.getUserInformation(userGuid).subscribe({
      next: (result: UserInformation) => {
        this.information.set(result);
        this.localStorageService.setItem(USER_COMPANY_ID_NAME, result.companyGuid);
        this.localStorageService.setItem(USER_ORGANIZATION_CHART_ID_NAME, result.organizationChartGuid);
        if (result.classificationLevelGuid) {
          this.localStorageService.setItem(USER_CLASSIFICATION_LEVEL_ID_NAME, result.classificationLevelGuid);
        }
        this.loadDelegations(userGuid);
      },
      error: (error) => console.error('Error loading user information:', error)
    });
  }

  private loadDelegations(userId: string): void {
    const positionGuid = this.localStorageService.getItem(POSITION_ID);
    const request = { userGuid: userId, positionGuid: positionGuid };

    this.delegationService.getActiveDelegationsForDelegatee(request).subscribe({
      next: (delegations: any) => {
        this.delegations.set(Array.isArray(delegations) && delegations.length > 1 ? delegations : []);
      },
      error: (error) => {
        console.error('Error loading delegations:', error);
        this.delegations.set([]);
      }
    });
  }

  updateDateTime(): void {
    const now = new Date();
    this.currentDate.set(now.toLocaleDateString('fa-IR'));
    this.currentTime.set(now.toLocaleTimeString('fa-IR', {
      hour: '2-digit',
      minute: '2-digit'
    }));
    this.currentDay.set(now.toLocaleDateString('fa-IR', { weekday: 'long' }));
  }

  toggle(): void {
    this.sidebarService.toggleSidebar();
  }

  toggleRoleSwitcher(): void {
    this.isRoleSwitcherOpen.update(open => !open);
  }

  switchAccount(item: Delegation): void {
    this.selectedDelegation.set(item.positionGuid);
    this.position.set(item.position);
    this.isDelegate.set(item.isDelegate);
    this.isRoleSwitcherOpen.set(false);

    // Update localStorage
    this.localStorageService.setItem(USER_ID_NAME, item.userGuid);
    this.localStorageService.setItem(POSITION_ID, item.positionGuid);
    this.localStorageService.setItem(POSITION_NAME, item.position);
    this.localStorageService.setItem(IsDeletage, item.isDelegate.toString());
    this.localStorageService.setItem(ISSP, item.isSuperAdmin.toString());

    this.getPermissions(item.positionGuid, item.id, item.isDelegate);
  }

  private getPermissions(positionGuid: string, delegationId: string, isDelegate: boolean): void {
    if (isDelegate) {
      const request = {
        delegationId: delegationId,
        clientId: getClientSettings().client_id
      };

      this.delegationService.getDelegationPermissions(request).subscribe({
        next: permissions => this.updatePermissionsAndNavigate(permissions),
        error: () => this.codeFlowService.logout(),
      });
    } else {
      this.permissionService.getPositionPermissions(positionGuid).subscribe({
        next: permissions => this.updatePermissionsAndNavigate(permissions),
        error: () => this.codeFlowService.logout(),
      });
    }
  }

  private updatePermissionsAndNavigate(permissions: any): void {
    this.localStorageService.removeItem(PERMISSIONS_NAME);
    this.localStorageService.setItem(PERMISSIONS_NAME, permissions);
    this.router.navigateByUrl('/dashboard');
    location.reload();
  }

  logout(): void {
    if (environment.ssoAuthenticationFlow === 'code') {
      this.codeFlowService.logout();
    } else {
      this.passwordFlowService.logout();
    }
  }

  redirectToGrants(): void {
    window.location.href = `${environment.identityEndpoint}/grants/index`;
  }

  onImageError(event: Event): void {
    (event.target as HTMLImageElement).src = 'img/default-avatar.png';
  }
}