import {
  Component,
  viewChild,
  inject,
  DestroyRef,
  signal,
  computed,
  effect,
  OnInit
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { CalendarOptions } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { FullCalendarModule } from '@fullcalendar/angular';
import timeGridPlugin from '@fullcalendar/timegrid';
import faLocale from '@fullcalendar/core/locales/fa';
import { Modal, Tooltip } from 'bootstrap';
import moment from 'jalali-moment';
import { MeetingService } from '../../services/meeting.service';
import { LocalStorageService } from '../../services/framework-services/local.storage.service';
import {  POSITION_ID, USER_ID_NAME } from '../../core/types/configuration';
import { BreadcrumbService } from '../../services/framework-services/breadcrumb.service';
import { PasswordFlowService } from '../../services/framework-services/password-flow.service';
import { ToastService } from '../../services/framework-services/toast.service';
import { UserService } from '../../services/user.service';

interface CalendarEvent {
  title: string;
  start: string;
  end?: string;
  backgroundColor?: string;
  textColor?: string;
  url?: string;
  display?: string;
  extendedProps?: {
    type: string;
  };
}

interface NewEvent {
  title: string;
  startTime: string;
  endTime: string;
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [FormsModule, FullCalendarModule],
  templateUrl: './calendar.html',
  styleUrl: './calendar.css'
})
export class CalendarComponent implements OnInit {
  // Injected services using inject()
  private readonly meetingService = inject(MeetingService);
  private readonly localStorageService = inject(LocalStorageService);
  private readonly breadcrumbService = inject(BreadcrumbService);
  private readonly passwordFlowService = inject(PasswordFlowService);
  private readonly toastService = inject(ToastService);
  private readonly userService = inject(UserService);
  private readonly destroyRef = inject(DestroyRef);

  // ViewChild signals
  readonly calendarComponent = viewChild<any>('fullcalendar');
  readonly eventModal = viewChild<any>('eventModal');

  // Private writable signals for internal state
  private readonly _events = signal<CalendarEvent[]>([]);
  private readonly _selectedDate = signal<string>('');
  private readonly _newEvent = signal<NewEvent>({
    title: '',
    startTime: '',
    endTime: ''
  });
  private readonly _selectedEvent = signal<any>(null);
  private readonly _isPermitted = signal<boolean>(false);
  private readonly _calendarOptions = signal<CalendarOptions>({} as CalendarOptions);
  private readonly _isLoading = signal<boolean>(false);
  private readonly _currentUser = signal<any>(null);

  // Public readonly signals
  readonly events = this._events.asReadonly();
  readonly selectedDate = this._selectedDate.asReadonly();
  readonly newEvent = this._newEvent.asReadonly();
  readonly selectedEvent = this._selectedEvent.asReadonly();
  readonly isPermitted = this._isPermitted.asReadonly();
  readonly calendarOptions = this._calendarOptions.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly currentUser = this._currentUser.asReadonly();

  // Computed signals
  readonly hasEvents = computed(() => this._events().length > 0);
  readonly canManageEvents = computed(() => this._isPermitted() && this._currentUser());
  readonly eventCount = computed(() => this._events().length);

  // Static properties
  readonly title = 'calendar';

  // For template binding
  selectedDateInput = '';

  constructor() {
    this.setupBreadcrumb();
    this.initializeCalendarOptions();
    this.setupEffects();
  }

  private setupBreadcrumb(): void {
    this.breadcrumbService.setItems([
      { label: 'تقویم', routerLink: '/calendar' },
    ]);
  }

