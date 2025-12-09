import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
  AfterViewInit,
  inject,
  DestroyRef,
  signal,
  computed,
  effect
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import {
  ApexNonAxisChartSeries,
  ApexAxisChartSeries,
  ApexChart,
  ApexResponsive,
  ApexLegend,
  ApexTooltip,
  ApexDataLabels,
  ApexPlotOptions,
  ApexFill,
  ApexXAxis,
  ApexYAxis,
  ApexStroke,
  ApexTitleSubtitle,
  NgApexchartsModule
} from 'ng-apexcharts';
import { catchError, forkJoin, of } from 'rxjs';
import { ChartAutoResizeDirective } from '../../core/directives/chart-autoresize.directive';
import { AssignmentCount } from '../../core/models/assignment-count';
import { MeetingCount } from '../../core/models/meeting-count';
import { POSITION_ID, USER_ID_NAME } from '../../core/types/configuration';
import {
  AssignmentService,
  OriginalAssignmentCounts,
  PendingActionCounts,
  ReferralCounts
} from '../../services/assignment.service';
import { DelegationService } from '../../services/delegation.service';
import { BreadcrumbService } from '../../services/framework-services/breadcrumb.service';
import { CodeFlowService } from '../../services/framework-services/code-flow.service';
import { LocalStorageService } from '../../services/framework-services/local.storage.service';
import { MeetingService } from '../../services/meeting.service';
import { FollowerActorsActionCounts } from '../../core/models/followersActorCounts';

declare var $: any;

// ======================================================================
// Enums مربوط به فیلترها برای ناوبری به ResolutionList
// این‌ها فقط در همین داشبورد استفاده می‌شوند
// ======================================================================
enum ActionStatusDash {
  Pending = 1,
  InProgress = 2,
  End = 3,
  Overdue = 4
}

enum ActionFollowStatusDash {
  Pending = 1,
  InProgress = 2,
  End = 3
}

enum AssignmentResultDash {
  Done = 1,
  NotDone = 2
}

// ======================================================================

@Component({
  selector: 'app-dashboard',
  standalone: true,
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css'],
  imports: [
    RouterLink,
    FormsModule,
    NgApexchartsModule,
    ChartAutoResizeDirective
  ]
})
export class DashboardComponent implements OnInit, OnDestroy, AfterViewInit {

