// ~/src/ReWOO/services/library.service.ts

import dotenv from 'dotenv';

dotenv.config();

const DOJO_API_BASE_URL = process.env.DOJO_API_BASE_URL;
const DOJO_API_KEY = process.env.DOJO_API_KEY;

if (!DOJO_API_BASE_URL || !DOJO_API_KEY) {
  throw new Error(
    'Missing required environment variables DOJO_API_BASE_URL or DOJO_API_KEY'
  );
}

// Define more specific success/error types
type ApiSuccess<T> = {
  success: true;
  status: number;
  data: T;
};

type ApiFailure<E> = {
  success: false;
  status: number;
  data: E;
};

type ApiFetchData<Data, ErrorData> = ApiSuccess<Data> | ApiFailure<ErrorData>;

// Define custom headers type
type CustomHeaders = HeadersInit & {
  Accept?: string;
  Authorization?: string;
  Referrer?: string;
};

interface CustomRequestInit extends RequestInit {
  headers?: CustomHeaders;
  timeout?: number;
}

// Define HTTP status codes enum
enum HttpStatusCode {
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  TOO_MANY_REQUESTS = 429,
  INTERNAL_SERVER_ERROR = 500,
  BAD_GATEWAY = 502,
  SERVICE_UNAVAILABLE = 503,
  GATEWAY_TIMEOUT = 504,
}

// Define status code descriptions
const STATUS_CODE_DESCRIPTIONS: Record<HttpStatusCode, string> = {
  [HttpStatusCode.BAD_REQUEST]: 'Bad Request',
  [HttpStatusCode.UNAUTHORIZED]:
    'Unauthorized - API key may be invalid or missing',
  [HttpStatusCode.FORBIDDEN]: 'Forbidden - Insufficient permissions',
  [HttpStatusCode.NOT_FOUND]: 'Not Found',
  [HttpStatusCode.TOO_MANY_REQUESTS]: 'Too Many Requests',
  [HttpStatusCode.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
  [HttpStatusCode.BAD_GATEWAY]: 'Bad Gateway',
  [HttpStatusCode.SERVICE_UNAVAILABLE]: 'Service Unavailable',
  [HttpStatusCode.GATEWAY_TIMEOUT]: 'Gateway Timeout',
};

const DEFAULT_HEADERS: CustomHeaders = {
  Accept: 'application/json',
  Authorization: `Token ${DOJO_API_KEY}`,
  Referrer: new URL(DOJO_API_BASE_URL).origin,
};

const DEFAULT_TIMEOUT = 30000; // 30 seconds

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public status?: number,
    public status_text?: string,
    public response_body?: any,
    public url?: string
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }

  toString(): string {
    const parts = [this.message];
    if (this.status) {
      parts.push(`Status: ${this.status} (${this.status_text || 'Unknown'})`);
    }
    if (this.url) {
      parts.push(`URL: ${this.url}`);
    }
    if (this.response_body) {
      parts.push(`Response: ${JSON.stringify(this.response_body)}`);
    }
    return parts.join(' | ');
  }
}

// Get HTTP status code description
const get_status_code_description = (status: number): string => {
  return STATUS_CODE_DESCRIPTIONS[status as HttpStatusCode] || 'Unknown Status';
};

// Enhanced fetch function with timeout
const fetch_with_timeout = async (
  url: string,
  config: CustomRequestInit = {}
): Promise<Response> => {
  const { timeout = DEFAULT_TIMEOUT, ...rest_config } = config;

  const controller = new AbortController();
  const timeout_id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...rest_config,
      signal: controller.signal,
      headers: rest_config.headers as HeadersInit,
    });
    return response;
  } finally {
    clearTimeout(timeout_id);
  }
};

// Enhanced fetch function for API requests with proper error handling
export const api_fetch = async (
  url: string,
  config: CustomRequestInit = {}
): Promise<Response> => {
  const full_url = `${DOJO_API_BASE_URL}${url}`;
  const merged_config: CustomRequestInit = {
    ...config,
    headers: {
      ...DEFAULT_HEADERS,
      ...config.headers,
    },
  };

  try {
    const response = await fetch_with_timeout(full_url, merged_config);

    if (!response.ok) {
      const response_body = await response.json().catch(() => undefined);
      const status_description = get_status_code_description(response.status);

      throw new ApiRequestError(
        `API request failed: ${status_description}`,
        response.status,
        response.statusText,
        response_body,
        full_url
      );
    }

    return response;
  } catch (err) {
    if (err instanceof ApiRequestError) {
      throw err;
    }

    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiRequestError(
        'Request timeout exceeded',
        undefined,
        'Timeout',
        undefined,
        full_url
      );
    }

    throw new ApiRequestError(
      'Failed to complete API request',
      undefined,
      undefined,
      undefined,
      full_url
    );
  }
};

/**
 * Fetches and parses JSON response with proper typing.
 *
 * This function is designed for internal application use where you need:
 * 1. Type safety with generics for both success and error responses
 * 2. Structured response with success flag, status, and typed data
 * 3. Programmatic access to both the response status and data
 *
 * Use this when you need to handle the API response within your application code
 * and want to perform different logic based on success/failure.
 *
 * Example:
 * const result = await api_fetch_and_parse_json<UserData, ErrorData>('/users/123');
 * if (result.success) {
 *   // Handle success case with UserData
 *   processUser(result.data);
 * } else {
 *   // Handle error case with ErrorData
 *   handleError(result.data);
 * }
 */
export const api_fetch_and_parse_json = async <Data, ErrorData>(
  url: string,
  config: Partial<CustomRequestInit> = {}
): Promise<ApiFetchData<Data, ErrorData>> => {
  const response = await api_fetch(url, config as CustomRequestInit);
  let data: Data | ErrorData;

  try {
    data = await response.json();
  } catch (err) {
    throw new Error('Unable to parse JSON response');
  }

  return {
    success: response.status < 300,
    status: response.status,
    data: response.status < 300 ? (data as Data) : (data as ErrorData),
  } as ApiFetchData<Data, ErrorData>;
};

/**
 * Returns API response formatted as a proper HTTP Response object.
 *
 * This function is designed for API endpoints or middleware where you need to:
 * 1. Forward or proxy responses from the Dojo API
 * 2. Maintain the original HTTP status codes
 * 3. Return a proper Response object that can be sent directly to clients
 *
 * Use this when you're building API endpoints that need to relay responses
 * from the Dojo API while preserving the response structure.
 *
 * Example:
 * // In an API route handler:
 * app.get('/api/users/:id', async (req, res) => {
 *   return api_fetch_as_json_response<UserData, ErrorData>(`/users/${req.params.id}`);
 * });
 */
export const api_fetch_as_json_response = async <Data, ErrorData>(
  url: string,
  config: Partial<CustomRequestInit> = {}
): Promise<Response> => {
  const { status, data } = await api_fetch_and_parse_json<Data, ErrorData>(
    url,
    config
  );
  return new Response(JSON.stringify(data), { status });
};
