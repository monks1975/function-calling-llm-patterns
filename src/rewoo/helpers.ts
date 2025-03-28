// ~/src/ReWOO/helpers.ts

import { ReWooState } from './types';

// function escape_markdown(text: string): string {
//   // Escape special markdown characters while preserving line breaks
//   return text
//     .split('\n')
//     .map((line) => line.replace(/[_*`[\]()~>#+=|{}.!-]/g, '\\$&'))
//     .join('\n');
// }

function escape_block(text: string): string {
  // Escape backticks and ensure no ``` sequences
  return text.replace(/`/g, '\\`').replace(/```/g, '\\`\\`\\`');
}

function format_header(state: ReWooState): string[] {
  const md: string[] = [];
  md.push(`# ReWOO Session Log\n`);
  md.push(`**Session ID:** \`${escape_block(state.session_id)}\`\n`);
  md.push(
    `**Timestamp:** ${new Date(state.timestamp || Date.now()).toISOString()}\n`
  );
  md.push(`**Task:** ${escape_block(state.task)}\n`);
  return md;
}

function format_plan(plan_string: string): string[] {
  if (!plan_string) return [];
  return [
    `\n## Plan\n\n${plan_string
      .split('\n')
      .map((line) => line.trim())
      .join('  \n')}\n`,
  ];
}

function format_steps(steps: ReWooState['steps']): string[] {
  if (!steps?.length) return [];

  const md: string[] = [`\n## Execution Steps\n`];
  steps.forEach((step, index) => {
    md.push(`\n### Step ${index + 1}\n`);
    md.push(`- **Tool:** \`${escape_block(step.tool)}\``);
    md.push(`- **Variable:** \`${escape_block(step.variable)}\``);
    md.push(`- **Plan:** ${escape_block(step.plan)}`);
    if (step.args) {
      md.push(`- **Arguments:** \`${escape_block(step.args)}\``);
    }
  });
  return md;
}

function format_results(results: ReWooState['results']): string[] {
  if (!results) return [];

  const md: string[] = [`\n## Results\n`];
  Object.entries(results).forEach(([variable, result]) => {
    md.push(`\n### ${escape_block(variable)}\n`);
    const formatted_result = result
      .split('\n')
      .map((line) =>
        line.includes('```') ? line.replace(/```/g, '\\`\\`\\`') : line
      )
      .join('\n');
    md.push(`${formatted_result}\n`);
  });
  return md;
}

function format_final_result(result: string): string[] {
  if (!result) return [];

  const md: string[] = [`\n## Final Result\n\n`];
  const evidence_match = result.match(/<evidence>([\s\S]*?)<\/evidence>/);
  const solution_match = result.match(/<solution>([\s\S]*?)<\/solution>/);

  if (evidence_match) {
    md.push(`### Evidence\n\n${evidence_match[1].trim()}\n`);
  }
  if (solution_match) {
    md.push(`### Solution\n\n${solution_match[1].trim()}\n`);
  }
  return md;
}

function format_errors(errors: string[]): string[] {
  if (!errors?.length) return [];

  const md: string[] = [`\n## Errors\n`];
  errors.forEach((error, index) => {
    md.push(`\n### Error ${index + 1}\n`);
    md.push(`\`\`\`\n${escape_block(error)}\n\`\`\`\n`);
  });
  return md;
}

function format_token_usage(token_usage: ReWooState['token_usage']): string[] {
  if (!token_usage?.length) return [];

  const md: string[] = [
    `\n## Token Usage\n`,
    `| Source | Prompt | Completion | Total |`,
    `|--------|---------|------------|--------|`,
  ];

  token_usage.forEach((usage) => {
    md.push(
      `| ${usage.source} | ${usage.prompt_tokens} | ${usage.completion_tokens} | ${usage.total_tokens} |`
    );
  });

  const totals = token_usage.reduce(
    (acc, curr) => ({
      prompt_tokens: acc.prompt_tokens + curr.prompt_tokens,
      completion_tokens: acc.completion_tokens + curr.completion_tokens,
      total_tokens: acc.prompt_tokens + acc.completion_tokens,
    }),
    { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
  );

  md.push(
    `| **Total** | ${totals.prompt_tokens} | ${totals.completion_tokens} | ${
      totals.prompt_tokens + totals.completion_tokens
    } |`
  );

  return md;
}

export function format_state_as_markdown(state: ReWooState): string {
  return [
    ...format_header(state),
    ...format_plan(state.plan_string ?? ''),
    ...format_steps(state.steps ?? []),
    ...format_results(state.results ?? {}),
    ...format_final_result(state.result ?? ''),
    ...format_errors(state.errors ?? []),
    ...format_token_usage(state.token_usage ?? []),
  ].join('\n');
}
