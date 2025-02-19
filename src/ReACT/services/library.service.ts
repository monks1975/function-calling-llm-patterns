// ~/src/ReACT/services/library.service.ts

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const DOJO_API_BASE_URL = process.env.DOJO_API_BASE_URL;
const DOJO_API_KEY = process.env.DOJO_API_KEY;

if (!DOJO_API_BASE_URL || !DOJO_API_KEY) {
  throw new Error(
    'Missing required environment variables DOJO_API_BASE_URL or DOJO_API_KEY'
  );
}

export type FetchConfig = RequestInit;

/**
 * Enhanced fetch function for API requests with proper error handling and logging
 */
export const api_fetch = async (url: string, config: FetchConfig = {}) => {
  try {
    const new_config = {
      ...config,
      headers: {
        Accept: 'application/json',
        Authorization: `Token ${DOJO_API_KEY}`,
        Referrer: new URL(DOJO_API_BASE_URL).origin,
        ...config.headers,
      },
    };

    const full_url = `${DOJO_API_BASE_URL}${url}`;
    console.info(`API fetch request initiated to ${full_url}`);

    const response = await fetch(full_url, new_config);

    if (!response.ok) {
      console.error(
        `API fetch request failed with status ${response.status} for ${full_url}`
      );

      throw new Error(`API request failed with status ${response.status}`);
    }

    return response;
  } catch (err) {
    console.error('API fetch encountered an error:', err);
    throw new Error('Failed to complete API request');
  }
};

export type ApiFetchData<Data, ErrorData> =
  | { success: true; status: number; data: Data }
  | { success: false; status: number; data: ErrorData };

/**
 * Fetches and parses JSON response with proper typing
 */
export const api_fetch_and_parse_json = async <Data, ErrorData>(
  url: string,
  config: FetchConfig = {}
): Promise<ApiFetchData<Data, ErrorData>> => {
  const response = await api_fetch(url, config);
  let data: Data | ErrorData;

  try {
    data = await response.json();
  } catch (err) {
    console.error('Failed to parse JSON in API response:', err);
    throw new Error('Unable to parse JSON response');
  }

  return {
    success: response.status < 300,
    status: response.status,
    data: response.status < 300 ? (data as Data) : (data as ErrorData),
  } as ApiFetchData<Data, ErrorData>;
};

/**
 * Returns API response formatted as JSON with proper status code
 */
export const api_fetch_as_json_response = async <Data, ErrorData>(
  url: string,
  config: FetchConfig = {}
): Promise<Response> => {
  const { status, data } = await api_fetch_and_parse_json<Data, ErrorData>(
    url,
    config
  );
  return new Response(JSON.stringify(data), { status });
};