  // Injected services
  private readonly delegationService = inject(DelegationService);
  private readonly codeFlowService = inject(CodeFlowService);
  private readonly localStorageService = inject(LocalStorageService);
  private readonly router = inject(Router);
  private readonly meetingService = inject(MeetingService);
  private readonly assignmentService = inject(AssignmentService);
  private readonly breadcrumbService = inject(BreadcrumbService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly _followerActorsActionCounts = signal<FollowerActorsActionCounts | null>(null);
  readonly followerActorsActionCounts = this._followerActorsActionCounts.asReadonly();
  // Reactive signals
  private readonly _isFirstLoad = signal(true);
  private readonly _isDataLoaded = signal(false);
  private readonly _isChartsInitialized = signal(false);
  private readonly _selectedPeriod = signal<'Weekly' | 'Monthly' | 'Yearly'>('Yearly');

  private readonly _meetingCounts = signal<MeetingCount>({} as MeetingCount);
  private readonly _assignmentCounts = signal<AssignmentCount>({} as AssignmentCount);
  private readonly _todayMeetings = signal<any[]>([]);
  private readonly _tomorrowMeetings = signal<any[]>([]);
  private readonly _meetingStatistics = signal<{ dateLabel: string; count: number; duration: number; }[]>([]);

  // Extended assignment counts
  private readonly _originalAssignmentCounts = signal<OriginalAssignmentCounts | null>(null);
  private readonly _receivedReferralCounts = signal<ReferralCounts | null>(null);
  private readonly _sentReferralCounts = signal<ReferralCounts | null>(null);
  private readonly _pendingActionCounts = signal<PendingActionCounts | null>(null);

  // Chart options signals
  private readonly _chartOptions = signal<Partial<ApexChartOptions> | null>(null);
  private readonly _actionChartOptions = signal<Partial<ApexChartOptions> | null>(null);
  private readonly _followChartOptions = signal<Partial<ApexChartOptions> | null>(null);
  private readonly _referralChartOptions = signal<Partial<ApexChartOptions> | null>(null);
  private readonly _pendingActionChartOptions = signal<Partial<ApexChartOptions> | null>(null);

  // Public readonly signals
  readonly url = 'http://localhost:7200/#/dashboard';
  readonly delegations: any[] = [];
  readonly selectedDelegationId: any = null;

  readonly isFirstLoad = this._isFirstLoad.asReadonly();
  readonly isDataLoaded = this._isDataLoaded.asReadonly();
  readonly isChartsInitialized = this._isChartsInitialized.asReadonly();
  readonly selectedPeriod = this._selectedPeriod.asReadonly();

  readonly meetingCounts = this._meetingCounts.asReadonly();
  readonly assignmentCounts = this._assignmentCounts.asReadonly();
  readonly todayMeetings = this._todayMeetings.asReadonly();
  readonly tomorrowMeetings = this._tomorrowMeetings.asReadonly();
  readonly meetingStatistics = this._meetingStatistics.asReadonly();

  readonly originalAssignmentCounts = this._originalAssignmentCounts.asReadonly();
  readonly receivedReferralCounts = this._receivedReferralCounts.asReadonly();
  readonly sentReferralsCounts = this._sentReferralCounts.asReadonly();
  readonly pendingActionCounts = this._pendingActionCounts.asReadonly();

  readonly chartOptions = this._chartOptions.asReadonly();
  readonly actionChartOptions = this._actionChartOptions.asReadonly();
  readonly followChartOptions = this._followChartOptions.asReadonly();
  readonly referralChartOptions = this._referralChartOptions.asReadonly();
  readonly pendingActionChartOptions = this._pendingActionChartOptions.asReadonly();

  // Computed values from meeting counts
  readonly draftMeetingsCount = computed(() => this._meetingCounts().draftMeetingsCount || 0);
  readonly todayMeetingsCount = computed(() => this._meetingCounts().todayMeetingsCount || 0);
  readonly upcomingMeetingsCount = computed(() => this._meetingCounts().upcomingMeetingsCount || 0);
  readonly signatureMeetingsCount = computed(() => this._meetingCounts().signatureMeetingsCount || 0);
  readonly finishedMeetingsCount = computed(() => this._meetingCounts().finishedMeetingsCount || 0);
  readonly allMeetingsCount = computed(() => this._meetingCounts().allMeetingsCount || 0);
  readonly canceledMeetingsCount = computed(() => this._meetingCounts().canceledMeetingsCount || 0);
  readonly attendanceMeetingsCount = computed(() => this._meetingCounts().attendanceMeetingsCount || 0);

  combinedMeetings = computed(() => {
    const today = this.todayMeetings().map(m => ({ ...m, isToday: true }));
    const tomorrow = this.tomorrowMeetings().map(m => ({ ...m, isToday: false }));
    return [...today, ...tomorrow].sort((a, b) => a.time.localeCompare(b.time));
  });

  // Enhanced computed counts including referrals
  readonly counts = computed(() => {
    const ac = this._assignmentCounts().actionCounts || {} as any;
    const fc = this._assignmentCounts().followCounts || {} as any;

    return {
      action: {
        all: ac.all || 0,
        pending: ac.pending || 0,
        inProgress: ac.inProgress || 0,
        done: ac.done || 0,
        notDone: ac.notDone || 0,
        end: ac.end || 0
      },
      follow: {
        all: fc.all || 0,
        inProgress: fc.inProgress || 0,
        end: fc.end || 0,
        pending: fc.pending || 0
      },
      followerActorsActions: this._followerActorsActionCounts() || { total: 0, pending: 0, inProgress: 0, end: 0, overdue: 0 },
      original: this._originalAssignmentCounts() || {} as OriginalAssignmentCounts,
      receivedReferrals: this._receivedReferralCounts() || {} as ReferralCounts,
      sentReferrals: this._sentReferralCounts() || {} as ReferralCounts,
      pendingActions: this._pendingActionCounts() || {} as PendingActionCounts
    };
  });

  // Chart series for line chart
  chartSeries: ApexAxisChartSeries = [];
  chartLineOptions: Partial<ApexChartOptions> = {
    chart: {
      type: 'bar',
      height: 200,
      fontFamily: 'Sahel'
    }
  };
  xaxis: ApexXAxis = { categories: [] };
  yaxis: ApexYAxis | ApexYAxis[] = {};
  stroke: ApexStroke = { curve: 'smooth' };
  dataLabels: ApexDataLabels = { enabled: false };
  title: ApexTitleSubtitle = {
    text: 'آمار جلسات',
    align: 'center'
  };
  tooltip: ApexTooltip = {};

  constructor() {
    this.breadcrumbService.setItems([]);
    this.setupEffects();
  }

  private setupEffects(): void {
    // Effect to update charts when data changes
    effect(() => {
      const meetingCounts = this._meetingCounts();
      const assignmentCounts = this._assignmentCounts();
      const isDataLoaded = this._isDataLoaded();

      if (isDataLoaded && Object.keys(meetingCounts).length > 0 && Object.keys(assignmentCounts).length > 0) {
        setTimeout(() => {
          this.updateAllCharts(meetingCounts, assignmentCounts);
          this._isChartsInitialized.set(true);
          this.cdr.detectChanges();
        }, 200);
      }
    });

    // Effect to handle period changes
    effect(() => {
      const period = this._selectedPeriod();
      this.loadMeetingStatistics();
    });

    // Effect to force charts update after view init
    effect(() => {
      const isDataLoaded = this._isDataLoaded();
      const isChartsInitialized = this._isChartsInitialized();

      if (isDataLoaded && !isChartsInitialized) {
        setTimeout(() => {
          this.forceChartsUpdate();
        }, 300);
      }
    });
  }

  ngOnInit(): void {
    this.loadDashboardData();
  }

  ngAfterViewInit(): void { }

  ngOnDestroy(): void { }

  private loadDashboardData(): void {
    const positionGuid = this.localStorageService.getItem(POSITION_ID);
    const userGuid = this.localStorageService.getItem(USER_ID_NAME);
    this.loadMeetingStatistics();

    const requests = {
      meetingCounts: this.meetingService.getMeetingCounts(positionGuid),
      assignmentCounts: this.assignmentService.getCounts(positionGuid),
      meetings: this.meetingService.getTodayTommorrowMeetings(positionGuid),
      originalCounts: this.assignmentService.getOriginalAssignmentCounts(positionGuid).pipe(catchError(() => of(null))),
      receivedCounts: this.assignmentService.getReceivedReferralCounts(positionGuid).pipe(catchError(() => of(null))),
      sentCounts: this.assignmentService.getSentReferralCounts(userGuid).pipe(catchError(() => of(null))),
      pendingCounts: this.assignmentService.getPendingActionCounts(positionGuid).pipe(catchError(() => of(null))),

      // ✅ جدید: آمار اقدام‌کنندگان برای مواردی که من پیگیری‌کننده‌ام
      followerActorsActionCounts: this.assignmentService
        .getFollowerActorsActionCounts(positionGuid)
        .pipe(catchError(() => of(null)))
    };

    forkJoin(requests).pipe(
      // تا زمان destroy
    ).subscribe({
      next: (response) => {
        this._meetingCounts.set(response.meetingCounts);
        this._assignmentCounts.set(response.assignmentCounts);

        const meetings = Array.isArray(response.meetings) ? response.meetings : [];
        this._todayMeetings.set(meetings.filter((m: any) => m.type === 'Today'));
        this._tomorrowMeetings.set(meetings.filter((m: any) => m.type === 'Tomorrow'));
        this._followerActorsActionCounts.set(response.followerActorsActionCounts);

        this._originalAssignmentCounts.set(response.originalCounts);
        this._receivedReferralCounts.set(response.receivedCounts);
        this._sentReferralCounts.set(response.sentCounts);
        this._pendingActionCounts.set(response.pendingCounts);
        this._isDataLoaded.set(true);
      },
      error: (error) => {
        console.error('Error loading dashboard data:', error);
        this._isDataLoaded.set(false);
      }
    });
  }

  private updateAllCharts(meetingCounts: MeetingCount, assignmentCounts: AssignmentCount): void {
    // جلسات
    this._chartOptions.set(this.buildDonutChartOptions(
      [
        this.signatureMeetingsCount(),
        this.attendanceMeetingsCount(),
        this.draftMeetingsCount(),
        this.upcomingMeetingsCount(),
        this.canceledMeetingsCount()
      ],
      ['جهت امضا', 'جهت اعلام حضور', 'پیش نویس', 'آینده', 'لغو شده'],
      ['#03c3ec', '#ffab00', '#696cff', '#435971', '#ff3e1d'],
      'جلسات',
      this.allMeetingsCount()
    ));

    // اقدام
    this._actionChartOptions.set(this.buildDonutChartOptions(
      [
        assignmentCounts.actionCounts.inProgress,
        assignmentCounts.actionCounts.pending,
        assignmentCounts.actionCounts.end
      ],
      ['در حال انجام', 'در انتظار اقدام', 'پایان یافته'],
      ['#71dd37', '#03c3ec', '#ffab00', '#435971'],
      'اقدام',
      assignmentCounts.actionCounts.all
    ));

    // پیگیری
    this._followChartOptions.set(this.buildDonutChartOptions(
      [
        assignmentCounts.followCounts.inProgress,
        assignmentCounts.followCounts.pending,
        assignmentCounts.followCounts.end
      ],
      ['در حال پیگیری', 'در انتظار/پیگیری نشده', 'اتمام یافته'],
      ['#71dd37', '#03c3ec', '#435971'],
      'پیگیری',
      assignmentCounts.followCounts.all
    ));

    // ارجاعات
    const referralCounts = this._receivedReferralCounts();
    const sentCounts = this._sentReferralCounts();
    if (referralCounts && sentCounts) {
      this._referralChartOptions.set(this.buildDonutChartOptions(
        [referralCounts.total || 0, sentCounts.total || 0],
        ['دریافتی', 'ارسالی'],
        ['#28a745', '#ffc107'],
        'ارجاعات',
        (referralCounts.total || 0) + (sentCounts.total || 0)
      ));
    }

    // اقدامات در انتظار
    const pendingCounts = this._pendingActionCounts();
    if (pendingCounts) {
      this._pendingActionChartOptions.set(this.buildDonutChartOptions(
        [
          pendingCounts.inProgress || 0,
          pendingCounts.notDone || 0,
          pendingCounts.overdue || 0
        ],
        ['در حال انجام', 'انجام نشده', 'گذشته از مهلت'],
        ['#ffc107', '#dc3545', '#6c757d'],
        'منتظر اقدام',
        pendingCounts.total || 0
      ));
    }
  }

  private forceChartsUpdate(): void {
    this.cdr.detectChanges();
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 100);
  }

