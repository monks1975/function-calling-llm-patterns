// ~/src/ReWOO/tools/search.tool.ts

import { Tool } from '../types';

export class SearchTool implements Tool {
  name = 'Search';
  description =
    'Searches the web. Useful for specific and up-to-date information.';
  private api_key: string;

  constructor(tavily_api_key: string) {
    this.api_key = tavily_api_key;
  }

  async execute(query: string): Promise<string> {
    try {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.api_key}`,
        },
        body: JSON.stringify({
          query,
          sort_by: 'relevance',
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Search API returned ${response.status}: ${response.statusText}`
        );
      }

      const data = await response.json();

      // Format the search results
      return data.results
        .map(
          (result: any) =>
            `[${result.title}]\n${result.content}\nURL: ${result.url}`
        )
        .join('\n\n');
    } catch (error) {
      console.error('Search API error:', error);
      throw error;
    }
  }
}
