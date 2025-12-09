import { NgFor, NgIf } from '@angular/common'
import { LocalStorageService } from '../../services/framework-services/local.storage.service'
import { SettingService } from '../../services/framework-services/setting.service'
import { getCurrentMonth, months, sessions } from '../constants'
import { Component, EventEmitter, OnInit, Output } from '@angular/core'
import { SelectDateComponent } from "../select-date/select-date";
declare var $: any

@Component({
  selector: 'grid-search-panel',
  standalone: true,
  imports: [NgFor, NgIf, SelectDateComponent],
  templateUrl: './grid-search-panel.html'
})
export class GridSearchPanelComponent implements OnInit {

  months = months
  sessions = sessions
  calendarType: number = 4
  searchModel = {
    periodId: getCurrentMonth(this.calendarType),
    searchType: 1,
    fromDate: '',
    toDate: ''
  }

  @Output() search = new EventEmitter<any>()

  constructor(private readonly localStorageService: LocalStorageService,
    private readonly settingService: SettingService) {
    this.calendarType = parseInt(this.settingService.getSettingValue('CalendarType'))
  }

  ngOnInit(): void {
    this.search.emit(this.searchModel)
  }

  getCurrentMonthName() {
    const periodId = this.searchModel.periodId
    switch (this.searchModel.searchType) {
      case 1:
        const month = this.months.find(x => x.id == periodId)
        if (this.calendarType == 1) {
          return month ? month.name : ''
        } else {
          return month ? month.miladi : ''
        }
      case 2:
        const session = this.sessions.find(x => x.id == periodId)
        if (this.calendarType == 1) {
          return session ? session.name : ''
        } else {
          return session ? session.miladi : ''
        }
      case 3:
        return ` از ${this.searchModel.fromDate} تا ${this.searchModel.toDate}`
      default:
        return "بدون شرط"
    }
  }

  emitSearch(periodId: number, searchType: number) {
    this.searchModel.periodId = periodId
    this.searchModel.searchType = searchType

    this.search.emit(this.searchModel)
  }

  customSeachSelected(dates: { fromDate: string; toDate: string }) {
    this.searchModel.periodId = 0
    this.searchModel.searchType = 3
    this.searchModel.fromDate = dates.fromDate
    this.searchModel.toDate = dates.toDate

    this.search.emit(this.searchModel)
    $("#select-date-modal-2").modal("hide")
  }
}