  private setupEffects(): void {
    // Effect to update calendar when events change - این قسمت مهم بود که کامنت شده بود
    effect(() => {
      const currentEvents = this._events();
      const calendarApi = this.calendarComponent()?.getApi();

      if (calendarApi && currentEvents) {
        // Remove all existing events
        calendarApi.removeAllEvents();

        // Add new events
        currentEvents.forEach(event => {
          calendarApi.addEvent(event);
        });
      }
    });

    // Effect to handle selected date changes
    effect(() => {
      const selectedDate = this._selectedDate();
      if (selectedDate) {
        this.highlightSelectedDate(selectedDate);
      }
    });

    // Effect to handle user changes
    effect(() => {
      const user = this._currentUser();
      const isPermitted = this._isPermitted();

      if (user && isPermitted) {
        this.loadCalendarMeetings();
      }
    });
  }

  private initializeCalendarOptions(): void {
    const baseOptions: CalendarOptions = {
      direction: 'rtl',
      selectable: true,
      initialView: 'dayGridMonth',
      plugins: [dayGridPlugin, interactionPlugin, timeGridPlugin],
      locales: [faLocale],
      locale: 'fa',
      timeZone: 'Asia/Tehran',
      events: [], // شروع با آرایه خالی
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek,timeGridDay'
      },
      dayMaxEvents: true,
      eventDidMount: (info) => {
        this.handleEventMount(info);
      },
      dateClick: (info) => {
        this.handleDateClick(info);
      },
      eventClick: (info) => {
        this.handleEventClick(info);
      }
    };

