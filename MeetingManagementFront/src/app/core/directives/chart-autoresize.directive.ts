import {
  Directive,
  ElementRef,
  OnDestroy,
  AfterViewInit
} from '@angular/core';

@Directive({
  selector: '[appChartAutoResize]',
  standalone: true
})
export class ChartAutoResizeDirective implements AfterViewInit, OnDestroy {
  private observer!: IntersectionObserver;

  constructor(private el: ElementRef) {}

  ngAfterViewInit(): void {
    this.observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        // یکم صبر کنیم تا چارت واقعاً mount بشه
        setTimeout(() => {
          const chartEl = this.el.nativeElement.querySelector('.apexcharts-canvas');
          if (chartEl) {
            window.dispatchEvent(new Event('resize'));
            this.observer.disconnect(); // فقط یک بار اجرا بشه
          } else {
            // اگه چارت هنوز نساخته شده بود، دوباره تلاش کنیم
            setTimeout(() => window.dispatchEvent(new Event('resize')), 200);
          }
        }, 200);
      }
    }, {
      root: null,
      threshold: 0.1
    });

    this.observer.observe(this.el.nativeElement);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
