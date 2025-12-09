import { Component, inject, signal, computed, effect, OnInit } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { LocalStorageService } from '../../services/framework-services/local.storage.service';
import { SettingService } from '../../services/framework-services/setting.service';
import { ToastService } from '../../services/framework-services/toast.service';

@Component({
  selector: 'app-app-shared-data',
  standalone: true,
  templateUrl: './app-shared-data.html'
})
export class AppSharedDataComponent implements OnInit {
  // Signals for reactive state management
  public currentDateYm = signal<any>(null);
  public currentCompanyGuid = signal<any>(null);
  public someGlobalSetting = signal<any>(null);

  // Inject services using modern inject() function
  protected readonly localStorageService = inject(LocalStorageService);
  protected readonly toastService = inject(ToastService);
  protected readonly settingService = inject(SettingService);

  // Computed signals for derived state
  public isSettingLoaded = computed(() => this.someGlobalSetting() !== null);

  ngOnInit(): void {
    //this.loadGlobalSettings();
  }

  private loadGlobalSettings(): void {
    // Load settings using signals
    const setting = this.settingService.getSettingValue("Public_UseSecondlanguage");
    this.someGlobalSetting.set(setting);
  }

  // Form utility methods (keeping them as they are still useful)
  getFormValue(form: FormGroup, controlName: string): any {
    const control = form.get(controlName);
    return control?.value ?? null;
  }

  setFormValue(form: FormGroup, controlName: string, value: any): void {
    const control = form.get(controlName);
    if (control) {
      control.setValue(value);
    }
  }

  disableFormControl(form: FormGroup, controlName: string): void {
    const control = form.get(controlName);
    control?.disable();
  }

  enableFormControl(form: FormGroup, controlName: string): void {
    const control = form.get(controlName);
    control?.enable();
  }

  // Modern DOM manipulation methods (replacing jQuery)
  hideElement(selector: string): void {
    const element = document.querySelector(selector);
    if (element) {
      element.classList.add('d-none');
    }
  }

  showElement(selector: string): void {
    const element = document.querySelector(selector);
    if (element) {
      element.classList.remove('d-none');
    }
  }

  // New method to replace jQuery innerHTML changes
  changeElementContent(selector: string, content: string): void {
    const element = document.querySelector(selector);
    if (element) {
      element.innerHTML = content;
    }
  }
}