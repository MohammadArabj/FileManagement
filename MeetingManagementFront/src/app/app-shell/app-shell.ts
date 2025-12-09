import { AfterViewInit, Component, inject, Renderer2 } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SwalService } from '../services/framework-services/swal.service';
import { BreadcrumbComponent } from './breadcrumb/breadcrumb';
import { HeaderComponent } from './header/header';
import { SidebarComponent } from './sidebar/sidebar';
import { SidebarService } from '../services/framework-services/sidebar.service';

@Component({
  selector: 'app-app-shell',
  imports: [SidebarComponent, HeaderComponent, BreadcrumbComponent, RouterOutlet],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.css',
  standalone: true
})
export class AppShellComponent implements AfterViewInit {
  readonly sidebar = inject(SidebarService);

  // @HostListener('window:beforeunload', ['$event'])
  // handleBeforeUnload(event: BeforeUnloadEvent) {
  //   // مثلا خروج از سیستم یا پاک کردن session
  //   console.log('در حال خروج از برنامه');

  //   // اگر می‌خواهی از کاربر تایید بگیری:
  //   event.preventDefault();
  //   event.returnValue = ''; // برای نمایش دیالوگ پیش‌فرض مرورگر
  // }
  constructor(
    private renderer: Renderer2) { }
  ngAfterViewInit() {
    this.loadScripts([
      'js/main.js'
    ]);
  }

  private loadScripts(scripts: string[]): void {
    scripts.forEach(src => {
      const script = this.renderer.createElement('script');
      script.src = src;
      script.type = 'text/javascript';
      script.defer = true;
      this.renderer.appendChild(document.body, script);
    });
  }
}
