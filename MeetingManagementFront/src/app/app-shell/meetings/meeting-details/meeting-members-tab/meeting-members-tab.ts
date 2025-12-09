import {
  Component,
  ElementRef,
  NgZone,
  OnInit,
  ViewChild,
  inject,
  signal,
  computed,
  effect,
  input,
  output,
  DestroyRef
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MeetingMemberService } from '../../../../services/meeting-member.service';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { NgFor, NgIf, NgStyle } from '@angular/common';
import { MeetingDetails, MeetingMember } from '../../../../core/models/Meeting';
import { LocalStorageService } from '../../../../services/framework-services/local.storage.service';
import { ISSP, Main_USER_ID, POSITION_ID, USER_ID_NAME } from '../../../../core/types/configuration';
import { catchError, forkJoin, map, of } from 'rxjs';
import { MeetingService } from '../../../../services/meeting.service';
import { CustomSelectComponent } from "../../../../shared/custom-controls/custom-select";
import { UserService } from '../../../../services/user.service';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { SystemUser } from '../../../../core/models/User';
import { ComboBase } from '../../../../shared/combo-base';
import { CustomInputComponent } from "../../../../shared/custom-controls/custom-input";
import { SwalService } from '../../../../services/framework-services/swal.service';
import { RoleService } from '../../../../services/role.service';
import { MeetingBehaviorService } from '../meeting-behavior-service';
import { getClientSettings } from '../../../../services/framework-services/code-flow.service';
import { environment } from '../../../../../environments/environment';
import { FileService } from '../../../../services/file.service';
import { Modal } from 'bootstrap';

declare var $: any;

type ModalMode = 'add' | 'replacement';

interface GuestData {
  name: string;
  roleId: number;
  isExternal: boolean;
  mobile: string;
  email: string;
  organization: string;
  meetingGuid: string;
}

interface ReplacementData {
  memberId?: number;
  replacementUserGuid: string;
  meetingGuid: string;
}

interface NewMemberData {
  userGuid: string;
  roleGuid: string;
  meetingGuid: string;
}

@Component({
  selector: 'app-meeting-members-tab',
  standalone: true,
  imports: [CustomSelectComponent, ReactiveFormsModule, CustomInputComponent, NgStyle],
  templateUrl: './meeting-members-tab.html',
  styleUrl: './meeting-members-tab.css'
})
export class MeetingMembersTabComponent implements OnInit {
  // Injected services
  private readonly destroyRef = inject(DestroyRef);
  private readonly meetingMemberService = inject(MeetingMemberService);
  private readonly localStorageService = inject(LocalStorageService);
  private readonly route = inject(ActivatedRoute);
  private readonly meetingService = inject(MeetingService);
  private readonly userService = inject(UserService);
  private readonly fb = inject(FormBuilder);
  private readonly swalService = inject(SwalService);
  private readonly fileService = inject(FileService);
  private readonly zone = inject(NgZone);
  private readonly meetingBehaviorService = inject(MeetingBehaviorService);
  private readonly roleService = inject(RoleService);

  // Inputs
  readonly meetingGuid = input<string>('');
  readonly canEdit = input<boolean>(false);
  readonly canAddMembers = input<boolean>(false);
  readonly canManageAttendance = input<boolean>(false);

  // Outputs
  readonly memberAdded = output<MeetingMember>();
  readonly memberUpdated = output<MeetingMember>();
  readonly memberDeleted = output<number>();
  readonly attendanceChanged = output<{ memberId: number; isPresent: boolean }>();
  readonly replacementSet = output<{ memberId: number; replacementUserGuid: string }>();
  readonly commentSaved = output<{ memberId: number; comment: string; isSign: boolean }>();

  // ViewChild references
  @ViewChild('signModal') signModal!: ElementRef;

  // Private signals for internal state
  private readonly _roles = signal<ComboBase[]>([]);
  private readonly _users = signal<ComboBase[]>([]);
  private readonly _memberGuids = signal<string[]>([]);
  private readonly _statusId = signal<number | null>(null);
  private readonly _roleId = signal<number | null>(null);
  private readonly _modalMode = signal<ModalMode>('add');
  private readonly _signatureImage = signal<string>('');
  private readonly _currentSelectedMember = signal<MeetingMember | null>(null);

