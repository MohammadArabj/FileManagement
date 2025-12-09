import {
  Component,
  OnInit,
  inject,
  signal,
  ChangeDetectionStrategy,
  ViewChild,
  computed
} from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
  FormGroup
} from '@angular/forms';

import { Category } from '../../../core/models/Category';
import { ModalFormBaseComponent } from '../../../shared/modal/modal-form-base';
import { ModalConfig } from '../../../shared/modal/modal.config';
import { CategoryService } from '../../../services/category.service';
import { ModalComponent } from "../../../shared/modal/modal";
import { CustomInputComponent } from "../../../shared/custom-controls/custom-input";
import { IconButtonComponent } from "../../../shared/custom-buttons/icon-button";
import { LabelButtonComponent } from "../../../shared/custom-buttons/label-button";
import { UserService } from '../../../services/user.service';
import { CategoryPermissionService } from '../../../services/category-permission.service';
import { getClientSettings } from '../../../services/framework-services/code-flow.service';

interface UserPosition {
  guid: string;
  name: string;
  position: string;
  isSelected: boolean;
  positionGuid: string;
}

// مدل برای بروزرسانی ViewAll در دسته‌بندی
interface CategoryPermissionModel {
  id: number;
  viewAll: boolean;
}

// مدل برای ارسال دسترسی‌های جزئی
interface CategoryDetailedPermissionModel {
  categoryId: number;
  positionGuids: string[];
}
@Component({
  selector: 'app-category',
  templateUrl: './category.html',
  styleUrls: ['./category.css'],
  standalone: true,
  imports: [
    ModalComponent,
    CustomInputComponent,
    IconButtonComponent,
    ReactiveFormsModule,
    LabelButtonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CategoryComponent extends ModalFormBaseComponent<CategoryService, Category> implements OnInit {
  // Signals for component state
  public helpModalConfig = signal<ModalConfig>(new ModalConfig());
  public permissionModalConfig = signal<ModalConfig>(new ModalConfig());

  // Injected services
  private readonly fb = inject(FormBuilder);
  private readonly categoryService = inject(CategoryService);
  @ViewChild('permissionModal') permissionModal!: ModalComponent;

  // Signals for state management
  categories = signal<any[]>([]);
  allUsers = signal<UserPosition[]>([]);
  filteredUsers = signal<UserPosition[]>([]);
  selectedCategoryId = signal<number>(0);
  selectedCategoryTitle = signal<string>('');
  isLoadingPermissions = signal<boolean>(false);
  showOnlySelected = signal<boolean>(false);
  searchTerm = signal<string>('');

  // اضافه کردن ViewAll دسترسی
  hasViewAllPermission = signal<boolean>(false);

  // Pagination signals
  currentPage = signal<number>(1);
  pageSize = 50;
  totalUsers = signal<number>(0);

  // محاسبه computed برای صفحات
  totalPages = computed(() => Math.ceil(this.filteredUsers().length / this.pageSize));

  // محاسبه computed برای کاربران صفحه جاری
  paginatedUsers = computed(() => {
    const startIndex = (this.currentPage() - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    return this.filteredUsers().slice(startIndex, endIndex);
  });

  // Form
  searchForm: FormGroup;

  // Injected services
  private userService = inject(UserService);
  private categoryPermissionService = inject(CategoryPermissionService);

  constructor() {
    super();
    this.service = this.categoryService;
    this.setupComponent();
    this.initializeForm();

    const config = new ModalConfig();
    config.setId?.('permissionModal');
    config.size = 'large';
    config.modalTitle = 'مدیریت دسترسی دسته‌بندی';
    config.hideFooter = false;
    this.permissionModalConfig.set(config);

    // Initialize search form
    this.searchForm = this.fb.group({
      searchTerm: ['']
    });

    // Watch for search changes
    this.searchForm.get('searchTerm')?.valueChanges.subscribe(value => {
      this.searchTerm.set(value || '');
      this.filterUsers();
    });
  }

  // Add this method to your component class
  isPageVisible(page: number): boolean {
    const current = this.currentPage();
    const total = this.totalPages();
    return Math.abs(page - current) <= 2 || page === 1 || page === total;
  }

  private setupComponent(): void {
    // Set modal configuration
    const config = this.modalConfig();
    config.size = "large";
    config.modalTitle = "ایجاد/ویرایش دسته بندی";
    this.modalConfig.set(config);

    // Set help modal configuration
    const helpConfig = new ModalConfig();
    helpConfig.setId?.("helpModal");
    helpConfig.hideFooter = true;
    helpConfig.modalTitle = "راهنمای فرمت شماره گذاری";
    this.helpModalConfig.set(helpConfig);
  }

  private initializeForm(): void {
    const formGroup = this.fb.group({
      guid: [''],
      title: ['', [
        Validators.required,
        Validators.minLength(5),
        Validators.maxLength(100)
      ]],
      numberFormat: ['Mt/%i/%d/شماره', [Validators.required]],
      startNumber: [1, [Validators.required, Validators.min(1)]],
      step: [1, [Validators.required, Validators.min(1)]],
    });

    this.form.set(formGroup);
  }

  override ngOnInit(): void {
    super.ngOnInit();
    this.loadUsers(); // بارگذاری کاربران در ابتدا
  }

  // Helper methods for form validation
  public isFieldInvalid(fieldName: string): boolean {
    const currentForm = this.form();
    if (!currentForm) return false;

    const field = currentForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  public getFieldError(fieldName: string): string {
    const currentForm = this.form();
    if (!currentForm) return '';

    const field = currentForm.get(fieldName);
    if (!field || !field.errors) return '';

    if (field.errors['required']) return `${fieldName} الزامی است`;
    if (field.errors['minlength']) return `حداقل ${field.errors['minlength'].requiredLength} کاراکتر وارد کنید`;
    if (field.errors['maxlength']) return `حداکثر ${field.errors['maxlength'].requiredLength} کاراکتر مجاز است`;
    if (field.errors['min']) return `مقدار نباید کمتر از ${field.errors['min'].min} باشد`;

    return 'خطا در اعتبارسنجی';
  }

  // Custom validation methods
  public validateNumberFormat(): boolean {
    const currentForm = this.form();
    if (!currentForm) return false;

    const numberFormat = currentForm.get('numberFormat')?.value;
    if (!numberFormat) return false;

    // Check if format contains required placeholders
    const hasValidPlaceholders = numberFormat.includes('%i') || numberFormat.includes('%d');
    return hasValidPlaceholders;
  }

  // Override submit to add custom validation
  override submit(action: string, hasFile = false): void {
    if (!this.validateNumberFormat()) {
      this.toastService.error('فرمت شماره گذاری باید شامل حداقل یکی از placeholder های %i یا %d باشد');
      return;
    }

    super.submit(action, hasFile);
  }

  // Helper method to open help modal
  public openHelpModal(): void {
    // Implementation for opening help modal
    const helpModal = document.getElementById('helpModal');
    if (helpModal) {
      // Open help modal using your modal service or direct DOM manipulation
    }
  }

  // Helper method to reset form with default values
  public resetFormWithDefaults(): void {
    const currentForm = this.form();
    if (currentForm) {
      currentForm.patchValue({
        guid: '',
        title: '',
        numberFormat: 'Mt/%i/%d/شماره',
        startNumber: 1,
        step: 1
      });
    }
  }

  // Custom event handlers
  public onTitleChange(value: any): void {
    const currentForm = this.form();
    if (currentForm) {
      // Auto-generate number format based on title if needed
      const titleControl = currentForm.get('title');
      if (titleControl && value && !currentForm.get('numberFormat')?.dirty) {
        const baseFormat = `${value.substring(0, 10)}/%i/%d/شماره`;
        currentForm.get('numberFormat')?.setValue(baseFormat);
      }
    }
  }

  // Method to preview number format
  public previewNumberFormat(): string {
    const currentForm = this.form();
    if (!currentForm) return '';

    const format = currentForm.get('numberFormat')?.value || '';
    const startNumber = currentForm.get('startNumber')?.value || 1;

    // Replace placeholders with sample values
    let preview = format
      .replace(/%i/g, startNumber.toString())
      .replace(/%d/g, new Date().getFullYear().toString())
      .replace(/%m/g, (new Date().getMonth() + 1).toString().padStart(2, '0'))
      .replace(/%y/g, new Date().getFullYear().toString().substr(-2));

    return preview || 'پیش‌نمایش در دسترس نیست';
  }

  async loadCategories() {
    try {
      const categories = await this.categoryService.getList().toPromise();
      this.categories.set(Array.isArray(categories) ? categories : []);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  }

  async loadUsers() {
    if (this.allUsers().length > 0) {
      return; // اگر کاربران قبلاً بارگذاری شده‌اند، دوباره بارگذاری نکن
    }

    this.isLoadingPermissions.set(true);
    const clientId = getClientSettings().client_id ?? '';

    try {
      const users = (await this.userService.getAllByClientId(clientId).toPromise() || [])
        .map(user => ({
          guid: user.guid,
          name: user.name,
          position: user.position,
          isSelected: false,
          positionGuid: user.positionGuid
        }));

      this.allUsers.set(users);
      this.totalUsers.set(users.length);
      this.filterUsers();
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      this.isLoadingPermissions.set(false);
    }
  }

  filterUsers() {
    let filtered = [...this.allUsers()];

    // Apply search filter
    if (this.searchTerm()) {
      const searchLower = this.searchTerm().toLowerCase();
      filtered = filtered.filter(user =>
        user.name.toLowerCase().includes(searchLower) ||
        user.position.toLowerCase().includes(searchLower)
      );
    }

    // Apply selection filter
    if (this.showOnlySelected()) {
      filtered = filtered.filter(user => user.isSelected);
    }

    // مرتب‌سازی: ابتدا کاربران انتخاب شده، سپس بقیه
    filtered.sort((a, b) => {
      if (a.isSelected && !b.isSelected) return -1;
      if (!a.isSelected && b.isSelected) return 1;
      return a.name.localeCompare(b.name, 'fa');
    });

    this.filteredUsers.set(filtered);
    this.currentPage.set(1); // بازنشانی صفحه به 1
  }
  async loadCategoryPermissions(category: Category) {
    try {
      this.isLoadingPermissions.set(true);
      const categoryId = category?.id;
      // بارگذاری اطلاعات دسته‌بندی برای بررسی ViewAll
      this.hasViewAllPermission.set(category?.viewAll === true);

      // اگر ViewAll فعال نیست، دسترسی‌های جزئی را بارگذاری کن
      if (!this.hasViewAllPermission()) {
        const permissions = await this.categoryPermissionService.getByCategoryId(categoryId).toPromise();

        // Mark selected users
        this.allUsers.update(users =>
          users.map(user => {
            const hasPermission = permissions?.some(p => p.positionGuid === user.positionGuid);
            return { ...user, isSelected: hasPermission || false };
          })
        );
      } else {
        // اگر ViewAll فعال است، همه کاربران را غیرانتخاب کن
        this.allUsers.update(users =>
          users.map(user => ({ ...user, isSelected: false }))
        );
      }

      this.filterUsers(); // فیلتر کردن کاربران بعد از بارگذاری دسترسی‌ها
    } catch (error) {
      console.error('Error loading category permissions:', error);
    } finally {
      this.isLoadingPermissions.set(false);
    }
  }


  toggleUserSelection(user: UserPosition) {
    // اگر ViewAll فعال است، ابتدا آن را غیرفعال کن
    if (this.hasViewAllPermission()) {
      this.hasViewAllPermission.set(false);
    }

    this.allUsers.update(users =>
      users.map(u =>
        u.guid === user.guid ? { ...u, isSelected: !u.isSelected } : u
      )
    );
    this.filterUsers();
  }

  // تابع جدید برای ViewAll
  toggleViewAllPermission() {
    const newValue = !this.hasViewAllPermission();
    this.hasViewAllPermission.set(newValue);

    if (newValue) {
      // اگر ViewAll فعال شود، همه کاربران را غیرانتخاب کن
      this.allUsers.update(users =>
        users.map(u => ({ ...u, isSelected: false }))
      );
      this.filterUsers();
    }
  }
  selectAll() {
    if (this.hasViewAllPermission()) {
      this.hasViewAllPermission.set(false);
    }

    const currentPageUsers = this.paginatedUsers();
    const allSelected = currentPageUsers.every(user => user.isSelected);

    this.allUsers.update(users =>
      users.map(u => {
        const isInCurrentPage = currentPageUsers.some(cpu => cpu.guid === u.guid);
        return isInCurrentPage ? { ...u, isSelected: !allSelected } : u;
      })
    );
    this.filterUsers();
  }

  selectAllFiltered() {
    if (this.hasViewAllPermission()) {
      this.hasViewAllPermission.set(false);
    }

    const filtered = this.filteredUsers();
    const allSelected = filtered.every(user => user.isSelected);

    this.allUsers.update(users =>
      users.map(u => {
        const isFiltered = filtered.some(fu => fu.guid === u.guid);
        return isFiltered ? { ...u, isSelected: !allSelected } : u;
      })
    );
    this.filterUsers();
  }

  clearAllSelections() {
    this.hasViewAllPermission.set(false);
    this.allUsers.update(users =>
      users.map(u => ({ ...u, isSelected: false }))
    );
    this.filterUsers();
  }

  toggleShowOnlySelected() {
    this.showOnlySelected.update(val => !val);
    this.filterUsers();
  }

  get selectedCount(): number {
    return this.allUsers().filter(user => user.isSelected).length;
  }

  get filteredSelectedCount(): number {
    return this.filteredUsers().filter(user => user.isSelected).length;
  }

  previousPage() {
    if (this.currentPage() > 1) {
      this.currentPage.update(val => val - 1);
    }
  }

  nextPage() {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.update(val => val + 1);
    }
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  async submitPermissions() {
    if (this.selectedCategoryId() === 0) return;

    try {
      if (this.hasViewAllPermission()) {
        // ارسال ViewAll به عنوان بروزرسانی دسته‌بندی
        const categoryUpdateModel = {
          id: this.selectedCategoryId(),
          viewAll: true
        };
        await this.categoryService.setPermission(categoryUpdateModel).toPromise();
      } else {
        // ابتدا ViewAll را غیرفعال کن
        const categoryUpdateModel = {
          id: this.selectedCategoryId(),
          viewAll: false
        };
        await this.categoryService.setPermission(categoryUpdateModel).toPromise();

        // سپس دسترسی‌های جزئی را ست کن
        const selectedPositionGuids = this.allUsers()
          .filter(user => user.isSelected)
          .map(user => user.positionGuid);

        if (selectedPositionGuids.length > 0) {
          const permissionCommand = {
            categoryId: this.selectedCategoryId(),
            positionGuids: selectedPositionGuids
          };
          await this.categoryPermissionService.setPermissions(permissionCommand).toPromise();
        }
      }

      this.toastService.success('دسترسی‌ها با موفقیت ذخیره شد');
      this.permissionModal.close();

      // بروزرسانی جدول اصلی
      await this.refreshList();
    } catch (error) {
      console.error('Error saving permissions:', error);
      this.toastService.error('خطا در ذخیره دسترسی‌ها');
    }
  }

  async openPermissionModal(category: Category, categoryTitle: string) {
    this.selectedCategoryId.set(category.id);
    this.selectedCategoryTitle.set(category.title);

    // بارگذاری کاربران اگر هنوز بارگذاری نشده‌اند
    await this.loadUsers();

    // Reset all selections
    this.allUsers.update(users =>
      users.map(user => ({ ...user, isSelected: false }))
    );
    this.hasViewAllPermission.set(false);

    // Load existing permissions
    await this.loadCategoryPermissions(category);

    this.permissionModal.open();
  }

  permissionModalClosed() {
    this.selectedCategoryId.set(0);
    this.selectedCategoryTitle.set('');
    this.searchForm.reset();
    this.showOnlySelected.set(false);
    this.currentPage.set(1);
    this.searchTerm.set('');
    this.hasViewAllPermission.set(false);
  }

}