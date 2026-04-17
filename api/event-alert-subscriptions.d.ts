type ApiRequest = {
    method?: string;
    body?: unknown;
    query?: Record<string, string | string[] | undefined>;
    headers?: Record<string, string | string[] | undefined>;
};
type ApiResponse = {
    setHeader(name: string, value: string | string[]): void;
    status(code: number): ApiResponse;
    json(payload: unknown): void;
    send?(payload: unknown): void;
    end?(payload?: unknown): void;
};
export default function handler(request: ApiRequest, response: ApiResponse): Promise<void>;
export {};
