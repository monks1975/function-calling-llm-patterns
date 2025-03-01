import { z } from 'zod';
import { Plan, available_tools } from './planning.schema';

/**
 * Formats a Zod error into a human-readable string
 * @param error The Zod error to format
 * @returns A formatted error message
 */
export function format_zod_error(error: z.ZodError): string {
  let error_message = 'Validation failed with the following issues:\n\n';

  error.errors.forEach((err) => {
    const path = err.path.join('.');
    error_message += `- ${path ? `Field "${path}": ` : ''}${err.message}\n`;
  });

  // Add schema information
  error_message += '\n\nExpected schema:\n';
  error_message += `- title: string - A concise title for the plan\n`;
  error_message += `- steps: array of objects with:\n`;
  error_message += `  - id: string or number - Step number\n`;
  error_message += `  - description: string - What to do in this step\n`;
  error_message += `  - tool: optional enum (${available_tools.join(
    ', '
  )}) - Tool to use for this step\n`;
  error_message += `- goal: string - The original goal to accomplish\n`;

  return error_message;
}

/**
 * Creates a safe plan for potentially problematic queries
 * @param goal The original goal
 * @returns A safe plan object
 */
export function create_safe_plan(goal: string): Plan {
  return {
    title: 'Content Policy Compliance Plan',
    steps: [
      {
        id: 1,
        description: 'Acknowledge the request in a respectful manner',
      },
      {
        id: 2,
        description:
          'Explain that the request cannot be processed due to content policy restrictions',
      },
      {
        id: 3,
        description:
          'Suggest alternative approaches that comply with content policies',
        tool: 'library_lookup',
      },
    ],
    goal: 'Provide helpful assistance while maintaining content policy compliance',
  };
}

/**
 * Simple template processor for Handlebars-style templates
 * @param template The template string with {{variable}} placeholders
 * @param variables Object containing variable values
 * @returns Processed string with variables replaced
 */
export function process_template(
  template: string,
  variables: Record<string, any>
): string {
  let result = template;

  // Process {{variable}} replacements
  const simple_var_regex = /{{([^#\/][^}]*)}}/g;
  result = result.replace(simple_var_regex, (match, variable) => {
    const trimmed_var = variable.trim();

    // Handle {{json object}} helper
    if (trimmed_var.startsWith('json ')) {
      const obj_name = trimmed_var.substring(5).trim();
      const obj = get_nested_property(variables, obj_name);
      return obj ? JSON.stringify(obj, null, 2) : match;
    }

    const value = get_nested_property(variables, trimmed_var);
    return value !== undefined ? String(value) : match;
  });

  // Process {{#each array}}...{{/each}} blocks
  const each_regex = /{{#each\s+([^}]+)}}([\s\S]*?){{\/each}}/g;
  result = result.replace(each_regex, (match, array_path, block_content) => {
    const array = get_nested_property(variables, array_path.trim());

    if (!Array.isArray(array)) {
      return '';
    }

    return array
      .map((item) => {
        // For each item in the array, process the block with the item as 'this'
        return process_template(block_content, { ...variables, this: item });
      })
      .join('');
  });

  return result;
}

/**
 * Gets a nested property from an object using dot notation
 * @param obj The object to get the property from
 * @param path The path to the property using dot notation
 * @returns The property value or undefined if not found
 */
function get_nested_property(obj: Record<string, any>, path: string): any {
  const parts = path.split('.');
  let current = obj;

  for (const part of parts) {
    if (current === undefined || current === null) {
      return undefined;
    }
    current = current[part];
  }

  return current;
}
