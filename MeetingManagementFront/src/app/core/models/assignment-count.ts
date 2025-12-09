export interface AssignmentCount {
    actionCounts: {
        all: number;
        inProgress: number;
        done: number;
        notDone: number;
        end: number;
        pending: number;
    };
    followCounts: {
        all: number;
        inProgress: number;
        end: number;
        pending: number;
    };
}
