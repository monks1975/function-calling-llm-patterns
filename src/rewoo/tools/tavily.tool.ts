// ~/src/ReWOO/tools/tavily.tool.ts

import type { Tool } from '../types';

export class TavilyTool implements Tool {
  name = 'Tavily';
  description =
    'Searches the web using the Tavily API. Useful for fetching up-to-date information.';
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
          max_results: 5,
          include_answer: 'basic',
          // include_domains: ['en.wikipedia.org'],
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Search API returned ${response.status}: ${response.statusText}`
        );
      }

      const data = await response.json();

      // Format the search results with Tavily answer if available
      let formatted_results = '';

      if (data.answer) {
        formatted_results += `## Tavily Answer\n\n${data.answer}\n\n## Supporting Sources\n\n`;
      }

      formatted_results += data.results
        .map(
          (result: any) =>
            `### ${result.title}\n\n${result.content}\n\n[Source](${result.url})`
        )
        .join('\n\n---\n\n');

      return formatted_results;
    } catch (error) {
      console.error('Search API error:', error);
      throw error;
    }
  }
}
