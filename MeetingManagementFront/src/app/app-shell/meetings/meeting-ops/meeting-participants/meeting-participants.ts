import {
  Component,
  ElementRef,
  input,
  signal,
  computed,
  effect,
  inject,
  DestroyRef,
  viewChild,
  output,
  OnInit,
  OnDestroy,
  untracked
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Collapse } from 'bootstrap';

import { MeetingMember } from './../../../../core/models/Meeting';
import { SystemUser } from '../../../../core/models/User';
import { ConflictItem } from '../../../../core/types/conflict-result';
import { ComboBase } from '../../../../shared/combo-base';
import { BoardMember } from '../../../../core/models/BoardMember';
import { CreatType } from '../../../../core/types/enums';

import { RoleService } from '../../../../services/role.service';
import { FileService } from '../../../../services/file.service';
import { environment } from '../../../../../environments/environment';
import { base64ToArrayBuffer, generateGuid } from '../../../../core/types/configuration';
import { FileDetails } from '../../../../core/types/file';

// به‌روزرسانی interface MemberIdentity
interface MemberIdentity {
  id: string;
  type: 'system' | 'board' | 'external';
  sourceId: string; // composite برای validate/uniqueness
  userKey: string; // baseUserGuid یا boardGuid برای duplicate/conflict
  displayName: string;
  position: string;
  positionGuid?: string;
  image?: string;
  isSystem?: boolean;
}

interface ProcessedMember extends MeetingMember {
  identity: MemberIdentity;
  isValidated: boolean; // آیا با منبع اصلی sync شده
}

@Component({
  selector: 'app-meeting-participants',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    CommonModule
  ],
  standalone: true,
  templateUrl: './meeting-participants.html',
  styleUrls: ['./meeting-participants.css']
})
export class MeetingParticipantsComponent implements OnInit, OnDestroy {

  // ===== DEPENDENCY INJECTION =====
  private readonly fb = inject(FormBuilder);
  private readonly roleService = inject(RoleService);
  private readonly fileService = inject(FileService);
  private readonly destroyRef = inject(DestroyRef);

  // ===== INPUT SIGNALS =====
  readonly selectedMembers = input<MeetingMember[]>([]);
  readonly conflictedUsers = input<ConflictItem[]>([]);
  readonly availableSystemUsers = input<SystemUser[]>([]);
  readonly allUsesrs = input<SystemUser[]>([]);
  readonly availableBoardMembers = input<BoardMember[]>([]);
  readonly isBoardMeeting = input<boolean>(false);
  readonly operationMode = input<CreatType>(CreatType.Create);
  readonly allSystemUsers = input<SystemUser[]>([]);
  // ===== OUTPUT SIGNALS =====
  readonly membersUpdated = output<MeetingMember[]>();
  readonly conflictCheckRequested = output<string>();
  readonly fileStorageUpdated = output<any>();

  // ===== VIEW CHILD SIGNALS =====
  readonly searchBox = viewChild<ElementRef>('searchBox');

  // ===== PRIVATE SIGNALS =====
  private readonly _processedMembers = signal<ProcessedMember[]>([]);
  private readonly _roles = signal<ComboBase[]>([]);
  private readonly _searchQuery = signal<string>('');
  private readonly _dropdownVisible = signal<boolean>(false);
  private readonly _previewImage = signal<string | null>(null);
  private readonly _fileStorage = signal<{ [key: string]: { profile?: File; signature?: File } }>({});
  private readonly _fileUrls = signal<Map<string, string>>(new Map());
  private readonly _isInitialized = signal<boolean>(false);
  readonly roles = this._roles.asReadonly();
  readonly previewImage = this._previewImage.asReadonly();

  // Guest form specific signals
  private readonly _selectedInternalMember = signal<SystemUser | null>(null);
  private readonly _internalMemberSearchQuery = signal<string>('');
  private readonly _internalMemberDropdownVisible = signal<boolean>(false);
  readonly selectedInternalMember = this._selectedInternalMember.asReadonly();


  // ===== PUBLIC COMPUTED SIGNALS =====
  readonly activeMembers = computed(() => {
    const members = this._processedMembers();
    const mode = this.operationMode();

    if (mode === CreatType.Create) {
      // در حالت ایجاد، فقط اعضای غیر حذف شده
      return members;
    } else {
      // در حالت ویرایش، همه اعضا (برای نمایش تاریخچه)
      return members.filter(m => !m.isRemoved);
    }
  });


  // به‌روزرسانی availableMembers computed (activeIds بر اساس sourceId composite)
  readonly availableMembers = computed(() => {
    const query = this._searchQuery().toLowerCase().trim();
    const isVisible = this._dropdownVisible();
    const systemUsers = this.availableSystemUsers(); // processed
    const boardMembers = this.availableBoardMembers();
    const isBoardMeeting = this.isBoardMeeting();
    const processedMembers = this._processedMembers();

    if (!isVisible) return [];

    // activeIds بر اساس sourceId (composite برای جلوگیری از duplicate سمت)
    const activeIds = new Set(
      processedMembers
        .filter(m => !m.isRemoved)
        .map(m => m.identity.sourceId)
    );

    let availableUsers: SystemUser[] = [];
    availableUsers = systemUsers;

    return availableUsers.filter(user => {
      const fullText = `${user.name} ${user.userName || ''} ${user.position}`.toLowerCase();
      const compositeKey = `${user.guid || ''}`;
      const isNotSelected = !activeIds.has(compositeKey); // composite
      const matchesQuery = !query || fullText.includes(query);

      return isNotSelected && matchesQuery;
    });
  });

