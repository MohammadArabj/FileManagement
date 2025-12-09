import {
  AfterViewInit,
  Component,
  ElementRef,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MeetingDetails, MeetingMember } from '../../../../core/models/Meeting';
import { Resolution } from '../../../../core/models/Resolution';
import { MeetingService } from '../../../../services/meeting.service';
import { ResolutionService } from '../../../../services/resolution.service';
import { ComboBase } from '../../../../shared/combo-base';
import { UserService } from '../../../../services/user.service';
import { SystemUser } from '../../../../core/models/User';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { MeetingBehaviorService } from '../meeting-behavior-service';
import { Modal } from 'bootstrap';
import { FileMeetingService } from '../../../../services/file-meeting.service';
import { AssignmentService } from '../../../../services/assignment.service';
import {
  getClientSettings,
} from '../../../../services/framework-services/code-flow.service';
import { IsDeletage, ISSP } from '../../../../core/types/configuration';
import { LocalStorageService } from '../../../../services/framework-services/local.storage.service';
import { ToastService } from '../../../../services/framework-services/toast.service';
import { PasswordFlowService } from '../../../../services/framework-services/password-flow.service';

// Import child components
import { MeetingDescriptionComponent } from './meeting-description/meeting-description';
import { ResolutionListComponent } from './resolution-list/resolution-list';
import { ResolutionFormComponent } from './resolution-form/resolution-form';
import { AssignmentModalComponent } from './assignment-modal/assignment-modal';
import { FileManagementModalComponent } from './file-management-modal/file-management-modal';
import { FileViewerModalComponent } from './file-viewer-modal/file-viewer-modal';
import { environment } from '../../../../../environments/environment';
import { BoardResolutionList } from "./board-resolution-list/board-resolution-list";
import { BoardMemberService } from '../../../../services/board-member.service';

declare var Swal: any;

@Component({
  selector: 'app-meeting-content-tab',
  imports: [
    MeetingDescriptionComponent,
    ResolutionListComponent,
    ResolutionFormComponent,
    AssignmentModalComponent,
    FileManagementModalComponent,
    FileViewerModalComponent,
    BoardResolutionList
  ],
  standalone: true,
  templateUrl: './meeting-content-tab.html',
  styleUrl: './meeting-content-tab.css',
})
export class MeetingContentTabComponent implements AfterViewInit {
  [x: string]: any;

  // Injected services
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly meetingService = inject(MeetingService);
  private readonly resolutionService = inject(ResolutionService);
  private readonly userService = inject(UserService);
  private readonly fileManagemnetService = inject(FileMeetingService);
  private readonly meetingBehaviorService = inject(MeetingBehaviorService);
  private readonly assignmentService = inject(AssignmentService);
  private readonly toastService = inject(ToastService);
  private readonly localStorageService = inject(LocalStorageService);
  private readonly passwordFlowService = inject(PasswordFlowService);
  private readonly boardMemberService = inject(BoardMemberService);

  // View children using new viewChild API
  readonly addResolutionModal = viewChild<ElementRef>('addResolutionModal');
  readonly assignModal = viewChild<ElementRef>('assignModal');
  readonly fileModal = viewChild<ElementRef>('fileModal');
  readonly fileViewerModal = viewChild<ElementRef>('fileViewerModal');

  // Signals for reactive state
  readonly meetingGuid = signal<string>('');
  readonly description = signal<string>('');
  readonly resolutions = signal<Resolution[]>([]);
  readonly meetingDate = signal<string>('');
  readonly isBoardMeeting = signal<boolean>(false);
  readonly previousResolutions = signal<any[]>([]);
  readonly attachments = signal<any>([]);
  readonly fileCount = signal<number>(0);
  readonly meeting = signal<MeetingDetails | null>(null);

  // Permission and role signals
  readonly isSuperAdmin = signal<boolean>(false);
  readonly isDelegate = signal<boolean>(false);
  readonly permissions = signal<Set<string>>(new Set());
  readonly currentMember = signal<MeetingMember | null>(null);
  readonly roleId = signal<any>(null);
  readonly statusId = signal<any>(null);

  // Data signals
  readonly allUsers = signal<ComboBase[]>([]);
  readonly userList = signal<SystemUser[]>([]);
  readonly assignmentTypes = signal([
    { guid: 'FollowUp', title: 'بررسی' },
    { guid: 'ReportPreparation', title: 'تهیه گزارش' },
    { guid: 'Notification', title: 'استحضار' },
    { guid: 'Information', title: 'اطلاع' },
    { guid: 'Action', title: 'اقدام' },
  ]);
  @ViewChild(BoardResolutionList) boardResolutionList!: BoardResolutionList;

  // State signals for modals
  readonly isEditingResolution = signal<boolean>(false);
  readonly selectedResolutionForEdit = signal<Resolution | null>(null);
  readonly selectedResolutionForAssign = signal<Resolution | null>(null);
  readonly selectedAssignmentForEdit = signal<any>(null);
  readonly selectedResolutionForFiles = signal<number | null>(null);
  readonly selectedFileForViewer = signal<{
    guid?: string;
    url?: string;
    type?: string;
    name?: string;
    content?: string
  } | null>(null);
  // در بخش signals اضافه کنید:
  readonly hasChairmanSigned = computed(() => {
    const members = this.meetingBehaviorService.members();
    const chairman = members.find(m => m.roleId === 3);
    return chairman?.isSign === true;
  });
  // تغییر canEditDescription
  readonly canEditDescription = computed(() => {
    const roleId = this.roleId();
    const statusId = this.statusId();
    const currentMember = this.currentMember();
    const isDelegate = this.isDelegate();
    const permissions = this.permissions();
    const boardMeeting = this.isBoardMeeting();
    const hasChairmanSigned = this.hasChairmanSigned();

    // اگر رئیس جلسه است و هنوز امضا نکرده
    const isUnsignedChairman = (roleId === 3 && !hasChairmanSigned);

    return isUnsignedChairman ||
      (!isDelegate &&
        [1, 2, 3].includes(roleId) &&
        !currentMember?.isDelegate &&
        ![4, 6].includes(statusId)) ||
      boardMeeting ||
      permissions.has('MT_Descriptions_Edit');
  });

