type DispatchOptions = {
    dryRun?: boolean;
    eventIds?: string[];
};
type FailedDelivery = {
    eventId: string;
    email: string;
    error: string;
};
export declare class EventAlertsConfigError extends Error {
    constructor(message: string);
}
export declare function isValidEventAlertEmail(email: string): boolean;
export declare function verifyEventAlertUnsubscribeToken(email: string, token: string): boolean;
export declare function subscribeToEventAlerts(email: string): Promise<{
    email: string;
    activeSubscriberCount: number;
    storageDriver: import("./store").EventAlertsStorageDriver;
}>;
export declare function unsubscribeFromEventAlerts(email: string): Promise<{
    email: string;
    activeSubscriberCount: number;
    storageDriver: import("./store").EventAlertsStorageDriver;
}>;
export declare function getEventAlertsStatus(): Promise<{
    storageDriver: import("./store").EventAlertsStorageDriver;
    activeSubscriberCount: number;
    subscribers: import("./store").EventAlertSubscriber[];
    deliveries: import("./store").EventAlertDelivery[];
}>;
export declare function getEventAlertUnsubscribePage(email: string, shouldFinalize: boolean): string;
export declare function sendNewEventAlerts(options?: DispatchOptions): Promise<{
    dryRun: boolean;
    storageDriver: import("./store").EventAlertsStorageDriver;
    subscriberCount: number;
    pendingEvents: {
        eventId: string;
        recipientCount: number;
    }[];
    sentEvents: {
        eventId: string;
        attemptedCount: number;
        sentCount: number;
        failedCount: number;
    }[];
    failures: FailedDelivery[];
    skippedReason: string;
} | {
    dryRun: boolean;
    storageDriver: "resend-segment";
    subscriberCount: number;
    pendingEvents: {
        eventId: string;
        recipientCount: number;
    }[];
    sentEvents: {
        eventId: string;
        attemptedCount: number;
        sentCount: number;
        failedCount: number;
    }[];
    failures: FailedDelivery[];
    skippedReason?: undefined;
} | {
    dryRun: boolean;
    storageDriver: "file" | "upstash";
    subscriberCount: number;
    pendingEvents: {
        eventId: string;
        recipientCount: number;
    }[];
    sentEvents: {
        eventId: string;
        attemptedCount: number;
        sentCount: number;
        failedCount: number;
    }[];
    failures: FailedDelivery[];
    skippedReason?: undefined;
}>;
export {};