  loadMeetingStatistics(): void {
    const positionGuid = this.localStorageService.getItem(POSITION_ID);
    const request = {
      positionGuid: positionGuid,
      type: this._selectedPeriod()
    };

    this.meetingService.getMeetingStatistics(request)
      .subscribe((data) => {
        this._meetingStatistics.set(data);
        this.chartSeries = [
          {
            name: 'تعداد جلسات',
            data: data.map((item: any) => Number(item.count.toFixed(2)))
          },
          {
            name: 'مجموع ساعات',
            data: data.map((item: any) => Number(item.duration.toFixed(2)))
          }
        ];

        this.xaxis = {
          categories: data.map((item: any) => item.dateLabel)
        };

        this.cdr.detectChanges();
      });
  }

  changePeriod(period: 'Weekly' | 'Monthly' | 'Yearly'): void {
    this._selectedPeriod.set(period);
  }

  // ==================== Navigation methods به ResolutionList ====================

  // همه تخصیص‌های اصلی
  navigateToOriginalAssignments(): void {
    this.router.navigate(['/resolutions/list'], {
      queryParams: {
        viewType: 'OriginalAssignment'
      }
    });
  }

  // در انتظار اقدام (اقدام‌کننده)
  navigateToPendingActions(): void {
    this.router.navigate(['/resolutions/list'], {
      queryParams: {
        viewType: 'OriginalAssignment',
        role: 'Action',
        actionStatus: ActionStatusDash.Pending
      }
    });
  }

