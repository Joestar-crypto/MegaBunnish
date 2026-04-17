type ApiRequest = {
    method?: string;
    headers?: Record<string, string | string[] | undefined>;
    query?: Record<string, string | string[] | undefined>;
};
type ApiResponse = {
    setHeader(name: string, value: string | string[]): void;
    status(code: number): ApiResponse;
    json(payload: unknown): void;
};
export default function handler(request: ApiRequest, response: ApiResponse): Promise<void>;
export {};
