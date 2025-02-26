// ~/src/ReACT/agent_singleton.ts
// Singleton wrapper for ReActAgent
// Suitable for CLI applications where only one agent is needed at a time

import { ReActAgent } from './react.agent';

import type { AiConfig } from './ai';
import type { ReActEvents } from './react.agent';
import type { ToolsConfig } from './tools/setup';

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
   * Add a typed event listener to the agent
   * This is a convenience method that ensures type safety for event listeners
   *
   * @param event The event to listen for
   * @param listener The callback function
   */
  public static on<K extends keyof ReActEvents>(
    event: K,
    listener: ReActEvents[K]
  ): void {
    const agent = this.get_agent();
    agent.on(event, listener);
  }

  /**
   * Remove a typed event listener from the agent
   * This is a convenience method that ensures type safety for event listeners
   *
   * @param event The event to stop listening for
   * @param listener The callback function to remove
   */
  public static off<K extends keyof ReActEvents>(
    event: K,
    listener: ReActEvents[K]
  ): void {
    if (this.instance) {
      this.instance.off(event, listener);
    }
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
      process.on('exit', () => {
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
}
