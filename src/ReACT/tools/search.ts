// ~/src/REACT-COT/tools/search.ts

import { search, SafeSearchType } from 'duck-duck-scrape';
import { z } from 'zod';

import {
  handle_tool_error,
  log_tool,
  zod_schema_to_description,
} from './helpers';

import type { SearchResult, SearchOptions } from 'duck-duck-scrape';
import type { ToolResponse } from './helpers';

export const schema = z.object({
  query: z.string().min(1, 'Search query is required'),
});

export const json_schema = zod_schema_to_description(schema);

export type SearchWebInput = z.infer<typeof schema>;

/**
 * Search Web Tool
 *
 * A tool for performing web searches using the Google Search API.
 * Validates input using Zod schema and returns search results as JSON string.
 *
 * Input: Search query as a string
 * Output: Object containing search results as JSON string or error message
 *
 * Example:
 * Input: "latest news"
 * Output: { results: "[{title: 'News 1', description: '...', url: '...'}, ...]" }
 *
 * Handles:
 * - Web search queries
 * - Safe search filtering
 * - Result pagination
 * - Error cases with descriptive messages
 * - Returns top 5 most relevant results
 */

export const search_web_tool = async ({
  query = '',
}: SearchWebInput): Promise<ToolResponse> => {
  try {
    // Validate input
    const validated_input = schema.parse({ query });

    const search_options: SearchOptions = {
      locale: 'en-GB',
      region: 'GB',
      safeSearch: SafeSearchType.STRICT,
    };

    const search_results = await search(validated_input.query, search_options);

    if (search_results.noResults) {
      return handle_tool_error(
        'search-web',
        `No search results found for query: '${validated_input.query}'`
      );
    }

    const picked_results = search_results.results
      .map((result: SearchResult) => {
        const { title, description, url } = result;
        return { title, description, url };
      })
      .slice(0, 5);

    log_tool.tool('search-web', validated_input, {
      results: JSON.stringify(picked_results[0]),
    });

    return { results: JSON.stringify(picked_results) };
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return handle_tool_error(
        'search-web',
        'Validation error: ' + error.errors.map((e) => e.message).join(', ')
      );
    }
    return handle_tool_error('search-web', undefined, error);
  }
};
