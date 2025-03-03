// ~/src/PlanExecute/tools/google.tool.ts

import dotenv from 'dotenv';
import { BaseTool } from './base.tool';
import { z } from 'zod';

import type { ToolResult } from '../types';

dotenv.config();

// Define input schema
const search_schema = z
  .string()
  .min(1, 'Search query is required')
  .describe('Search query');

type WebSearchInput = string;

/**
 * Google search tool using Tavily API
 */
export class GoogleTool extends BaseTool {
  name = 'google';
  description =
    'Google[input]: Search the web for practical, up-to-date information. Input should be a search query.';
  schema = search_schema;
  required_params = ['query'];

  protected async execute_validated(
    query: WebSearchInput
  ): Promise<ToolResult> {
    const tavily_api_key = process.env.TAVILY_API_KEY;

    if (!tavily_api_key) {
      return {
        status: 'error',
        error: 'Tavily API key not found in environment variables',
      };
    }

    try {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tavily_api_key}`,
        },
        body: JSON.stringify({
          query,
          sort_by: 'relevance',
        }),
      });

      if (response.status === 429) {
        return {
          status: 'error',
          error: 'Rate limit exceeded. Please try again later.',
        };
      }

      if (!response.ok) {
        return {
          status: 'error',
          error: `Tavily API error: ${response.statusText}`,
        };
      }

      const search_results = await response.json();

      if (!search_results.results?.length) {
        return {
          status: 'error',
          error: `No search results found for query: '${query}'`,
        };
      }

      const picked_results = search_results.results
        .sort((a: any, b: any) => b.score - a.score)
        .map((result: any) => ({
          title: result.title,
          description: result.content,
          url: result.url,
        }))
        .slice(0, 5);

      return {
        status: 'success',
        data: picked_results,
      };
    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

// Export tool instance
export const google = new GoogleTool();
