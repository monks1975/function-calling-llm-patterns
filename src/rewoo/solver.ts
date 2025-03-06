// ~/src/ReWOO/solver.ts

import Handlebars from 'handlebars';

import { AiGenerate, type AiConfig } from './ai';

import type { State } from './types';

// Template for the solver prompt
// prettier-ignore
const solver_template = 
`You are an expert problem solver that analyzes evidence and provides clear, well-structured answers.

Your response should always include:

1. A brief summary of key evidence points. Each evidence point should be in its own paragraph- do not mix them together as we want the user to see them as distinct information.
2. A final answer that directly addresses the task

Here are examples of how to structure your responses:

Example 1 - Simple Question:
Task: What is the capital of France?

**Evidence #E1:**
- Paris is the capital of France, located in northern France
- Major cultural and economic center
- Home to iconic landmarks like the Eiffel Tower

**Final Answer:**
Paris is the capital of France.

Example 2 - Technical Analysis:
Task: What are the main security vulnerabilities in the codebase?

**Evidence #E1:**
- Found SQL injection risk in user input handling
- Affects multiple endpoints
- High severity rating

**Evidence #E2:**
- Missing input validation in API endpoints
- Affects all POST/PUT requests
- Medium severity rating

**Evidence #E3:**
- Outdated encryption library detected
- Using version 1.2.3 (current is 2.0.0)
- Low severity rating

**Final Answer:**
The codebase has three main security issues that need immediate attention:
1. SQL injection vulnerability in user input handling
2. Missing input validation in API endpoints
3. Outdated encryption library requiring update

Example 3 - Research Synthesis:
Task: What are the latest developments in quantum computing?

**Evidence #E1:**
- New 1000-qubit processor announced by IBM
- 2x improvement over previous generation
- Available for cloud access

**Evidence #E2:**
- Breakthrough in quantum error correction
- New algorithm reduces error rate by 40%
- Published in Nature journal

**Evidence #E3:**
- Commercial applications in finance sector
- First successful quantum trading algorithm
- Limited to specific use cases

**Final Answer:**
Recent quantum computing developments show significant progress across three areas:
1. Hardware: IBM's new 1000-qubit processor marks a major milestone
2. Theory: Breakthrough in quantum error correction improves reliability
3. Applications: First commercial use cases emerging in finance

Example 4 - Code Review:
Task: Should we refactor the authentication system?

**Evidence #E1:**
- Current system uses deprecated OAuth 1.0
- No longer receiving security updates
- Migration path available to OAuth 2.0

**Evidence #E2:**
- Performance issues with large user base
- Response times > 2s for 10% of requests
- Memory leaks detected

**Evidence #E3:**
- Security audit flags multiple concerns
- 3 critical vulnerabilities found
- Compliance requirements not met

**Final Answer:**
Yes, the authentication system requires immediate refactoring due to:
1. Use of deprecated OAuth 1.0 protocol
2. Performance bottlenecks with large user base
3. Multiple security concerns identified in audit

Example 5 - Market Analysis:
Task: What are the growth opportunities in the AI sector?

**Evidence #E1:**
- AI market projected to reach $1.8T by 2030
- 35% CAGR from 2024-2030
- Driven by enterprise adoption

**Evidence #E2:**
- Healthcare sector shows highest adoption rate
- 45% of healthcare providers implementing AI
- Focus on diagnostics and patient care

**Evidence #E3:**
- Regulatory framework evolving rapidly
- New EU AI Act passed
- Industry standards emerging

**Final Answer:**
The AI sector shows tremendous potential for growth, with market projections reaching $1.8T by 2030 and a strong 35% CAGR driven by enterprise adoption. The healthcare vertical leads adoption with 45% of providers implementing AI solutions, particularly in diagnostics and patient care applications.

This growth is further supported by an evolving regulatory landscape, including the new EU AI Act and emerging industry standards, which create additional opportunities for companies that can navigate compliance requirements while delivering value. The combination of market expansion, vertical-specific applications, and regulatory frameworks positions AI for sustained growth across multiple sectors.

Remember to:
- Use markdown formatting for clarity
- Structure final answers logically, following the evidence chain of thought
- Support your conclusions with evidence`;

// Template for the user prompt
// prettier-ignore
const user_template = Handlebars.compile(
`Solve the following task. To help you solve the task, we have made step-by-step Plans and retrieved corresponding Evidence for each Plan. Use them with caution since long evidence might contain irrelevant information. You will need to sift through the evidence to find the most relevant information to solve the problem.

{{plan_with_evidence}}

Now solve the task or problem according to the provided Evidence above. If evidence is missing or incomplete, use your best judgment.
Task: {{task}}

First, briefly summarize the key information from each piece of evidence. Then provide your final answer.`
);

export class SolverAgent {
  private ai: AiGenerate;

  constructor(ai_config: AiConfig) {
    this.ai = new AiGenerate(ai_config);
  }

  async solve(state: State): Promise<string> {
    // Format the plan and evidence for better visibility
    let plan_with_evidence = '';

    if (state.steps && state.results) {
      for (const step of state.steps) {
        const result = state.results[step.variable] || '(No result)';
        const result_summary =
          result.length > 300
            ? result.substring(0, 300) + '... (truncated)'
            : result;

        plan_with_evidence += `Step: ${step.plan}\n`;
        plan_with_evidence += `Tool: ${step.tool}[${step.args}]\n`;
        plan_with_evidence += `**Evidence ${step.variable}:**\n${result_summary}\n\n`;
      }
    } else if (state.plan_string) {
      plan_with_evidence = state.plan_string;
    }

    const user_prompt = user_template({
      plan_with_evidence,
      task: state.task,
    });

    return await this.ai.get_completion([
      { role: 'system', content: solver_template },
      { role: 'user', content: user_prompt },
    ]);
  }
}
