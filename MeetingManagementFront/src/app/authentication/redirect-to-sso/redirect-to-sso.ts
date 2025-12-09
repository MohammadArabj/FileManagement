import { Component, OnInit } from '@angular/core';
import { CodeFlowService } from '../../services/framework-services/code-flow.service';

@Component({
  selector: 'app-redirect-to-sso',
  templateUrl: './redirect-to-sso.html'
})
export class RedirectToSsoComponent implements OnInit {

  constructor(private readonly codeFlowService: CodeFlowService) { }

  ngOnInit() {
    this.codeFlowService.startAuthentication()
  }
}