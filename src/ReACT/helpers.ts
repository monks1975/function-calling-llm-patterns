// ~/src/ReACT/helpers.ts

import * as yaml from 'js-yaml';
import * as fs from 'fs';

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

function convert_to_training_format(examples: TrainingExample[]): string {
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

function load_and_convert_yaml(file_path: string): string {
  const file_content = fs.readFileSync(file_path, 'utf8');
  const yaml_content = yaml.load(file_content) as {
    examples: TrainingExample[];
  };
  return convert_to_training_format(yaml_content.examples);
}

// Example message format
const yamlString = `
examples:
  - - role: user
      content: "Calculate how many apples each person gets if we have 125 apples to distribute among 5 people."
    - role: assistant 
      content:
        thought: "I need to divide 125 apples by 5 people to find out how many apples each person gets."
        action: "calculator"
        input: "125 / 5"

  - - role: user
      content: "What is the capital of France and what is its population?"
    - role: assistant
      content:
        thought: "I need to first confirm the capital of France and then find its population."
        action: "search"
        input: "capital of France"
`;

const data = yaml.load(yamlString) as { examples: TrainingExample[] };
const formatted = convert_to_training_format(data.examples);

export { convert_to_training_format, load_and_convert_yaml };