  // تغییر canAddResolution
  readonly canAddResolution = computed(() => {
    const roleId = this.roleId();
    const statusId = this.statusId();
    const currentMember = this.currentMember();
    const isDelegate = this.isDelegate();
    const permissions = this.permissions();
    const boardMeeting = this.isBoardMeeting();
    const hasChairmanSigned = this.hasChairmanSigned();

    // اگر رئیس جلسه است و هنوز امضا نکرده
    const isUnsignedChairman = (roleId === 3 && !hasChairmanSigned);

    return isUnsignedChairman ||
      (!isDelegate &&
        [1, 2, 3].includes(roleId) &&
        !currentMember?.isDelegate &&
        ![4, 6].includes(statusId)) ||
      permissions.has('MT_Resolutions_Add') ||
      boardMeeting;
  });

  // تغییر canEditResolution
  readonly canEditResolution = computed(() => {
    const roleId = this.roleId();
    const statusId = this.statusId();
    const permissions = this.permissions();
    const boardMeeting = this.isBoardMeeting();
    const hasChairmanSigned = this.hasChairmanSigned();

    // اگر رئیس جلسه است و هنوز امضا نکرده
    const isUnsignedChairman = (roleId === 3 && !hasChairmanSigned);

    return isUnsignedChairman ||
      permissions.has('MT_Resolutions_Edit') ||
      ([1, 2, 3].includes(roleId) && ![4, 6].includes(statusId)) ||
      boardMeeting;
  });

  // تغییر canDeleteResolution
  readonly canDeleteResolution = computed(() => {
    const roleId = this.roleId();
    const statusId = this.statusId();
    const permissions = this.permissions();
    const boardMeeting = this.isBoardMeeting();
    const hasChairmanSigned = this.hasChairmanSigned();

    // اگر رئیس جلسه است و هنوز امضا نکرده
    const isUnsignedChairman = (roleId === 3 && !hasChairmanSigned);

    return isUnsignedChairman ||
      permissions.has('MT_Resolutions_Delete') ||
      ([1, 2, 3].includes(roleId) && ![4, 6].includes(statusId)) ||
      boardMeeting;
  });

  // تغییر canAddAssignment
  readonly canAddAssignment = computed(() => {
    const roleId = this.roleId();
    const statusId = this.statusId();
    const permissions = this.permissions();
    const boardMeeting = this.isBoardMeeting();
    const hasChairmanSigned = this.hasChairmanSigned();

    // اگر رئیس جلسه است و هنوز امضا نکرده
    const isUnsignedChairman = (roleId === 3 && !hasChairmanSigned);

    return isUnsignedChairman ||
      permissions.has('MT_Resolutions_Assign') ||
      ([1, 2, 3].includes(roleId) && ![4, 6].includes(statusId)) ||
      boardMeeting;
  });

  // تغییر canDragResolutions
  readonly canDragResolutions = computed(() => {
    const roleId = this.roleId();
    const statusId = this.statusId();
    const permissions = this.permissions();
    const boardMeeting = this.isBoardMeeting();
    const hasChairmanSigned = this.hasChairmanSigned();

    // اگر رئیس جلسه است و هنوز امضا نکرده
    const isUnsignedChairman = (roleId === 3 && !hasChairmanSigned);

    return isUnsignedChairman ||
      (permissions.has('MT_Resolutions') ||
        [1, 2, 3].includes(roleId ?? 0)) &&
      (![4, 6].includes(statusId ?? 0) ||
        permissions.has('MT_Resolutions')) ||
      boardMeeting;
  });

  // تغییر canUploadFileForResolution
  readonly canUploadFileForResolution = computed(() => {
    const currentMember = this.currentMember();
    const roleId = this.roleId();
    const isSuperAdmin = this.isSuperAdmin();
    const boardMeeting = this.isBoardMeeting();
    const hasChairmanSigned = this.hasChairmanSigned();

    // اگر رئیس جلسه است و هنوز امضا نکرده
    const isUnsignedChairman = (roleId === 3 && !hasChairmanSigned);

    return isUnsignedChairman ||
      (!currentMember?.isDelegate &&
        ([1, 2, 3].includes(roleId) || isSuperAdmin)) ||
      boardMeeting;
  });
  readonly canViewFiles = computed(() => {
    return this.permissions().has('MT_Resolutions_ViewFiles');
  });

  constructor() {
    // Initialize basic signals
    this.isSuperAdmin.set(this.localStorageService.getItem(ISSP) === 'true');
    this.isDelegate.set(this.localStorageService.getItem(IsDeletage) === 'true');

    // Effect to handle route parameter changes
    effect((onCleanup) => {
      const sub = this.route.paramMap.subscribe(params => {
        const guid = params.get('guid');
        if (guid) {
          this.meetingGuid.set(guid);
        }
      });

      onCleanup(() => sub.unsubscribe());
    });

    // Effect برای currentMember
    effect(() => {
      this.currentMember.set(this.meetingBehaviorService.currentMember());
    });

    // Effect جداگانه برای meeting
    effect(() => {
      const meeting = this.meetingBehaviorService.meeting();
      if (meeting) {
        this.isBoardMeeting.set(this.meetingBehaviorService.isBoardMeeting());
        this.resolutions.set(this.meetingBehaviorService.resolutions());
        this.meeting.set(meeting);
        this.roleId.set(meeting.roleId);
        this.statusId.set(meeting.statusId);
        this.meetingDate.set(meeting.mtDate || '');
        this.description.set(meeting.description ?? '');
      }
    });

    // Effect to load data when meetingGuid changes
    effect(() => {
      const guid = this.meetingGuid();
      if (guid) {
        this.loadUsers();
        if (this.isBoardMeeting()) {
          this.loadPreviousResolutions();
        }
      }
    });

    // Load permissions
    this.loadPermissions();
  }

  ngAfterViewInit() {
    // Modals are now managed by their respective components
  }

  // --- Meeting Description Handlers ---
  onDescriptionSaved(newDescription: string) {
    this.meetingService.updateDescription(this.meetingGuid(), newDescription).subscribe({
      next: () => {
        this.meetingBehaviorService.updateMeeting({ description: newDescription });
      },
      error: (error: any) => {
        console.error('Error saving description:', error);
        this.toastService.error('خطا در ذخیره شرح جلسه.');
      }
    });
  }

