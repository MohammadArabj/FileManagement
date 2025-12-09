import {
  Component,
  OnInit,
  inject,
  signal,
  ChangeDetectionStrategy,
  ViewChild
} from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
  FormGroup
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HasPermissionDirective } from '../../../../core/directives/has-permission.directive';
import { UserService } from '../../../../services/user.service';
import { IconButtonComponent } from '../../../../shared/custom-buttons/icon-button';
import { LabelButtonComponent } from '../../../../shared/custom-buttons/label-button';
import { CustomInputComponent } from '../../../../shared/custom-controls/custom-input';
import { ModalComponent } from '../../../../shared/modal/modal';
import { ModalConfig } from '../../../../shared/modal/modal.config';
import { CategoryPermissionService } from '../../../../services/category-permission.service';
import { CategoryService } from '../../../../services/category.service';
import { getClientSettings } from '../../../../services/framework-services/code-flow.service';
import { finalize } from 'rxjs';

interface UserPosition {
  guid: string;
  name: string;
  position: string;
  isSelected: boolean;
  positionGuid: string;
}

@Component({
  selector: 'app-category-permission',
  templateUrl: './category-permission.html',
  styleUrls: ['./category-permission.css'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IconButtonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CategoryPermissionComponent implements OnInit {
  @ViewChild('permissionModal') permissionModal!: ModalComponent;


// Add this method to your component class
isPageVisible(page: number): boolean {
  const current = this.currentPage();
  const total = this.totalPages();
  return Math.abs(page - current) <= 2 || page === 1 || page === total;
}
  // Signals for state management
  categories = signal<any[]>([]);
  allUsers = signal<UserPosition[]>([]);
  filteredUsers = signal<UserPosition[]>([]);
  selectedCategoryId = signal<number>(0);
  selectedCategoryTitle = signal<string>('');
  isLoading = signal<boolean>(false);
  showOnlySelected = signal<boolean>(false);
  searchTerm = signal<string>('');

  // Pagination signals
  currentPage = signal<number>(1);
  pageSize = 50;
  totalUsers = signal<number>(0);
  totalPages = signal<number>(0);

  // Modal config
  modalConfig = signal<ModalConfig>(new ModalConfig());

  // Form
  searchForm: FormGroup;

  // Injected services
  private fb = inject(FormBuilder);
  private userService = inject(UserService);
  private categoryService = inject(CategoryService);
  private categoryPermissionService = inject(CategoryPermissionService);

  constructor() {
    // Initialize modal config
    const config = new ModalConfig();
    config.id = 'permissionModal';
    config.size = 'large';
    config.modalTitle = 'مدیریت دسترسی دسته‌بندی';
    config.hideFooter = false;
    this.modalConfig.set(config);

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

  ngOnInit() {
    this.loadCategories();
    this.loadUsers();
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
    this.isLoading.set(true);
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
      this.isLoading.set(false);
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

    this.filteredUsers.set(filtered);
    this.totalPages.set(Math.ceil(filtered.length / this.pageSize));
    this.currentPage.set(1);
  }

  get paginatedUsers(): UserPosition[] {
    const startIndex = (this.currentPage() - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    return this.filteredUsers().slice(startIndex, endIndex);
  }

  async openPermissionModal(categoryId: number, categoryTitle: string) {
    this.selectedCategoryId.set(categoryId);
    this.selectedCategoryTitle.set(categoryTitle);

    // Reset all selections
    this.allUsers.update(users =>
      users.map(user => ({ ...user, isSelected: false }))
    );

    // Load existing permissions
    await this.loadCategoryPermissions(categoryId);

    this.filterUsers();
    this.permissionModal.open();
  }

  async loadCategoryPermissions(categoryId: number) {
    try {
      const permissions = await this.categoryPermissionService.getByCategoryId(categoryId).toPromise();

      // Mark selected users
      this.allUsers.update(users =>
        users.map(user => {
          const hasPermission = permissions?.some(p => p.positionGuid === user.positionGuid);
          return { ...user, isSelected: hasPermission || false };
        })
      );
    } catch (error) {
      console.error('Error loading category permissions:', error);
    }
  }

  toggleUserSelection(user: UserPosition) {
    this.allUsers.update(users =>
      users.map(u =>
        u.guid === user.guid ? { ...u, isSelected: !u.isSelected } : u
      )
    );
    this.filterUsers();
  }

  selectAll() {
    const currentPageUsers = this.paginatedUsers;
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

  async submit() {
    if (this.selectedCategoryId() === 0) return;

    try {
      const selectedPositionGuids = this.allUsers()
        .filter(user => user.isSelected)
        .map(user => user.positionGuid);

      const command = {
        categoryId: this.selectedCategoryId(),
        positionGuids: selectedPositionGuids
      };

      await this.categoryPermissionService.setPermissions(command).toPromise();
      this.permissionModal.close();
    } catch (error) {
      console.error('Error saving permissions:', error);
    }
  }

  modalClosed() {
    this.selectedCategoryId.set(0);
    this.selectedCategoryTitle.set('');
    this.searchForm.reset();
    this.showOnlySelected.set(false);
    this.currentPage.set(1);
  }
}