  // Form signals
  private readonly _replacementForm = signal<FormGroup>(this.createReplacementForm());
  private readonly _signForm = signal<FormGroup>(this.createSignForm());
  private readonly _guestForm = signal<FormGroup>(this.createGuestForm());
  private readonly _commentForm = signal<FormGroup>(this.createCommentForm());

  // Readonly signals for template access
  readonly roles = this._roles.asReadonly();
  readonly users = this._users.asReadonly();
  readonly memberGuids = this._memberGuids.asReadonly();
  readonly statusId = this._statusId.asReadonly();
  readonly roleId = this._roleId.asReadonly();
  readonly modalMode = this._modalMode.asReadonly();
  readonly signatureImage = this._signatureImage.asReadonly();
  readonly currentSelectedMember = this._currentSelectedMember.asReadonly();

  readonly replacementForm = this._replacementForm.asReadonly();
  readonly signForm = this._signForm.asReadonly();
  readonly guestForm = this._guestForm.asReadonly();
  readonly commentForm = this._commentForm.asReadonly();

  // Signals from behavior service
  readonly members = this.meetingBehaviorService.members;
  readonly meeting = this.meetingBehaviorService.meeting;
  readonly currentMember = this.meetingBehaviorService.currentMember;

  // Computed signals for filtered members
  readonly externalMembers = computed(() =>
    this.members().filter(m => m.isExternal)
  );

  readonly internalMembers = computed(() =>
    this.members().filter(m => !m.isExternal)
  );

  // User information computed signals
  readonly userGuid = computed(() =>
    this.localStorageService.getItem(USER_ID_NAME)
  );

  readonly positionGuid = computed(() =>
    this.localStorageService.getItem(POSITION_ID)
  );

  readonly isSuperAdmin = computed(() =>
    this.localStorageService.getItem(ISSP) === 'true'
  );

  // Permission computed signals
  readonly canDeleteMember = computed(() => {
    const member = this.currentMember();
    return member && ([1, 2].includes(member.roleId) || this.isSuperAdmin());
  });

  readonly canSetReplacement = computed(() => {
    const member = this.currentMember();
    return member && ([1, 2, 3].includes(member.roleId) || this.isSuperAdmin());
  });

  readonly canSignMeeting = computed(() => {
    const meetingData = this.meeting();
    const member = this.currentMember();
    return meetingData?.statusId === 4 && member && !member.isDelegate;
  });

  readonly isReplacementMode = computed(() => this._modalMode() === 'replacement');

  constructor() {
    this.setupEffects();
  }

  ngOnInit(): void {
    this.subscribeToRoute();
    this.loadInitialData();
  }

  // Effects setup
  private setupEffects(): void {
    // Effect to load members when meetingGuid changes
    effect(() => {
      const guid = this.meetingGuid();
      if (guid) {
        this.loadMembers();
      }
    });

    // Effect to update member guids when members change
    effect(() => {
      const membersList = this.members();
      const guids = membersList.map(m => m.userGuid ?? '');
      this._memberGuids.set(guids);
    });
  }

  // Form creation methods
  private createReplacementForm(): FormGroup {
    return this.fb.group({
      memberId: [null],
      replacementUserGuid: [''],
      roleGuid: ['']
    });
  }

  private createSignForm(): FormGroup {
    return this.fb.group({
      memberId: [null],
      comment: [''],
      sign: [false]
    });
  }

  private createGuestForm(): FormGroup {
    return this.fb.group({
      name: ['', Validators.required],
      mobile: [''],
      email: ['', [Validators.email]],
      organization: [''],
      profile: [null],
      signature: [null]
    });
  }

  private createCommentForm(): FormGroup {
    return this.fb.group({
      memberId: [null],
      description: ['']
    });
  }

  // Route subscription
  private subscribeToRoute(): void {
    this.route.paramMap.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((params: ParamMap) => {
      const guid = params.get('guid') || this.meetingGuid();
      if (guid) {
        this.loadMembers();
      }
    });
  }

