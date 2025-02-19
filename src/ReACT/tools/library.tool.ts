// ~/src/ReACT/tools/library.tool.ts

import { api_fetch_and_parse_json } from '../services/library.service';
import { handle_tool_error, zod_schema_to_text } from './helpers';
import { z } from 'zod';

import type { components, operations } from '../types/api';
import type { ToolResponse } from './helpers';
import type { ToolDefinition } from './repository';

// API response types from the OpenAPI spec
type ChunkSearchResponse =
  operations['documents_chunks_search_list']['responses']['200']['content']['application/json'];
type Chunk = components['schemas']['Chunk'];

export const schema = z.object({
  query: z.string().min(1, 'Search query is required'),
});

export const text_schema = zod_schema_to_text(schema);

export type SearchLibraryToolParams = z.infer<typeof schema>;

/**
 * Creates a pre-configured library search tool with a specific UUID
 *
 * @param library_uuid - The UUID of the library to search
 * @param library_name - The name of the library to search
 * @param library_description - The description of the library to search
 * @returns A tool definition object that can be used by the ReACT agent
 *
 * Example usage:
 * ```
 * const libraryTool = createLibraryTool("123e4567-e89b-12d3-a456-426614174000", "My Library", "This is a description of my library");
 * const tools = [calculatorTool, libraryTool];
 * ```
 */
export function create_library_tool(
  library_uuid: string,
  library_name: string,
  library_description: string
): ToolDefinition {
  return {
    name: library_name,
    alternative_names: ['Knowledge Base', 'Library'],
    description: `Search the ${library_name} knowledge base: ${library_description}`,
    schema: text_schema,

    execute: async ({
      query,
    }: z.infer<typeof schema>): Promise<ToolResponse> => {
      return search_library_tool({
        query,
        library_uuid,
      });
    },
  };
}

/**
 * Search Library Tool
 *
 * A tool for searching a knowledge-base document library.
 * Validates input using Zod schema and returns search results as JSON string.
 *
 * @param query - The search query
 * @param library_uuid - The UUID of the library to search
 *
 * @returns Object containing search results as JSON stringified result or error
 *
 * Example:
 * Input: { query: "how to deploy an ai agent", library_uuid: "123e4567-e89b-12d3-a456-426614174000" }
 * Output: { results: "[{text: 'Deployment steps...', id: 1}, ...]" }
 *
 * Handles:
 * - Knowledge base search queries
 * - Library validation
 * - Error cases with descriptive messages
 */
export const search_library_tool = async ({
  query = '',
  library_uuid = '',
}): Promise<ToolResponse> => {
  try {
    // Validate input
    const validated_input = schema.parse({ query });

    const search_params = new URLSearchParams({
      q: validated_input.query,
      distance: 'cosine-distance',
      pipeline__document__library: library_uuid,
    });

    const url = `/documents/chunks/search/?${search_params.toString()}`;

    const response = await api_fetch_and_parse_json<
      ChunkSearchResponse,
      { detail: string }
    >(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.success) {
      return handle_tool_error(
        'search-library',
        `API request failed: ${response.data.detail}`
      );
    }

    const { results } = response.data;

    if (!results?.length) {
      return handle_tool_error(
        'search-library',
        `No search results found for query: '${validated_input.query}'`
      );
    }

    // Map chunks to a simpler format with just text and id
    const picked_results = results.map((chunk: Chunk) => ({
      text: chunk.text,
      id: chunk.id,
    }));

    return { result: JSON.stringify(picked_results) };
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return handle_tool_error(
        'search-library',
        'Validation error: ' + error.errors.map((e) => e.message).join(', ')
      );
    }
    return handle_tool_error('search-library', undefined, error);
  }
};
