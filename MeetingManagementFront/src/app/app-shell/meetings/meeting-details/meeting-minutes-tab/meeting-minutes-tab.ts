import {
  Component,
  ElementRef,
  NgZone,
  ViewChild,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
  effect,
  input,
  output,
  DestroyRef
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Modal } from 'bootstrap';
import { ActivatedRoute } from '@angular/router';
import { MeetingDetails, MeetingMember } from '../../../../core/models/Meeting';
import { MeetingService } from '../../../../services/meeting.service';
import { CommonModule } from '@angular/common';
import { LocalStorageService } from '../../../../services/framework-services/local.storage.service';
import { base64ToArrayBuffer, IsDeletage, ISSP, Main_USER_ID, USER_ID_NAME } from '../../../../core/types/configuration';
import { Resolution } from '../../../../core/models/Resolution';
import { ComboBase } from '../../../../shared/combo-base';
import { MeetingMemberService } from '../../../../services/meeting-member.service';
import { combineLatest, map } from 'rxjs';
import { FileMeetingService } from '../../../../services/file-meeting.service';
import { CodeFlowService } from '../../../../services/framework-services/code-flow.service';
import { FileService } from '../../../../services/file.service';
import { CustomInputComponent } from "../../../../shared/custom-controls/custom-input";
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { environment } from '../../../../../environments/environment';
import { PasswordFlowService } from '../../../../services/framework-services/password-flow.service';
import { UserService } from '../../../../services/user.service';
import { FileUploaderComponent } from "../../../../shared/file-uploader/file-uploader";
import { MeetingBehaviorService } from '../meeting-behavior-service';
import { FileItem } from '../../../../core/models/file';

declare var $: any;
declare var Swal: any;

interface FormattedAssignment {
  followerName: string;      // یک پیگیر برای هر گروه
  actionerNames: string;     // چند اقدام‌کننده در همین گروه
  dueDate: string;           // یک مهلت برای هر گروه
  type: string;              // یک نوع تخصیص برای هر گروه
}


interface MemberDescription {
  name: string;
  comment: string;
}

interface SignedMember {
  name: string;
  signature: string;
}

interface AttachmentFile {
  guid: string;
  fileName: string;
  file: string;
  contentType: string;
}

@Component({
  selector: 'app-meeting-minutes-tab',
  imports: [
    CommonModule,
    CustomInputComponent,
    ReactiveFormsModule,
    FileUploaderComponent
  ],
  templateUrl: './meeting-minutes-tab.html',
  styleUrl: './meeting-minutes-tab.css'
})
export class MeetingMinutesTabComponent implements OnInit, OnDestroy {
  // Injected services
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly meetingService = inject(MeetingService);
  private readonly localStorageService = inject(LocalStorageService);
  private readonly fileMeetingService = inject(FileMeetingService);
  private readonly fileService = inject(FileService);
  private readonly codeFlowService = inject(CodeFlowService);
  private readonly memberService = inject(MeetingMemberService);
  private readonly meetingBehaviorService = inject(MeetingBehaviorService);
  private readonly route = inject(ActivatedRoute);
  private readonly passwordFlowService = inject(PasswordFlowService);
  private readonly userService = inject(UserService);
  private readonly zone = inject(NgZone);

  // Inputs
  readonly meetingGuid = input<string>('');
  readonly canEdit = input<boolean>(false);
  readonly canDelete = input<boolean>(false);

  // Outputs
  readonly meetingUpdated = output<MeetingDetails>();
  readonly memberUpdated = output<MeetingMember>();
  readonly fileUploaded = output<FileItem[]>();
  readonly signatureCompleted = output<{ memberId: number; isSign: boolean; comment: string }>();

  // ViewChild references
  @ViewChild('fileModal') fileModal!: ElementRef;
  @ViewChild('signModal') signModal!: ElementRef;
  @ViewChild('fileViewerModal') fileViewerModal!: ElementRef;
  @ViewChild('printSection') printSection!: ElementRef;

