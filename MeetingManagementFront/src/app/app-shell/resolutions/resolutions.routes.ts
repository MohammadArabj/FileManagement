import { Routes } from '@angular/router';
import { ResolutionListComponent } from './resolution-list/resolution-list';
import { AssignmentManagement } from './assignment-management/assignment-management';
import { ResolutionReportComponent } from './resolution-report/resolution-report';

export const resolutionsRoutes: Routes = [
  { path: 'list', component: ResolutionListComponent },
  { path: 'report', component: ResolutionReportComponent },
  { path: 'details/:id', component: AssignmentManagement },
];
