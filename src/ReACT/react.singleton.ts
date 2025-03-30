// ~/src/ReACT/react.singleton.ts
// Singleton wrapper for ReActAgent
// Suitable for CLI applications where only one agent is needed at a time

import { ReActAgent } from './react.agent';

import type { AiConfig } from '../core/types';
import type { ReActCallbacks } from './types';
import type { ToolsConfig } from './tools/setup';
import type { ReActState } from './types';

/**
 * Singleton wrapper for ReActAgent
 * Provides a global access point to a single ReActAgent instance
 * Suitable for CLI applications where only one agent is needed at a time
 */
export class ReActAgentSingleton {
  private static instance: ReActAgent | null = null;
  private static is_initialized = false;
  private static config: AiConfig | null = null;
  private static tools_config: ToolsConfig | null = null;
  private static _handlers_set = false;

  /**
   * Initialize the singleton with configuration
   * This should be called once at the start of your application
   *
   * @param config The AI configuration
   * @param tools_config The tools configuration
   */
  public static initialize(config: AiConfig, tools_config: ToolsConfig): void {
    if (this.is_initialized) {
      console.warn(
        'ReActAgentSingleton is already initialized. Call reset() first if you want to reinitialize.'
      );
      return;
    }

    this.config = config;
    this.tools_config = tools_config;
    this.is_initialized = true;
  }

  /**
   * Get the agent instance
   * Creates a new instance if one doesn't exist or if force_new is true
   *
   * @param force_new Whether to force creation of a new instance
   * @returns The ReActAgent instance
   */
  public static get_agent(force_new = false): ReActAgent {
    if (!this.is_initialized) {
      throw new Error(
        'ReActAgentSingleton not initialized. Call initialize() first.'
      );
    }

    if (force_new && this.instance) {
      this.cleanup();
    }

    if (!this.instance) {
      if (!this.config || !this.tools_config) {
        throw new Error('Configuration missing. Call initialize() first.');
      }

      this.instance = new ReActAgent(this.config, this.tools_config);

      // Set up cleanup on process exit
      this.setup_exit_handlers();
    }

    return this.instance;
  }

  /**
   * Clean up the current agent instance
   * Should be called when the CLI command completes
   */
  public static cleanup(): void {
    if (this.instance) {
      try {
        // Abort any pending requests
        this.instance.abort();
        this.instance.cleanup();
        this.instance = null;

        // Remove any process event handlers we set up
        if (this._handlers_set) {
          process.removeAllListeners('exit');
          process.removeAllListeners('SIGINT');
          process.removeAllListeners('uncaughtException');
          this._handlers_set = false;
        }

        console.log('Agent singleton cleaned up');
      } catch (error) {
        console.error('Error during cleanup:', error);
      }
    }
  }

  /**
   * Reset the singleton state
   * Useful when you want to reinitialize with different configuration
   */
  public static reset(): void {
    this.cleanup();
    this.config = null;
    this.tools_config = null;
    this.is_initialized = false;
  }

  /**
   * Set up handlers to ensure cleanup on process exit
   * This prevents memory leaks if the process exits unexpectedly
   */
  private static setup_exit_handlers(): void {
    // Only set up handlers once
    if (this.instance && !this._handlers_set) {
      // Remove any existing handlers first to avoid duplicates
      process.removeAllListeners('exit');
      process.removeAllListeners('SIGINT');
      process.removeAllListeners('uncaughtException');

      // Clean up on normal exit
      process.on('beforeExit', () => {
        this.cleanup();
      });

      // Clean up on SIGINT (Ctrl+C)
      process.on('SIGINT', () => {
        console.log('\nReceived SIGINT. Cleaning up...');
        this.cleanup();
        process.exit(0);
      });

      // Clean up on uncaught exceptions
      process.on('uncaughtException', (err) => {
        console.error('Uncaught exception:', err);
        this.cleanup();
        process.exit(1);
      });

      this._handlers_set = true;
    }
  }

  /**
   * Process a user's question and get an answer
   * This is the main method to interact with the agent
   *
   * @param question The user's question
   * @param callbacks Optional callbacks for handling events during processing
   * @returns A promise that resolves to the answer
   */
  public static async answer(
    question: string,
    callbacks?: ReActCallbacks
  ): Promise<string> {
    const agent = this.get_agent();
    return agent.answer(question, callbacks);
  }

  /**
   * Abort any ongoing request
   * Useful when the user wants to cancel a long-running operation
   */
  public static abort(): void {
    if (this.instance) {
      this.instance.abort();
    }
  }

  /**
   * Get the current state of the agent
   * @returns The current ReActState or null if no agent exists
   */
  public static get current_state(): ReActState | null {
    if (!this.instance) {
      return null;
    }
    return this.instance.current_state;
  }

  /**
   * Get the current session ID
   * @returns The current session ID or null if no agent exists
   */
  public static get session_id(): string | null {
    if (!this.instance) {
      return null;
    }
    return this.instance.session_id;
  }
}
