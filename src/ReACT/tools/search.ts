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

export const examples = [
  // Example 1: Basic search
  'User: What is the population of Tokyo?\n' +
    "Thought: I need to search for Tokyo's population first.\n" +
    'Action: Search Web\n' +
    'Action Input: { "query": "Tokyo population 2024" }\n' +
    '<HALT>',

  // Example 2: Multi-step search with refinement
  'User: Who won more Olympic medals, Michael Phelps or Usain Bolt?\n' +
    "Thought: I should first search for Michael Phelps' medal count.\n" +
    'Action: Search Web\n' +
    'Action Input: { "query": "Michael Phelps total Olympic medals" }\n' +
    'Observation: Michael Phelps won 28 Olympic medals in total.\n' +
    "Thought: Now I need to find Usain Bolt's medal count.\n" +
    'Action: Search Web\n' +
    'Action Input: { "query": "Usain Bolt total Olympic medals" }\n' +
    '<HALT>',

  // Example 3: Handling search failure with query refinement
  'User: What were the key features of the iPhone 15?\n' +
    "Thought: I'll search for iPhone 15 features.\n" +
    'Action: Search Web\n' +
    'Action Input: { "query": "iPhone 15 main features and specifications" }\n' +
    'Observation: { "error": "Search service unavailable" }\n' +
    'Thought: The search failed. Let me try a more specific query.\n' +
    'Action: Search Web\n' +
    'Action Input: { "query": "iPhone 15 Pro Max key differences from iPhone 14" }\n' +
    '<HALT>',

  // Example 4: Multi-step search with cross-referencing
  'User: Compare the height of Mount Everest and Mauna Kea from base to peak.\n' +
    "Thought: I'll first search for Mount Everest's height details.\n" +
    'Action: Search Web\n' +
    'Action Input: { "query": "Mount Everest total height from base to peak" }\n' +
    'Observation: Mount Everest rises 29,032 feet (8,848 m) above sea level.\n' +
    "Thought: Now I need Mauna Kea's height from its base on the ocean floor.\n" +
    'Action: Search Web\n' +
    'Action Input: { "query": "Mauna Kea height from ocean floor to peak total" }\n' +
    '<HALT>',

  // Example 5: Handling no results
  'User: What was the most watched TV show in 1932?\n' +
    'Thought: Let me search for TV viewership in 1932.\n' +
    'Action: Search Web\n' +
    'Action Input: { "query": "most popular TV show 1932 viewership" }\n' +
    'Observation: { "noResults": true }\n' +
    "Thought: I realize television wasn't widely available in 1932. Let me search for when TV broadcasting began.\n" +
    'Action: Search Web\n' +
    'Action Input: { "query": "when did regular TV broadcasting begin history" }\n' +
    '<HALT>',

  // Example 6: Search with progressive refinement
  "User: What's the average salary of a software engineer in Silicon Valley?\n" +
    "Thought: I'll search for current software engineer salaries.\n" +
    'Action: Search Web\n' +
    'Action Input: { "query": "average software engineer salary Silicon Valley 2024" }\n' +
    'Observation: Found general salary ranges but need more specific data.\n' +
    'Thought: Let me refine the search to include experience levels.\n' +
    'Action: Search Web\n' +
    'Action Input: { "query": "Silicon Valley software engineer salary by experience level 2024 entry mid senior" }\n' +
    '<HALT>',

  // Example 7: Handling ambiguous results
  'User: Who invented the telephone?\n' +
    "Thought: This needs a careful search as there's historical debate.\n" +
    'Action: Search Web\n' +
    'Action Input: { "query": "who really invented the telephone Bell Meucci controversy" }\n' +
    'Observation: Found conflicting information about Bell and Meucci.\n' +
    'Thought: Let me search for specific patent information.\n' +
    'Action: Search Web\n' +
    'Action Input: { "query": "first telephone patent holder Alexander Graham Bell Antonio Meucci date" }\n' +
    '<HALT>',

  // Example 8: Search failing and falling back on knowledge
  'User: What is the capital of France?\n' +
    "Thought: I'll try searching for the most up-to-date information about France's capital city.\n" +
    'Action: Search Web\n' +
    'Action Input: { "query": "current capital city of France" }\n' +
    'Observation: { "error": "Search service unavailable" }\n' +
    'Thought: Let me try a more specific search.\n' +
    'Action: Search Web\n' +
    'Action Input: { "query": "Paris France capital city government" }\n' +
    'Observation: { "error": "Search service timeout" }\n' +
    "Thought: The search service seems to be down. However, I know with certainty that Paris is the capital of France. This is a well-established fact that doesn't require real-time verification.\n" +
    'Action: null\n' +
    'Action Input: null\n' +
    "Final Answer: The capital of France is Paris. This is a fundamental fact that has remained unchanged for centuries, with Paris serving as France's political, cultural, and economic center.\n" +
    '<HALT>',

  // Example 9: Search with date-specific refinement
  'User: What were the top movies of 2023?\n' +
    "Thought: I'll search for highest-grossing films of 2023.\n" +
    'Action: Search Web\n' +
    'Action Input: { "query": "highest grossing movies 2023 box office" }\n' +
    'Observation: Found box office numbers but need critical reception too.\n' +
    'Thought: Let me search for critically acclaimed movies as well.\n' +
    'Action: Search Web\n' +
    'Action Input: { "query": "best rated movies 2023 critics awards" }\n' +
    '<HALT>',

  // Example 10: Complex multi-part search
  'User: How has climate change affected polar bear populations?\n' +
    'Thought: I need to find current polar bear population statistics first.\n' +
    'Action: Search Web\n' +
    'Action Input: { "query": "current polar bear population numbers 2024" }\n' +
    'Observation: Found recent population estimates.\n' +
    'Thought: Now I need historical data for comparison.\n' +
    'Action: Search Web\n' +
    'Action Input: { "query": "polar bear population decline statistics past 30 years Arctic" }\n' +
    'Observation: Found historical trends.\n' +
    'Thought: Let me search for specific climate impact factors.\n' +
    'Action: Search Web\n' +
    'Action Input: { "query": "how climate change affects polar bear habitat hunting Arctic ice" }\n' +
    '<HALT>',
];
