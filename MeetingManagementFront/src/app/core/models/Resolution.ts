export interface Resolution {
    decisionsMade?: string;
    committeeResolution?: string;
    committeeMeeting?: string;
    followUpResolution?: string;
    followUpMeeting?: string;
    number?: string;
    committeeResolutionId?: string;
    parentResolutionId?: string;
    title?: string;
    assignments: ResolutionAssignment[];
    id: number;
    description: string;
    file: string;
    labelGuid: string;
    parentResolutionGuid?: string;
    committeeMeetingGuid?: string;
    contractNumber?: string;
    approvedPrice?: string;
    assignedToGuid?: string;
    dueDate?: string;
    status?: string;
    statusNote?: string;
    documentation?: string;
    text?: string
    _refreshToken?: any
}

export interface ResolutionAssignment {
    actorPositionGuid: string;
    followerPositionGuid: string;
    actorGuid?: string;
    followerGuid?: string;
    id: number;
    type: string;
    followUpDate: string;
    dueDate: string;
    followerName: string;
    actorName: string;
};
