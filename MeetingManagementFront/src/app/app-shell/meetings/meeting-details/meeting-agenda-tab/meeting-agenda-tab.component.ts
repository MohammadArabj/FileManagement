import { NgClass } from '@angular/common';
import { Component, ElementRef, ViewChild, computed, effect, inject, signal, viewChild } from '@angular/core';
import { CustomInputComponent } from "../../../../shared/custom-controls/custom-input";
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { FileService } from '../../../../services/file.service';
import { CodeFlowService } from '../../../../services/framework-services/code-flow.service';
import { LocalStorageService } from '../../../../services/framework-services/local.storage.service';
import { AgendaService } from '../../../../services/agenda.service';
import { CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { Resolution } from '../../../../core/models/Resolution';
import { Modal } from 'bootstrap';
import { MeetingMember } from '../../../../core/models/Meeting';
import { environment } from '../../../../../environments/environment';
// ✅ استفاده از کامپوننت جدید TUS
import { IsDeletage, ISSP } from '../../../../core/types/configuration';
import { PasswordFlowService } from '../../../../services/framework-services/password-flow.service';
import { MeetingBehaviorService } from '../meeting-behavior-service';
import { FileUploaderModalComponent } from '../../../../shared/file-manager/file-uploader-modal.component';
import { FileManagerComponent } from "../../../../shared/file-manager/file-manager.component";
import { FileManagerModalComponent } from "../../../../shared/file-manager/file-manger-modal.component";

declare var $: any;
declare var Swal: any;

@Component({
  selector: 'app-meeting-agenda-tab',
  imports: [
    NgClass,
    ReactiveFormsModule,
    CdkDropList,
    CdkDrag,
    CustomInputComponent,
    FileManagerModalComponent
],
  templateUrl: './meeting-agenda-tab.html',
  styleUrl: './meeting-agenda-tab.css'
})
export class MeetingAgendaTabComponent {
onFilesChanged($event: string[]) {
throw new Error('Method not implemented.');
}
onCancelled() {
throw new Error('Method not implemented.');
}

  // Injected services
  private readonly fb = inject(FormBuilder);
  private readonly fileService = inject(FileService);
  private readonly route = inject(ActivatedRoute);
  private readonly agendaService = inject(AgendaService);
  private readonly localStorageService = inject(LocalStorageService);
  private readonly passwordFlowService = inject(PasswordFlowService);
  private readonly meetingBehaviorService = inject(MeetingBehaviorService);
  readonly isBoardMeeting = signal<boolean>(false);
  existingFiles: string[] = [];
  uploadedGuids: string[] = [];
  // View children
  readonly fileViewerModal = viewChild.required<ElementRef>('fileViewerModal');

  // Signals for reactive state
  readonly permissions = signal<Set<string>>(new Set());
  readonly isSuperAdmin = signal<boolean>(false);
  readonly isDelegate = signal<boolean>(false);
  readonly meeting = signal<any>(null);
  readonly currentMember = signal<MeetingMember | null>(null);
  readonly agendas = signal<any[]>([]);
  readonly meetingGuid = signal<string>('');
  readonly file = signal<any>(null);
  readonly textContent = signal<string>('');
  readonly siteUrl = signal<string>(environment.selfEndpoint);
  readonly isEditingAgenda = signal<boolean>(false);

  // ✅ سیگنال برای فایل مدال
  readonly currentModalFileGuid = signal<string | null>(null);

  // Form
  readonly agendaForm = this.fb.group({
    id: [0],
    text: ['', [Validators.required, Validators.maxLength(500)]],
    fileGuids: [[] as string[]],
  });

  // ✅ محاسبه مسیر پوشه برای آپلود - بدون نیاز به classificationId
  readonly uploadFolderPath = computed(() => {
    const guid = this.meetingGuid();
    // فرمت: Meeting{{Folder}}Agenda{{Folder}}{meetingGuid}
    return `Meeting{{Folder}}Agenda{{Folder}}${guid}`;
  });

  readonly hasChairmanSigned = computed(() => {
    const members = this.meetingBehaviorService.members();
    const chairman = members.find(m => m.roleId === 3);
    return chairman?.isSign === true;
  });

  readonly canAddAgenda = computed(() => {
    const meeting = this.meeting();
    const member = this.currentMember();
    const hasEditPermission = this.permissions().has('MT_Meetings_Edit');
    const hasChairmanSigned = this.hasChairmanSigned();

    const isUnsignedChairman = (meeting?.roleId === 3 && !hasChairmanSigned);

    return isUnsignedChairman ||
      ((([1, 2, 3].includes(meeting?.roleId) || hasEditPermission) && !member?.isDelegate) &&
        (![4, 3, 6].includes(meeting?.statusId) || hasEditPermission)) ||
      this.isBoardMeeting();
  });

  readonly canDragAgendas = computed(() => {
    const meeting = this.meeting();
    const hasEditPermission = this.permissions().has('MT_Meetings_Edit');
    const hasChairmanSigned = this.hasChairmanSigned();

    const isUnsignedChairman = (meeting?.roleId === 3 && !hasChairmanSigned);

    return isUnsignedChairman ||
      ((hasEditPermission || ([1, 2, 3].includes(meeting?.roleId ?? 0))) &&
        (![4, 6].includes(meeting?.statusId ?? 0) || hasEditPermission)) ||
      this.isBoardMeeting();
  });

  readonly canEditOrDeleteAgenda = computed(() => {
    const meeting = this.meeting();
    const member = this.currentMember();
    const hasEditPermission = this.permissions().has('MT_Meetings_Edit');
    const hasChairmanSigned = this.hasChairmanSigned();

    const isUnsignedChairman = (meeting?.roleId === 3 && !hasChairmanSigned);

    return isUnsignedChairman ||
      ((hasEditPermission || [1, 2, 3].includes(meeting?.roleId)) &&
        !member?.isDelegate &&
        ![4, 6].includes(meeting?.statusId ?? 0)) ||
      this.isBoardMeeting();
  });

  readonly canUploadFile = computed(() => {
    const member = this.currentMember();
    const meeting = this.meeting();
    const isSuperAdmin = this.isSuperAdmin();
    return (!member?.isDelegate && ([1, 2, 3].includes(meeting?.roleId) || isSuperAdmin)) || this.isBoardMeeting();
  });

  readonly canShowEmptyMessage = computed(() => {
    return this.agendas().length === 0;
  });

  constructor() {
    this.isSuperAdmin.set(this.localStorageService.getItem(ISSP) === 'true');
    this.isDelegate.set(this.localStorageService.getItem(IsDeletage) === 'true');

    effect(() => {
      this.meeting.set(this.meetingBehaviorService.meeting());
      if (this.meeting()) {
        this.isBoardMeeting.set(this.meetingBehaviorService.isBoardMeeting());
      }
      this.currentMember.set(this.meetingBehaviorService.currentMember());
    });

    effect(() => {
      this.route.paramMap.subscribe(params => {
        const guid = params.get('guid') || '';
        this.meetingGuid.set(guid);
        if (guid) {
          this.loadAgendas();
        }
      });
    });

    this.loadPermissions();
  }
  onFilesConfirmed(guids: string[]) {
    this.agendaForm.patchValue({ fileGuids: guids });
    this.uploadedGuids = guids;
  }
  private hasPermission(permission: string): boolean {
    return this.permissions().has(permission);
  }

  onDrop(event: CdkDragDrop<Resolution[]>) {
    const currentAgendas = [...this.agendas()];
    moveItemInArray(currentAgendas, event.previousIndex, event.currentIndex);
    this.agendas.set(currentAgendas);
    this.agendaService.updateAgendaOrder(currentAgendas).subscribe();
  }

  removeAgendaItem(index: number) {
    // Implementation needed
  }

  deleteAgenda(agenda: any) {
    Swal.fire({
      title: "آیا از حذف دستور جلسه اطمینان دارید؟",
      text: "درصورت حذف دیگر قادر به بازیابی دستور جلسه فوق نخواهید بود.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "بله، اطمینان دارم.",
      cancelButtonText: "خیر",
      confirmButtonClass: "btn btn-success mx-2",
      cancelButtonClass: "btn btn-danger",
      buttonsStyling: false,
    }).then((result: any) => {
      if (result.isConfirmed) {
        this.agendaService.delete(agenda.id).subscribe({
          next: () => {
            this.loadAgendas();
          },
          error: () => { }
        });
      }
    });
  }

  // ✅ باز کردن مدال آپلودر
  openUploaderModal(fileGuid?: string) {
    this.currentModalFileGuid.set(fileGuid || null);
    const uploaderModal = new Modal(document.getElementById('tusUploaderModalAgenda')!);
    uploaderModal.show();
  }

  openAddAgendaModal() {
    this.agendaForm.reset({
      id: 0,
      text: '',
      fileGuids: null
    });
    this.file.set(null);
    this.currentModalFileGuid.set(null);
    this.isEditingAgenda.set(false);
    $("#addAgendaModal").modal("toggle");
  }

  openEditModal(agenda: any) {
    this.agendaForm.patchValue({
      id: agenda.id,
      text: agenda.text,
      fileGuids: agenda.fileGuids
    });

    this.currentModalFileGuid.set(agenda.fileGuid || null);
    this.isEditingAgenda.set(true);

    setTimeout(() => {
      $("#addAgendaModal").modal("toggle");
    }, 50);
  }

  // // ✅ وقتی فایل جدید آپلود شد
  // onFileUploaded(result: CompleteUploadResult) {
  //   // آپدیت فرم با fileGuid جدید
  //   this.agendaForm.patchValue({ fileGuid: result.fileGuid });
  //   this.currentModalFileGuid.set(result.fileGuid);

  //   // اگر در حالت ویرایش هستیم، ذخیره کن
  //   if (this.isEditingAgenda() && this.agendaForm.get('id')?.value) {
  //     // می‌توانید اینجا اتوماتیک ذخیره کنید یا منتظر کلیک دکمه ذخیره بمانید
  //   }
  // }

  // ✅ وقتی فایل حذف شد
  onFileDeleted(fileGuid: string) {
    this.agendaForm.patchValue({ fileGuids: null });
    this.currentModalFileGuid.set(null);
  }

  saveAgenda() {
    if (this.agendaForm.invalid) {
      this.agendaForm.markAllAsTouched();
      return;
    }
    var formData = this.agendaForm.value;
    // const formData = new FormData();
    // const agendaId = this.agendaForm.get('id')?.value || 0;
    // const agendaText = this.agendaForm.get('text')?.value || '';
    // const fileGuid = this.agendaForm.get('fileGuid')?.value;

    // formData.append('id', String(agendaId));
    // formData.append('text', agendaText);
    // formData.append('meetingGuid', this.meetingGuid());

    // // ✅ فقط fileGuid ارسال می‌کنیم (فایل قبلاً با TUS آپلود شده)
    // if (fileGuid) {
    //   formData.append('fileGuid', fileGuid);
    // }

    this.agendaService.createOrEdit(formData).subscribe({
      next: (response: any) => {
        $("#addAgendaModal").modal("hide");
        this.loadAgendas();
        this.agendaForm.reset();
        this.currentModalFileGuid.set(null);
      },
      error: (error: any) => {
        console.error('Error saving agenda:', error);
      }
    });
  }

  loadAgendas() {
    this.agendaService.getListBy(this.meetingGuid()).subscribe({
      next: (data: any) => {
        this.agendas.set(data);
      },
      error: (error) => {
        console.error('Error loading agendas:', error);
      }
    });
  }

  print() {
    const printContent = document.getElementById("printSection")?.innerHTML;
    if (!printContent) return;

    const newWin = window.open("", "_blank", "width=900,height=700");
    if (!newWin) return;

    const styles = Array.from(document.styleSheets)
      .map((styleSheet) => {
        try {
          return Array.from(styleSheet.cssRules)
            .map((rule) => rule.cssText)
            .join("\n");
        } catch (e) {
          return "";
        }
      })
      .join("\n");

    newWin.document.open();
    newWin.document.write(`
      <html>
        <head>
          <title>چاپ دستورهای جلسه</title>
         <style>
          ${styles}
          body {
            direction: rtl;
            text-align: right;
            margin: 20px;
            background-color: #f8f9fa;
          }
          .header-container {
            border: 2px solid #007bff;
            border-radius: 12px;
            padding: 15px;
            background-color: #e9f2ff;
            margin-bottom: 20px;
            text-align: center;
            position: relative;
          }
          .header-container img {
            width: 60px;
            height: 60px;
            display: block;
            margin: 0 auto 10px;
          }
          .header-content {
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .header-content h2 {
            font-size: 20px;
            color: #007bff;
            margin: 0;
          }
          .header-content p {
            margin: 0;
            font-size: 16px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            background: white;
          }
          table, th, td {
            border: 1px solid #000;
          }
          th, td {
            padding: 10px;
            font-size: 14px;
            border-top:1px solid black !important;
            border-bottom:1px solid black !important;
          }
          th {
            background: #007bff;
            color: black;
            font-weight:800;
          }
          tr:nth-child(even) {
            background: #f2f2f2;
          }
        </style>
        </head>
        <body>
          ${printContent}
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

  showModal(): void {
    const fileViewerModal = this.fileViewerModal();
    if (fileViewerModal) {
      const modalInstance = Modal.getInstance(fileViewerModal.nativeElement) ||
        new Modal(fileViewerModal.nativeElement);
      modalInstance.show();
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
  // در Component
  @ViewChild('uploaderModal') uploaderModal!: FileUploaderModalComponent;
  existingFileGuids: string[] = [];

  // باز کردن برای افزودن/ویرایش
  openUploaderForEdit() {
    this.uploaderModal.open();
  }

  // // تأیید فایل‌ها
  // onFilesConfirmed(fileGuids: string[]) {
  //   this.agendaForm.patchValue({ fileGuids });
  //   this.existingFileGuids = fileGuids;
  // }
  confirmDeleteFile(fileGuid: any): void {
    Swal.fire({
      title: "حذف فایل پیوست",
      text: "آیا از حذف این فایل اطمینان دارید؟",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "بله، حذف شود",
      cancelButtonText: "خیر",
    }).then((result: { isConfirmed: any; }) => {
      if (result.isConfirmed) {
        this.deleteFile(fileGuid);
      }
    });
  }

  deleteFile(id: any): void {
    this.agendaService.deleteFile(id).subscribe({
      next: () => {
        this.loadAgendas();
      },
      error: () => { }
    });
  }

  private async loadPermissions(): Promise<void> {
    const permissionsToCheck = ['MT_Meetings_Edit'];
    const newPermissions = new Set<string>();

    for (const perm of permissionsToCheck) {
      const has = await this.passwordFlowService.checkPermission(perm);
      if (has && (this.isSuperAdmin() || this.isDelegate())) {
        newPermissions.add(perm);
      }
    }
    this.permissions.set(newPermissions);
  }
}
