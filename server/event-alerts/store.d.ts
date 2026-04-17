export type EventAlertsStorageDriver = 'file' | 'upstash' | 'resend-segment';
export type EventAlertSubscriber = {
    email: string;
    status: 'subscribed' | 'unsubscribed';
    source: string;
    subscribedAt: string;
    unsubscribedAt: string | null;
    updatedAt: string;
};
export type EventAlertDelivery = {
    eventId: string;
    subject: string;
    deliveredEmails: string[];
    resendEmailIds: string[];
    lastAttemptAt: string | null;
    lastDeliveredAt: string | null;
    lastFailedEmails: string[];
    lastAttemptedCount: number;
    lastSentCount: number;
    lastFailedCount: number;
    createdAt: string;
    updatedAt: string;
};
type DeliveryUpdate = {
    eventId: string;
    subject: string;
    deliveredEmails: string[];
    resendEmailIds: string[];
    failedEmails: string[];
    attemptedCount: number;
};
export declare function getEventAlertsSnapshot(): Promise<{
    storageDriver: EventAlertsStorageDriver;
    storagePath: string;
    storageKey: string;
    subscribers: EventAlertSubscriber[];
    deliveries: EventAlertDelivery[];
    activeSubscribers: EventAlertSubscriber[];
    activeSubscriberEmails: string[];
}>;
export declare function subscribeEventAlertSubscriber(email: string, source?: string): Promise<{
    email: string;
    activeSubscriberCount: number;
    storageDriver: EventAlertsStorageDriver;
}>;
export declare function unsubscribeEventAlertSubscriber(email: string): Promise<{
    email: string;
    activeSubscriberCount: number;
    storageDriver: EventAlertsStorageDriver;
}>;
export declare function recordEventAlertDelivery(update: DeliveryUpdate): Promise<EventAlertDelivery>;
export declare function getDeliveredEmailsForEvent(deliveries: EventAlertDelivery[], eventId: string): string[];
export declare function buildEventAlertBroadcastName(eventId: string): string;
export declare function ensureResendEventAlertTarget(): Promise<{
    segmentId: string;
    topicId: string;
}>;
export declare function ensureEventAlertStorage(): Promise<void>;
export {};
