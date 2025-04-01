// ~/src/ReACT/helpers.ts

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

import type { ReActState, ReActAction, ReActTokenUsage } from './types';

interface ExampleAssistantResponse {
  thought: string;
  action?: string;
  input?: any;
  final_answer?: string;
}

interface ExampleUserMessage {
  role: 'user';
  content: string;
}

interface ExampleAssistantMessage {
  role: 'assistant';
  content: ExampleAssistantResponse;
}

type TrainingExample = [ExampleUserMessage, ExampleAssistantMessage];

export function convert_to_training_format(
  examples: TrainingExample[]
): string {
  return examples
    .map((conversation) => {
      return conversation
        .map((message) => {
          if (message.role === 'user') {
            return `<user>${message.content}</user>`;
          } else if (message.role === 'assistant') {
            const content =
              typeof message.content === 'string'
                ? message.content
                : JSON.stringify(message.content, null, 4);
            return `<assistant>\n${content}\n</assistant>`;
          }
          return '';
        })
        .join('\n');
    })
    .join('\n\n');
}

export function load_and_convert_yaml(file_path: string): string {
  const file_content = fs.readFileSync(file_path, 'utf8');
  const yaml_content = yaml.load(file_content) as {
    examples: TrainingExample[];
  };
  return convert_to_training_format(yaml_content.examples);
}

function escape_block(text: string): string {
  // Escape backticks and ensure no ``` sequences
  return text.replace(/`/g, '\\`').replace(/```/g, '\\`\\`\\`');
}

function format_header(state: ReActState): string[] {
  const md: string[] = [];
  md.push(`# ReACT Session Log\n`);
  md.push(`**Session ID:** \`${escape_block(state.session.session_id)}\`\n`);
  md.push(
    `**Timestamp:** ${new Date(state.session.timestamp).toISOString()}\n`
  );
  md.push(`**User Input:** ${escape_block(state.session.user_input)}\n`);
  return md;
}

function format_actions(actions: ReActAction[]): string[] {
  if (!actions?.length) return [];

  const md: string[] = [`\n## Actions & Observations\n`];
  actions.forEach((action, index) => {
    md.push(`\n### Step ${index + 1}\n`);
    md.push(`- **Action:** \`${escape_block(action.action)}\``);
    md.push(`- **Input:** \`${escape_block(JSON.stringify(action.input))}\``);
    md.push(`- **Observation:** ${escape_block(action.observation)}\n`);
  });
  return md;
}

function format_thoughts(thoughts: string[]): string[] {
  if (!thoughts?.length) return [];

  const md: string[] = [`\n## Thoughts\n`];
  thoughts.forEach((thought, index) => {
    md.push(`\n### Thought ${index + 1}\n`);
    md.push(`${escape_block(thought)}\n`);
  });
  return md;
}

function format_errors(errors: Error[]): string[] {
  if (!errors?.length) return [];

  const md: string[] = [`\n## Errors\n`];
  errors.forEach((error, index) => {
    md.push(`\n### Error ${index + 1}\n`);
    md.push(`\`\`\`\n${escape_block(error.message)}\n\`\`\`\n`);
  });
  return md;
}

function format_token_usage(token_usage: ReActTokenUsage[]): string[] {
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

function format_final_answer(final_answer?: string): string[] {
  if (!final_answer) return [];
  return ['\n## Final Answer\n', escape_block(final_answer), ''];
}

export function format_state_as_markdown(state: ReActState): string {
  const md_sections = [...format_header(state)];

  // Interleave thoughts and actions for a more narrative flow
  const thoughts = state.history.previous_thoughts || [];
  const actions = state.history.previous_actions || [];

  md_sections.push('\n## ReACT Process\n');

  const steps = Math.max(thoughts.length, actions.length);
  for (let i = 0; i < steps; i++) {
    // Add parent section for each step
    md_sections.push(`\n### Step ${i + 1}\n`);

    // Add thought subsection if exists
    if (thoughts[i]) {
      md_sections.push(`#### Thought\n`);
      md_sections.push(`${escape_block(thoughts[i])}\n`);
    }

    // Add action subsection if exists
    if (actions[i]) {
      md_sections.push(`#### Action\n`);
      md_sections.push(`\`${escape_block(actions[i].action)}\``);
      md_sections.push(
        `\n**Input:** \`${escape_block(JSON.stringify(actions[i].input))}\`\n`
      );

      // Add observation subsection
      md_sections.push(`#### Observation\n`);
      md_sections.push(`${escape_block(actions[i].observation)}\n`);
    }
  }

  // Add errors if any
  if (state.errors?.length) {
    md_sections.push(...format_errors(state.errors));
  }

  // Add final answer
  if (state.session.final_answer) {
    md_sections.push(...format_final_answer(state.session.final_answer));
  }

  // Add token usage stats at the end
  if (state.history.token_usage?.length) {
    md_sections.push(...format_token_usage(state.history.token_usage));
  }

  return md_sections.join('\n');
}

export async function save_session_log(state: ReActState): Promise<string> {
  const log_dir = path.join(__dirname, 'logs');
  await fs.promises.mkdir(log_dir, { recursive: true });

  const log_file = path.join(log_dir, `${state.session.session_id}_log.md`);
  const markdown = format_state_as_markdown(state);
  await fs.promises.writeFile(log_file, markdown);

  return log_file;
}
