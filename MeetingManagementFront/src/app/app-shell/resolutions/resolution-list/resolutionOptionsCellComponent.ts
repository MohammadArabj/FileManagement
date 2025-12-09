import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { Component, ElementRef, TemplateRef, ViewChild, ViewContainerRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { LocalStorageService } from '../../../services/framework-services/local.storage.service';
import { PasswordFlowService } from '../../../services/framework-services/password-flow.service';
import { NgStyle } from '@angular/common';

@Component({
  selector: 'app-assignment-options-cell',
  standalone: true,
  imports: [NgStyle],
  template: `
    <button type="button" class="btn btn-sm btn-action dropdown-toggle" (click)="toggleMenu($event)">
      <i class="fa fa-cog me-1"></i>
    </button>

    <ng-template #menuTemplate>
      <ul class="dropdown-menu show simplified-menu" [ngStyle]="menuStyle">
    <li><a (click)="openManagementModal()" class="dropdown-item d-flex align-items-center">
          <i style="margin-left:10px" class="fa fa-tasks text-primary scaleX-n1-rtl"></i>
{{this.params.data.isFollower?"جزئیات اقدام":"جزئیات پیگیری"}}
        </a></li>
        
        @if(canPerformAction){
        <li><a (click)="changeStatus()" class="dropdown-item d-flex align-items-center">
          <i style="margin-left:10px" class="fa fa-check-circle text-success scaleX-n1-rtl"></i>
          {{this.params.data.isFollower?"پایان پیگیری":"پایان اقدام"}}
        </a></li>
        }
      </ul>
    </ng-template>
  `,
  styles: [`
    .simplified-menu {
      min-width: 200px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      border: 1px solid #e9ecef;
      padding: 8px 0;
    }

    .simplified-menu .dropdown-item {
      padding: 12px 16px;
      font-size: 0.9rem;
      color: #495057;
      transition: all 0.2s ease;
      border: none;
      background: none;
    }

    .simplified-menu .dropdown-item:hover {
      background-color: #f8f9fa;
      color: #007bff;
      transform: translateX(-2px);
    }

    .simplified-menu .dropdown-item i {
      font-size: 1rem;
      width: 20px;
      text-align: center;
    }

    
  `]
})
export class AssignmentOptionsCellComponent {
  public type: string | null = null;
  params: any;
  static activeOverlayRef: OverlayRef | null = null;

  overlayRef: OverlayRef | null = null;
  menuStyle: any = {};

  @ViewChild('menuTemplate') menuTemplate!: TemplateRef<any>;
  canPerformAction: boolean = false;

  constructor(
    private overlay: Overlay,
    private viewContainerRef: ViewContainerRef,
    private activatedRoute: ActivatedRoute,
    private readonly localStorageService: LocalStorageService,
    private readonly passwordFlowService: PasswordFlowService,
  ) {
    this.activatedRoute.queryParamMap.subscribe(params => {
      this.type = params.get('type');
    });

    this.checkPermissions().then((permissions) => {
      this.canPerformAction = permissions.canPerformAction;
    });
  }

  agInit(params: any): void {
    this.params = params;
  }

  toggleMenu(event: MouseEvent) {
    if (AssignmentOptionsCellComponent.activeOverlayRef) {
      AssignmentOptionsCellComponent.activeOverlayRef.dispose();
      AssignmentOptionsCellComponent.activeOverlayRef = null;
    }

    if (this.overlayRef) {
      this.closeMenu();
      return;
    }

    const positionStrategy = this.overlay.position()
      .flexibleConnectedTo(event.target as HTMLElement)
      .withPositions([{ originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top' }]);

    this.overlayRef = this.overlay.create({ positionStrategy });
    const portal = new TemplatePortal(this.menuTemplate, this.viewContainerRef);
    this.overlayRef.attach(portal);

    AssignmentOptionsCellComponent.activeOverlayRef = this.overlayRef;

    document.addEventListener('click', this.onClickOutside.bind(this), true);
  }

  closeMenu() {
    if (this.overlayRef) {
      this.overlayRef.dispose();
      this.overlayRef = null;
      AssignmentOptionsCellComponent.activeOverlayRef = null;
    }

    document.removeEventListener('click', this.onClickOutside.bind(this), true);
  }

  onClickOutside(event: Event) {
    if (this.overlayRef && !this.overlayRef.overlayElement.contains(event.target as Node)) {
      this.closeMenu();
    }
  }

  async checkPermissions() {
    var isPermitted = false;
    var checkPermission = await this.passwordFlowService.checkPermission('MT_Followups');
    if (!checkPermission) {
      isPermitted = false;
    } else {
      isPermitted = true;
    }

    let canPerformAction = false;

    if (this.params?.data) {
      if (this.params.data.isFollower) {
        canPerformAction = this.params.data.followStatusId !== 3 && isPermitted;
      } else {
        canPerformAction = this.params.data.status !== 4 && isPermitted;
      }
    }

    return {
      canPerformAction
    };
  }

  changeStatus() {
    this.params.context.componentParent.changeStatus(this.params.data.id, this.params.data.isFollower);
    this.closeMenu();
  }

  openManagementModal() {
    this.params.context.componentParent.openAssignmentManagement(this.params.data);
    this.closeMenu();
  }
}