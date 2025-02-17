// ~/src/REACT-COT/tools/database.ts

import { z } from 'zod';

import {
  handle_tool_error,
  log_tool,
  zod_schema_to_description,
} from './helpers';

import type { ToolResponse } from './helpers';

const filter_operator_schema = z.enum([
  'eq',
  'neq', // equals, not equals
  'gt',
  'gte', // greater than, greater than or equal
  'lt',
  'lte', // less than, less than or equal
  'contains', // string contains
  'startsWith', // string starts with
  'endsWith', // string ends with
  'in',
  'nin', // in array, not in array
]);

const filter_condition_schema = z.object({
  field: z.string(),
  operator: filter_operator_schema,
  value: z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.union([z.string(), z.number(), z.boolean()])),
  ]),
});

const sort_order_schema = z.enum(['asc', 'desc']);

const sort_schema = z.object({
  field: z.string(),
  order: sort_order_schema,
});

const pagination_schema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(10),
});

export const database_schema = z.object({
  collection: z.string().min(1, 'Collection name is required'),
  filter: z.array(filter_condition_schema).optional(),
  sort: z.array(sort_schema).optional(),
  pagination: pagination_schema.optional(),
  fields: z.array(z.string()).optional(),
});

export type DatabaseQuery = z.infer<typeof database_schema>;

export const database_tool_json_schema =
  zod_schema_to_description(database_schema);

/**
 * Database Tool
 *
 * A tool for querying structured data from a database.
 * Validates input using Zod schema and returns query results as JSON string.
 *
 * Input: Database query parameters (collection, filters, sort, pagination, fields)
 * Output: Object containing query results as JSON string or error message
 *
 * Example:
 * Input: { collection: "books", filter: [{field: "genre", operator: "eq", value: "fiction"}] }
 * Output: { results: "[{title: 'Book 1', author: '...', genre: '...'}, ...]" }
 *
 * Handles:
 * - Collection queries with filters
 * - Result sorting and pagination
 * - Field selection
 * - Error cases with descriptive messages
 * - Returns paginated results based on limit
 */

export const database_tool = async ({
  collection,
  filter = [],
  sort = [],
  pagination = { page: 1, limit: 10 },
  fields = [],
}: DatabaseQuery): Promise<ToolResponse> => {
  try {
    // Validate input
    const validated_input = database_schema.parse({
      collection,
      filter,
      sort,
      pagination,
      fields,
    });

    log_tool.tool('database', validated_input, {
      results: JSON.stringify(validated_input),
    });

    // For now, return a not available message, but structured to show the query was valid
    return {
      error: `Database is not available at the moment. Received valid query for collection: ${validated_input.collection}`,
    };
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return handle_tool_error(
        'database',
        'Validation error: ' + error.errors.map((e) => e.message).join(', ')
      );
    }
    return handle_tool_error('database', undefined, error);
  }
};
