import {
  Directive,
  OnInit,
  TemplateRef,
  ViewContainerRef,
  Input
} from '@angular/core';
import { PasswordFlowService } from '../../services/framework-services/password-flow.service';

@Directive({
  selector: '[hasPermission]',
  standalone: true
})
export class HasPermissionDirective implements OnInit {
  private neededPermission!: string;

  constructor(
    private templateRef: TemplateRef<any>,
    private viewContainer: ViewContainerRef,
    private authenticationService: PasswordFlowService) {
  }

  ngOnInit() { }

  @Input()
  set hasPermission(val: any) {
    this.neededPermission = val;
    this.updateView();
  }

  private async updateView() {
    if (this.authenticationService.hasNoAnyPermissions()) this.viewContainer.clear;
    if (await this.authenticationService.checkPermission(this.neededPermission)) {
      this.viewContainer.createEmbeddedView(this.templateRef);
    } else {
      this.viewContainer.clear();
    }
  }
}