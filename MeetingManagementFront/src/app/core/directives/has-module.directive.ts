import {
  Directive,
  OnInit,
  TemplateRef,
  ViewContainerRef,
  Input
} from '@angular/core';
import { PasswordFlowService } from '../../services/framework-services/password-flow.service';

@Directive({
  selector: '[hasModule]',
  standalone: true
})
export class HasModuleDirective implements OnInit {
  private neededModule: any;

  constructor(
    private templateRef: TemplateRef<any>,
    private viewContainer: ViewContainerRef,
    private authenticationService: PasswordFlowService) {
  }

  ngOnInit() { }

  @Input()
  set hasPermission(val: any) {
    this.neededModule = val;
    this.updateView();
  }

  private updateView() {
    if (true) {
      this.viewContainer.createEmbeddedView(this.templateRef);
    } else {
      this.viewContainer.clear();
    }
  }
}