  // Signals for component state
  private readonly _signForm = signal<FormGroup>(this.createSignForm());
  private readonly _selectedFiles = signal<FileItem[]>([]);
  private readonly _filesToSave = signal<FileItem[]>([]);
  private readonly _attachments = signal<any[]>([]);
  private readonly _fileUrl = signal<string>('');
  private readonly _fileName = signal<string>('');
  private readonly _fileContent = signal<string>('');
  private readonly _fileType = signal<'image' | 'pdf' | 'text' | 'other'>('other');
  private readonly _loadingFile = signal<boolean>(false);
  private readonly _signatureImage = signal<string>('');
  private readonly _mainUser = signal<string>('');

  // Readonly signals for template access
  readonly signForm = this._signForm.asReadonly();
  readonly selectedFiles = this._selectedFiles.asReadonly();
  readonly filesToSave = this._filesToSave.asReadonly();
  readonly attachments = this._attachments.asReadonly();
  readonly fileUrl = this._fileUrl.asReadonly();
  readonly fileName = this._fileName.asReadonly();
  readonly fileContent = this._fileContent.asReadonly();
  readonly fileType = this._fileType.asReadonly();
  readonly loadingFile = this._loadingFile.asReadonly();
  readonly signatureImage = this._signatureImage.asReadonly();
  readonly mainUser = this._mainUser.asReadonly();

  // Computed signals from behavior service
  readonly meeting = this.meetingBehaviorService.meeting;
  readonly members = this.meetingBehaviorService.members;
  readonly currentMember = this.meetingBehaviorService.currentMember;
  readonly resolutions = this.meetingBehaviorService.resolutions;

  // Local computed signals
  readonly meetingId = computed(() => this.meeting()?.id);
  readonly fileCount = computed(() => this.attachments().length);

  readonly formattedAssignments = computed<FormattedAssignment[][]>(() => {
    const resolutionsList = this.resolutions();
    if (!resolutionsList) return [];

    return resolutionsList.map((res: Resolution) => {
      const assignments = res.assignments || [];

      if (assignments.length === 0) {
        return [];
      }

      // 🔹 گروه‌بندی بر اساس: نوع + پیگیر + مهلت
      const groups = new Map<
        string,
        { actionerNames: Set<string>; followerName: string; dueDate: string; type: string }
      >();

      assignments.forEach(a => {
        const type = a.type || '';
        const followerName = a.followerName || '';
        const dueDate = a.dueDate || '';
        const actorName = a.actorName || '';

        const key = `${type}__${followerName}__${dueDate}`;

        if (!groups.has(key)) {
          groups.set(key, {
            actionerNames: new Set(actorName ? [actorName] : []),
            followerName,
            dueDate,
            type
          });
        } else if (actorName) {
          groups.get(key)!.actionerNames.add(actorName);
        }
      });

      // تبدیل Map به آرایه از FormattedAssignment
      return Array.from(groups.values()).map(g => ({
        actionerNames: Array.from(g.actionerNames).join('، '),
        followerName: g.followerName,
        dueDate: g.dueDate,
        type: g.type
      }));
    });
  });


  readonly guestTitles = computed(() =>
    this.members().filter(m => m.isExternal).map(m => m.name).join(', ')
  );

  readonly internalTitles = computed(() =>
    this.members().filter(m => !m.isExternal).map(m => m.name).join(', ')
  );

  readonly absentedTitles = computed(() =>
    this.members().filter(m => !m.isPresent && !m.isExternal).map(m => m.name).join(', ')
  );

  readonly memberDescriptions = computed(() =>
    this.members()
      .filter(m => m.comment)
      .map(m => ({ name: m.name, comment: m.comment || '' }))
  );

