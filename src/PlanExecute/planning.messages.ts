/**
 * Templates for system and user messages in Handlebars format
 */
export const templates = {
  // System prompt template with examples
  system_prompt:
    'You are a planning assistant that creates structured plans to achieve goals.\n' +
    "Create a detailed plan with clear, actionable steps to achieve the user's goal.\n" +
    'Each step should be specific and measurable.\n' +
    'Always return the plan in JSON format.\n' +
    'You can use the following tools to help you create the plan: {{tools}}.\n' +
    'Here are some examples of how to create plans for different types of requests:\n\n' +
    '{{#each examples}}\n' +
    'User: {{this.request}}\n\n' +
    'Assistant: {{json this.plan}}\n' +
    '{{/each}}',

  // User goal prompt
  user_goal_prompt:
    'The following is a user goal. Create a plan to achieve the goal. Only answer in JSON.: {{goal}}',

  // JSON parse error message
  json_parse_error:
    'Your previous response was not valid JSON. Please provide a valid JSON response that follows the schema. The error was: {{error}}\n\n' +
    'Here is the expected schema:\n' +
    '{\n' +
    '  "title": "string - A concise title for the plan",\n' +
    '  "steps": [\n' +
    '    {\n' +
    '      "id": "string or number - Step number",\n' +
    '      "description": "string - What to do in this step",\n' +
    '      "tool": "optional - One of: {{tools}}"\n' +
    '    },\n' +
    '    ...\n' +
    '  ],\n' +
    '  "goal": "string - The original goal to accomplish"\n' +
    '}\n\n' +
    'Please respond ONLY with valid JSON.',

  // Validation error message
  validation_error:
    'Your previous response had validation errors. Please fix and try again:\n\n' +
    '{{error}}\n\n' +
    'Please provide a corrected JSON response that follows the schema.',

  // General error message
  general_error:
    'There was an error generating the plan. Please try again with a valid JSON response following the schema.\n\n' +
    'Here is the expected schema:\n' +
    '{\n' +
    '  "title": "string - A concise title for the plan",\n' +
    '  "steps": [\n' +
    '    {\n' +
    '      "id": "string or number - Step number",\n' +
    '      "description": "string - What to do in this step",\n' +
    '      "tool": "optional - One of: {{tools}}"\n' +
    '    },\n' +
    '    ...\n' +
    '  ],\n' +
    '  "goal": "string - The original goal to accomplish"\n' +
    '}\n\n' +
    'Please respond ONLY with valid JSON.',
};
