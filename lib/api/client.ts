import { appConfig } from "@/config/app";
import { ApiError, extractSafeErrorReference } from "@/lib/errors";

type ApiClientOptions = RequestInit & {
  path: string;
};

export async function apiClient<TResponse>({
  path,
  headers,
  ...init
}: ApiClientOptions): Promise<TResponse> {
  const response = await fetch(`${appConfig.apiUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });

  if (!response.ok) {
    let errorBody: unknown;
    try {
      errorBody = await response.json();
    } catch {
      // If response body is not JSON, use empty object
      errorBody = {};
    }

    const errorResponse = extractSafeErrorReference(errorBody, response.status);
    throw new ApiError(errorResponse);
  }

  return response.json() as Promise<TResponse>;
}

export function bearer(token: string) {
  return {
    Authorization: `Bearer ${token}`,
  };
}