    this._calendarOptions.set(baseOptions);
  }

  async ngOnInit(): Promise<void> {
    await this.checkPermissions();
    if (this._isPermitted()) {
      await this.loadCurrentUser();
    }
  }

  private async checkPermissions(): Promise<void> {
    try {
      const hasPermission = await this.passwordFlowService.checkPermission('MT_Meetings_Search');

      if (!hasPermission) {
        this.toastService.error('شما مجوز مشاهده این صفحه را ندارید');
        this._isPermitted.set(false);
        return;
      }

      this._isPermitted.set(true);
    } catch (error) {
      console.error('Error checking permissions:', error);
      this._isPermitted.set(false);
    }
  }

  private async loadCurrentUser(): Promise<void> {
    try {
      const userGuid = this.localStorageService.getItem(USER_ID_NAME);

      if (!userGuid) {
        console.error('User GUID not found in localStorage');
        return;
      }

      this.userService.getBy(userGuid)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (userData: any) => {
            this._currentUser.set(userData);
          },
          error: (error) => {
            console.error('Error loading user data:', error);
            this.toastService.error('خطا در بارگذاری اطلاعات کاربر');
          }
        });
    } catch (error) {
      console.error('Error in loadCurrentUser:', error);
    }
  }

  private loadCalendarMeetings(): void {
    const positionGuid = this.localStorageService.getItem(POSITION_ID);
    const user = this._currentUser();

    if (!user || !positionGuid) {
      console.warn('User or position GUID not available');
      return;
    }

    this._isLoading.set(true);

    this.meetingService.getCalendarMeetings(positionGuid, user.username)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (meetings: any[]) => {
          console.log('Meetings loaded:', meetings); // برای دیباگ

          const mappedEvents = meetings.map((meeting: any) => ({
            title: meeting.title,
            start: meeting.start,
            end: meeting.end,
            backgroundColor: meeting.type === 'Meeting' ? '#0d6efd' : '#dc3545',
            textColor: '#fff',
            url: meeting.type === 'Meeting' ? `/#/meetings/details/${meeting.guid}` : undefined,
            extendedProps: {
              type: meeting.type
            }
          }));

          console.log('Mapped events:', mappedEvents); // برای دیباگ
          this._events.set(mappedEvents);
          this._isLoading.set(false);
        },
        error: (error) => {
          console.error('Error loading calendar meetings:', error);
          this.toastService.error('خطا در بارگذاری جلسات تقویم');
          this._isLoading.set(false);
        }
      });
  }

  private handleEventMount(info: any): void {
    const type = info.event.extendedProps['type'];

    if (type === 'Leave') {
      info.el.classList.add('event-leave');
    } else if (type === 'Meeting') {
      info.el.classList.add('event-meeting');
    }

    // Create tooltip
    const tooltip = new Tooltip(info.el, {
      title: info.event.title,
      placement: 'top',
      trigger: 'hover',
      container: 'body'
    });

    (info.el as any)._tooltipInstance = tooltip;
  }

  private handleDateClick(info: any): void {
    this._selectedDate.set(info.dateStr);
  }

  private handleEventClick(info: any): void {
    const tooltip = (info.el as any)._tooltipInstance;
    if (tooltip) {
      tooltip.dispose();
    }

    const type = info.event.extendedProps['type'];
    if (type === 'Leave' || type === 'Class') {
      info.jsEvent.preventDefault();
      return;
    }

    if (info.event.url) {
      window.location.href = info.event.url;
    }
  }

  // Public methods
  fixPersianDigits(input: string): string {
    return input.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
  }

  highlightDate(date: string): void {
    if (!date) {
      date = moment().format('jYYYY/jMM/jDD');
    }

    const fixedDate = this.fixPersianDigits(date);
    const georgianDate = moment(fixedDate, 'jYYYY/jMM/jDD').format('YYYY-MM-DD');

    const calendarApi = this.calendarComponent()?.getApi();
    if (calendarApi) {
      calendarApi.gotoDate(georgianDate);
    }

    // Add highlight event
    const currentEvents = this._events();
    const highlightEvent: CalendarEvent = {
      title: '📌 روز انتخاب شده',
      start: georgianDate,
      display: 'background',
      backgroundColor: '#ffc107'
    };

    this._events.set([...currentEvents, highlightEvent]);
  }

  private highlightSelectedDate(selectedDate: string): void {
    this.highlightDate(selectedDate);
  }

  filterByDay(): void {
    const selectedDate = this._selectedDate();
    if (!selectedDate) return;

    const currentOptions = this._calendarOptions();
    this._calendarOptions.set({
      ...currentOptions,
      initialView: 'dayGridDay',
      initialDate: selectedDate
    });

    this.loadCalendarMeetings();
  }

  // Event management methods
  updateNewEvent(updates: Partial<NewEvent>): void {
    this._newEvent.update(current => ({ ...current, ...updates }));
  }

  setSelectedDate(date: string): void {
    this._selectedDate.set(date);
  }

  refreshCalendar(): void {
    if (this._isPermitted() && this._currentUser()) {
      this.loadCalendarMeetings();
    }
  }

  // Method to get calendar API
  getCalendarApi(): any {
    return this.calendarComponent()?.getApi();
  }

  // Method to navigate to specific date
  goToDate(date: string): void {
    const calendarApi = this.getCalendarApi();
    if (calendarApi) {
      calendarApi.gotoDate(date);
    }
  }

  // Method to change calendar view
  changeView(viewName: string): void {
    const calendarApi = this.getCalendarApi();
    if (calendarApi) {
      calendarApi.changeView(viewName);
    }
  }

  // Utility method to convert events for display
  getEventsForDate(date: string): CalendarEvent[] {
    return this._events().filter(event =>
      event.start.startsWith(date) ||
      (event.end && event.end.startsWith(date))
    );
  }

  // Method to get events by type
  getEventsByType(type: string): CalendarEvent[] {
    return this._events().filter(event =>
      event.extendedProps?.type === type
    );
  }

  // Method for template date input handling
  onDateInputChange(date: string): void {
    if (date && date.length >= 10) { // Basic validation for Persian date format
      this.highlightDate(date);
      this.setSelectedDate(date);
    }
  }
  addTestEvent(): void {
    const testEvent: CalendarEvent = {
      title: 'رویداد تست',
      start: moment().format('YYYY-MM-DD'),
      backgroundColor: '#28a745',
      textColor: '#fff',
      extendedProps: {
        type: 'Test'
      }
    };

    const currentEvents = this._events();
    this._events.set([...currentEvents, testEvent]);
  }
}