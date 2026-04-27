type ApiRequest = {
    method?: string;
    body?: unknown;
};
type ApiResponse = {
    setHeader(name: string, value: string | string[]): void;
    status(code: number): ApiResponse;
    json(payload: unknown): void;
};
export default function handler(request: ApiRequest, response: ApiResponse): Promise<void>;
export {};