  // در حال انجام (اقدام‌کننده)
  navigateToInProgressActions(): void {
    this.router.navigate(['/resolutions/list'], {
      queryParams: {
        viewType: 'OriginalAssignment',
        role: 'Action',
        actionStatus: ActionStatusDash.InProgress
      }
    });
  }

  // پایان یافته ولی انجام نشده (اقدام‌کننده)
  navigateToNotDoneActions(): void {
    this.router.navigate(['/resolutions/list'], {
      queryParams: {
        viewType: 'OriginalAssignment',
        role: 'Action',
        actionStatus: ActionStatusDash.End
      }
    });
  }

  // همه پایان یافته‌ها (اقدام‌کننده) – در صورت نیاز
  navigateToEndActions(): void {
    this.router.navigate(['/resolutions/list'], {
      queryParams: {
        viewType: 'OriginalAssignment',
        role: 'Action',
        actionStatus: ActionStatusDash.End
      }
    });
  }

  // پیگیری‌های در حال پیگیری
  navigateToFollowingUpReferrals(): void {
    this.router.navigate(['/resolutions/list'], {
      queryParams: {
        viewType: 'OriginalAssignment',
        role: 'Follow',
        followStatus: ActionFollowStatusDash.InProgress
      }
    });
  }

  // پیگیری نشده / در انتظار پیگیری
  navigateToNotFollowedUpReferrals(): void {
    this.router.navigate(['/resolutions/list'], {
      queryParams: {
        viewType: 'OriginalAssignment',
        role: 'Follow',
        followStatus: ActionFollowStatusDash.Pending
      }
    });
  }

