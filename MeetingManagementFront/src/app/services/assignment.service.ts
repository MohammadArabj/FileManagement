import { Injectable } from '@angular/core';
import { ServiceBase } from './framework-services/service.base';
import { RequestConfig } from './framework-services/http.service';
import { Observable } from 'rxjs';
import { FollowerActorsActionCounts } from '../core/models/followersActorCounts';
export interface AssignmentTreeNode {
  id: number;
  actorGuid: string;
  followerGuid: string;
  actorName: string;
  referrerName: string;
  referralDate: string;
  referralNote: string;
  actionStatus: string;
  followStatus: string;
  isReferral: boolean;
  level: number;
  dueDate: string;
  actorPersonalNo: string;
  canAddAction: boolean;
  canAddFollowup: boolean;
  canRefer: boolean;
  canEditAssignment: boolean;
  actions: ActionItem[];
  followups: ActionItem[];
  children: AssignmentTreeNode[];
  totalActions: number;
  totalFollowups: number;
  completedActions: number;
  pendingActions: number;
  actorPositionTitle?: string;
  isFollower: boolean
}

export interface ActionItem {
  id: number;
  description: string;
  type: 'Action' | 'Follow';
  status: string;
  date: string;
  statusStr?: string;
  followStatus?: string;
  followStatusStr?: string;

  userName: string;
  userGuid: string;
  canEdit: boolean;
  canDelete: boolean;
}

export interface CompleteAssignmentInfo {
  mainAssignment: any;
  referralTree: AssignmentTreeNode;
  summary: AssignmentTreeSummary;
  allActions: ActionItem[];
  allFollowups: ActionItem[];
  resolutionTitle: string;
  resolutionText: string;
  meetingTitle: string;
  meetingDate: string;
  meetingNumber: string;
  currentUserPermissions: UserPermissions;
}

export interface AssignmentTreeSummary {
  totalNodes: number;
  totalActions: number;
  totalFollowups: number;
  completedAssignments: number;
  pendingAssignments: number;
  overdueAssignments: number;
  involvedUsers: string[];
}

export interface UserPermissions {
  canViewAllNodes: boolean;
  canEditAnyAction: boolean;
  canDeleteAnyAction: boolean;
  canCreateReferrals: boolean;
  canViewPrivateNotes: boolean;
  editableNodeIds: number[];
}
@Injectable({
  providedIn: 'root'
})
export class AssignmentService extends ServiceBase {




  constructor() {
    super("Assignment");
  }


  getCompleteAssignmentInfo(assignmentId: number): Observable<CompleteAssignmentInfo> {
    return this.httpService.get<any>(`${this.baseUrl}/GetCompleteAssignmentInfo/${assignmentId}`);
  }

  getAssignmentResolutionDetails(assignmentId: number): Observable<any> {
    return this.httpService.get<any>(`${this.baseUrl}/GetAssignmentResolutionDetails/${assignmentId}`);
  }

  getAll(body: any): Observable<any> {
    let path = `${this.baseUrl}/GetList`;
    return this.httpService.post(path, body, new RequestConfig({ submitted: false }), false);
  }

  getCounts(positionGuid: string): Observable<any> {
    let path = `${this.baseUrl}/GetCounts/${positionGuid}`;
    return this.httpService.getAll<any>(path);
  }

  saveAssignment(body: any): Observable<any> {
    const path = `${this.baseUrl}/CreateOrEditAssignment`;
    return this.httpService.post(path, body, new RequestConfig({ submitted: true, formId: "assignForm" }), true);
  }

  getAssignmentDetails(id: any): Observable<any> {
    const path = `${this.baseUrl}/GetAssignmentResolutionDetails`;
    return this.httpService.get(path, id, new RequestConfig({}), false);
  }

  createReferral(data: any): Observable<any> {
    return this.httpService.post(`${this.baseUrl}/CreateReferral`, data);
  }

  getReferrals(assignmentId: number): Observable<any> {
    return this.httpService.get(`${this.baseUrl}/GetReferrals/${assignmentId}`);
  }

  getAssignmentTree(assignmentId: number): Observable<AssignmentTreeNode> {
    return this.httpService.get(`${this.baseUrl}/GetAssignmentTree/${assignmentId}`);
  }

  getMyReferrals(userGuid: string): Observable<any> {
    return this.httpService.get(`${this.baseUrl}/GetMyReferrals/${userGuid}`);
  }

  getReferralsGivenByMe(userGuid: string): Observable<any> {
    return this.httpService.get(`${this.baseUrl}/GetReferralsGivenByMe/${userGuid}`);
  }

  // New methods for enhanced dashboard functionality

  /**
   * Get counts for original assignments (not referrals) assigned directly to the user
   */
  getOriginalAssignmentCounts(positionGuid: string): Observable<OriginalAssignmentCounts> {
    return this.httpService.get<OriginalAssignmentCounts>(`${this.baseUrl}/GetOriginalAssignmentCounts/${positionGuid}`);
  }

