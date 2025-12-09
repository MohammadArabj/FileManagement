import { Routes } from '@angular/router';
import { AppShellComponent } from './app-shell/app-shell';
import { BoardMemberComponent } from './app-shell/board-member/board-member';
import { DashboardComponent } from './app-shell/dashboard/dashboard';
import { SearchComponent } from './app-shell/search/search';
import { ChallengeComponent } from './authentication/challenge/challange';
import { authGuard } from './core/guards/auth.guard.service';
import { clientAccessGuard } from './core/guards/client.access.guard.service';
import { sessionGuard } from './core/guards/session.guard.service';
import { CalendarComponent } from './app-shell/calendar/calendar';
import { UserList } from './app-shell/user/user';

export const routes: Routes = [
    {
        path: '',
        component: AppShellComponent,
        canActivate: [authGuard, sessionGuard, clientAccessGuard],
        runGuardsAndResolvers: 'always',
        children: [
            { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
            { path: 'dashboard', component: DashboardComponent },
            {
                path: 'meetings',
                loadChildren: () =>
                    import('./app-shell/meetings/meetings.routes').then(m => m.meetingsRoutes)
            },
            {
                path: 'resolutions',
                loadChildren: () =>
                    import('./app-shell/resolutions/resolutions.routes').then(m => m.resolutionsRoutes)
            },
            {
                path: 'delegation',
                loadChildren: () =>
                    import('./app-shell/delegation/delegations.routes').then(m => m.delegationRouts)
            },
            { path: 'user', component: UserList },
            { path: 'boardMember', component: BoardMemberComponent },
            { path: 'calendar', component: CalendarComponent },
            { path: 'search', component: SearchComponent },
        ]
    },
    {
        path: 'challenge',
        component: ChallengeComponent
    },
    {
        path: '**',
        redirectTo: 'dashboard',
        pathMatch: 'full'
    },
];
