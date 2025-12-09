import { Component, input, output, signal, computed, OnInit, inject, effect, ViewEncapsulation } from '@angular/core';
import { NgSelectComponent, NgSelectModule } from '@ng-select/ng-select';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Observable, of, catchError, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';
import { SelectType } from '../../core/types/configuration';
import { CustomControlComponent } from './custom-control';
import { CommonModule } from '@angular/common';
import { ComboBase } from '../combo-base';

export interface SelectOption {
  guid: string;
  title: string;
  value?: any;
  disabled?: boolean;
  group?: string;
  id?: string;
  name?: string;
}

@Component({
  selector: 'custom-select',
  standalone: true,
  imports: [NgSelectModule, FormsModule, CommonModule],
  template: `
    <div [class]="containerClass()">
      @if (styleType() === 'group') {
        <label [for]="identity()" class="input-group-text">
          {{label()}}
          @if (isRequired()) {
            <span class="text-danger"> *</span>
          }
        </label>
      } @else {
        <label [for]="identity()" class="form-label">
          {{label()}}
          @if (isRequired()) {
            <span class="text-danger"> *</span>
          }
        </label>
      }

      @switch (type()) {
        @case ('simple') {
          <select
            class="form-select {{classInput()}}"
            [id]="identity()"
            [disabled]="isDisabled()"
            [value]="value()"
            (change)="handleSimpleSelect($event)"
            [attr.required]="isRequired() || null"
            [attr.aria-describedby]="hasError() ? identity() + '-error' : null">
            <option value="">{{placeholder() || 'انتخاب کنید'}}</option>
            @for (option of options(); track option.guid) {
              <option [value]="option.guid" [disabled]="option.disabled">
                {{option.title}}
              </option>
            }
          </select>
        }

        @case ('multiple') {
          <ng-select
            class="flex-grow-1"
            [id]="identity()"
            [items]="selectOptions()"
            [multiple]="true"
            bindLabel="title"
            [bindValue]="bindValue()"
            [ngModel]="value()"
            [placeholder]="placeholder() || 'انتخاب کنید'"
            [disabled]="isDisabled()"
            [required]="isRequired()??false"
            [clearable]="clearable()"
            [searchable]="searchable()"
            [loading]="isLoading()"
            [maxSelectedItems]="maxSelectedItems()"
            [appendTo]="appendTo()"
            (ngModelChange)="handleNgSelectChange($event)"
            (open)="handleOpen()"
            (close)="handleClose()"
            (clear)="handleClear()"
            [attr.aria-describedby]="hasError() ? identity() + '-error' : null">

            @if (customOptionTemplate()) {
              @for(option of selectOptions();track $index){
                <ng-template ng-option-tmp let-option="item">
  <ng-container
    [ngTemplateOutlet]="customOptionTemplate()"
    [ngTemplateOutletContext]="{ option: option }">
  </ng-container>
</ng-template>
              }

            }
          </ng-select>
        }

        @case ('select') {
          <ng-select
            class="flex-grow-1"
            [id]="identity()"
            [items]="selectOptions()"
            bindLabel="title"
            [bindValue]="bindValue()"
            [ngModel]="value()"
            [placeholder]="placeholder() || 'انتخاب کنید'"
            [disabled]="isDisabled()"
            [required]="isRequired()??false"
            [clearable]="clearable()"
            [searchable]="searchable()"
            [loading]="isLoading()"
            [appendTo]="appendTo()"
            (ngModelChange)="handleNgSelectChange($event)"
            (open)="handleOpen()"
            (close)="handleClose()"
            (clear)="handleClear()"
            [attr.aria-describedby]="hasError() ? identity() + '-error' : null">
          </ng-select>
        }

        @case ('select-ajax') {
          <ng-select
            class="flex-grow-1"
            [id]="identity()"
            [items]="selectOptions()"
            bindLabel="title"
            [bindValue]="bindValue()"
            [ngModel]="value()"
            [placeholder]="placeholder() || 'انتخاب کنید'"
            [disabled]="isDisabled()"
            [required]="isRequired()??false"
            [searchable]="true"
            [clearable]="clearable()"
            [virtualScroll]="true"
            [loading]="isLoading()"
            [appendTo]="appendTo()"
            (ngModelChange)="handleNgSelectChange($event)"
            (open)="handleOpen()"
            (close)="handleClose()"
            (clear)="handleClear()"
            (typeahead)="handleSearch($event)"
            [attr.aria-describedby]="hasError() ? identity() + '-error' : null">
            @for(option of selectOptions();track $index){
              <option  [value]="option.guid" [disabled]="option.disabled">
              {{option.title}}
            </option>
            }

          </ng-select>
        }
      }

      <ng-content></ng-content>

      @if (helpText()) {
        <div class="form-text">{{helpText()}}</div>
      }

      @if (hasError()) {
        <div [id]="identity() + '-error'" class="invalid-feedback d-block">
          @for (message of errorMessages(); track $index) {
            <div>{{message}}</div>
          }
        </div>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  styles: `
    .ng-select.ng-select-single .ng-select-container {
      height: 39px !important;
    }

    .ng-select.ng-select-opened>.ng-select-container {
      background: #fff;
      border-color: hsl(0, 0%, 70%) #ccc hsl(0, 0%, 85%)
    }

    .ng-select.ng-select-opened>.ng-select-container:hover {
      box-shadow: none
    }

    .ng-select.ng-select-opened>.ng-select-container .ng-arrow {
      top: -2px;
      border-color: rgba(0, 0, 0, 0) rgba(0, 0, 0, 0) #999;
      border-width: 0 5px 5px
    }

    .ng-select.ng-select-opened>.ng-select-container .ng-arrow:hover {
      border-color: rgba(0, 0, 0, 0) rgba(0, 0, 0, 0) #333
    }

    .ng-select.ng-select-opened.ng-select-top>.ng-select-container {
      border-top-right-radius: 0;
      border-top-left-radius: 0
    }

    .ng-select.ng-select-opened.ng-select-right>.ng-select-container {
      border-top-right-radius: 0;
      border-bottom-right-radius: 0
    }

    .ng-select.ng-select-opened.ng-select-bottom>.ng-select-container {
      border-bottom-right-radius: 0;
      border-bottom-left-radius: 0
    }

    .ng-select.ng-select-opened.ng-select-left>.ng-select-container {
      border-top-left-radius: 0;
      border-bottom-left-radius: 0
    }

    .ng-select.ng-select-focused:not(.ng-select-opened)>.ng-select-container {
      border-color: #007eff;
      box-shadow: inset 0 1px 1px rgba(0, 0, 0, .075), 0 0 0 3px rgba(0, 126, 255, .1)
    }

    .ng-select.ng-select-disabled>.ng-select-container {
      background-color: #f9f9f9
    }

    .ng-select .ng-has-value .ng-placeholder {
      display: none
    }

    .ng-select .ng-select-container {
      color: #333;
      background-color: #fff;
      border-radius: 4px;
      border: 1px solid #ccc;
      min-height: 36px;
      align-items: center
    }

    .ng-select .ng-select-container:hover {
      box-shadow: 0 1px 0 rgba(0, 0, 0, .06)
    }

    .ng-select .ng-select-container .ng-value-container {
      align-items: center;
      padding-left: 10px
    }

    [dir=rtl] .ng-select .ng-select-container .ng-value-container {
      padding-right: 10px;
      padding-left: 0
    }

    .ng-select .ng-select-container .ng-value-container .ng-placeholder {
      color: #999
    }

    .ng-select.ng-select-single .ng-select-container {
      height: 36px
    }

    .ng-select.ng-select-single .ng-select-container .ng-value-container .ng-input {
      top: 5px;
      left: 0;
      padding-left: 10px;
      padding-right: 50px
    }

    [dir=rtl] .ng-select.ng-select-single .ng-select-container .ng-value-container .ng-input {
      padding-right: 10px;
      padding-left: 50px
    }

    .ng-select.ng-select-multiple.ng-select-disabled>.ng-select-container .ng-value-container .ng-value {
      background-color: #f9f9f9;
      border: 1px solid hsl(0, 0%, 90%)
    }

    .ng-select.ng-select-multiple.ng-select-disabled>.ng-select-container .ng-value-container .ng-value .ng-value-label {
      padding: 0 5px
    }

    .ng-select.ng-select-multiple .ng-select-container .ng-value-container {
      padding-top: 5px;
      padding-left: 7px
    }

    [dir=rtl] .ng-select.ng-select-multiple .ng-select-container .ng-value-container {
      padding-right: 7px;
      padding-left: 0
    }

    .ng-select.ng-select-multiple .ng-select-container .ng-value-container .ng-value {
      font-size: .9em;
      margin-bottom: 5px;
      color: #333;
      background-color: rgb(234.6, 244.68, 255);
      border-radius: 2px;
      margin-right: 5px
    }

    [dir=rtl] .ng-select.ng-select-multiple .ng-select-container .ng-value-container .ng-value {
      margin-right: 0;
      margin-left: 5px
    }

    .ng-select.ng-select-multiple .ng-select-container .ng-value-container .ng-value.ng-value-disabled {
      background-color: #f9f9f9
    }

    .ng-select.ng-select-multiple .ng-select-container .ng-value-container .ng-value.ng-value-disabled .ng-value-label {
      padding-left: 5px
    }

    [dir=rtl] .ng-select.ng-select-multiple .ng-select-container .ng-value-container .ng-value.ng-value-disabled .ng-value-label {
      padding-left: 0;
      padding-right: 5px
    }

    .ng-select.ng-select-multiple .ng-select-container .ng-value-container .ng-value .ng-value-label {
      display: inline-block;
      padding: 1px 5px
    }

    .ng-select.ng-select-multiple .ng-select-container .ng-value-container .ng-value .ng-value-icon {
      display: inline-block;
      padding: 1px 5px
    }

    .ng-select.ng-select-multiple .ng-select-container .ng-value-container .ng-value .ng-value-icon:hover {
      background-color: rgb(209.1, 231.78, 255)
    }

    .ng-select.ng-select-multiple .ng-select-container .ng-value-container .ng-value .ng-value-icon.left {
      border-right: 1px solid rgb(183.6, 218.88, 255)
    }

    [dir=rtl] .ng-select.ng-select-multiple .ng-select-container .ng-value-container .ng-value .ng-value-icon.left {
      border-left: 1px solid rgb(183.6, 218.88, 255);
      border-right: none
    }

    .ng-select.ng-select-multiple .ng-select-container .ng-value-container .ng-value .ng-value-icon.right {
      border-left: 1px solid rgb(183.6, 218.88, 255)
    }

    [dir=rtl] .ng-select.ng-select-multiple .ng-select-container .ng-value-container .ng-value .ng-value-icon.right {
      border-left: 0;
      border-right: 1px solid rgb(183.6, 218.88, 255)
    }

    .ng-select.ng-select-multiple .ng-select-container .ng-value-container .ng-input {
      padding: 0 0 3px 3px
    }

    [dir=rtl] .ng-select.ng-select-multiple .ng-select-container .ng-value-container .ng-input {
      padding: 0 3px 3px 0
    }

    .ng-select.ng-select-multiple .ng-select-container .ng-value-container .ng-input>input {
      color: #000
    }

    .ng-select.ng-select-multiple .ng-select-container .ng-value-container .ng-placeholder {
      top: 5px;
      padding-bottom: 5px;
      padding-left: 3px
    }

    [dir=rtl] .ng-select.ng-select-multiple .ng-select-container .ng-value-container .ng-placeholder {
      padding-right: 3px;
      padding-left: 0
    }

    .ng-select .ng-clear-wrapper {
      color: #999
    }

    .ng-select .ng-clear-wrapper:hover .ng-clear {
      color: #d0021b
    }

    .ng-select .ng-clear-wrapper:focus .ng-clear {
      color: #d0021b
    }

    .ng-select .ng-clear-wrapper:focus {
      outline: none
    }

    .ng-select .ng-spinner-zone {
      padding: 5px 5px 0 0
    }

    [dir=rtl] .ng-select .ng-spinner-zone {
      padding: 5px 0 0 5px
    }

    .ng-select .ng-arrow-wrapper {
      width: 25px;
      padding-right: 5px
    }

    [dir=rtl] .ng-select .ng-arrow-wrapper {
      padding-left: 5px;
      padding-right: 0
    }

    .ng-select .ng-arrow-wrapper:hover .ng-arrow {
      border-top-color: #666
    }

    .ng-select .ng-arrow-wrapper .ng-arrow {
      border-color: #999 rgba(0, 0, 0, 0) rgba(0, 0, 0, 0);
      border-style: solid;
      border-width: 5px 5px 2.5px
    }

    /* ===== CRITICAL: Dropdown Panel Styles ===== */
    .ng-dropdown-panel {
      background-color: #fff;
      border: 1px solid #ccc;
      box-shadow: 0 1px 0 rgba(0, 0, 0, .06);
      left: 0;
      z-index: 1060 !important; /* بالاتر از modal های Bootstrap */
    }

    /* وقتی appendTo="body" استفاده میشه */
    body > .ng-dropdown-panel {
      z-index: 1060 !important;
    }

    .ng-dropdown-panel.ng-select-top {
      bottom: 100%;
      border-top-right-radius: 4px;
      border-top-left-radius: 4px;
      border-bottom-color: hsl(0, 0%, 90%);
      margin-bottom: -1px
    }

    .ng-dropdown-panel.ng-select-top .ng-dropdown-panel-items .ng-option:first-child {
      border-top-right-radius: 4px;
      border-top-left-radius: 4px
    }

    .ng-dropdown-panel.ng-select-right {
      left: 100%;
      top: 0;
      border-top-right-radius: 4px;
      border-bottom-right-radius: 4px;
      border-bottom-left-radius: 4px;
      border-bottom-color: hsl(0, 0%, 90%);
      margin-bottom: -1px
    }

    .ng-dropdown-panel.ng-select-right .ng-dropdown-panel-items .ng-option:first-child {
      border-top-right-radius: 4px
    }

    .ng-dropdown-panel.ng-select-bottom {
      top: 100%;
      border-bottom-right-radius: 4px;
      border-bottom-left-radius: 4px;
      border-top-color: hsl(0, 0%, 90%);
      margin-top: -1px
    }

    .ng-dropdown-panel.ng-select-bottom .ng-dropdown-panel-items .ng-option:last-child {
      border-bottom-right-radius: 4px;
      border-bottom-left-radius: 4px
    }

    .ng-dropdown-panel.ng-select-left {
      left: -100%;
      top: 0;
      border-top-left-radius: 4px;
      border-bottom-right-radius: 4px;
      border-bottom-left-radius: 4px;
      border-bottom-color: hsl(0, 0%, 90%);
      margin-bottom: -1px
    }

    .ng-dropdown-panel.ng-select-left .ng-dropdown-panel-items .ng-option:first-child {
      border-top-left-radius: 4px
    }

    .ng-dropdown-panel .ng-dropdown-header {
      border-bottom: 1px solid #ccc;
      padding: 5px 7px
    }

    .ng-dropdown-panel .ng-dropdown-footer {
      border-top: 1px solid #ccc;
      padding: 5px 7px
    }

    .ng-dropdown-panel .ng-dropdown-panel-items .ng-optgroup {
      user-select: none;
      padding: 8px 10px;
      font-weight: 500;
      color: rgba(0, 0, 0, .54);
      cursor: pointer
    }

    .ng-dropdown-panel .ng-dropdown-panel-items .ng-optgroup.ng-option-disabled {
      cursor: default
    }

    .ng-dropdown-panel .ng-dropdown-panel-items .ng-optgroup.ng-option-marked {
      background-color: rgb(244.8, 249.84, 255)
    }

    .ng-dropdown-panel .ng-dropdown-panel-items .ng-optgroup.ng-option-selected,
    .ng-dropdown-panel .ng-dropdown-panel-items .ng-optgroup.ng-option-selected.ng-option-marked {
      color: rgba(0, 0, 0, .54);
      background-color: rgb(234.6, 244.68, 255);
      font-weight: 600
    }

    .ng-dropdown-panel .ng-dropdown-panel-items .ng-option {
      background-color: #fff;
      color: rgba(0, 0, 0, .87);
      padding: 8px 10px
    }

    .ng-dropdown-panel .ng-dropdown-panel-items .ng-option.ng-option-selected,
    .ng-dropdown-panel .ng-dropdown-panel-items .ng-option.ng-option-selected.ng-option-marked {
      color: #333;
      background-color: rgb(234.6, 244.68, 255)
    }

    .ng-dropdown-panel .ng-dropdown-panel-items .ng-option.ng-option-selected .ng-option-label,
    .ng-dropdown-panel .ng-dropdown-panel-items .ng-option.ng-option-selected.ng-option-marked .ng-option-label {
      font-weight: 600
    }

    .ng-dropdown-panel .ng-dropdown-panel-items .ng-option.ng-option-marked {
      background-color: rgb(244.8, 249.84, 255);
      color: #333
    }

    .ng-dropdown-panel .ng-dropdown-panel-items .ng-option.ng-option-disabled {
      color: #ccc
    }

    .ng-dropdown-panel .ng-dropdown-panel-items .ng-option.ng-option-child {
      padding-left: 22px
    }

    [dir=rtl] .ng-dropdown-panel .ng-dropdown-panel-items .ng-option.ng-option-child {
      padding-right: 22px;
      padding-left: 0
    }

    .ng-dropdown-panel .ng-dropdown-panel-items .ng-option .ng-tag-label {
      font-size: 80%;
      font-weight: 400;
      padding-right: 5px
    }

    [dir=rtl] .ng-dropdown-panel .ng-dropdown-panel-items .ng-option .ng-tag-label {
      padding-left: 5px;
      padding-right: 0
    }

    [dir=rtl] .ng-dropdown-panel {
      direction: rtl;
      text-align: right
    }
  `,
  host: {
    '[attr.data-component]': '"custom-select"'
  }
})
export class CustomSelectComponent extends CustomControlComponent implements OnInit {
  private http = inject(HttpClient);

  // Input properties
  type = input<SelectType>('select');
  options = input<ComboBase[]>([]);
  ajaxUrl = input<string>('');
  searchable = input<boolean>(true);
  clearable = input<boolean>(true);
  maxSelectedItems = input<number>();
  minSearchLength = input<number>(2);
  customOptionTemplate = input<any>();
  bindValue = input<string>('guid');

  // ✅ اضافه شده: کنترل appendTo
  appendTo = input<string>('body'); // پیش‌فرض body برای جلوگیری از مشکل z-index

  // Output signals
  selected = output<any>();
  opened = output<void>();
  closed = output<void>();
  cleared = output<void>();
  searched = output<string>();

  // Internal state
  public isLoading = signal<boolean>(false);
  private searchTerm = signal<string>('');
  private ajaxOptions = signal<ComboBase[]>([]);
  private internalOptions = signal<ComboBase[]>(this.options());

  selectOptions = computed(() => {
    const defaultOption: ComboBase = {
      guid: '',
      title: 'انتخاب کنید',
      disabled: true
    };

    const baseOptions = this.type() === 'select-ajax'
      ? (this.ajaxOptions() || [])
      : (this.internalOptions() || []);

    return [defaultOption, ...baseOptions];
  });

  containerClass = computed(() => {
    const baseClass = this.styleType() === 'group' ? 'input-group mb-1 mt-1' : 'form-group';
    return baseClass;
  });

  constructor() {
    super();
    effect(() => {
      this.internalOptions.set(this.options());
    });
  }

  override ngOnInit(): void {
    super.ngOnInit();

    if (this.type() === 'select-ajax' && this.ajaxUrl()) {
      this.loadInitialAjaxData();
    }
  }

  // Event handlers
  protected handleSimpleSelect(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const selectedValue = target.value || null;

    this.value.set(selectedValue);
    this.onChange(selectedValue);
    this.changed.emit(selectedValue);
    this.selected.emit(selectedValue);
  }

  protected handleNgSelectChange(selectedValue: any): void {
    this.value.set(selectedValue);
    this.onChange(selectedValue);
    this.changed.emit(selectedValue);
    this.selected.emit(selectedValue);
  }

  protected handleOpen(): void {
    this.opened.emit();
  }

  protected handleClose(): void {
    this.closed.emit();
  }

  protected handleClear(): void {
    this.value.set(null);
    this.onChange(null);
    this.changed.emit(null);
    this.cleared.emit();
  }

  protected handleSearch(term: any): void {
    this.searchTerm.set(term);
    this.searched.emit(term);

    if (this.type() === 'select-ajax' && this.ajaxUrl()) {
      this.performAjaxSearch(term);
    }
  }

  // Ajax functionality
  private loadInitialAjaxData(): void {
    if (!this.ajaxUrl()) return;

    this.isLoading.set(true);
    this.performAjaxRequest().subscribe({
      next: (data) => {
        this.ajaxOptions.set(data);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      }
    });
  }

  private performAjaxSearch(term: string): void {
    if (term.length < this.minSearchLength()) {
      return;
    }

    this.isLoading.set(true);
    this.performAjaxRequest(term).subscribe({
      next: (data) => {
        this.ajaxOptions.set(data);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      }
    });
  }

  private performAjaxRequest(searchTerm?: string): Observable<ComboBase[]> {
    const url = this.buildAjaxUrl(searchTerm);

    return this.http.get<any>(url).pipe(
      switchMap(response => {
        const data = response.data || response.items || response;
        const options = Array.isArray(data) ? data : [];

        return of(options.map(item => ({
          guid: item.id || item.guid || item.value,
          title: item.name || item.title || item.label || String(item),
          value: item,
          disabled: item.disabled || false
        })));
      }),
      catchError(() => of([])),
      debounceTime(300),
      distinctUntilChanged()
    );
  }

  private buildAjaxUrl(searchTerm?: string): string {
    let url = this.ajaxUrl();

    if (searchTerm) {
      const separator = url.includes('?') ? '&' : '?';
      url += `${separator}search=${encodeURIComponent(searchTerm)}`;
    }

    return url;
  }

  // Public methods
  refresh(): void {
    if (this.type() === 'select-ajax') {
      this.loadInitialAjaxData();
    }
  }

  addOption(option: ComboBase): void {
    this.internalOptions.update(options => [...options, option]);
  }

  removeOption(guid: string): void {
    this.internalOptions.update(options => options.filter(opt => opt.guid !== guid));
  }
}