  /**
   * Get counts for referrals received by the user
   */
  getReceivedReferralCounts(positionGuid: string): Observable<ReferralCounts> {
    return this.httpService.get<ReferralCounts>(`${this.baseUrl}/GetReceivedReferralCounts/${positionGuid}`);
  }

  /**
   * Get counts for referrals sent by the user to others
   */
  getSentReferralCounts(positionGuid: string): Observable<ReferralCounts> {
    return this.httpService.get<ReferralCounts>(`${this.baseUrl}/GetSentReferralCounts/${positionGuid}`);
  }

  /**
   * Get counts of pending actions that the user needs to follow up on
   * (for assignments where user is the follower)
   */
  getPendingActionCounts(positionGuid: string): Observable<PendingActionCounts> {
    return this.httpService.get<PendingActionCounts>(`${this.baseUrl}/GetPendingActionCounts/${positionGuid}`);
  }

  /**
   * Get detailed list of assignments by view type
   */
  getAssignmentsByViewType(request: {
    userGuid: string;
    positionGuid: string;
    viewType: number; // 1: Original, 2: Received Referrals, 3: Given Referrals
    filter?: string;
    actionStatus?: string;
    followStatus?: string;
  }): Observable<any[]> {
    return this.httpService.post(`${this.baseUrl}/GetAssignmentsByViewType`, request);
  }

  /**
   * Get assignments that are pending action for follow-up purposes
   */
  getPendingActionsForFollowUp(request: {
    userGuid: string;
    positionGuid: string;
    statusFilter?: string;
  }): Observable<any[]> {
    return this.httpService.post(`${this.baseUrl}/GetPendingActionsForFollowUp`, request);
  }

  /**
   * Get summary statistics for dashboard
   */
  getDashboardSummary(positionGuid: string): Observable<{
    totalAssignments: number;
    activeAssignments: number;
    overdueAssignments: number;
    completedThisMonth: number;
    avgCompletionTime: number;
    topActors: { name: string; count: number }[];
    urgentActions: number;
  }> {
    return this.httpService.get(`${this.baseUrl}/GetDashboardSummary/${positionGuid}`);
  }

  /**
   * Get referral chain for a specific assignment
   */
  getReferralChain(assignmentId: number): Observable<{
    originalAssignment: any;
    referralChain: any[];
    totalLevels: number;
    currentLevel: number;
  }> {
    return this.httpService.get(`${this.baseUrl}/GetReferralChain/${assignmentId}`);
  }

  /**
   * Bulk operations for assignments
   */
  bulkUpdateAssignmentStatus(request: {
    assignmentIds: number[];
    newStatus: string;
    note?: string;
  }): Observable<any> {
    return this.httpService.post(`${this.baseUrl}/BulkUpdateAssignmentStatus`, request);
  }

  /**
   * Get assignments that need attention (overdue, pending, etc.)
   */
  getAssignmentsNeedingAttention(positionGuid: string): Observable<{
    overdue: any[];
    dueSoon: any[];
    pendingAction: any[];
    pendingFollowUp: any[];
  }> {
    return this.httpService.get(`${this.baseUrl}/GetAssignmentsNeedingAttention/${positionGuid}`);
  }

  /**
   * Search assignments with advanced filters
   */
  searchAssignments(request: {
    userGuid: string;
    positionGuid: string;
    searchTerm?: string;
    dateFrom?: string;
    dateTo?: string;
    meetingNumber?: string;
    category?: string;
    actor?: string;
    follower?: string;
    status?: string;
    priority?: string;
    pageNumber?: number;
    pageSize?: number;
  }): Observable<{
    items: any[];
    totalCount: number;
    pageNumber: number;
    pageSize: number;
    totalPages: number;
  }> {
    return this.httpService.post(`${this.baseUrl}/SearchAssignments`, request);
  }

  /**
   * Export assignments to Excel with filters
   */
  exportAssignments(request: {
    userGuid: string;
    positionGuid: string;
    viewType?: number;
    filters?: any;
    exportFormat: 'excel' | 'pdf' | 'csv';
  }): Observable<Blob> {
    return this.httpService.post(`${this.baseUrl}/ExportAssignments`, request,
      new RequestConfig({

        submitted: true
      }), false);
  }

  /**
   * Get assignment statistics for reporting
   */
  getAssignmentStatistics(request: {
    positionGuid: string;
    dateFrom: string;
    dateTo: string;
    groupBy: 'month' | 'week' | 'day';
    includeReferrals: boolean;
  }): Observable<{
    statistics: any[];
    summary: {
      totalAssignments: number;
      completedAssignments: number;
      pendingAssignments: number;
      overdueAssignments: number;
      averageCompletionDays: number;
    };
  }> {
    return this.httpService.post(`${this.baseUrl}/GetAssignmentStatistics`, request);
  }

