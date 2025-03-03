// ~/src/PlanExecute/tools/wikipedia.tool.ts

import { BaseTool } from './base.tool';
import { z } from 'zod';

import type { ToolResult } from '../types';

// Constants for retry logic
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// Define enhanced response schema
const wiki_page_schema = z.object({
  pageid: z.number(),
  ns: z.number(),
  title: z.string(),
  index: z.number(),
  extract: z.string(),
});

const wiki_response_schema = z.object({
  batchcomplete: z.string().optional(),
  continue: z
    .object({
      gsroffset: z.number(),
      continue: z.string(),
    })
    .optional(),
  query: z.object({
    pages: z.record(z.string(), wiki_page_schema),
  }),
});

// Define input schema
const wikipedia_schema = z
  .string()
  .min(1, 'Input is required')
  .describe('Wikipedia keyword query');

type WikipediaInput = z.infer<typeof wikipedia_schema>;
type WikiResponse = z.infer<typeof wiki_response_schema>;

interface WikiResult {
  title: string;
  snippet: string;
  page_id: number;
  timestamp: string;
  score: number;
  is_disambiguation: boolean;
  word_count: number;
  size: number;
}

export class WikipediaTool extends BaseTool {
  name = 'wikipedia';
  description = 'Search Wikipedia articles and return a set of ranked results.';
  schema = wikipedia_schema;

  private async fetch_with_retry(
    url: URL,
    retries = MAX_RETRIES
  ): Promise<Response> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        if (response.status === 429 && retries > 0) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
          return this.fetch_with_retry(url, retries - 1);
        }
        throw new Error(`Wikipedia API error: ${response.statusText}`);
      }
      return response;
    } catch (error) {
      if (retries > 0) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
        return this.fetch_with_retry(url, retries - 1);
      }
      throw error;
    }
  }

  protected async execute_validated(
    query: WikipediaInput
  ): Promise<ToolResult> {
    try {
      const search_url = new URL('https://en.wikipedia.org/w/api.php');
      search_url.search = new URLSearchParams({
        action: 'query',
        format: 'json',
        generator: 'search',
        gsrsearch: query,
        gsrlimit: '5',
        prop: 'extracts',
        exintro: '1',
        explaintext: '1',
        exsentences: '10',
        origin: '*',
      }).toString();

      const response = await this.fetch_with_retry(search_url);
      const data = await response.json();

      // Validate response structure
      const validated_data = wiki_response_schema.parse(data);

      if (!validated_data.query?.pages) {
        return {
          status: 'error',
          error: `No results found for query: "${query}"`,
        };
      }

      // Convert pages object to array and sort by index
      const results = Object.values(validated_data.query.pages)
        .sort((a, b) => a.index - b.index)
        .map((page) => ({
          title: page.title,
          extract: page.extract,
          page_id: page.pageid,
          is_disambiguation: page.extract
            .toLowerCase()
            .includes('may refer to:'),
        }));

      // Group results by type
      const grouped_results = {
        direct_matches: results.filter((r) => !r.is_disambiguation),
        disambiguation_pages: results.filter((r) => r.is_disambiguation),
      };

      return {
        status: 'success',
        data: {
          total_hits: results.length,
          results: grouped_results,
        },
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          status: 'error',
          error: `Wikipedia API response validation failed: ${error.errors
            .map((e) => e.message)
            .join(', ')}`,
        };
      }
      return {
        status: 'error',
        error:
          error instanceof Error ? error.message : 'Failed to search Wikipedia',
      };
    }
  }
}

export const wikipedia = new WikipediaTool();