  onDeleteAssignment(assign: any) {
    Swal.fire({
      title: "آیا از حذف تخصیص اطمینان دارید؟",
      text: "درصورت حذف دیگر قادر به بازیابی تخصیص فوق نخواهید بود.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "بله، اطمینان دارم.",
      cancelButtonText: "خیر",
      confirmButtonClass: "btn btn-success mx-2",
      cancelButtonClass: "btn btn-danger",
      buttonsStyling: !1,
    }).then((result: any) => {
      if (result.isConfirmed) {
        this.assignmentService.delete(assign.id).subscribe(data => {
          this.resolutionService.getListBy(this.meetingGuid).subscribe(res => {
            this.meetingBehaviorService.setResolutions(res)
          })
          this.updateResolutionsList();
        }, () => {
        });
      }
    });
  }

  onDescriptionEditCanceled() {
    // No action needed here, child component handles its state
  }

  // --- Resolution List Handlers ---
  onResolutionDropped(event: CdkDragDrop<Resolution[]>) {
    const resolutionsCopy = [...this.resolutions()];
    const movedItem = resolutionsCopy[event.previousIndex];
    resolutionsCopy.splice(event.previousIndex, 1);
    resolutionsCopy.splice(event.currentIndex, 0, movedItem);

    this.resolutionService.updateResolutionOrder(resolutionsCopy).subscribe({
      next: () => {
        this.meetingBehaviorService.updateResolutions(resolutionsCopy);
      },
      error: (error: any) => {
        console.error('Error updating resolution order:', error);
        this.toastService.error('خطا در به‌روزرسانی ترتیب مصوبات.');
      }
    });
  }

  openAddResolutionModal() {
    if (this.isBoardMeeting()) {
      this.showModal(this.addResolutionModal());
    } else {
      this.isEditingResolution.set(false);
      this.selectedResolutionForEdit.set(null);
      this.showModal(this.addResolutionModal());
    }
  }

  onEditResolution(resolution: Resolution) {
    this.isEditingResolution.set(true);
    // ایجاد یک کپی جدید با اضافه کردن یک timestamp
    this.selectedResolutionForEdit.set({
      ...resolution,
      _refreshToken: Date.now() // اضافه کردن یک فیلد موقت
    });
    this.showModal(this.addResolutionModal());
  }
  onAssignmentSaved() {
    this.updateResolutionsList();
    this.showModal(this.assignModal()); // Close modal
  }

  onAssignmentModalClosed() {
    this.selectedResolutionForAssign.set(null);
    this.selectedAssignmentForEdit.set(null);
  }

  onEditAssignment(assignmentId: number) {
    this.assignmentService.getBy(assignmentId).subscribe({
      next: (data: any) => {
        this.selectedAssignmentForEdit.set(data);
        const resolution = this.resolutions().find(r => r.id === data.resolutionId);
        this.selectedResolutionForAssign.set(resolution || null);
        this.showModal(this.assignModal());
      },
      error: (error: any) => {
        console.error('Error fetching assignment:', error);
        this.toastService.error('خطا در بارگذاری اطلاعات تخصیص.');
      }
    });
  }
  onDeleteResolution(resolution: Resolution) {
    Swal.fire({
      title: 'آیا از حذف مصوبه اطمینان دارید؟',
      text: 'درصورت حذف دیگر قادر به بازیابی مصوبه فوق نخواهید بود.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'بله، اطمینان دارم.',
      cancelButtonText: 'خیر',
      confirmButtonClass: 'btn btn-success mx-2',
      cancelButtonClass: 'btn btn-danger',
      buttonsStyling: false,
    }).then((result: any) => {
      if (result.isConfirmed) {
        this.resolutionService.delete(resolution.id).subscribe({
          next: () => {
            this.updateResolutionsList();
          },
          error: (error: any) => {
            console.error('Error deleting resolution:', error);
            this.toastService.error('خطا در حذف مصوبه.');
          }
        });
      }
    });
  }
  // --- File Management Modal Handlers ---
  onFileViewed(fileData: { guid?: string; url?: string; type?: string; name?: string; content?: string }) {
    this.selectedFileForViewer.set(fileData);
    this.showModal(this.fileViewerModal());
  }



  onFileDeleted(fileGuid: string) {
    this.fileManagemnetService.deleteFile(fileGuid).subscribe({
      next: () => {
        const resolutionId = this.selectedResolutionForFiles();
        if (resolutionId) {
          this.onShowFiles(resolutionId); // Refresh file list
        }
      },
      error: (error: any) => {
        console.error('Error deleting file:', error);
        this.toastService.error('خطا در حذف فایل.');
      }
    });
  }

  onFileManagementModalClosed() {
    this.selectedResolutionForFiles.set(null);
    this.attachments.set([]);
  }

  // --- File Viewer Modal Handlers ---
  onFileViewerModalClosed() {
    this.selectedFileForViewer.set(null);
  }


  onAssignResolution(resolution: Resolution) {
    this.selectedResolutionForAssign.set(resolution);
    this.selectedAssignmentForEdit.set(null);
    this.showModal(this.assignModal());
  }