  readonly signedMembers = computed(() => {
    const isDelegate = this.localStorageService.getItem(IsDeletage) === 'true';

    return this.members().filter(m => m.isSign).map(m => {
      let name = m.name;
      let userName = m.userName;

      if (isDelegate && m.signer !== m.userGuid) {
        name = 'از طرف ' + m.signerName;
        userName = m.signerUserName ?? '';
      }

      return {
        name: name,
        signature: `${environment.fileManagementEndpoint}/EpcSignature/${userName}.jpg`
      };
    });
  });

  // Permission computed signals
  readonly isDelegate = computed(() =>
    this.localStorageService.getItem(IsDeletage) === 'true'
  );

  readonly isSuperAdmin = computed(() =>
    this.localStorageService.getItem(ISSP) === 'true'
  );

  readonly canUploadFile = computed(() => {
    const member = this.currentMember();
    return !member?.isDelegate &&
      ([1, 2, 3].includes(member?.roleId) || this.isSuperAdmin());
  });

  // readonly canSign = computed(() => {
  //   const meetingData = this.meeting();
  //   const member = this.currentMember();

  //   if (!meetingData || !member) return false;

  //   const isStatusValid = meetingData.statusId === 4;
  //   const isNotDelegate = !member.isDelegate;
  //   const isNotSigned = !member.isSign;

  //   if (this.isDelegate()) {
  //     return isStatusValid && isNotDelegate &&
  //       this.hasPermission('MT_Meetings_CommentAndSign') && isNotSigned;
  //   }

  //   return isStatusValid && isNotDelegate && isNotSigned;
  // });

  readonly canSign = computed(() => {
    const meetingData = this.meeting();
    const member = this.currentMember();

    if (!meetingData || !member) return false;

    const isStatusValid = meetingData.statusId === 4;
    const isNotDelegate = !member.isDelegate;
    const isNotSigned = !member.isSign;

    // بررسی اینکه آیا رئیس جلسه امضا کرده یا خیر
    const chairmanMember = this.members().find(m => m.roleId === 3); // roleId === 3 برای رئیس جلسه
    const hasChairmanSigned = chairmanMember?.isSign ?? false;

    // اگر کاربر خودش رئیس جلسه است، نیازی به بررسی امضای رئیس نیست
    const isCurrentUserChairman = member.roleId === 3;

    // شرط اضافی: اگر کاربر رئیس نیست، باید رئیس امضا کرده باشد
    const canSignBasedOnChairman = isCurrentUserChairman || hasChairmanSigned;

    if (this.isDelegate()) {
      return isStatusValid && isNotDelegate &&
        this.hasPermission('MT_Meetings_CommentAndSign') &&
        isNotSigned &&
        canSignBasedOnChairman;
    }

    return isStatusValid &&
      isNotDelegate &&
      isNotSigned &&
      canSignBasedOnChairman;
  });

  readonly canPrintFinal = computed(() => {
    const meetingData = this.meeting();
    if (![4, 6].includes(meetingData?.statusId)) return false;

    return this.members().some(member => member.roleId === 3 && member.isSign);
  });

  readonly canPrintDraft = computed(() => !this.canPrintFinal());

  readonly canAccessFiles = computed(() => {
    if (this.isDelegate()) {
      return this.hasPermission('MT_Meetings_ViewFiles');
    }
    return true;
  });

  readonly siteUrl = computed(() => environment.selfEndpoint);

  constructor() {
    this.setupEffects();
  }

  ngOnInit(): void {
    this.subscribeToRouteParams();
    this.loadMeetingDetails();
  }

  ngOnDestroy(): void {
    this.cleanupFileUrl();
  }

  // Effects setup
  private setupEffects(): void {
    // Effect to handle signature image updates
    effect(() => {
      const member = this.currentMember();
      if (member) {
        this.handleSignatureImage(member);
      }
    });

    // Effect to load attachments when meeting changes
    effect(() => {
      const meetingIdValue = this.meetingId();
      if (meetingIdValue) {
        this.loadAttachments();
      }
    });

    // Effect to handle meeting guid input changes
    effect(() => {
      const guid = this.meetingGuid();
      if (guid) {
        this.loadMeetingDetails();
      }
    });
  }

