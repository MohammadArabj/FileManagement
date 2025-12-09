import { Routes } from '@angular/router';
import { DelegationListComponent } from './delegation-list/delegation-list';
import { DelegationOpComponent } from './delegation-op/delegation-op';

export const delegationRouts: Routes = [
  { path: 'list', component: DelegationListComponent },
  { path: 'edit/:guid', component: DelegationOpComponent },
  { path: 'create', component: DelegationOpComponent },
];