  onShowFiles(resolutionId: number) {
    this.selectedResolutionForFiles.set(resolutionId);
    this.fileManagemnetService.getFiles(resolutionId, 'Resolution').subscribe({
      next: (files) => {
        // اطمینان حاصل کنید که files یک آرایه است
        this.attachments.set(files || []); // اضافه کردن || []
        this.showModal(this.fileModal());
      },
      error: (error: any) => {
        console.error('Error fetching files:', error);
        this.attachments.set([]); // اضافه کردن این خط
        this.toastService.error('خطا در بارگذاری فایل‌ها.');
      }
    });
  }
  onPrintResolution(resolution: Resolution, index: number) {
    const meeting = this.meeting();
    if (!resolution || !meeting) return;

    const newWin = window.open('', '_blank', 'width=900,height=700');
    if (!newWin) return;

    if (this.isBoardMeeting()) {
      // فرمت چاپ برای جلسات هیئت مدیره
      this.printBoardResolution(newWin, resolution, meeting, index);
    }
    else {
      this.printNormalResolution(newWin, resolution, meeting, index);
    }
  }
  private printAllNormalResolutions(newWin: Window, resolutions: Resolution[], meeting: any) {
    // Generate all resolutions content
    let allResolutionsContent = '';

    resolutions.forEach((resolution, index) => {
      // Generate assignment rows for each resolution
      let assignmentRows = '';
      if (resolution.assignments && resolution.assignments.length > 0) {
        resolution.assignments.forEach((assignment, i) => {
          assignmentRows += `
          <tr>
            <td>${i + 1}</td>
            <td>${assignment.actorName || '-'}</td>
            <td>${assignment.type || '-'}</td>
            <td>${assignment.followerName || '-'}</td>
            <td>${assignment.dueDate || '-'}</td>
          </tr>
        `;
        });
      } else {
        assignmentRows = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 20px;">تخصیصی برای این مصوبه تعریف نشده است</td>
        </tr>
      `;
      }

      // Generate resolution title
      const resolutionTitle = `مصوبه شماره ${index + 1}`;

      allResolutionsContent += `
      <div class="resolution-page" ${index < resolutions.length - 1 ? 'style="page-break-after: always;"' : ''}>
        <div class="resolution-title-header">
          <h2>${resolutionTitle}</h2>
        </div>

        <div class="resolution-content">
          <div class="resolution-header">متن مصوبه</div>
          <div class="resolution-text">
            ${resolution.description || resolution.text || 'متن مصوبه در دسترس نیست'}
          </div>
        </div>

        <div class="assignments-section">
          <div class="assignments-header">تخصیص‌های مصوبه</div>
          <table class="assignments-table">
            <thead>
              <tr>
                <th>ردیف</th>
                <th>اقدام کننده</th>
                <th>نوع تخصیص</th>
                <th>پیگیری کننده</th>
                <th>تاریخ سررسید</th>
              </tr>
            </thead>
            <tbody>
              ${assignmentRows}
            </tbody>
          </table>
        </div>
      </div>
    `;
    });

    const meetingTypeTitle = 'مصوبات جلسه';

    newWin.document.open();
    newWin.document.write(`
    <html>
      <head>
        <title>چاپ همه ${meetingTypeTitle} - ${meeting?.title}</title>
        <meta charset="UTF-8">
        <style>
          body { direction: rtl; font-family: 'Tahoma', Arial, sans-serif; background-color: #f8f9fa; padding: 0; margin: 0; }
          .container { max-width: 26cm; margin: 0 auto; background-color: #fff; padding: 20px; }

          /* Header Styles */
          .main-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; border-bottom: 3px solid #6d8dab; padding-bottom: 20px; }
          .header-content { flex: 1; text-align: center; }
          .name-of-god { font-size: 18px; font-weight: bold; margin-bottom: 10px; }
          .main-title { border: 2px solid #6d8dab; padding: 15px; border-radius: 20px; font-weight: 700; font-size: 18px; text-align: center; background: linear-gradient(to left, #e1d4cd, #f7ddd0, #e0e9f3); }
          .summary-info { margin: 20px 0; text-align: center; font-size: 14px; color: #666; }

          /* Meeting Info Table */
          .meeting-info { margin: 20px 0; border: 2px solid #6e6e6e; border-radius: 15px; overflow: hidden; }
          .meeting-info table { width: 100%; border-collapse: collapse; }
          .meeting-info th { background: #d9d9d9; border: 1px solid black; padding: 10px; font-weight: bold; text-align: center; font-size: 14px; }
          .meeting-info td { border: 1px solid black; padding: 10px; text-align: center; font-size: 13px; }

          /* Resolution Page Styles */
          .resolution-page { margin-bottom: 40px; }
          .resolution-title-header { text-align: center; margin-bottom: 20px; padding: 15px; background: linear-gradient(to left, #e8f4fd, #f0f9ff); border: 2px solid #2c5aa0; border-radius: 15px; }
          .resolution-title-header h2 { margin: 0; color: #2c5aa0; font-size: 20px; }

          /* Resolution Content */
          .resolution-content { margin: 20px 0; border: 2px solid #6e6e6e; border-radius: 10px; }
          .resolution-header { background: #fbe5d5; padding: 12px; border-bottom: 1px solid #6e6e6e; font-weight: bold; text-align: center; font-size: 16px; }
          .resolution-text { padding: 20px; line-height: 1.8; font-size: 14px; text-align: justify; }

          /* Assignments Section */
          .assignments-section { margin: 20px 0; border: 2px solid #6e6e6e; border-radius: 10px; }
          .assignments-header { background: #fbe5d5; padding: 12px; border-bottom: 1px solid #6e6e6e; font-weight: bold; text-align: center; font-size: 16px; }
          .assignments-table { width: 100%; border-collapse: collapse; }
          .assignments-table th { background: #d9d9d9; border: 1px solid black; padding: 10px; font-weight: bold; text-align: center; font-size: 14px; }
          .assignments-table td { border: 1px solid black; padding: 10px; text-align: center; font-size: 13px; }

          .print-date { margin-top: 30px; text-align: left; font-size: 12px; color: #666; border-top: 1px solid #ddd; padding-top: 15px; }

          /* Print Styles */
          * { -webkit-print-color-adjust: exact !important; color-adjust: exact !important; }
          @media print {
            body { background-color: white; }
            .container { box-shadow: none; border: none; }
            .resolution-page {
              page-break-inside: auto;
            }
          }
        </style>
        <link rel="stylesheet" href="${environment.selfEndpoint}/css/custom.css"/>
      </head>
      <body>
        <div class="container">
          <!-- Main Header -->
          <div class="main-header">
            <div class="header-content">
              <div class="name-of-god">به نام خدا</div>
              <div class="main-title">
                گزارش کامل ${meetingTypeTitle} - ${meeting?.title || 'جلسه'}
              </div>
            </div>
          </div>

          <!-- Summary Info -->
          <div class="summary-info">
            <strong>تعداد کل مصوبات: ${resolutions.length} مصوبه</strong>
          </div>

          <!-- Meeting Info -->
          <div class="meeting-info">
            <table>
              <thead>
                <tr>
                  <th>موضوع جلسه</th>
                  <th>تاریخ</th>
                  <th>زمان</th>
                  <th>شماره جلسه</th>
                  <th>رئیس جلسه</th>
                  <th>دبیر جلسه</th>
                  <th>محل تشکیل</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${meeting?.title || '-'}</td>
                  <td>${meeting?.mtDate || '-'}</td>
                  <td>${meeting?.startTime || '-'}</td>
                  <td>${meeting?.number || '-'}</td>
                  <td>${meeting?.chairman || '-'}</td>
                  <td>${meeting?.secretary || '-'}</td>
                  <td>${meeting?.location || '-'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          ${allResolutionsContent}

        </div>

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
  private printNormalResolution(newWin: Window, resolution: Resolution, meeting: any, index: number) {
    // کد قبلی برای چاپ جلسات عادی (بدون تغییر)
    let assignmentRows = '';
    if (resolution.assignments && resolution.assignments.length > 0) {
      resolution.assignments.forEach((assignment, i) => {
        assignmentRows += `
        <tr>
          <td>${i + 1}</td>
          <td>${assignment.actorName || '-'}</td>
          <td>${assignment.type || '-'}</td>
          <td>${assignment.followerName || '-'}</td>
          <td>${assignment.dueDate || '-'}</td>
        </tr>
      `;
      });
    } else {
      assignmentRows = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 20px;">تخصیصی برای این مصوبه تعریف نشده است</td>
      </tr>
    `;
    }

    const resolutionTitle = `مصوبه شماره ${index + 1} - ${meeting?.title || 'جلسه'}`;

    newWin.document.open();
    newWin.document.write(`
    <html>
      <head>
        <title>چاپ مصوبه شماره ${index + 1}</title>
        <meta charset="UTF-8">
        <style>
          body { direction: rtl; font-family: 'Tahoma', Arial, sans-serif; background-color: #f8f9fa; padding: 0; margin: 0; }
          .container { max-width: 26cm; margin: 0 auto; background-color: #fff; padding: 20px; border-radius: 15px; }
          header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
          .header-content { flex: 1; }
          .name-of-god { text-align: center; font-size: 18px; font-weight: bold; margin-bottom: 10px; }
          .resolution-title { border: 2px solid #6d8dab; padding: 15px; border-radius: 20px; font-weight: 700; font-size: 17px; text-align: center; background: linear-gradient(to left, #e1d4cd, #f7ddd0, #e0e9f3); }
          .logo img { width: 140px; }
          .meeting-info { margin: 20px 0; border: 2px solid #6e6e6e; border-radius: 15px; overflow: hidden; }
          .meeting-info table { width: 100%; border-collapse: collapse; }
          .meeting-info th { background: #d9d9d9; border: 1px solid black; padding: 10px; font-weight: bold; text-align: center; font-size: 14px; }
          .meeting-info td { border: 1px solid black; padding: 10px; text-align: center; font-size: 13px; }
          .resolution-content { margin: 20px 0; border: 2px solid #6e6e6e; border-radius: 10px; }
          .resolution-header { background: #fbe5d5; padding: 12px; border-bottom: 1px solid #6e6e6e; font-weight: bold; text-align: center; font-size: 16px; }
          .resolution-text { padding: 20px; line-height: 1.8; font-size: 14px; text-align: justify; }
          .assignments-section { margin: 20px 0; border: 2px solid #6e6e6e; border-radius: 10px; }
          .assignments-header { background: #fbe5d5; padding: 12px; border-bottom: 1px solid #6e6e6e; font-weight: bold; text-align: center; font-size: 16px; }
          .assignments-table { width: 100%; border-collapse: collapse; }
          .assignments-table th { background: #d9d9d9; border: 1px solid black; padding: 10px; font-weight: bold; text-align: center; font-size: 14px; }
          .assignments-table td { border: 1px solid black; padding: 10px; text-align: center; font-size: 13px; }
          .print-date { margin-top: 30px; text-align: left; font-size: 12px; color: #666; }
          * { -webkit-print-color-adjust: exact !important; color-adjust: exact !important; }
          @media print { body { background-color: white; } .container { box-shadow: none; border: none; } }
        </style>
      </head>
      <body>
        <div class="container">
          <header>
            <div class="header-content">
              <div class="name-of-god">به نام خدا</div>
              <div class="resolution-title">
                ${resolutionTitle}
              </div>
            </div>
          </header>

          <div class="meeting-info">
            <table>
              <thead>
                <tr>
                  <th>موضوع جلسه</th>
                  <th>تاریخ</th>
                  <th>زمان</th>
                  <th>شماره جلسه</th>
                  <th>رئیس جلسه</th>
                  <th>دبیر جلسه</th>
                  <th>محل تشکیل</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${meeting?.title || '-'}</td>
                  <td>${meeting?.mtDate || '-'}</td>
                  <td>${meeting?.startTime || '-'}</td>
                  <td>${meeting?.number || '-'}</td>
                  <td>${meeting?.chairman || '-'}</td>
                  <td>${meeting?.secretary || '-'}</td>
                  <td>${meeting?.location || '-'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="resolution-content">
            <div class="resolution-header">متن مصوبه</div>
            <div class="resolution-text">
              ${resolution.description || resolution.text || 'متن مصوبه در دسترس نیست'}
            </div>
          </div>

          <div class="assignments-section">
            <div class="assignments-header">تخصیص‌های مصوبه</div>
            <table class="assignments-table">
              <thead>
                <tr>
                  <th>ردیف</th>
                  <th>اقدام کننده</th>
                  <th>نوع تخصیص</th>
                  <th>پیگیری کننده</th>
                  <th>تاریخ سررسید</th>
                </tr>
              </thead>
              <tbody>
                ${assignmentRows}
              </tbody>
            </table>
          </div>
        </div>

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
  // --- Resolution Form Handlers (for normal resolutions) ---
  // onResolutionSaved() {
  //   this.updateResolutionsList();
  //   this.showModal(this.addResolutionModal()); // Close modal
  // }


  onResolutionSaved(): void {
    // بستن modal
    this.showModal(this.addResolutionModal()); // Close modal
    this.updateResolutionsList();
    // اگر در حالت ویرایش بودیم، فایل‌های آن مصوبه را refresh کنیم
    if (this.isEditingResolution() && this.selectedResolutionForEdit()?.id) {
      setTimeout(() => {
        this.boardResolutionList?.refreshFiles(this.selectedResolutionForEdit()!.id!);
      }, 500); // تأخیر کوتاه برای اطمینان از بارگذاری کامل
    }
  }
  // در parent component
  forceRefreshResolutionFiles(resolutionId: number): void {
    // پاک کردن cache
    this.boardResolutionList?.refreshFiles(resolutionId);

    // اطمینان از re-render شدن template
  }
  // متد چاپ تک مصوبه هیئت مدیره
  private printBoardResolution(newWin: Window, resolution: Resolution, meeting: any, index: number) {
    const members = this.meetingBehaviorService.getMembersValue();
    const boardMembers = members.filter(m => m.boardMemberGuid);
    const userMembers = members.filter(m => m.userGuid && !m.boardMemberGuid);

    if (boardMembers.length > 0) {
      const boardMemberGuids = boardMembers.map(m => m.boardMemberGuid);
      this.boardMemberService.getByGuids(boardMemberGuids).subscribe(boardMemberDetails => {
        const attendees = boardMemberDetails.filter(member => {
          return member.position !== 'دبیر هیئت مدیره';
        });
        this.generateSingleBoardResolutionDocument(newWin, resolution, meeting, index, attendees, userMembers);
      });
      return;
    }
    this.generateSingleBoardResolutionDocument(newWin, resolution, meeting, index, [], userMembers);
  }

  private generateSingleBoardResolutionDocument(newWin: Window, resolution: Resolution, meeting: any, index: number, attendees: any[], userMembers: any[]) {
    let attendeesHtml = '';
    attendees.forEach(member => {
      attendeesHtml += `
      <div class="attendee">
        <div class="checkbox">✓</div>
        <span>${member.fullName || member.name || ''}</span>
      </div>
    `;
    });

    userMembers.forEach(member => {
      attendeesHtml += `
      <div class="attendee">
        <div class="checkbox">✓</div>
        <span>${member.name || ''}</span>
      </div>
    `;
    });

    // تولید امضاها
    const signaturesHtml = this.generateBoardSignaturesGrid(attendees, userMembers);

    // شرطی کردن نمایش بخش‌ها
    const documentationSection = resolution.documentation?.trim() ? `
    <div class="row">
      <div class="row-title">سوابق و مستندات:</div>
      <div class="resolution-content">${resolution.documentation}</div>
    </div>
  ` : '';

    const descriptionSection = (resolution.description?.trim() || resolution.text?.trim()) ? `
    <div class="row">
      <div class="row-title">توضیحات:</div>
      <div class="resolution-content">
        ${resolution.description || resolution.text}
      </div>
    </div>
  ` : '';

    const decisionsMadeSection = resolution.decisionsMade?.trim() ? `
    <div class="row">
      <div class="row-title">تصمیمات متخذه:</div>
      <div class="resolution-content">
        ${resolution.decisionsMade}
      </div>
    </div>
  ` : '';


    newWin.document.open();
    newWin.document.write(`
    <!DOCTYPE html>
    <html lang="fa" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>صورتجلسه هیئت مدیره - مصوبه ${resolution.number || (index + 1)}</title>
        <style>
            body {
                font-family: 'B Nazanin', 'Tahoma', sans-serif;
                margin: 0;
                padding: 20px;
                direction: rtl;
                text-align: right;
                background-color: white;
                font-size: 14px;
                line-height: 1.6;
            }

            .container {
                margin: 0 auto;
                background-color: white;
                border: 2px solid black;
            }

            .header {
                text-align: center;
           }

            .logo {
                  width: 85px;
                height: 65px;
                margin: 0 auto 10px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 24px;
                font-weight: bold;
            }

            .company-name {
                font-size: 18px;
                font-weight: bold;
                margin-bottom: 20px;
            }

            .row1 {
                width: 100%;
                border-bottom: 1px solid black;
                padding: 15px 0;
                align-items: center;
                justify-content: space-between;
            }

            .title {
                font-size: 18px;
                font-weight: bold;
                flex: 1;
                text-align: center;
            }

            .info-group {
                display: flex;
                gap: 30px;
                flex: 1;
                justify-content: space-between;
                padding-right: 14px;
                padding-left: 34px;
            }

            .info-item {
                font-size: 16px;
                white-space: nowrap;
            }

            .row {
                padding-bottom: 5px;
                border-bottom: 1px solid black;
            }

            .row-title {
                font-family:'B Titr';
                font-weight: bold;
                padding-right: 10px;
            }

            .attendees {
                display: flex;
                gap: 5px;
                padding-right: 10px;
                font-weight: 900;
                flex-wrap: wrap;
            }

            .attendee {
                display: flex;
                align-items: center;
                gap: 5px;
                margin-bottom: 10px;
            }

            .checkbox {
                width: 10px;
                height: 10px;
                border: 2px solid #000;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                background-color: white;
            }

            .signatures {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 20px;
                padding: 20px 0;
                border-bottom: 1px solid black;
            }

            .signature {
                text-align: center;
            }

            .signature-name {
                font-weight: bold;
                font-size: 14px;
                margin-top: 25px;
            }

            .signature-position {
                font-size: 12px;
                font-weight: bold;
                margin-top: 5px;
            }

            .footer-note {
                font-size: 12px;
                text-align: justify;
                line-height: 1.5;
                padding: 10px;
            }

            .underline {
                display: inline-block;
                width: 100px;
                border-bottom: 1px solid black;
                margin: 0 5px;
            }

            .resolution-content {
             padding-right: 15px;
            padding-left: 15px;
            text-align: justify;
            line-height: 1.8;
            font-size: 16px;
            font-weight: 600;
            }

            @media print {
                * { -webkit-print-color-adjust: exact !important; color-adjust: exact !important; }
            }
        </style>
    </head>

    <body>
        <div class="header">
            <div class="logo">
                      <img src="${environment.selfEndpoint}/img/MainLogo.png" alt="لوگو" style="width:100%"  />

            </div>
            <div class="company-name">شرکت پتروشیمی اصفهان</div>
        </div>
        <div class="container">
            <!-- Row 1: Title and Info -->
            <div class="row1">
                <div class="title">صورتجلسه هیئت مدیره</div>
                <div class="info-group">
                    <div class="info-item">تاریخ جلسه: ${meeting.mtDate || ''}</div>
                    <div class="info-item">شماره صورتجلسه: ${meeting.number || ''}</div>
                    <div class="info-item">شماره مصوبه: ${resolution.number || (index + 1).toString().padStart(2, '0')}</div>
                </div>
            </div>

            <!-- Row 2: Attendees -->
            <div class="row">
                <div class="attendees">
                    <div class="attendee">
                        <span>حاضرین:</span>
                    </div>
                    ${attendeesHtml}
                </div>
            </div>
          <div class="row">
            <div class="row-title" style="display:inline">موضوع: </div><span>${resolution.title || ''}</span>
          </div>


            <!-- Row 4: Background (conditional) -->
            ${documentationSection}

            <!-- Row 5: Description (conditional) -->
            ${descriptionSection}

            <!-- Row 6: Decisions (conditional) -->
            ${decisionsMadeSection}


            <!-- Row 7: Signatures -->
            <div class="signatures">
                ${signaturesHtml}
            </div>

            <!-- Footer Note -->
            <div class="footer-note">
                در راستای رعایت مفاد ماده 129 اصلاحیه قانون تجارت، جناب آقای <span class="underline"></span> در تصمیم گیری
                بند <span class="underline"></span> مشارکت نداشته اند / امضاء
            </div>
        </div>

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

  // متد چاپ همه مصوبات هیئت مدیره
  onPrintAllResolutions() {
    const meeting = this.meeting();
    const resolutions = this.resolutions();

    if (!meeting || !resolutions || resolutions.length === 0) {
      this.toastService.warning('هیچ مصوبه‌ای برای چاپ وجود ندارد.');
      return;
    }

    const newWin = window.open('', '_blank', 'width=900,height=700');
    if (!newWin) return;

    if (this.isBoardMeeting()) {
      this.printAllBoardResolutions(newWin, resolutions, meeting);
    } else {
      this.printAllNormalResolutions(newWin, resolutions, meeting);
    }
  }

  private printAllBoardResolutions(newWin: Window, resolutions: Resolution[], meeting: any) {
    const members = this.meetingBehaviorService.getMembersValue();
    const boardMembers = members.filter(m => m.boardMemberGuid);
    const userMembers = members.filter(m => m.userGuid && !m.boardMemberGuid);

    if (boardMembers.length > 0) {
      const boardMemberGuids = boardMembers.map(m => m.boardMemberGuid);
      this.boardMemberService.getByGuids(boardMemberGuids).subscribe(boardMemberDetails => {
        const attendees = boardMemberDetails.filter(member => {
          return member.position !== 'دبیر هیئت مدیره';
        });
        this.generateAllBoardResolutionsDocument(newWin, resolutions, meeting, attendees, []);
      });
      return;
    }
    this.generateAllBoardResolutionsDocument(newWin, resolutions, meeting, [], []);
  }

  private generateAllBoardResolutionsDocument(newWin: Window, resolutions: Resolution[], meeting: any, attendees: any[], userMembers: any[]) {
    let attendeesHtml = '';
    attendees.forEach(member => {
      attendeesHtml += `
      <div class="attendee">
        <div class="checkbox">✓</div>
        <span>${member.fullName || member.name || ''}</span>
      </div>
    `;
    });

    userMembers.forEach(member => {
      attendeesHtml += `
      <div class="attendee">
        <div class="checkbox">✓</div>
        <span>${member.name || ''}</span>
      </div>
    `;
    });

    // تولید محتوای همه مصوبات
    let allResolutionsContent = '';
    resolutions.forEach((resolution, index) => {
      const signaturesHtml = this.generateBoardSignaturesGrid(attendees, userMembers);

      // شرطی کردن نمایش بخش‌ها
      const documentationSection = resolution.documentation?.trim() ? `
      <div class="row">
        <div class="row-title">سوابق و مستندات:</div>
        <div class="resolution-content">${resolution.documentation}</div>
      </div>
    ` : '';

      const descriptionSection = (resolution.description?.trim() || resolution.text?.trim()) ? `
      <div class="row">
        <div class="row-title">توضیحات:</div>
        <div class="resolution-content">
          ${resolution.description || resolution.text}
        </div>
      </div>
    ` : '';

      const decisionsMadeSection = resolution.decisionsMade?.trim() ? `
      <div class="row">
        <div class="row-title">تصمیمات متخذه:</div>
        <div class="resolution-content">${resolution.decisionsMade}</div>
      </div>
    ` : '';

      allResolutionsContent += `
      <div class="resolution-page" ${index < resolutions.length - 1 ? 'style="page-break-after: always;"' : ''}>
        <div class="header">
          <div class="logo">
            <img src="${environment.selfEndpoint}/img/MainLogo.png" alt="لوگو" style="width:100%" />
          </div>
        </div>
        <div class="container">
          <!-- Row 1: Title and Info -->
          <div class="row1">
            <div class="title">صورتجلسه هیئت مدیره</div>
            <div class="info-group">
              <div class="info-item">تاریخ جلسه: ${meeting.mtDate || ''}</div>
              <div class="info-item">شماره صورتجلسه: ${meeting.number || ''}</div>
              <div class="info-item">شماره مصوبه: ${resolution.number || (index + 1).toString().padStart(2, '0')}</div>
            </div>
          </div>

          <!-- Row 2: Attendees -->
          <div class="row">
            <div class="attendees">
              <div class="attendee">
                <span>حاضرین:</span>
              </div>
              ${attendeesHtml}
            </div>
          </div>

          <!-- Row 3: Subject -->
          <div class="row">
            <div class="row-title" style="display:inline">موضوع: </div><span>${resolution.title || ''}</span>
          </div>

          <!-- Conditional sections -->
          ${documentationSection}
          ${descriptionSection}
          ${decisionsMadeSection}

          <!-- Row 7: Signatures -->
          <div class="signatures">
            ${signaturesHtml}
          </div>

          <!-- Footer Note -->
          <div class="footer-note">
            در راستای رعایت مفاد ماده 129 اصلاحیه قانون تجارت، جناب آقای <span class="underline"></span> در تصمیم گیری
            بند <span class="underline"></span> مشارکت نداشته اند / امضاء
          </div>
        </div>
      </div>
    `;
    });


    newWin.document.open();
    newWin.document.write(`
    <!DOCTYPE html>
    <html lang="fa" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>صورتجلسه هیئت مدیره - تمام مصوبات</title>
                <style>
            body {
                font-family: 'B Nazanin';
                margin: 0;
                padding: 20px;
                direction: rtl;
                text-align: right;
                background-color: white;
                font-size: 14px;
                line-height: 1.6;
            }

            .container {
                margin: 0 auto;
                background-color: white;
                border: 2px solid black;
            }

            .header {
                text-align: center;
            }

            .logo {
                  width: 85px;
                height: 65px;
                margin: 0 auto 10px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 24px;
                font-weight: bold;
            }

            .company-name {
                font-size: 18px;
                font-weight: bold;
                margin-bottom: 20px;
            }

            .row1 {
                width: 100%;
                border-bottom: 1px solid black;
                padding: 15px 0;
                align-items: center;
                justify-content: space-between;
            }

            .title {
                font-size: 18px;
                font-weight: bold;
                flex: 1;
                text-align: center;
            }

            .info-group {
                display: flex;
                gap: 30px;
                flex: 1;
                justify-content: space-between;
                padding-right: 14px;
                padding-left: 34px;
            }

            .info-item {
                font-size: 16px;
                white-space: nowrap;
            }

            .row {
                padding-bottom: 5px;
                border-bottom: 1px solid black;
            }

            .row-title {
                font-family:'B Titr';
                font-weight: bold;
                padding-right: 10px;
            }

            .attendees {
                display: flex;
                gap: 5px;
                padding-right: 10px;
                font-weight: 900;
                flex-wrap: wrap;
            }

            .attendee {
                display: flex;
                align-items: center;
                gap: 5px;
                margin-bottom: 10px;
            }

            .checkbox {
                width: 10px;
                height: 10px;
                border: 2px solid #000;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                background-color: white;
            }

            .signatures {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 20px;
                padding: 20px 0;
                border-bottom: 1px solid black;
            }

            .signature {
                text-align: center;
            }

            .signature-name {
                font-weight: bold;
                font-size: 14px;
                margin-top: 25px;
            }

            .signature-position {
                font-size: 12px;
                font-weight: bold;
                margin-top: 5px;
            }

            .footer-note {
                font-size: 12px;
                text-align: justify;
                line-height: 1.5;
                padding: 10px;
            }

            .underline {
                display: inline-block;
                width: 100px;
                border-bottom: 1px solid black;
                margin: 0 5px;
            }

            .resolution-content {
              padding-right: 15px;
              padding-left: 15px;
              text-align: justify;
              line-height: 1.8;
              font-size: 16px;
              font-weight: 600;
            }

            @media print {
                * { -webkit-print-color-adjust: exact !important; color-adjust: exact !important; }
            }
        </style>
    </head>

    <body>
        ${allResolutionsContent}

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

  // متد کمکی برای تولید grid امضاها
  private generateBoardSignaturesGrid(attendees: any[], userMembers: any[]): string {
    let signaturesHtml = '';
    let allMembers = [...attendees, ...userMembers];

    // تنظیم حداکثر 6 امضا (3x2 grid مانند قالب اصلی)
    for (let i = 0; i < 6; i++) {
      if (i < allMembers.length) {
        const member = allMembers[i];
        signaturesHtml += `
        <div class="signature">
          <div class="signature-name">${member.fullName || member.name || ''}</div>
          <div class="signature-position">${member.position || 'عضو هیئت مدیره'}</div>
        </div>
      `;
      } else {
        signaturesHtml += `<div class="signature"></div>`;
      }
    }

    return signaturesHtml;
  }

  // متد کمکی برای تولید متن تصمیمات
  private generateDecisionText(resolution: Resolution): string {
    if (resolution.assignments && resolution.assignments.length > 0) {
      return `مصوب شد و تخصیص‌های لازم انجام گردید. (${resolution.assignments.length} تخصیص)`;
    }
    return 'مصوب شد.';
  }
  onResolutionFormModalClosed() {
    // Any cleanup if needed when the modal is closed
  }

  onFilesUploaded(files: any) {
    this.fileCount.set(files.length + (this.attachments()?.length || 0));
  }
  private loadUsers() {
    const clientId = getClientSettings().client_id ?? '';
    this.userService.getAllByClientId<SystemUser[]>(clientId).subscribe({
      next: (data: SystemUser[]) => {
        this.userList.set(data);
        const users = data.map((user) => ({
          guid: user.guid,
          title: user.name,
          other: user.positionGuid,
          personalNo: user.userName
        }));
        this.allUsers.set(users);
      }
    });
  }

  private loadPreviousResolutions() {
    this.resolutionService.getListBy(this.meetingGuid()).subscribe({
      next: (data) => {
        this.previousResolutions.set(data);
      }
    });
  }

  private updateResolutionsList() {
    this.resolutionService.getListBy(this.meetingGuid()).subscribe({
      next: (data) => {
        this.meetingBehaviorService.updateResolutions(data);
      }
    });
  }

  private async loadPermissions(): Promise<void> {
    const permissionsToCheck = [
      'MT_Resolutions_Add',
      'MT_Resolutions_Edit',
      'MT_Resolutions_Delete',
      'MT_Resolutions_Assign',
      'MT_Resolutions_ViewFiles',
      'MT_Resolutions_DeleteFiles',
      'MT_Descriptions_Edit',
      'MT_Resolutions', // For drag and drop
    ];

    const newPermissions = new Set<string>();
    for (const perm of permissionsToCheck) {
      const has = await this.passwordFlowService.checkPermission(perm);
      if (has && (this.isSuperAdmin() || this.isDelegate())) {
        newPermissions.add(perm);
      }
    }
    this.permissions.set(newPermissions);
  }

  private showModal(modalRef: ElementRef | undefined): void {
    if (!modalRef || !modalRef.nativeElement) {
      console.error('Modal reference is invalid', modalRef);
      return;
    }
    const modalInstance =
      Modal.getInstance(modalRef.nativeElement) ||
      new Modal(modalRef.nativeElement);
    modalInstance.toggle();
  }


}
