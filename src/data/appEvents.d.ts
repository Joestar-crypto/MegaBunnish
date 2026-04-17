export type AppEvent = {
    id: string;
    title: string;
    projectId: string;
    start: string;
    end?: string;
    tweetUrl: string;
    detailsUrl?: string;
    phases: {
        label: string;
        start: string;
        end: string;
    }[];
};
export declare const APP_EVENTS: AppEvent[];
