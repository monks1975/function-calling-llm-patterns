// ~/src/ReWOO/helpers.ts

import { State } from './types';

function escape_markdown(text: string): string {
  // Escape special markdown characters
  return text.replace(/[_*`[\]()~>#+=|{}.!-]/g, '\\$&');
}

function escape_code_block(text: string): string {
  // Escape backticks and ensure no ``` sequences
  return text.replace(/`/g, '\\`').replace(/```/g, '\\`\\`\\`');
}

export function format_state_as_markdown(state: State): string {
  const md: string[] = [];

  // Header with session info
  md.push(`# ReWOO Session Log\n`);
  md.push(`**Session ID:** \`${escape_code_block(state.session_id)}\`\n`);
  md.push(
    `**Timestamp:** ${new Date(state.timestamp || Date.now()).toISOString()}\n`
  );
  md.push(`**Task:** ${escape_markdown(state.task)}\n`);

  // Plan section
  if (state.plan_string) {
    md.push(`\n## Plan\n\n${escape_markdown(state.plan_string)}\n`);
  }

  // Steps section
  if (state.steps?.length) {
    md.push(`\n## Execution Steps\n`);
    state.steps.forEach((step, index) => {
      md.push(`\n### Step ${index + 1}\n`);
      md.push(`- **Tool:** \`${escape_code_block(step.tool)}\``);
      md.push(`- **Variable:** \`${escape_code_block(step.variable)}\``);
      md.push(`- **Plan:** ${escape_markdown(step.plan)}`);
      if (step.args) {
        md.push(`- **Arguments:** \`${escape_code_block(step.args)}\``);
      }
    });
  }

  // Results section
  if (state.results) {
    md.push(`\n## Results\n`);
    Object.entries(state.results).forEach(([variable, result]) => {
      md.push(`\n### ${escape_markdown(variable)}\n`);
      md.push(`\`\`\`\n${escape_code_block(result)}\n\`\`\`\n`);
    });
  }

  // Final Result section
  if (state.result) {
    md.push(`\n## Final Result\n\n${escape_markdown(state.result)}\n`);
  }

  // Errors section (if any)
  if (state.errors?.length) {
    md.push(`\n## Errors\n`);
    state.errors.forEach((error, index) => {
      md.push(`\n### Error ${index + 1}\n`);
      md.push(`\`\`\`\n${escape_code_block(error)}\n\`\`\`\n`);
    });
  }

  return md.join('\n');
}