  // به‌روزرسانی filteredInternalMembers (activeIds بر اساس sourceId composite، فیلتر بر اساس compositeKey)
  readonly filteredInternalMembers = computed(() => {
    const query = this._internalMemberSearchQuery().toLowerCase().trim();
    const isVisible = this._internalMemberDropdownVisible();
    const systemUsers = this.allUsesrs(); // raw
    const processedMembers = this._processedMembers();

    if (!isVisible || !systemUsers?.length) return [];

    // activeIds بر اساس sourceId (composite)
    const activeIds = new Set(
      processedMembers
        .filter(m => !m.isRemoved)
        .map(m => m.identity.sourceId)
    );

    return systemUsers.filter(user => {
      const fullText = `${user.name} ${user.userName || ''} ${user.position}`.toLowerCase();
      const compositeKey = this.getUserCompositeKey(user); // composite برای فیلتر
      const isNotSelected = !activeIds.has(compositeKey);
      const matchesQuery = !query || fullText.includes(query);

      return isNotSelected && matchesQuery;
    });
  });
  readonly filteredAllUserInternalMembers = computed(() => {
    const query = this._internalMemberSearchQuery().toLowerCase().trim();
    const isVisible = this._internalMemberDropdownVisible();
    const systemUsers = this.allSystemUsers(); // raw
    const processedMembers = this._processedMembers();

    if (!isVisible || !systemUsers?.length) return [];

    // activeIds بر اساس sourceId (composite)
    const activeIds = new Set(
      processedMembers
        .filter(m => !m.isRemoved)
        .map(m => m.identity.sourceId)
    );

    return systemUsers.filter(user => {
      const fullText = `${user.name} ${user.userName || ''} ${user.position}`.toLowerCase();
      const compositeKey = this.getUserCompositeKey(user); // composite برای فیلتر
      const isNotSelected = !activeIds.has(compositeKey);
      const matchesQuery = !query || fullText.includes(query);

      return isNotSelected && matchesQuery;
    });
  });

  private addMemberToList(newMember: ProcessedMember): void {
    const currentMembers = this._processedMembers();

    // بررسی تکراری بر اساس sourceId (composite برای اجازه انتخاب سمت‌های مختلف)
    const existingIndex = currentMembers.findIndex(m =>
      m.identity.sourceId === newMember.identity.sourceId
    );

    if (existingIndex !== -1) {
      const existingMember = currentMembers[existingIndex];
      if (existingMember.isRemoved) {
        // بازگردانی عضو حذف شده: حذف از موقعیت فعلی و اضافه کردن به انتها
        const updatedMembers = [...currentMembers];
        updatedMembers.splice(existingIndex, 1);
        const restoredMember = { ...existingMember, isRemoved: false };
        updatedMembers.push(restoredMember);
        this.sortMembers(updatedMembers);
        this._processedMembers.set(updatedMembers);
      }
      else {
        if (newMember.roleId === 6) {
          const currentMembers = [...this._processedMembers()];
          var currentMember = currentMembers[existingIndex];
          newMember.id = currentMember.id;
          currentMembers[existingIndex] = newMember;
          this.sortMembers(currentMembers);
          this._processedMembers.set(currentMembers);
          this.emitMembersUpdated();
        }
        else return;
      }
    } else {
      // اضافه کردن عضو جدید
      const updatedMembers = [...currentMembers, newMember];
      this.sortMembers(updatedMembers);
      this._processedMembers.set(updatedMembers);
    }

    this.emitMembersUpdated();
  }

  // بقیه متدها unchanged، چون منطق conflict و userGuid اصلی حفظ می‌شه (emit از userKey base، hasConflict از userGuid اصلی)

  // بقیه متدها (مثل createMemberIdentityFromUser، selectMember) unchanged، چون userKey base set می‌شه و فیلتر حالا بر اساس base کار می‌کنه

  // ===== FORM MANAGEMENT =====
  participantsForm!: FormGroup;

  get guestForm(): FormGroup {
    return this.participantsForm.get('guestForm') as FormGroup;
  }

  // ===== LIFECYCLE METHODS =====
  constructor() {
    this.initializeForm();
    this.loadRoles();
    this.setupEffects();
  }

  ngOnInit(): void {
    this._isInitialized.set(true);
    this.syncWithInputMembers();
  }

  ngOnDestroy(): void {
    this.cleanupBlobUrls();
  }

  // ===== INITIALIZATION METHODS =====
  private initializeForm(): void {
    this.participantsForm = this.fb.group({
      guestForm: this.fb.group({
        guid: [generateGuid()],
        guestType: ['external', Validators.required],
        selectedMember: [''],
        memberSearch: [''],
        name: [''],
        mobile: [''],
        email: ['', [Validators.email]],
        organization: [''],
        gender: ['Male']
      })
    });

    this.setupDynamicValidators();
  }

  private setupDynamicValidators(): void {
    const guestTypeControl = this.guestForm.get('guestType');

    guestTypeControl?.valueChanges.subscribe(guestType => {
      this.updateValidators(guestType);
    });

    this.updateValidators(guestTypeControl?.value);
  }

