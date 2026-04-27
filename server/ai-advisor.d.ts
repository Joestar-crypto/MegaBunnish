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
export declare class AiAdvisorConfigError extends Error {
}
export declare function generateAiAdvisorReply(input: {
    message: string;
    history?: AdvisorChatMessage[];
    conversationId?: string;
}): Promise<AdvisorReply>;
