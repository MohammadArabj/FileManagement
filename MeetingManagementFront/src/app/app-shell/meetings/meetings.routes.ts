import { Routes } from '@angular/router';
import { CategoryComponent } from './category/category';
import { RoomComponent } from './room/room';
import { MeetingListComponent } from './meeting-list/meeting-list';
import { MeetingOpsComponent } from './meeting-ops/meeting-ops';
import { MeetingDetailsComponent } from './meeting-details/meeting-details';
import { SettingComponent } from '../../shared/setting-component/setting';
import { RoleComponent } from './role/role';
import { MeetingStatusComponent } from './meeting-status/meeting-status';
import { CategoryPermissionComponent } from './category/category-permission/category-permission';
import { LabelComponent } from './label/label';

export const meetingsRoutes: Routes = [
  { path: 'category', component: CategoryComponent },
  { path: 'categoryPermission', component: CategoryPermissionComponent },
  { path: 'label', component: LabelComponent },
  { path: 'status', component: MeetingStatusComponent },
  { path: 'role', component: RoleComponent },
  { path: 'room', component: RoomComponent },
  { path: 'setting', component: SettingComponent },
  { path: 'list', component: MeetingListComponent },
  { path: 'clone/:guid', component: MeetingOpsComponent },
  { path: 'create', component: MeetingOpsComponent },
  { path: 'details/:guid', component: MeetingDetailsComponent },
];