  // Form creation
  private createSignForm(): FormGroup {
    return this.fb.group({
      memberId: [null],
      comment: [''],
      sign: [false]
    });
  }

  // Route subscription
  private subscribeToRouteParams(): void {
    this.route.paramMap.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(params => {
      const guid = params.get('guid') || this.meetingGuid();
      if (guid) {
        this.loadMeetingDetails();
      }
    });
  }

  // Signature image handling
  private handleSignatureImage(member: MeetingMember): void {
    if (this.isDelegate()) {
      const userGuid = this.localStorageService.getItem(Main_USER_ID);
      if (userGuid) {
        this.userService.getUserInformation(userGuid).pipe(
          takeUntilDestroyed(this.destroyRef)
        ).subscribe(user => {
          this._mainUser.set(user.fullname);
          this._signatureImage.set(
            `${environment.fileManagementEndpoint}/EpcSignature/${user.userName}.jpg`
          );
        });
      }
    } else {
      this._signatureImage.set(
        `${environment.fileManagementEndpoint}/EpcSignature/${member.userName}.jpg`
      );
    }
  }

  // Permission check method
  hasPermission(permission: string): boolean {
    const permissions = this.passwordFlowService.getPermissions();
    return permissions?.includes(permission) || false;
  }

  // Data loading methods

  loadMeetingDetails(): void {
    if (this.meeting()) {
      this.loadAttachments();
    }
  }


  private loadAttachments(): void {
    const meetingIdValue = this.meetingId();
    if (!meetingIdValue) return;

    this.fileMeetingService.getFiles(meetingIdValue).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((files: any) => {
      this._attachments.set(files);
    });
  }