  private updateValidators(guestType: string): void {
    const controls = {
      name: this.guestForm.get('name'),
      mobile: this.guestForm.get('mobile'),
      organization: this.guestForm.get('organization'),
      selectedMember: this.guestForm.get('selectedMember'),
      gender: this.guestForm.get('gender') // اضافه شده
    };

    // پاک کردن validators قبلی
    Object.values(controls).forEach(control => control?.clearValidators());

    if (guestType === 'external') {
      controls.name?.setValidators([Validators.required, Validators.minLength(2)]);
      controls.mobile?.setValidators([Validators.required, Validators.pattern(/^09\d{9}$/)]);
      controls.organization?.setValidators([Validators.required]);
      controls.gender?.setValidators([Validators.required]); // اضافه شده

    } else if (guestType === 'internal') {
      controls.selectedMember?.setValidators([Validators.required]);
    }

    // بروزرسانی وضعیت validation
    Object.values(controls).forEach(control => control?.updateValueAndValidity());
  }

  private loadRoles(): void {
    this.roleService.getForCombo<ComboBase[]>()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this._roles.set(data || this.getDefaultRoles());
        },
        error: (error) => {
          console.error('Error loading roles:', error);
          this._roles.set(this.getDefaultRoles());
        }
      });
  }

  private getDefaultRoles(): ComboBase[] {
    return [
      { id: 1, title: 'رئیس جلسه', other: '#dc3545' },
      { id: 2, title: 'دبیر', other: '#0d6efd' },
      { id: 3, title: 'عضو', other: '#198754' },
      { id: 4, title: 'ناظر', other: '#fd7e14' },
      { id: 5, title: 'مشاور', other: '#6f42c1' },
      { id: 6, title: 'مهمان', other: '#6c757d' }
    ];
  }

  // ===== EFFECTS SETUP =====
  private setupEffects(): void {
    // Sync with input changes
    // effect(() => {
    //   const inputMembers = this.selectedMembers();
    //   if (this._isInitialized() && inputMembers) {
    //     this.syncWithInputMembers();

    //   }
    // });
    effect(() => {
      const inputMembers = this.selectedMembers();
      if (this._isInitialized() && inputMembers) {
        untracked(() => this.syncWithInputMembers());
      }
    });
    // Update when available members change
    effect(() => {
      const systemUsers = this.availableSystemUsers();
      const boardMembers = this.availableBoardMembers();

      if (this._isInitialized() && (systemUsers.length > 0 || boardMembers.length > 0)) {
        this.validateAndUpdateMembers();
      }
    });
  }





  private validateAndUpdateMembers(): void {
    const processedMembers = this._processedMembers();
    const systemUsers = this.availableSystemUsers();
    const boardMembers = this.availableBoardMembers();

    let hasUpdates = false;

    const updatedMembers = processedMembers.map(member => {
      const updatedMember = this.validateSingleMember(member, systemUsers, boardMembers);

      if (!this.areMembersEqual(member, updatedMember)) {
        hasUpdates = true;
      }

      return updatedMember;
    });

    if (hasUpdates) {
      this.sortMembers(updatedMembers);
      this._processedMembers.set(updatedMembers);
      this.emitMembersUpdated();
    }
  }




  removeMember(memberGuid: string): void {
    const currentMembers = this._processedMembers();
    const memberIndex = currentMembers.findIndex(m => m.guid === memberGuid);

    if (memberIndex === -1) return;

    const operationMode = this.operationMode();

    if (operationMode === CreatType.Create) {
      // در حالت ایجاد: حذف کامل
      const updatedMembers = currentMembers.filter((_, index) => index !== memberIndex);
      this._processedMembers.set(updatedMembers);
    } else {
      // در حالت ویرایش: علامت‌گذاری برای حذف
      const updatedMembers = [...currentMembers];
      updatedMembers[memberIndex] = {
        ...updatedMembers[memberIndex],
        isRemoved: true
      };
      this._processedMembers.set(updatedMembers);
    }

    this.emitMembersUpdated();
  }

  changeRole(member: ProcessedMember, event: Event): void {
    const target = event.target as HTMLSelectElement;
    const selectedRole = parseInt(target.value, 10);

    if (isNaN(selectedRole)) return;

    const currentMembers = this._processedMembers();
    const memberIndex = currentMembers.findIndex(m => m.guid === member.guid);

    if (memberIndex === -1) return;

    const updatedMembers = [...currentMembers];
    const oldRole = updatedMembers[memberIndex].roleId;

    // تغییر نقش
    updatedMembers[memberIndex] = {
      ...updatedMembers[memberIndex],
      roleId: selectedRole
    };

    // مدیریت تداخلات نقش‌های منحصر به فرد
    if ([1, 2, 3].includes(selectedRole)) {
      updatedMembers.forEach((m, index) => {
        if (index !== memberIndex && m.roleId === selectedRole && !m.isRemoved) {
          updatedMembers[index] = { ...m, roleId: 5 }; // تبدیل به عضو عادی
        }
      });
    }

    this.sortMembers(updatedMembers);
    this._processedMembers.set(updatedMembers);
    this.emitMembersUpdated();
  }

  // ===== GUEST MANAGEMENT =====
  addGuest(): void {
    if (!this.isGuestFormValid()) {
      this.markFormGroupTouched(this.guestForm);
      return;
    }

    const guestFormValue = this.guestForm.value;
    const guestType = guestFormValue.guestType;
    const newGuest = this.createGuestMember(guestType, guestFormValue);

    this.addMemberToList(newGuest);
    this.resetGuestForm();
    this.hideGuestModal();
  }


  editMember(member: ProcessedMember): void {
    if (member.roleId !== 6) return;

    const guestType = member.isExternal ? 'external' : 'internal';

    this.guestForm.patchValue({
      guid: member.guid,
      guestType: guestType
    });

    if (guestType === 'external') {
      this.guestForm.patchValue({
        name: member.name,
        mobile: member.mobile || '',
        email: member.email || '',
        organization: member.organization || member.position,
        gender: member.gender || 'Male' // اضافه شده
      });
      this._previewImage.set(member.image || null);
    } else {
      const systemUsers = this.availableSystemUsers();
      const internalMember = systemUsers.find(u => u.guid === member.identity.sourceId);
      if (internalMember) {
        this._selectedInternalMember.set(internalMember);
        this.guestForm.patchValue({
          selectedMember: internalMember.guid,
          memberSearch: internalMember.name
        });
      }
    }

    this.showGuestModal();
  }

  // ===== SEARCH FUNCTIONALITY =====
  onSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this._searchQuery.set(input.value);
    this._dropdownVisible.set(true);
  }

  onSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      const filtered = this.availableMembers();
      if (filtered.length > 0) {
        this.selectMember(filtered[0]);
      }
    }
  }

  onInternalMemberSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this._internalMemberSearchQuery.set(input.value);
    this._internalMemberDropdownVisible.set(true);
  }

  selectInternalMember(member: SystemUser): void {
    this._selectedInternalMember.set(member);
    this.guestForm.patchValue({
      selectedMember: member.guid,
      memberSearch: member.name
    });
    this._internalMemberDropdownVisible.set(false);
  }

  private clearSearch(): void {
    this._searchQuery.set('');
    this._dropdownVisible.set(false);
    const searchBoxRef = this.searchBox();
    if (searchBoxRef?.nativeElement) {
      searchBoxRef.nativeElement.value = '';
    }
  }

  // ===== UTILITY METHODS =====
  private convertBoardMembersToUsers(boardMembers: BoardMember[]): SystemUser[] {
    return boardMembers.map(bm => ({
      guid: bm.guid || generateGuid(),
      name: bm.fullName,
      userName: '',
      position: bm.position || '',
      positionGuid: '',
      image: ''
    }));
  }

  private getSystemUserImage(user: SystemUser): string {
    return user.userName
      ? `${environment.fileManagementEndpoint}/photo/${user.userName}.jpg`
      : 'img/default-avatar.png';
  }
  private async loadBoardMemberImageUrl(profileImageGuid: string): Promise<string> {
    try {
      const file = await this.fileService.getFileDetails(profileImageGuid).toPromise() as FileDetails;
      if (!file) {
        return 'img/default-avatar.png';
      }

      const blob = new Blob([base64ToArrayBuffer(file.file)], { type: file.contentType });
      return URL.createObjectURL(blob);
    } catch (error) {
      return 'img/default-avatar.png';
    }
  }
  private getBoardMemberImage(boardMember: BoardMember): string {
    if (boardMember.profileImageGuid) {
      const fileUrls = this._fileUrls();
      if (fileUrls.has(boardMember.profileImageGuid)) {
        return fileUrls.get(boardMember.profileImageGuid)!;
      }

      // شروع بارگذاری تصویر
      this.loadBoardMemberImage(boardMember.profileImageGuid);
    }

    return 'img/default-avatar.png';
  }

  private loadBoardMemberImage(profileImageGuid: string): void {
    this.fileService.getFileDetails(profileImageGuid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (fileDetails: FileDetails) => {
          const blob = new Blob([base64ToArrayBuffer(fileDetails.file)], {
            type: fileDetails.contentType
          });
          const url = URL.createObjectURL(blob);

          const currentUrls = this._fileUrls();
          const newUrls = new Map(currentUrls);
          newUrls.set(profileImageGuid, url);
          this._fileUrls.set(newUrls);
        },
        error: (error) => {
          console.error('خطا در بارگذاری تصویر:', error);
        }
      });
  }

  private sortMembers(members: ProcessedMember[]): void {
    const rolePriority: { [key: number]: number } = {
      6: 1, 3: 2, 1: 3, 2: 4, 4: 5, 5: 6
    };

    // members.sort((a, b) => {
    //   const priorityA = rolePriority[a.roleId] || 999;
    //   const priorityB = rolePriority[b.roleId] || 999;

    //   if (priorityA !== priorityB) {
    //     return priorityA - priorityB;
    //   }

    //   return a.name.localeCompare(b.name, 'fa');
    // });
    members.sort((a, b) => rolePriority[a.roleId || 999] - rolePriority[b.roleId || 999]);
  }

  private areMembersEqual(member1: ProcessedMember, member2: ProcessedMember): boolean {
    return member1.name === member2.name &&
      member1.position === member2.position &&
      member1.roleId === member2.roleId &&
      member1.isRemoved === member2.isRemoved &&
      member1.identity.sourceId === member2.identity.sourceId;
  }

  private emitMembersUpdated(): void {
    const membersToEmit = this._processedMembers().map(member => {
      // حذف identity از object قبل از emit (چون parent component نیازی نداره)
      const { identity, isValidated, ...memberData } = member;
      return memberData;
    });

    this.membersUpdated.emit(membersToEmit);
  }

  private cleanupBlobUrls(): void {
    const fileUrls = this._fileUrls();
    fileUrls.forEach(url => {
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    });

    const members = this._processedMembers();
    members.forEach(member => {
      if (member.image && member.image.startsWith('blob:')) {
        URL.revokeObjectURL(member.image);
      }
    });
  }

  private resetGuestForm(): void {
    this.guestForm.reset({
      guid: generateGuid(),
      guestType: 'external',
      gender: 'Male' // اضافه شده - پیش‌فرض
    });
    this._previewImage.set(null);
    this._selectedInternalMember.set(null);
    this._internalMemberSearchQuery.set('');

    const profileInput = document.getElementById('profile') as HTMLInputElement;
    const signatureInput = document.getElementById('signature') as HTMLInputElement;
    if (profileInput) profileInput.value = '';
    if (signatureInput) signatureInput.value = '';
  }

  private isGuestFormValid(): boolean {
    const guestType = this.guestForm.get('guestType')?.value;

    if (guestType === 'external') {
      return this.guestForm.valid;
    } else if (guestType === 'internal') {
      return !!(this.guestForm.get('guestType')?.valid &&
        this.guestForm.get('selectedMember')?.valid);
    }

    return false;
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      if (control) {
        control.markAsTouched();
        if (control instanceof FormGroup) {
          this.markFormGroupTouched(control);
        }
      }
    });
  }

  // ===== MODAL MANAGEMENT =====
  showGuestModal(): void {
    try {
      const modalElement = document.getElementById('guestModal');
      if (modalElement) {
        const modal = new (window as any).bootstrap.Modal(modalElement);
        modal.show();
      }
    } catch (error) {
      console.error('Error showing guest modal:', error);
    }
  }

  private hideGuestModal(): void {
    try {
      const modalElement = document.getElementById('guestModal');
      if (modalElement) {
        const modal = (window as any).bootstrap.Modal.getInstance(modalElement);
        if (modal) {
          modal.hide();
        }
      }
    } catch (error) {
      console.error('Error hiding guest modal:', error);
    }
  }

  // ===== DROPDOWN MANAGEMENT =====
  showDropdown(): void {
    this._dropdownVisible.set(true);
  }

  hideDropdown(): void {
    setTimeout(() => this._dropdownVisible.set(false), 200);
  }

  shouldShowDropdown(): boolean {
    return this._dropdownVisible();
  }

  showInternalMemberDropdown(): void {
    this._internalMemberDropdownVisible.set(true);
  }

  hideInternalMemberDropdown(): void {
    setTimeout(() => this._internalMemberDropdownVisible.set(false), 200);
  }

  shouldShowInternalMemberDropdown(): boolean {
    return this._internalMemberDropdownVisible() &&
      this.guestForm.get('guestType')?.value === 'internal';
  }

  // ===== FILE MANAGEMENT =====
  onFileSelected(event: Event, controlName: 'profile' | 'signature'): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('لطفاً فقط فایل تصویری انتخاب کنید');
      input.value = '';
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('حجم فایل نباید از 2 مگابایت بیشتر باشد');
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      if (controlName === 'profile') {
        this._previewImage.set(e.target?.result as string);
      }
    };
    reader.readAsDataURL(file);

    let guestGuid = this.guestForm.value.guid;
    if (!guestGuid) {
      guestGuid = generateGuid();
      this.guestForm.patchValue({ guid: guestGuid });
    }

    const currentStorage = this._fileStorage();
    if (!currentStorage[guestGuid]) {
      currentStorage[guestGuid] = {};
    }
    currentStorage[guestGuid][controlName] = file;

    this._fileStorage.set({ ...currentStorage });
    this.fileStorageUpdated.emit(this._fileStorage());
  }


  onGuestTypeChange(guestType: string): void {
    this.guestForm.patchValue({
      name: '',
      mobile: '',
      email: '',
      organization: '',
      selectedMember: '',
      memberSearch: '',
      gender: 'Male' // اضافه شده - پیش‌فرض
    });

    this._selectedInternalMember.set(null);
    this._internalMemberSearchQuery.set('');
    this._previewImage.set(null);

    const profileInput = document.getElementById('profile') as HTMLInputElement;
    const signatureInput = document.getElementById('signature') as HTMLInputElement;
    if (profileInput) profileInput.value = '';
    if (signatureInput) signatureInput.value = '';
  }


  // ===== ROLE MANAGEMENT =====
  getRoleColor(roleId: number): string {
    const roles = this._roles();
    return roles.find(role => role.id === roleId)?.other || '#6c757d';
  }

  getRoleTitle(roleId: number): string {
    const roles = this._roles();
    return roles.find(role => role.id === roleId)?.title || 'نامشخص';
  }

  // ===== UI UTILITIES =====
  toggleCollapse(id: string): void {
    const collapseElement = document.getElementById(`collapse-${id}`);
    if (collapseElement) {
      try {
        const bsCollapse = new Collapse(collapseElement, { toggle: false });

        if (collapseElement.classList.contains('show')) {
          bsCollapse.hide();
        } else {
          bsCollapse.show();
        }
      } catch (error) {
        console.error('Error toggling collapse:', error);
      }
    }
  }

  hasGuestMembers(): boolean {
    return this.activeMembers().some(member => member.roleId === 6);
  }

  // ===== FORM VALIDATION HELPERS =====
  isFormFieldInvalid(fieldName: string): boolean {
    const field = this.guestForm.get(fieldName);
    return !!(field && field.invalid && field.touched);
  }

  getFieldErrorMessage(fieldName: string): string {
    const field = this.guestForm.get(fieldName);
    if (field && field.errors && field.touched) {
      if (field.errors['required']) return `${fieldName} الزامی است`;
      if (field.errors['email']) return 'فرمت ایمیل صحیح نیست';
      if (field.errors['pattern']) return 'فرمت شماره موبایل صحیح نیست';
      if (field.errors['minlength']) return `حداقل ${field.errors['minlength'].requiredLength} کاراکتر مجاز است`;
    }
    return '';
  }

  // ===== TEMPLATE HELPERS =====
  trackByMemberGuid(index: number, member: ProcessedMember): string {
    return member.identity.id ;
  }

  // ===== PUBLIC API FOR PARENT COMPONENT =====

  /**
   * متد عمومی برای اعتبارسنجی یکپارچگی اعضا
   */
  validateMembersIntegrity(): {
    isValid: boolean;
    warnings: string[];
    errors: string[];
    invalidMembers: ProcessedMember[];
  } {
    const members = this._processedMembers();
    const warnings: string[] = [];
    const errors: string[] = [];
    const invalidMembers: ProcessedMember[] = [];

    members.forEach(member => {
      if (member.isRemoved) return;

      if (!member.isValidated) {
        invalidMembers.push(member);

        if (member.identity.type === 'system') {
          errors.push(`کاربر "${member.name}" در سیستم یافت نشد`);
        } else if (member.identity.type === 'board') {
          errors.push(`عضو هیئت مدیره "${member.name}" در سیستم یافت نشد`);
        }
      }

      // بررسی تغییرات احتمالی (برای حالت کپی یا ویرایش طولانی مدت)
      const currentData = this.getCurrentMemberData(member);
      if (currentData && this.hasDataChanged(member, currentData)) {
        warnings.push(`اطلاعات "${member.name}" تغییر کرده است`);
      }
    });

    return {
      isValid: errors.length === 0,
      warnings,
      errors,
      invalidMembers
    };
  }

  private getCurrentMemberData(member: ProcessedMember): any {
    const { identity } = member;

    if (identity.type === 'system') {
      return this.availableSystemUsers().find(u => u.guid === identity.sourceId);
    } else if (identity.type === 'board') {
      return this.availableBoardMembers().find(bm =>
        bm.guid === identity.sourceId
      );
    }

    return null;
  }

  private hasDataChanged(member: ProcessedMember, currentData: any): boolean {
    if (member.identity.type === 'system') {
      return member.name !== currentData.name ||
        member.position !== currentData.position;
    } else if (member.identity.type === 'board') {
      return member.name !== currentData.fullName ||
        member.position !== (currentData.position || '');
    }

    return false;
  }

  /**
   * متد عمومی برای دریافت خلاصه وضعیت اعضا
   */
  getMembersSummary(): {
    total: number;
    active: number;
    removed: number;
    byRole: { [roleId: number]: number };
    hasChairman: boolean;
    hasSecretary: number;
  } {
    const members = this._processedMembers();
    const activeMembers = members.filter(m => !m.isRemoved);

    const byRole: { [roleId: number]: number } = {};
    activeMembers.forEach(member => {
      byRole[member.roleId] = (byRole[member.roleId] || 0) + 1;
    });

    return {
      total: members.length,
      active: activeMembers.length,
      removed: members.filter(m => m.isRemoved).length,
      byRole,
      hasChairman: (byRole[3] || 0) > 0,
      hasSecretary: (byRole[1] || 0) + (byRole[2] || 0)
    };
  }

  /**
   * متد عمومی برای بازیابی همه اعضای حذف شده (در حالت ویرایش)
   */
  restoreAllRemovedMembers(): void {
    const members = this._processedMembers();
    let hasChanges = false;

    const restoredMembers = members.map(member => {
      if (member.isRemoved) {
        hasChanges = true;
        return { ...member, isRemoved: false };
      }
      return member;
    });

    if (hasChanges) {
      this.sortMembers(restoredMembers);
      this._processedMembers.set(restoredMembers);
      this.emitMembersUpdated();
    }
  }

  /**
   * متد عمومی برای پاک کردن همه اعضا
   */
  clearAllMembers(): void {
    this._processedMembers.set([]);
    this.emitMembersUpdated();
  }








  // به‌روزرسانی createProcessedMember
  private createProcessedMember(member: MeetingMember): ProcessedMember {
    const identity = this.createMemberIdentity(member);
    return {
      ...member,
      identity,
      isValidated: false,
      guid: member.guid || generateGuid()
    };
  }

  // به‌روزرسانی createMemberIdentityFromUser (select normal)
  private async createMemberIdentityFromUser(user: SystemUser): Promise<MemberIdentity> {
    const isBoardMeeting = this.isBoardMeeting();
    const boardMembers = this.availableBoardMembers();
    const matchingBoardMember = boardMembers.find(bm => bm.guid === user.guid);
    if (isBoardMeeting && matchingBoardMember) {
      return {
        id: generateGuid(),
        type: 'board',
        sourceId: matchingBoardMember.guid || matchingBoardMember.id,
        userKey: matchingBoardMember.guid || matchingBoardMember.id,
        displayName: matchingBoardMember.fullName,
        position: matchingBoardMember.position || '',
        image: user.image,
        isSystem: false
      };
    }
    const compositeSourceId = `${user.guid}_${user.positionGuid || ''}`;
    return {
      id: generateGuid(),
      type: 'system',
      sourceId: compositeSourceId, // composite
      userKey: user.baseUserGuid ?? user.guid, // اصلی
      displayName: user.name,
      position: user.position,
      image: this.getSystemUserImage(user),
      isSystem: true
    };
  }

  // به‌روزرسانی createNewMemberFromUser
  private createNewMemberFromUser(user: SystemUser, identity: MemberIdentity): ProcessedMember {
    const baseMember: MeetingMember = {
      id: 0,
      guid: identity.id,
      name: identity.displayName,
      position: identity.position,
      roleId: 5,
      isExternal: false,
      isRemoved: false,
      image: identity.image ?? 'img/default-avatar.png',
      userGuid: identity.userKey, // اصلی! (baseUserGuid)
      positionGuid: user.positionGuid,
      userName: user.userName
    };
    if (identity.type === 'board') {
      baseMember.boardMemberGuid = identity.sourceId;
      delete baseMember.userGuid;
    }
    return {
      ...baseMember,
      identity,
      isValidated: true
    };
  }

  // به‌روزرسانی selectMember (emit base)
  async selectMember(member: SystemUser): Promise<void> {
    const identity = await this.createMemberIdentityFromUser(member);
    const newMember = this.createNewMemberFromUser(member, identity);
    this.addMemberToList(newMember);
    this.clearSearch();
    this.conflictCheckRequested.emit(identity.userKey); // baseUserGuid اصلی
  }

  private createGuestMember(guestType: string, formValue: any): ProcessedMember {
    const guestGuid = formValue.guid || generateGuid();

    if (guestType === 'internal') {
      const selectedMember = this._selectedInternalMember();
      if (!selectedMember) throw new Error('No internal member selected');

      const compositeKey = this.getUserCompositeKey(selectedMember);
      const relevantPos = selectedMember.positions?.find((p: any) =>
        p.positionGuid === selectedMember.positionGuid) || selectedMember.positions?.[0];
      const positionTitle = relevantPos ? relevantPos.positionTitle : selectedMember.position;
      const positionGuid = relevantPos ? relevantPos.positionGuid : selectedMember.positionGuid || '';

      const identity: MemberIdentity = {
        id: guestGuid,
        type: 'system',
        sourceId: compositeKey,
        userKey: selectedMember.guid,
        displayName: selectedMember.name,
        position: positionTitle
      };

      return {
        id: 0,
        guid: guestGuid,
        userGuid: selectedMember.baseUserGuid,
        positionGuid: positionGuid,
        name: selectedMember.name,
        position: positionTitle,
        userName: selectedMember.userName,
        roleId: 6,
        isExternal: false,
        isRemoved: false,
        image: this.getSystemUserImage(selectedMember),
        identity,
        isValidated: true
      };
    } else {
      // External guest - اصلاح شده با gender
      const identity: MemberIdentity = {
        id: guestGuid,
        type: 'external',
        sourceId: guestGuid,
        userKey: guestGuid,
        displayName: formValue.name,
        position: formValue.organization
      };

      return {
        id: 0,
        guid: guestGuid,
        name: formValue.name,
        position: formValue.organization,
        mobile: formValue.mobile,
        email: formValue.email,
        organization: formValue.organization, // اطمینان از ذخیره
        gender: formValue.gender, // اضافه شده
        roleId: 6,
        isExternal: true,
        isRemoved: false,
        image: this._previewImage() || 'img/default-avatar.png',
        identity,
        isValidated: true
      };
    }
  }

  // به‌روزرسانی hasConflict (از userKey یا board)
  hasConflict(member: ProcessedMember, conflictType: 'Meeting' | 'Leave'): boolean {
    const conflicts = this.conflictedUsers();
    const memberId = member.identity.type === 'system' ? member.userGuid : // اصلی
      member.identity.type === 'board' ? member.boardMemberGuid : null;
    return memberId ? conflicts.some(conflict =>
      conflict.guid === memberId && conflict.type === conflictType
    ) : false;
  }
  // به‌روزرسانی validateSingleMember برای حفظ سمت در ویرایش
  private validateSingleMember(
    member: ProcessedMember,
    systemUsers: SystemUser[], // processed
    boardMembers: BoardMember[]
  ): ProcessedMember {
    const { identity } = member;
    let isValidated = true;
    let updatedMember = { ...member };

    switch (identity.type) {
      case 'system':
        // جستجوی دقیق‌تر با composite key
        const [baseGuid, posGuid] = identity.sourceId.split('_');
        const systemUser = systemUsers.find(u =>
          (u.baseUserGuid === baseGuid || u.guid === baseGuid) &&
          (posGuid ? u.positionGuid === posGuid : !u.positionGuid || u.positionGuid === '')
        );

        if (systemUser) {
          updatedMember = {
            ...updatedMember,
            name: systemUser.name,
            position: systemUser.position || member.position, // حفظ position قبلی اگر جدید خالی بود
            userName: systemUser.userName,
            positionGuid: systemUser.positionGuid || posGuid || '',
            userGuid: systemUser.baseUserGuid || systemUser.guid || baseGuid, // اصلی
            image: this.getSystemUserImage(systemUser),
            identity: {
              ...identity,
              displayName: systemUser.name,
              position: (systemUser.position || member.position) ?? ''
            }
          };
        } else {
          isValidated = false;
          console.warn(`System user-position not found: ${identity.sourceId}, keeping original position: ${member.position}`);
          // حفظ اطلاعات موجود
          updatedMember = {
            ...updatedMember,
            position: member.position // حفظ سمت قبلی
          };
        }
        break;

      case 'board':
        const boardMember = boardMembers.find(bm =>
          bm.guid === identity.sourceId || bm.id === parseInt(identity.sourceId)
        );

        if (boardMember) {
          updatedMember = {
            ...updatedMember,
            name: boardMember.fullName,
            position: boardMember.position || member.position,
            boardMemberGuid: boardMember.guid || boardMember.id,
            identity: {
              ...identity,
              displayName: boardMember.fullName,
              position: boardMember.position || member.position || ''
            }
          };

          // بارگذاری تصویر board member
          if (boardMember.profileImageGuid) {
            updatedMember.image = this.getBoardMemberImage(boardMember);
          }
        } else {
          isValidated = false;
          console.warn(`Board member not found: ${identity.sourceId}, keeping original position: ${member.position}`);
          updatedMember = {
            ...updatedMember,
            position: member.position
          };
        }
        break;

      case 'external':
        // مهمان‌های خارجی همیشه valid هستند
        isValidated = true;
        break;
    }

    updatedMember.isValidated = isValidated;
    return updatedMember;
  }

  // اصلاح createMemberIdentity برای حفظ بهتر اطلاعات
  private createMemberIdentity(member: MeetingMember): MemberIdentity {
    if (member.isExternal) {
      return {
        id: member.guid || generateGuid(),
        type: 'external',
        sourceId: member.guid || generateGuid(),
        userKey: member.guid || generateGuid(), // برای external همان guid
        displayName: member.name,
        position: member.organization || member.position || ''
      };
    }

    if (member.boardMemberGuid) {
      return {
        id: member.guid || generateGuid(),
        type: 'board',
        sourceId: member.boardMemberGuid,
        userKey: member.boardMemberGuid, // board key همان guid
        displayName: member.name,
        position: member.position || ''
      };
    }

    // System user - ساخت composite key دقیق
    const baseGuid = member.userGuid || member.guid || generateGuid();
    const posGuid = member.positionGuid || '';

    return {
      id: member.guid || generateGuid(),
      type: 'system',
      sourceId: posGuid ? `${baseGuid}_${posGuid}` : baseGuid, // composite فقط اگر سمت داشته باشد
      userKey: baseGuid, // اصلی
      displayName: member.name,
      position: member.position || '',
      positionGuid: posGuid
    };
  }

  // بهبود syncWithInputMembers برای جلوگیری از update‌های غیرضروری
  private syncWithInputMembers(): void {
    const inputMembers = this.selectedMembers();
    if (!inputMembers || inputMembers.length === 0) {
      if (this._processedMembers().length > 0) {
        this._processedMembers.set([]);
      }
      return;
    }

    const processedMembers = inputMembers.map(m => this.createProcessedMember(m));

    // بررسی دقیق‌تر برای تشخیص تغییرات واقعی
    const hasRealChanges = this.hasRealMemberChanges(this._processedMembers(), processedMembers);

    if (hasRealChanges) {
      this._processedMembers.set(processedMembers);
      this.validateAndUpdateMembers();
    }
  }

  // متد کمکی برای تشخیص تغییرات واقعی
  private hasRealMemberChanges(oldMembers: ProcessedMember[], newMembers: ProcessedMember[]): boolean {
    if (oldMembers.length !== newMembers.length) {
      return true;
    }

    for (let i = 0; i < oldMembers.length; i++) {
      const oldMember = oldMembers[i];
      const newMember = newMembers[i];

      // بررسی فیلدهای کلیدی
      if (oldMember.guid !== newMember.guid ||
        oldMember.name !== newMember.name ||
        oldMember.position !== newMember.position ||
        oldMember.roleId !== newMember.roleId ||
        oldMember.isRemoved !== newMember.isRemoved ||
        oldMember.identity.sourceId !== newMember.identity.sourceId) {
        return true;
      }
    }

    return false;
  }

  // بهبود getUserCompositeKey برای سازگاری بیشتر
  private getUserCompositeKey(user: SystemUser): string {
    // اگر کاربر positionGuid مستقیم دارد
    if (user.positionGuid) {
      return `${user.guid}_${user.positionGuid}`;
    }

    // اگر در positions دارد
    if (user.positions && user.positions.length > 0) {
      const firstPosition = user.positions[0];
      return firstPosition.positionGuid
        ? `${user.guid}_${firstPosition.positionGuid}`
        : user.guid;
    }

    // اگر هیچ سمتی ندارد
    return user.guid;
  }
}