  // پیگیری‌های پایان یافته
  navigateToFollowUpEnd(): void {
    this.router.navigate(['/resolutions/list'], {
      queryParams: {
        viewType: 'OriginalAssignment',
        role: 'Follow',
        followStatus: ActionFollowStatusDash.End
      }
    });
  }
  navigateToFollowerPendingActorActions(): void {
    this.router.navigate(['/resolutions/list'], {
      queryParams: {
        viewType: 'All',
        role: 'Follow',
        actionStatus: ActionStatusDash.Pending
      }
    });
  }

  navigateToFollowerInProgressActorActions(): void {
    this.router.navigate(['/resolutions/list'], {
      queryParams: {
        viewType: 'All',
        role: 'Follow',
        actionStatus: ActionStatusDash.InProgress
      }
    });
  }

  // ارجاعات دریافتی (من اقدام‌کننده هستم)
  navigateToReceivedReferrals(): void {
    this.router.navigate(['/resolutions/list'], {
      queryParams: {
        viewType: 'ReceivedReferral',
        role: 'Action'
      }
    });
  }

  // ارجاعات ارسالی (من ارجاع‌دهنده/پیگیری‌کننده هستم)
  navigateToSentReferrals(): void {
    this.router.navigate(['/resolutions/list'], {
      queryParams: {
        viewType: 'GivenReferral',
        role: 'Follow'
      }
    });
  }

  // نمودار منتظر اقدام – در حال انجام
  navigateToPendingInProgress(): void {
    this.router.navigate(['/resolutions/list'], {
      queryParams: {
        viewType: 'OriginalAssignment',
        role: 'Action',
        actionStatus: ActionStatusDash.InProgress
      }
    });
  }

  // نمودار منتظر اقدام – انجام نشده
  navigateToPendingNotDone(): void {
    this.router.navigate(['/resolutions/list'], {
      queryParams: {
        viewType: 'OriginalAssignment',
        role: 'Action',
        actionStatus: ActionStatusDash.End,
        result: AssignmentResultDash.NotDone
      }
    });
  }