  /**
   * Get user activity timeline
   */
  getUserActivityTimeline(request: {
    userGuid: string;
    positionGuid: string;
    dateFrom: string;
    dateTo: string;
    pageNumber?: number;
    pageSize?: number;
  }): Observable<{
    activities: {
      id: number;
      timestamp: string;
      actionType: string;
      description: string;
      assignmentId: number;
      assignmentTitle: string;
      meetingNumber: string;
    }[];
    totalCount: number;
  }> {
    return this.httpService.post(`${this.baseUrl}/GetUserActivityTimeline`, request);
  }

  /**
   * Mark assignment as read/viewed
   */
  markAsViewed(assignmentId: number): Observable<any> {
    return this.httpService.post(`${this.baseUrl}/MarkAsViewed/${assignmentId}`, {});
  }

  /**
   * Get unread assignment count
   */
  getUnreadCount(positionGuid: string): Observable<{ count: number }> {
    return this.httpService.get(`${this.baseUrl}/GetUnreadCount/${positionGuid}`);
  }

  /**
   * Set assignment priority
   */
  setAssignmentPriority(assignmentId: number, priority: 'High' | 'Medium' | 'Low'): Observable<any> {
    return this.httpService.post(`${this.baseUrl}/SetAssignmentPriority`, {
      assignmentId,
      priority
    });
  }

  /**
   * Add private note to assignment
   */
  addPrivateNote(assignmentId: number, note: string): Observable<any> {
    return this.httpService.post(`${this.baseUrl}/AddPrivateNote`, {
      assignmentId,
      note
    });
  }

  /**
   * Get assignment notifications settings
   */
  getNotificationSettings(userGuid: string): Observable<{
    emailNotifications: boolean;
    smsNotifications: boolean;
    overdueReminders: boolean;
    dailyDigest: boolean;
    weeklyReport: boolean;
  }> {
    return this.httpService.get(`${this.baseUrl}/GetNotificationSettings/${userGuid}`);
  }

  /**
   * Update notification settings
   */
  updateNotificationSettings(userGuid: string, settings: {
    emailNotifications: boolean;
    smsNotifications: boolean;
    overdueReminders: boolean;
    dailyDigest: boolean;
    weeklyReport: boolean;
  }): Observable<any> {
    return this.httpService.post(`${this.baseUrl}/UpdateNotificationSettings`, {
      userGuid,
      ...settings
    });
  }
  createActionResult(actionData: any): Observable<unknown> {
    const path = `${this.baseUrl}/CreateActionResult`;
    return this.httpService.post(path, actionData);
  }

  getFollowerActorsActionCounts(positionGuid: string) {
    return this.httpService.get<FollowerActorsActionCounts>(
      `${this.baseUrl}/GetFollowerActorsActionCounts/${positionGuid}`
    );
  }
}


export interface AssignmentTreeNode {
  id: number;
  actorGuid: string;
  followerGuid: string;
  actorName: string;
  referrerName: string;
  referralDate: string;
  referralNote: string;
  actionStatus: string;
  followStatus: string;
  isReferral: boolean;
  level: number;
  dueDate: string;
  actorPersonalNo: string;
  canAddAction: boolean;
  canAddFollowup: boolean;
  canRefer: boolean;
  canEditAssignment: boolean;
  actions: ActionItem[];
  followups: ActionItem[];
  children: AssignmentTreeNode[];
  totalActions: number;
  totalFollowups: number;
  completedActions: number;
  pendingActions: number;
  actorPositionTitle?: string;
  isFollower: boolean;
}

export interface ActionItem {
  id: number;
  description: string;
  type: 'Action' | 'Follow';
  status: string;
  date: string;
  statusStr?: string;
  followStatus?: string;
  followStatusStr?: string;
  userName: string;
  userGuid: string;
  canEdit: boolean;
  canDelete: boolean;
}

export interface CompleteAssignmentInfo {
  mainAssignment: any;
  referralTree: AssignmentTreeNode;
  summary: AssignmentTreeSummary;
  allActions: ActionItem[];
  allFollowups: ActionItem[];
  resolutionTitle: string;
  resolutionText: string;
  meetingTitle: string;
  meetingDate: string;
  meetingNumber: string;
  currentUserPermissions: UserPermissions;
}

export interface AssignmentTreeSummary {
  totalNodes: number;
  totalActions: number;
  totalFollowups: number;
  completedAssignments: number;
  pendingAssignments: number;
  overdueAssignments: number;
  involvedUsers: string[];
}

export interface UserPermissions {
  canViewAllNodes: boolean;
  canEditAnyAction: boolean;
  canDeleteAnyAction: boolean;
  canCreateReferrals: boolean;
  canViewPrivateNotes: boolean;
  editableNodeIds: number[];
}

// New interfaces for enhanced dashboard functionality
export interface OriginalAssignmentCounts {
  totalOriginal: number;
  actionInProgress: number;
  actionDone: number;
  actionNotDone: number;
  actionEnd: number;
  followingUp: number;
  followUpEnd: number;
  notFollowedUp: number;
}

export interface ReferralCounts {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
}

export interface PendingActionCounts {
  total: number;
  inProgress: number;
  notDone: number;
  overdue: number;
  byActor: { [actorName: string]: number };
}

