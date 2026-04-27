type AdvisorProject = {
    id: string;
    name: string;
    categories: string[];
    networks: string[];
    links: {
        site?: string;
        twitter?: string;
        discord?: string;
        telegram?: string;
        docs?: string;
        nft?: string;
    };
    logo: string;
    isLive?: boolean;
    incentives?: Array<{
        id: string;
        title: string;
        reward: string;
        startsAt?: string;
        expiresAt: string;
    }>;
    linkedIds?: string[];
    jojoInsight?: string;
};
export type AdvisorChatMessage = {
    role: 'user' | 'assistant';
    content: string;
};
export type AdvisorRecommendation = {
    projectId: string;
    reason: string;
};
export type AdvisorReply = {
    answer: string;
    conversationId: string;
    recommendations: AdvisorRecommendation[];
    sourceProjectIds: string[];
    sourceEventIds: string[];
    suggestedPrompts: string[];
};
type IntentProfile = {
    categories: string[];
    strictLending: boolean;
    strictBridge: boolean;
    strictTrading: boolean;
    strictMobile: boolean;
    strictAi: boolean;
    strictRwa: boolean;
    preferLive: boolean;
    preferIncentives: boolean;
    preferSafety: boolean;
    preferBeginnerFriendly: boolean;
    wantsGeneralChainInfo: boolean;
    keywords: string[];
};
type RankedProject = {
    project: AdvisorProject;
    score: number;
    reason: string;
};
export declare class AiAdvisorConfigError extends Error {
}
declare function detectIntent(query: string): IntentProfile;
declare function selectProjects(message: string, history: AdvisorChatMessage[]): {
    ranked: RankedProject[];
    intent: IntentProfile;
};
declare function buildContextBlock(projects: RankedProject[], intent?: IntentProfile): {
    text: string;
    sourceEventIds: string[];
};
declare function buildPrompt(message: string, history: AdvisorChatMessage[], contextText: string): {
    role: string;
    content: string;
}[];
export declare function generateAiAdvisorReply(input: {
    message: string;
    history?: AdvisorChatMessage[];
    conversationId?: string;
}): Promise<AdvisorReply>;
export declare const __testables: {
    detectIntent: typeof detectIntent;
    selectProjects: typeof selectProjects;
    buildContextBlock: typeof buildContextBlock;
    buildPrompt: typeof buildPrompt;
};
export {};
