import { Component, EventEmitter, HostBinding, Input, OnInit, Output } from '@angular/core';
import { Location } from '@angular/common';
import { Router, UrlSerializer } from '@angular/router';

@Component({
  selector: 'app-report-widget',
  standalone: true,
  template: `
          <div class="widget-bg-color-icon card" (click)="clicked()">
            <div class="card-body custom-card">
                <div class="align-items-center flex-column d-flex">
                    <div class="avatar-md rounded-circle {{color}}">
                        <i class="fas {{icon}} font-24 avatar-title text-center" style="margin-top: 10px;"></i>
                    </div>
                    <div class="media-body text-right align-self-center mt-2 text-center">
                        <p class="font-weight-bolder mb-0"> {{name}} </p>
                    </div>
                </div>
            </div>
          </div>`
})
export class ReportWidgetComponent implements OnInit {

  @Input() icon!: string;
  @Input() link!: string;
  @Input() name!: string;
  @Input() color!: string;
  @Input() type: number = 0;
  @Output() event: EventEmitter<any> = new EventEmitter();

  @HostBinding('class.col-lg-3') public lg: boolean = true;
  @HostBinding('class.col-md-4') public md: boolean = true;
  @HostBinding('class.col-sm-6') public sm: boolean = true;

  constructor(
    private readonly router: Router,
    private _urlSerializer: UrlSerializer,
    private _location: Location) { }

  ngOnInit(): void { }

  clicked() {
    if (this.type) {
      this.event.emit(this.type);
    } else {
      this.navigateTo();
    }
  }

  navigateTo() {
    const tree = this.router.createUrlTree([this.link]);
    const url = this._location.prepareExternalUrl(this._urlSerializer.serialize(tree));
    window.open(url, '_blank');
  }
}