  // نمودار منتظر اقدام – گذشته از مهلت
  navigateToPendingOverdue(): void {
    this.router.navigate(['/resolutions/list'], {
      queryParams: {
        viewType: 'OriginalAssignment',
        role: 'Action',
        overdue: true
      }
    });
  }

  // ==================== سایر متدها ====================

  private buildDonutChartOptions(
    series: number[],
    labels: string[],
    colors: string[],
    totalLabel: string,
    totalValue: number,
    tooltipSuffix: string = 'عدد'
  ): Partial<ApexChartOptions> {
    const validSeries = series.filter(s => s > 0);
    const hasValidData = validSeries.length > 0;

    const baseOptions: Partial<ApexChartOptions> = {
      series: hasValidData ? series : [1],
      chart: {
        type: 'donut',
        height: 160,
        width: 160,
        fontFamily: 'Sahel',
        animations: {
          enabled: true,
          speed: 800,
          animateGradually: {
            enabled: true,
            delay: 150
          },
          dynamicAnimation: {
            enabled: true,
            speed: 350
          }
        }
      },
      labels: hasValidData ? labels : ['بدون داده'],
      colors: hasValidData ? colors : ['#e0e0e0'],
      legend: { show: false },
      tooltip: {
        enabled: hasValidData,
        y: {
          formatter: val => `${val} ${tooltipSuffix}`
        }
      },
      dataLabels: { enabled: false },
      plotOptions: {
        pie: {
          donut: {
            size: '70%',
            labels: {
              show: true,
              name: {
                show: true,
                fontSize: '12px',
                fontFamily: 'Sahel',
                offsetY: -10
              },
              value: {
                show: true,
                fontSize: '14px',
                fontFamily: 'Sahel',
                offsetY: 16,
                formatter: (val) => val
              },
              total: {
                show: true,
                showAlways: true,
                label: totalLabel,
                fontSize: '12px',
                fontFamily: 'Sahel',
                formatter: () => ''
              }
            }
          }
        }
      },
      responsive: [
        {
          breakpoint: 480,
          options: {
            chart: {
              width: 200
            }
          }
        }
      ]
    };

    return baseOptions;
  }

  refreshCharts(): void {
    this._isDataLoaded.set(false);
    this._isChartsInitialized.set(false);
    this._chartOptions.set(null);
    this._actionChartOptions.set(null);
    this._followChartOptions.set(null);
    this._referralChartOptions.set(null);
    this._pendingActionChartOptions.set(null);

    setTimeout(() => {
      this.loadDashboardData();
    }, 100);
  }

  getCurrentDate(): string {
    const today = new Date();
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    };
    return new Intl.DateTimeFormat('fa-IR', options).format(today);
  }

  getTomorrowDate(): string {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    };
    return new Intl.DateTimeFormat('fa-IR', options).format(tomorrow);
  }

  getMeetingVerticalPosition(time: string): number {
    const startTime = time.split('-')[1].trim();
    const [hours, minutes] = startTime.split(':').map(Number);

    const totalMinutes = hours * 60 + minutes;
    const startMinutes = 8 * 60;
    const endMinutes = 18 * 60;
    const rangeMinutes = endMinutes - startMinutes;

    const percentage = ((totalMinutes - startMinutes) / rangeMinutes * 100);
    return Math.max(0, Math.min(100, percentage));
  }

  getStartTime(time: string) {
    return time.split('-')[1].trim();
  }

  trackByMeeting(index: number, meeting: any): any {
    return meeting.guid || meeting.id || index;
  }
}

// Types
type ApexChartOptions = {
  series: ApexNonAxisChartSeries;
  chart: ApexChart;
  labels: string[];
  responsive: ApexResponsive[];
  legend: ApexLegend;
  tooltip: ApexTooltip;
  dataLabels: ApexDataLabels;
  plotOptions: ApexPlotOptions;
  fill: ApexFill;
  colors: string[];
};