  // Data loading methods
  private loadInitialData(): void {
    this.getRoles();
    this.loadMembers();
  }

  getRoles(): void {
    this.roleService.getForCombo<ComboBase[]>().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(data => {
      this._roles.set(data);
    });
  }

  loadMembers(): void {
    const guid = this.meetingGuid() || this.route.snapshot.params['guid'];
    if (!guid) return;

    // Load meeting details first
    this.meetingService.getUserMeeting<MeetingDetails>(
      guid,
      this.userGuid(),
      this.positionGuid(),
      this.isSuperAdmin()
    ).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(data => {
      this._roleId.set(data.roleId);
      this._statusId.set(data.statusId);
      this._memberGuids.set(data.userGuids);
    });

    // Load and process members
    this.loadAndProcessMembers(guid);
  }

  private loadAndProcessMembers(guid: string): void {
    const userGuidValue = this.userGuid();
    const positionGuidValue = this.positionGuid();

    if (!userGuidValue || !positionGuidValue) return;

    this.meetingMemberService.getUserList(guid, positionGuidValue).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(userList => {
      const requests = userList.map((member: MeetingMember) => {
        // Set substitute name if replacement exists
        if (member.replacementUserGuid) {
          member.substitute = userList.find(
            (m: MeetingMember) => m.userGuid === member.replacementUserGuid
          )?.name || '';
        }

        // Handle profile image
        if (member.profileGuid) {
          return this.fileService.getFileDetails(member.profileGuid).pipe(
            catchError(() => of(null)),
            map(file => {
              if (file) {
                const arrayBuffer = this.base64ToArrayBuffer(file.file);
                const blob = new Blob([arrayBuffer], { type: file.contentType });
                member.image = URL.createObjectURL(blob);
              }
              return member;
            })
          );
        } else {
          member.image = `${environment.fileManagementEndpoint}/photo/${member.userName}.jpg`;
        }

        return of(member);
      });

      forkJoin(requests).pipe(
        takeUntilDestroyed(this.destroyRef)
      ).subscribe((resolvedMembers: MeetingMember[]) => {
        this.meetingBehaviorService.setMembers(resolvedMembers);
      });
    });
  }

