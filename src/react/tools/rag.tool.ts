// ~/src/ReACT/tools/rag.tool.ts

import { z } from 'zod';

import {
  rag_fetch_and_parse_json,
  RagApiRequestError,
} from '../../core/services';

import { handle_tool_error, zod_schema_to_text } from './helpers';

import type { ToolDefinition } from './setup';
import type { ToolResponse } from './helpers';

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
interface Chunk {
  id: number;
  pipeline: number;
  order: number;
  text: string;
}

interface ChunkSearch extends Chunk {
  keyword_rank: number;
  cosine_similarity: number;
  weighted_rank: number;
  metadata: unknown | null;
}

interface ChunkMetadata {
  headings?: string[];
  captions?: string[];
  page?: number;
  path?: string[];
  heading?: string;
  position?: number;
  next_section?: string;
  prev_section?: string;
  heading_level?: number;
}

type ChunkWithDocument = ChunkSearch & {
  document_title: string;
  metadata: ChunkMetadata | null;
};

export const schema = z.object({
  query: z.string().min(1, 'Search query is required'),
});

export const text_schema = zod_schema_to_text(schema);

export type SearchLibraryToolParams = z.infer<typeof schema>;

/**
 * Creates a pre-configured RAG search tool with a specific UUID
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
export function create_rag_tool(
  library_uuid: string,
  library_name: string,
  library_description: string
): ToolDefinition {
  return {
    name: library_name,
    alternative_names: ['Library', 'Library Tool', 'Search RAG'],
    description: `Search the ${library_name} knowledge base: ${library_description}`,
    schema: text_schema,

    execute: async ({
      query,
    }: z.infer<typeof schema>): Promise<ToolResponse> => {
      return search_rag_tool({
        query,
        library_uuid,
      });
    },
  };
}

/**
 * Search RAG Tool
 *
 * A tool for searching a knowledge-base document library.
 * Returns search results formatted in Markdown.
 *
 * @param query - The search query
 * @param library_uuid - The UUID of the library to search
 *
 * @returns Object containing search results as Markdown string or error
 *
 * Example:
 * Input: { query: "how to deploy an ai agent", library_uuid: "123e4567-e89b-12d3-a456-426614174000" }
 * Output: { result: "## Results\n\n### Title\n\nContent...\n\n**Relevance:** 95%\n\n..." }
 */
export const search_rag_tool = async ({
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

    const response = await rag_fetch_and_parse_json<
      PaginatedResponse<ChunkWithDocument>,
      { detail: string }
    >(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.success) {
      throw new RagApiRequestError(
        `API request failed: ${response.data.detail}`,
        response.status,
        undefined,
        response.data
      );
    }

    const { results } = response.data;

    if (!results?.length) {
      return handle_tool_error(
        'RAG',
        `No search results found for query: '${validated_input.query}'`
      );
    }

    // Format results as markdown, filtering out low relevance results
    const formatted_results = response.data.results
      .filter((chunk) => chunk.weighted_rank > 0)
      .slice(0, 5)
      .map((chunk) => {
        const metadata = chunk.metadata;

        // Build title from available metadata
        let title = chunk.document_title || 'Untitled';

        if (metadata?.headings && metadata.headings.length > 0) {
          title = metadata.headings[0];
        } else if (metadata?.heading) {
          title = metadata.heading;
        }

        // Build section path
        let section_path = '';
        if (metadata?.path?.length) {
          section_path = metadata.path.join(' > ');
        } else if (metadata?.headings && metadata.headings.length > 1) {
          section_path = metadata.headings.slice(1).join(' > ');
        }

        // Convert semantic distance to similarity (1 - distance)
        const semantic_similarity = chunk.cosine_similarity;
        const relevance = Math.round(
          (0.7 * semantic_similarity + 0.3 * chunk.keyword_rank) * 100
        );

        const parts = [`### ${title}`, `**Relevance:** ${relevance}%`];

        if (section_path) {
          parts.push(`**Section:** ${section_path}`);
        }

        if (metadata?.position !== undefined) {
          parts.push(`**Position:** ${metadata.position}`);
        }

        if (metadata?.page !== undefined) {
          parts.push(`**Page:** ${metadata.page}`);
        }

        if (metadata?.captions?.length) {
          parts.push(`**Captions:** ${metadata.captions.join(', ')}`);
        }

        parts.push(chunk.text);

        return parts.filter(Boolean).join('\n\n');
      })
      .join('\n\n---\n\n');

    return { result: formatted_results };
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return handle_tool_error(
        'RAG',
        'Validation error: ' + error.errors.map((e) => e.message).join(', ')
      );
    }
    if (error instanceof RagApiRequestError) {
      return handle_tool_error('RAG', error.toString());
    }
    return handle_tool_error('RAG', undefined, error);
  }
};
