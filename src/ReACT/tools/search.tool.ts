// ~/src/ReACT/tools/search.tool.ts

import { handle_tool_error, zod_schema_to_text } from './helpers';
import { search, SafeSearchType } from 'duck-duck-scrape';
import { z } from 'zod';

import type { SearchResult, SearchOptions } from 'duck-duck-scrape';
import type { ToolResponse } from './helpers';

export const schema = z.object({
  query: z.string().min(1, 'Search query is required'),
});

export const text_schema = zod_schema_to_text(schema);

export type SearchWebToolParams = z.infer<typeof schema>;

/**
 * Search Web Tool
 *
 * A tool for performing web searches using the Google Search API.
 * Validates input using Zod schema and returns search results as JSON string.
 *
 * @param query - The search query
 *
 * @returns Object containing search results as JSON stringified result or error
 *
 * Example:
 * Input: { query: "latest news" }
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
}: SearchWebToolParams): Promise<ToolResponse> => {
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

    return { result: JSON.stringify(picked_results) };
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
