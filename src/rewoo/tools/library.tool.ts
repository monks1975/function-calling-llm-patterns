// ~/src/ReWOO/tools/library.tool.ts

import { api_fetch_and_parse_json } from '../../core/services';

import type { ReWooTool } from '../types';

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
  semantic_distance: number;
  weighted_rank: number;
  metadata: unknown | null;
}

// Define metadata type based on the backend implementation
interface ChunkMetadata {
  headings?: string[];
  captions?: string[];
  page?: number;
}

export class LibraryTool implements ReWooTool {
  name = 'Library';
  description =
    'Returns a list of relevant documents from a library that will be relevant to the user query.';
  private library_uuid: string;

  constructor(description: string, library_uuid: string) {
    this.library_uuid = library_uuid;
    this.description = description;
  }

  async execute(args: string): Promise<string> {
    try {
      const search_params = new URLSearchParams({
        q: args,
        pipeline__document__library: this.library_uuid,
      });

      const response = await api_fetch_and_parse_json<
        PaginatedResponse<ChunkSearch>,
        { error: string }
      >(`/documents/chunks/search/?${search_params.toString()}`);

      if (!response.success) {
        throw new Error(`Search failed: ${response.data.error}`);
      }

      if (!response.data.results?.length) {
        return `No results found for query: "${args}"`;
      }

      // Format results as markdown, filtering out low relevance results
      const results = response.data.results
        .filter((chunk) => chunk.weighted_rank > 0)
        .slice(0, 5)
        .map((chunk) => {
          const metadata = chunk.metadata as ChunkMetadata;
          const title = metadata?.headings?.[0] || 'Untitled';
          const subheadings = metadata?.headings?.slice(1).join(' > ') || '';

          // Convert semantic distance to similarity (1 - distance)
          // This gives us a score where higher is better
          const semantic_similarity = 1 - chunk.semantic_distance;

          // Calculate a more accurate relevance score
          // Using default weights from backend (semantic=0.7, keyword=0.3)
          const relevance = Math.round(
            (0.7 * semantic_similarity + 0.3 * chunk.keyword_rank) * 100
          );

          return [
            `### ${title}`,
            `**Relevance:** ${relevance}%`,
            subheadings && `**Section:** ${subheadings}`,
            chunk.text,
            metadata?.page && `**Page:** ${metadata.page}`,
            metadata?.captions?.length &&
              `**Captions:** ${metadata.captions.join(', ')}`,
          ]
            .filter(Boolean)
            .join('\n\n');
        })
        .join('\n\n---\n\n');

      return results;
    } catch (error) {
      return `Error executing library search: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`;
    }
  }
}