  // Form handling methods
  toggleSign(): void {
    const form = this._signForm();
    const currentValue = form.get('sign')?.value;
    form.get('sign')?.setValue(!currentValue);
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

    this.memberService.setComment(payload).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      this.updateMembersAfterComment(payload);
      this.hideModal(this.signModal);
      this.signatureCompleted.emit(payload);
    });
  }

  private updateMembersAfterComment(payload: any): void {
    const members = this.meetingBehaviorService.getMembersValue();
    const memberIndex = members.findIndex(member => member.id === payload.memberId);

    if (memberIndex !== -1) {
      const updatedMembers = [...members];
      updatedMembers[memberIndex] = {
        ...updatedMembers[memberIndex],
        isSign: payload.isSign,
        comment: payload.comment
      };

      this.meetingBehaviorService.updateMembers(updatedMembers);
      this.memberUpdated.emit(updatedMembers[memberIndex]);
    }
  }



  saveFiles(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();

    const filesToUpload = this._filesToSave().filter((file: any) => file.guid === null);
    if (filesToUpload.length === 0) return;

    const formData = new FormData();
    const guid = this.meetingGuid() || this.route.snapshot.params['guid'];
    formData.append('meetingGuid', guid);
    filesToUpload.forEach((file: any) => {
      formData.append('files', file.file || file, file.name);
    });

    this.meetingService.saveFiles(formData).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        this.loadAttachments();
        this.resetFileSelections();
        this.fileUploaded.emit(filesToUpload);
      },
      error: (error) => {
        console.error('Error saving files:', error);
      }
    });
  }

  private resetFileSelections(): void {
    this._selectedFiles.set([]);
    this._filesToSave.set([]);
  }

  viewFile(fileGuid?: string, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();

    if (!fileGuid) return;

    this._loadingFile.set(true);
    const attachment = this._attachments().find((file: any) => file.guid === fileGuid);

    if (!attachment) {
      this._loadingFile.set(false);
      return;
    }

    try {
      this._fileName.set(attachment.fileName);
      const blob = new Blob([base64ToArrayBuffer(attachment.file)], {
        type: attachment.contentType
      });

      this.cleanupFileUrl();
      const url = URL.createObjectURL(blob);
      this._fileUrl.set(url);
      this._fileType.set(this.determineFileType(attachment.contentType));

      if (this._fileType() === 'text') {
        this.readTextFile(blob);
      }

      this._loadingFile.set(false);

      setTimeout(() => {
        this.showModal(this.fileViewerModal);
      }, 100);
    } catch (error) {
      console.error('Error viewing file:', error);
      this._loadingFile.set(false);
    }
  }

  private determineFileType(contentType: string): 'image' | 'pdf' | 'text' | 'other' {
    if (contentType.includes('image')) return 'image';
    if (contentType === 'application/pdf') return 'pdf';
    if (contentType.includes('text')) return 'text';
    return 'other';
  }

  private readTextFile(blob: Blob): void {
    const reader = new FileReader();
    reader.onload = () => {
      this._fileContent.set(reader.result as string);
    };
    reader.readAsText(blob);
  }

  download(fileGuid?: any): void {
    if (!fileGuid) return;

    const attachment = this._attachments().find((file: any) => file.guid === fileGuid);
    if (!attachment) return;

    try {
      const blob = new Blob([this.base64ToArrayBuffer(attachment.file)], {
        type: attachment.contentType
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');

      a.style.display = 'none';
      a.href = url;
      a.download = attachment.fileName || 'downloaded-file';

      document.body.appendChild(a);
      a.click();

      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  }


  onFileChange(files: FileItem[]): void {
    if (!files || files.length === 0) return;

    const currentSelected = this._selectedFiles();
    const newFiles = Array.from(files).filter(
      file => !currentSelected.some(f => f.name === file.name && f.size === file.size)
    );

    this._selectedFiles.set([...currentSelected, ...newFiles]);
    this._filesToSave.set([...this._filesToSave(), ...Array.from(files)]);
  }

  // متد removeFile را به‌روزرسانی کنید
  removeFile(fileGuid: string | string[]): void {
    const guidsToRemove = Array.isArray(fileGuid) ? fileGuid : [fileGuid];

    guidsToRemove.forEach(guid => {
      // حذف از selectedFiles
      const selectedFiles = this._selectedFiles();
      const selectedIndex = selectedFiles.findIndex(f => f.id === guid || f.guid?.toString() === guid);
      if (selectedIndex >= 0) {
        const updatedSelected = [...selectedFiles];
        updatedSelected.splice(selectedIndex, 1);
        this._selectedFiles.set(updatedSelected);
      }

      // حذف از filesToSave
      const filesToSave = this._filesToSave();
      const saveIndex = filesToSave.findIndex((f: any) => f.id === guid || f.guid?.toString() === guid);
      if (saveIndex >= 0) {
        const updatedSave = [...filesToSave];
        updatedSave.splice(saveIndex, 1);
        this._filesToSave.set(updatedSave);
      }

      // حذف از attachments اگر فایل از سرور است
      const attachments = this._attachments();
      const attachmentIndex = attachments.findIndex((f: any) => f.guid === guid);
      if (attachmentIndex >= 0) {
        const updatedAttachments = [...attachments];
        updatedAttachments.splice(attachmentIndex, 1);
        this._attachments.set(updatedAttachments);
      }
    });
  }

  // متد confirmDeleteFile را بهبود دهید
  confirmDeleteFile(fileGuid: string): void {
    Swal.fire({
      title: "حذف فایل پیوست",
      text: "آیا از حذف این فایل اطمینان دارید؟",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "بله، حذف شود",
      cancelButtonText: "خیر",
    }).then((result: { isConfirmed: boolean }) => {
      if (result.isConfirmed) {
        this.deleteFile(fileGuid);
      }
    });
  }

  // متد deleteFile را بهبود دهید
  deleteFile(fileGuid: string, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();

    if (!fileGuid) return;

    this.fileService.delete(fileGuid).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        this.zone.run(() => {
          // حذف از لیست attachments
          const currentAttachments = this._attachments();
          const updatedAttachments = currentAttachments.filter((file: any) => file.guid !== fileGuid);
          this._attachments.set(updatedAttachments);

          // حذف از سایر لیست‌ها نیز
          this.removeFile(fileGuid);

          // نمایش پیام موفقیت
          Swal.fire({
            title: "حذف شد",
            text: "فایل با موفقیت حذف شد",
            icon: "success",
            timer: 2000,
            showConfirmButton: false
          });
        });
      },
      error: (error) => {
        console.error('Error deleting file:', error);
        Swal.fire({
          title: "خطا",
          text: "خطا در حذف فایل",
          icon: "error",
          confirmButtonText: "باشه"
        });
      }
    });
  }



  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  private cleanupFileUrl(): void {
    const currentUrl = this._fileUrl();
    if (currentUrl) {
      URL.revokeObjectURL(currentUrl);
      this._fileUrl.set('');
    }
  }

  // Modal handling methods
  showModal(modalRef: ElementRef): void {
    if (!modalRef?.nativeElement) {
      console.error("Modal reference is invalid", modalRef);
      return;
    }

    const modalInstance = Modal.getInstance(modalRef.nativeElement) ||
      new Modal(modalRef.nativeElement);

    if (modalRef === this.fileModal) {
      this.loadAttachments();
    }

    modalInstance.show();
  }

  private hideModal(modalRef: ElementRef): void {
    if (!modalRef?.nativeElement) return;

    const modalInstance = Modal.getInstance(modalRef.nativeElement);
    if (modalInstance) {
      modalInstance.hide();
    }
  }

  showAttachmentModal(): void {
    this.showModal(this.fileModal);
  }

  showSignModal(): void {
    const member = this.currentMember();
    if (!member?.isPresent) {
      Swal.fire({
        title: "خطا",
        text: "حضور شما در جلسه ثبت نشده است و امکان امضای جلسه را ندارید.",
        icon: "error",
        confirmButtonText: "باشه",
      });
      return;
    }

    this.populateSignForm();
    this.showModal(this.signModal);
  }

  private populateSignForm(): void {
    const userGuid = this.localStorageService.getItem(USER_ID_NAME);
    const member = this.members().find(c => c.userGuid === userGuid);

    if (member) {
      const form = this._signForm();
      form.patchValue({
        memberId: member.id,
        comment: member.comment,
        sign: member.isSign
      });
    }
  }

  openUploaderModal(): void {
    const modalElement = document.getElementById('uploaderModal1');
    if (modalElement) {
      const uploaderModal = new Modal(modalElement);
      uploaderModal.show();
    }
  }

  showImageModal(imageUrl: string): void {
    Swal.fire({
      imageUrl: imageUrl,
      imageAlt: "فایل پیوست",
      showConfirmButton: false,
      showCloseButton: true
    });
  }

  // Print methods
  printMeeting(): void {
    const printContent = document.getElementById("meeting-Minute")?.innerHTML;
    if (!printContent) return;

    this.openPrintWindow(printContent, "چاپ صورتجلسه", this.getFinalPrintStyles());
  }

  printDraftMeeting(): void {
    const printContent = this.printSection?.nativeElement?.innerHTML;
    if (!printContent) return;

    this.openPrintWindow(printContent, "چاپ پیش نویس صورتجلسه", this.getDraftPrintStyles());
  }

  private openPrintWindow(content: string, title: string, styles: string): void {
    const newWin = window.open("", "_blank", "width=900,height=700");
    if (!newWin) return;

    newWin.document.open();
    newWin.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>${styles}</style>
          <link rel="stylesheet" href="${this.siteUrl()}/css/custom.css" />
        </head>
        <body>
          ${content}
          <script>
            window.onload = function() {
              window.print();
              setTimeout(() => window.close(), 100);
            };
          </script>
        </body>
      </html>
    `);
    newWin.document.close();
  }
  private getFinalPrintStyles(): string {
    return this.getSharedPrintStyles();
  }

  private getDraftPrintStyles(): string {
    return this.getSharedPrintStyles();
  }

  private getSharedPrintStyles(): string {
    return `
@page {
    size: A4;
    margin: 10mm 15mm;
}

* {
    -webkit-print-color-adjust: exact !important; /* Chrome, Safari, Edge */
    color-adjust: exact !important;              /* Firefox */
    box-sizing: border-box;
}

body {
    direction: rtl;
    font-family: "IRANSans", Tahoma, Arial, sans-serif;
    background-color: #f8f9fa;
    margin: 0;
    padding: 0;
}

/* محتوا را وسط صفحه نگه می‌داریم */
body > header,
body > section {
    max-width: 26cm;
    margin: 0 auto;
}

/* هدر بالا */
header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 8px;
}