  // Member management methods
  togglePresence(member: MeetingMember, status: boolean): void {
    const memberItem = {
      id: member.id,
      isPresent: status
    };

    this.meetingMemberService.attendance(memberItem).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      this.zone.run(() => {
        this.loadMembers();
        this.attendanceChanged.emit({ memberId: member.id ?? 0, isPresent: status });
      });
    });
  }

  toggleSignature(member: MeetingMember): void {
    const memberItem = {
      memberId: member.id,
      isSign: !member.isSign
    };

    this.meetingMemberService.setComment(memberItem).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      this.updateMemberInState(member.id ?? 0, { isSign: !member.isSign });
    });
  }

  askForDelete(id: number): void {
    this.swalService.fireSwal('آیا از حذف این عضو اطمینان دارید؟').then((result: { value: any; dismiss?: any; }) => {
      if (result.value === true) {
        this.deleteMember(id);
      } else {
        this.swalService.dismissSwal(result);
      }
    });
  }

  private deleteMember(id: number): void {
    this.meetingMemberService.delete(id).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      this.zone.run(() => {
        this.loadMembers();
        this.memberDeleted.emit(id);
      });
    });
  }

  // Modal management methods
  showGuestModal(): void {
    this._guestForm().reset();
    $("#guestModal").modal('toggle');
  }

  openReplacementModal(memberId: number): void {
    this._modalMode.set('replacement');
    this._replacementForm().setValue({
      memberId,
      replacementUserGuid: '',
      roleGuid: null
    });
    this.loadUsers();
    $('#memberModal').modal('show');
  }

  openAddMemberModal(): void {
    this._modalMode.set('add');
    this._replacementForm().setValue({
      memberId: null,
      replacementUserGuid: '',
      roleGuid: ''
    });
    this.loadUsers();
    $('#memberModal').modal('show');
  }

  showSignModal(memberId: number): void {
    const member = this.members().find(m => m.id === memberId);
    if (!member) return;

    this._currentSelectedMember.set(member);
    this._signForm().reset();

    if (this.signModal) {
      const modalInstance = Modal.getInstance(this.signModal.nativeElement) ||
        new Modal(this.signModal.nativeElement);
      modalInstance.show();
    }

    // Load user signature
    this.userService.getUserInformation(member.userGuid).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(user => {
      this._signatureImage.set(
        `${environment.fileManagementEndpoint}/EpcSignature/${user.userName}.jpg`
      );
    });

    // Populate form
    this._signForm().patchValue({
      memberId: member.id,
      comment: member.comment,
      sign: member.isSign
    });
  }

  openCommentModal(memberId: number): void {
    this._commentForm().setValue({
      memberId,
      description: ''
    });
    $('#commentModal').modal('show');
  }

  // Form handling methods
  toggleSign(): void {
    const form = this._signForm();
    const currentValue = form.get('sign')?.value;
    form.get('sign')?.setValue(!currentValue);
  }

  addGuest(): void {
    const form = this._guestForm();
    if (!form.valid) return;

    const guest: GuestData = {
      name: form.value.name,
      roleId: 6, // نقش کاربر عادی
      isExternal: true,
      mobile: form.value.mobile || '',
      email: form.value.email || '',
      organization: form.value.organization || '',
      meetingGuid: this.meetingGuid() || this.route.snapshot.params['guid']
    };

    this.meetingMemberService.createOrEdit(guest).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(data => {
      form.reset();
      this.zone.run(() => {
        this.loadMembers();
        this.memberAdded.emit(data as MeetingMember);
      });
      ($('#guestModal') as any).modal('hide');
    });
  }

  saveMember(): void {
    const formData = this._replacementForm().value;
    const guid = this.meetingGuid() || this.route.snapshot.params['guid'];

    if (this.isReplacementMode()) {
      this.saveReplacement(formData, guid);
    } else {
      this.saveNewMember(formData, guid);
    }
  }

  private saveReplacement(formData: any, guid: string): void {
    const replacementData: ReplacementData = {
      memberId: formData.memberId,
      replacementUserGuid: formData.replacementUserGuid,
      meetingGuid: guid
    };

    this.meetingMemberService.setComment(replacementData).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      $('#memberModal').modal('hide');
      this.zone.run(() => {
        this.loadMembers();
        this.replacementSet.emit({
          memberId: formData.memberId,
          replacementUserGuid: formData.replacementUserGuid
        });
      });
    });
  }

  private saveNewMember(formData: any, guid: string): void {
    const newMemberData: NewMemberData = {
      userGuid: formData.replacementUserGuid,
      roleGuid: formData.roleGuid,
      meetingGuid: guid
    };

    this.meetingMemberService.createMember(newMemberData).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((newMember) => {
      $('#memberModal').modal('hide');
      this.zone.run(() => {
        this.loadMembers();
        this.memberAdded.emit(newMember as MeetingMember);
      });
    });
  }

  saveComment(): void {
    const form = this._signForm();
    if (!form.valid) return;

    const formValue = form.value;
    const userGuid = this.localStorageService.getItem(Main_USER_ID);

    const payload = {
      memberId: formValue.memberId,
      isSign: formValue.sign,
      comment: formValue.comment,
      signer: userGuid
    };

    this.meetingMemberService.setComment(payload).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      this.updateMemberInState(payload.memberId, {
        isSign: payload.isSign,
        comment: payload.comment
      });

      this.hideSignModal();
      this.commentSaved.emit({
        memberId: payload.memberId,
        comment: payload.comment,
        isSign: payload.isSign
      });
    });
  }

  // Helper methods
  private loadUsers(): void {
    const clientId = getClientSettings().client_id ?? "";

    this.userService.getAllByClientId<SystemUser[]>(clientId).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((data: SystemUser[]) => {
      const filteredUsers = data
        .filter(user => !this._memberGuids().includes(user.guid))
        .map(user => ({ guid: user.guid, title: user.name }));

      this._users.set(filteredUsers);
    });
  }

  private updateMemberInState(memberId: number, updates: Partial<MeetingMember>): void {
    const members = this.meetingBehaviorService.getMembersValue();
    const memberIndex = members.findIndex(member => member.id === memberId);

    if (memberIndex !== -1) {
      const updatedMembers = [...members];
      updatedMembers[memberIndex] = {
        ...updatedMembers[memberIndex],
        ...updates
      };

      this.meetingBehaviorService.updateMembers(updatedMembers);
      this.memberUpdated.emit(updatedMembers[memberIndex]);
    }
  }

  private hideSignModal(): void {
    if (this.signModal) {
      const modalInstance = Modal.getInstance(this.signModal.nativeElement);
      if (modalInstance) {
        modalInstance.hide();
      }
    }
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  // Signal-based utility methods for template
  updateReplacementForm(field: string, value: any): void {
    const form = this._replacementForm();
    form.get(field)?.setValue(value);
  }

  updateSignForm(field: string, value: any): void {
    const form = this._signForm();
    form.get(field)?.setValue(value);
  }

  updateGuestForm(field: string, value: any): void {
    const form = this._guestForm();
    form.get(field)?.setValue(value);
  }

  getFormValue(formType: 'replacement' | 'sign' | 'guest', field: string): any {
    switch (formType) {
      case 'replacement':
        return this._replacementForm().get(field)?.value;
      case 'sign':
        return this._signForm().get(field)?.value;
      case 'guest':
        return this._guestForm().get(field)?.value;
      default:
        return null;
    }
  }

  // Form validation helpers
  isFormValid(formType: 'replacement' | 'sign' | 'guest'): boolean {
    switch (formType) {
      case 'replacement':
        return this._replacementForm().valid;
      case 'sign':
        return this._signForm().valid;
      case 'guest':
        return this._guestForm().valid;
      default:
        return false;
    }
  }

  getFormErrors(formType: 'replacement' | 'sign' | 'guest', field: string): any {
    switch (formType) {
      case 'replacement':
        return this._replacementForm().get(field)?.errors;
      case 'sign':
        return this._signForm().get(field)?.errors;
      case 'guest':
        return this._guestForm().get(field)?.errors;
      default:
        return null;
    }
  }

  // Template helper methods
  trackByMemberGuid(index: number, member: MeetingMember): string {
    return member.userGuid ?? '';
  }

  trackByUserGuid(index: number, user: ComboBase): string {
    return user.guid ?? '';
  }

  trackByRoleGuid(index: number, role: ComboBase): string {
    return role.guid ?? '';
  }

  // Computed helpers for specific business logic
  readonly canTogglePresence = computed(() => {
    const member = this.currentMember();
    const meetingData = this.meeting();
    return member && meetingData &&
      ([1, 2, 3].includes(member.roleId) || this.isSuperAdmin()) &&
      meetingData.statusId !== 5; // Assuming 5 is closed/finalized status
  });

  readonly canAddGuest = computed(() => {
    const member = this.currentMember();
    return member && ([1, 2].includes(member.roleId) || this.isSuperAdmin());
  });

  readonly showReplacementOption = computed(() => {
    const member = this.currentMember();
    const meetingData = this.meeting();
    return member && meetingData &&
      ([1, 2, 3].includes(member.roleId) || this.isSuperAdmin()) &&
      meetingData.statusId !== 5;
  });

  // Reset methods for clean state management
  resetReplacementForm(): void {
    this._replacementForm().reset();
    this._modalMode.set('add');
  }

  resetSignForm(): void {
    this._signForm().reset();
    this._currentSelectedMember.set(null);
    this._signatureImage.set('');
  }

  resetGuestForm(): void {
    this._guestForm().reset();
  }

  // Public methods for parent component interaction
  refreshMembers(): void {
    this.loadMembers();
  }

  getMemberById(id: number): MeetingMember | undefined {
    return this.members().find(m => m.id === id);
  }

  getMemberByUserGuid(userGuid: string): MeetingMember | undefined {
    return this.members().find(m => m.userGuid === userGuid);
  }
}
