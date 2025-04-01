// ~/src/react/tools/search.tool.ts

import { handle_tool_error, zod_schema_to_text } from './helpers';
import { z } from 'zod';

import type { ToolResponse } from './helpers';

export const schema = z.object({
  query: z.string().min(1, 'Search query is required'),
});

export const text_schema = zod_schema_to_text(schema);

export type SearchWebToolParams = z.infer<typeof schema>;

interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

interface TavilyResponse {
  query: string;
  results: TavilySearchResult[];
  response_time: number;
  answer?: string;
}

/**
 * Search Web Tool
 *
 * A tool for performing web searches using the Tavily API.
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

    const tavily_api_key = process.env.TAVILY_API_KEY;

    if (!tavily_api_key) {
      return handle_tool_error(
        'Search Web',
        'Tavily API key not found in environment variables'
      );
    }

    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tavily_api_key}`,
      },
      body: JSON.stringify({
        query: validated_input.query,
        sort_by: 'relevance',
      }),
    });

    if (!response.ok) {
      return handle_tool_error(
        'Search Web',
        `Tavily API error: ${response.statusText}`
      );
    }

    const search_results: TavilyResponse = await response.json();

    if (!search_results.results?.length) {
      return handle_tool_error(
        'Search Web',
        `No search results found for query: '${validated_input.query}'`
      );
    }

    let formatted_results = '';

    if (search_results.answer) {
      formatted_results += `## Tavily Answer\n\n${search_results.answer}\n\n## Supporting Sources\n\n`;
    }

    formatted_results += search_results.results
      .sort((a, b) => b.score - a.score)
      .map(
        (result: TavilySearchResult) =>
          `### ${result.title}\n\n${result.content}\n\n[Source](${result.url})`
      )
      .slice(0, 5)
      .join('\n\n---\n\n');

    return { result: formatted_results };
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return handle_tool_error(
        'Search Web',
        'Validation error: ' + error.errors.map((e) => e.message).join(', ')
      );
    }
    return handle_tool_error('Search Web', undefined, error);
  }
};