header .right-side {
    flex: 1;
    margin-left: 5px;
}

header .logo img {
    max-width: 140px;
    height: auto;
}

.name-of-god {
    text-align: center;
    margin-right: 25px;
    font-size: 18px;
    font-weight: 600;
}

.meeting-title {
    border: 2px solid #6d8dab;
    padding: 10px;
    margin-top: 5px;
    border-radius: 20px;
    min-height: 50px;
    font-weight: 700 !important;
    font-size: 17px;
    background: linear-gradient(to left, #e1d4cd, #f7ddd0, #e0e9f3);
    display: flex;
    align-items: center;
}

/* سکشن اصلی */
.main {
    margin-top: 10px;
}

/* جدول اطلاعات جلسه */
table {
    border-collapse: collapse;
    width: 100%;
}

.metting-information {
    border-style: double;
    border-radius: 15px;
    overflow: hidden;
}

.metting-information table {
    min-height: 300px;
}

.metting-information th {
    width: 10%;
    border: 1px solid black;
    border-top: 1px solid white;
    padding: 5px;
    font-size: 15px;
    font-weight: 800;
    background-color: #f5f5f5;
}

th:first-child {
    border-right: none !important;
    border-top: none !important;
}

th:last-child {
    border-left: none !important;
    border-top: none !important;
}

td:first-child {
    border-right: none !important;
}

td:last-child {
    border-left: none !important;
}

.metting-information td {
    border: 1px solid black;
    font-size: 14px;
    padding: 4px 6px;
}

.metting-information tbody tr {
    height: 20%;
    border-top: 2px solid black;
    border-bottom: 1px solid black;
}

.metting-information tbody tr:last-child {
    border-bottom: none !important;
}

.metting-information tbody tr:last-child td {
    border-bottom: none !important;
}

.type {
    text-align: center;
    font-weight: 700;
}

/* بلوک‌های توضیحات/الحاقیه */
.metting-summary {
    margin: 15px 0;
    border: 2px solid #6e6e6e;
    display: flex;
}

.metting-summary .right-side {
    border-left: 1px solid black;
    background: #d9d9d9;
    display: flex;
    align-items: center;
    justify-content: center;
}

.label {
    border-top: 1px solid #0000004f;
}

.metting-summary .right-side span {
    transform: rotate(270deg);
    display: table-caption;
    padding: 0;
    width: 74px;
    font-size: 15px;
    text-align: center;
    margin: 31px 0;
    padding: 12px 0px;
    font-weight: 700 !important;
}

.metting-summary .main {
    width: 90%;
    margin: 13px;
    font-size: 13px;
    text-align: justify;
    line-height: 1.6;
}

/* جدول مصوبات با گروه‌بندی */
.metting-directives .main {
    border: 2px solid black;
    border-bottom: 1px solid black;
}

.metting-directives .main .label {
    text-align: center;
    background: #fbe5d5;
    padding: 8px 0;
    font-weight: 700;
}

.metting-directives table {
    border: 1px solid black;
}

/* هدر جدول مصوبات */
.metting-directives table th {
    border: 1px solid black;
    padding: 7px;
    font-size: 14px;
    background-color: #f8f8f8;
}

/* عرض ستون‌ها مطابق ساختار جدید */
.metting-directives table th:nth-child(1) {  /* ردیف */
    width: 4%;
    font-size: 15px;
    font-weight: 900;
}
.metting-directives table th:nth-child(2) {  /* شرح مصوبه */
    width: 36%;
    font-size: 15px;
    font-weight: 900;
}
.metting-directives table th:nth-child(3) {  /* مسئول اقدام */
    width: 15%;
}
.metting-directives table th:nth-child(4) {  /* نوع تخصیص */
    width: 15%;
}
.metting-directives table th:nth-child(5) {  /* مسئول پیگیری */
    width: 15%;
}
.metting-directives table th:nth-child(6) {  /* مهلت اقدام */
    width: 15%;
}

.metting-directives table th:first-child {
    border-right: 1px solid white;
}

.metting-directives table th:last-child {
    border-left: 1px solid white;
}

/* بدنه جدول مصوبات */
.metting-directives table tbody td {
    border: 1px solid black;
    text-align: center;
    padding: 5px 6px;
    font-size: 12px;
    vertical-align: top;            /* مهم: برای rowspan ها */
    line-height: 1.6;
    word-wrap: break-word;
    white-space: normal;
}

.metting-directives table tbody td.space-preline {
    white-space: pre-line;
    text-align: justify;
}

.metting-directives table tbody td:first-child {
    border-right: 1px solid white !important;
}

.metting-directives table tbody td:last-child {
    border-left: 1px solid white !important;
}

.metting-directives table tbody tr:last-child td {
    border-bottom: 1px solid white !important;
}

.metting-directives {
    margin-bottom: 20px;
    page-break-inside: avoid; /* تا حد ممکن کل جدول در یک صفحه بماند */
}

/* جدول توضیحات اعضا */
.metting-description .main .label {
    background: #d9d9d9;
}

/* امضاها */
.meeting-signatures {
    margin: 15px 0;
    border: 1px solid black;
    min-height: 130px;
    page-break-before: auto;
    page-break-after: auto;
    page-break-inside: avoid;
}

.meeting-signatures .top {
    background: #fbe5d5;
    text-align: center;
    padding: 8px;
    border-bottom: 1px solid black;
    font-weight: 700;
}

.meeting-signatures .main {
    display: flex;
    flex-wrap: wrap;
    padding: 8px;
}

.meeting-signatures .main img {
    margin: 0 5px 4px;
    width: 125px;
    height: 65px;
    object-fit: contain;
}

.meeting-signatures .main div {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin: 4px 2px;
}

.meeting-signatures .main div span {
    font-size: 9px;
    margin: 0 5px;
    background: #fbe5d5;
    width: 125px;
    text-align: center;
}

/* تی‌دی عمومی */
td {
    font-size: 14px;
    padding-right: 5px;
}

.meeting-information td {
    text-align: center;
}

.metting-description,
 {
    page-break-inside: avoid;
    break-inside: avoid; /* برای مرورگرهای جدیدتر */
}

/* این سه‌تا با هم پشت سر هم بمونن تا حد ممکن */
.metting-summary,
.metting-directives,
.meeting-signatures {
    page-break-before: avoid;
    break-before: avoid;
}
    `;
  }

  // Signal-based utility methods
  updateSignFormValue(field: string, value: any): void {
    const form = this._signForm();
    form.get(field)?.setValue(value);
  }

  getSignFormValue(field: string): any {
    const form = this._signForm();
    return form.get(field)?.value;
  }

  // Reactive helpers for template
  trackByMemberGuid(index: number, member: MeetingMember): string {
    return member.userGuid ?? '';
  }

  trackByFileGuid(index: number, file: any): string {
    return file.guid;
  }

  trackByResolutionId(index: number, resolution: Resolution): number {
    return resolution.id;
  }
}
