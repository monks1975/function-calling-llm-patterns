import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { REACT_EXAMPLES } from './react-examples';
// Types for our ReAct agent's responses
interface ReActResponse {
  thought?: string;
  action?: string;
  input?: any;
  observation?: string;
  final_answer?: string;
}

interface ToolFunction {
  name: string;
  description: string;
  execute: (input: any) => Promise<any>;
}

export class ReActAgent {
  private openai: OpenAI;
  private tools: Map<string, ToolFunction>;
  private messages: ChatCompletionMessageParam[];
  private maxIterations: number;

  constructor(openai: OpenAI) {
    this.openai = openai;
    this.tools = new Map();
    this.maxIterations = 10;

    this.messages = [
      {
        role: 'system',
        content: `You are a ReAct agent that thinks step by step to solve problems. 
        You will respond in JSON format matching exactly the format shown in these examples:
        
        ${REACT_EXAMPLES}
        
        Each response must be valid JSON and contain at least a "thought" field.
        Include "action" and "input" fields when you need to use a tool.
        Only include a "final_answer" field when you have reached the solution.
        Never include an "observation" field - that will come from the tools.`,
      },
    ];

    // Register mock tools
    this.registerTool({
      name: 'calculator',
      description: 'Performs basic mathematical calculations',
      execute: async (input: string) => {
        // Mock calculator - in real implementation, would use a proper parser
        try {
          return eval(input).toString();
        } catch (e) {
          return 'Error in calculation';
        }
      },
    });

    this.registerTool({
      name: 'search',
      description: 'Searches for information',
      execute: async (input: string) => {
        // Mock search - in real implementation, would use an actual search API
        return `Mock search result for: ${input}`;
      },
    });
  }

  registerTool(tool: ToolFunction) {
    this.tools.set(tool.name, tool);
  }

  private async executeAction(action: string, input: any): Promise<string> {
    const tool = this.tools.get(action);
    if (!tool) {
      return `Error: Tool '${action}' not found`;
    }
    return await tool.execute(input);
  }

  async solve(question: string) {
    this.messages.push({ role: 'user', content: question });
    let iterations = 0;

    while (iterations < this.maxIterations) {
      iterations++;

      // Get next step from LLM
      const stream = await this.openai.chat.completions.create({
        model: 'Qwen/Qwen2-VL-72B-Instruct',
        messages: this.messages,
        stream: true,
      });

      let responseText = '';
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        responseText += content;
        // Stream the thought process to console
        process.stdout.write(content);
      }

      try {
        const response: ReActResponse = JSON.parse(responseText);

        // Log the thought process
        if (response.thought) {
          console.log('\nThought:', response.thought);
        }

        // If we have a final answer, we're done
        if (response.final_answer) {
          console.log('\nFinal Answer:', response.final_answer);
          return response.final_answer;
        }

        // Execute action if specified
        if (response.action && response.input) {
          const observation = await this.executeAction(
            response.action,
            response.input
          );
          console.log('\nObservation:', observation);

          // Add the observation to the message history
          this.messages.push({
            role: 'assistant',
            content: responseText,
          });
          this.messages.push({
            role: 'user',
            content: `Observation: ${observation}`,
          });
        }
      } catch (error) {
        console.error('Error parsing response:', error);
        return 'Error: Failed to parse agent response';
      }
    }

    return 'Error: Maximum iterations reached';
  }
}
