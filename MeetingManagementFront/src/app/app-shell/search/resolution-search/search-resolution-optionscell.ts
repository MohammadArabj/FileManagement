import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { NgStyle } from '@angular/common';
import { Component, TemplateRef, ViewChild, ViewContainerRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
    selector: 'app-resolution-search-options-cell',
    standalone: true,
    imports: [NgStyle],
    template: `
    <button type="button" class="btn btn-sm btn-action dropdown-toggle" (click)="toggleMenu($event)">
      <i class="fa fa-cog me-1"></i>
    </button>

    <ng-template #menuTemplate>
      <ul class="dropdown-menu show" [ngStyle]="menuStyle">
        <li>
          <a (click)="viewMeeting()" class="dropdown-item d-flex align-items-center">
            <i style="margin-left:10px" class="fa fa-edit text-info scaleX-n1-rtl"></i>
            مشاهده جلسه
          </a>
        </li>
        <li>
          <a (click)="viewResolution()" class="dropdown-item d-flex align-items-center">
            <i style="margin-left:10px" class="fa fa-print text-primary scaleX-n1-rtl"></i>
            چاپ مصوبه
          </a>
        </li>
      </ul>
    </ng-template>
  `,
})
export class SearchResolutionSearchOptionsCellComponent {
    public type: string | null = null;
    params: any;
    static activeOverlayRef: OverlayRef | null = null;

    overlayRef: OverlayRef | null = null;
    menuStyle: any = {};

    @ViewChild('menuTemplate') menuTemplate!: TemplateRef<any>;

    constructor(
        private overlay: Overlay,
        private viewContainerRef: ViewContainerRef,
        private activatedRoute: ActivatedRoute
    ) {
        this.activatedRoute.queryParamMap.subscribe(params => {
            this.type = params.get('type');
        });
    }

    agInit(params: any): void {
        this.params = params;
    }

    toggleMenu(event: MouseEvent) {
        // بستن منوی قبلی اگر باز باشد
        if (SearchResolutionSearchOptionsCellComponent.activeOverlayRef) {
            SearchResolutionSearchOptionsCellComponent.activeOverlayRef.dispose();
            SearchResolutionSearchOptionsCellComponent.activeOverlayRef = null;
        }

        // اگر همان منو کلیک شد، دیگر باز نکن
        if (this.overlayRef) {
            this.closeMenu();
            return;
        }

        const positionStrategy = this.overlay.position()
            .flexibleConnectedTo(event.target as HTMLElement)
            .withPositions([
                { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top' }
            ]);

        this.overlayRef = this.overlay.create({ positionStrategy });
        const portal = new TemplatePortal(this.menuTemplate, this.viewContainerRef);
        this.overlayRef.attach(portal);

        // ذخیره مرجع منوی باز شده
        SearchResolutionSearchOptionsCellComponent.activeOverlayRef = this.overlayRef;

        // اضافه کردن لیسنر برای کلیک در بیرون از منو
        document.addEventListener('click', this.onClickOutside.bind(this), true);
    }

    closeMenu() {
        if (this.overlayRef) {
            this.overlayRef.dispose();
            this.overlayRef = null;
            SearchResolutionSearchOptionsCellComponent.activeOverlayRef = null;
        }

        // حذف لیسنر کلیک بیرونی
        document.removeEventListener('click', this.onClickOutside.bind(this), true);
    }

    onClickOutside(event: Event) {
        if (this.overlayRef && !this.overlayRef.overlayElement.contains(event.target as Node)) {
            this.closeMenu();
        }
    }

    viewMeeting() {
        if (this.params?.data?.meetingGuid) {
            this.params.context.componentParent.viewMeeting(this.params.data.meetingGuid);
        }
        this.closeMenu();
    }

    viewResolution() {
        if (this.params?.data?.id) {
            // فراخوانی متد viewResolution که اکنون چاپ را نمایش می‌دهد
            this.params.context.componentParent.viewResolution(this.params.data.id);
        }
        this.closeMenu();
    }
}