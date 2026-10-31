import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import { salesTools } from './handlers/salesTools.js';
import { marketingTools } from './handlers/marketingTools.js';
import { billingTools } from './handlers/billingTools.js';
import { inventoryTools } from './handlers/inventoryTools.js';
import { hrTools } from './handlers/hrTools.js';
import { supportTools } from './handlers/supportTools.js';
import { analyticsTools } from './handlers/analyticsTools.js';
import { automationTools } from './handlers/automationTools.js';
import { TavilyService } from '../search/tavilyService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TOOLS_FILE_PATH = path.resolve(__dirname, '../../../../tools.json');

/**
 * Universal Tool Registry
 * 
 * Maps 50+ tool schemas to deterministic Node.js domain execution handlers
 * with strict Tier-3 confirmation guardrails.
 */
export class ToolRegistry {
  static cachedTools = null;
  static handlerMap = {
    ...salesTools,
    ...marketingTools,
    ...billingTools,
    ...inventoryTools,
    ...hrTools,
    ...supportTools,
    ...analyticsTools,
    ...automationTools,
    web_search: async (args) => {
      const query = args.query || args.prompt || '';
      return TavilyService.search(query, { maxResults: 5 });
    }
  };

  /**
   * Load tool definitions from tools.json.
   */
  static async loadTools() {
    if (this.cachedTools) return this.cachedTools;

    let loaded = [];
    try {
      const raw = await fs.readFile(TOOLS_FILE_PATH, 'utf-8');
      const data = JSON.parse(raw);
      loaded = data.tools || [];
    } catch (err) {
      console.warn('[ToolRegistry] Could not read tools.json:', err.message);
    }

    // Ensure built-in web_search tool is always registered
    if (!loaded.some((t) => t.function?.name === 'web_search')) {
      loaded.push({
        domain: 'search',
        approvalRequired: 'none',
        function: {
          name: 'web_search',
          description: 'Search the live Internet using Tavily for real-time news, current events, scores, and up-to-date facts.',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'The search query to look up on the web.'
              }
            },
            required: ['query']
          }
        }
      });
    }

    this.cachedTools = loaded;
    return this.cachedTools;
  }

  /**
   * Get all tool definitions for Ollama function calling.
   * Can optionally filter by domain.
   */
  static async getToolsForAi(domain = null) {
    const all = await this.loadTools();
    if (!domain || domain === 'all') {
      return all;
    }
    return all.filter((t) => t.domain === domain);
  }

  /**
   * Get metadata for a specific tool.
   */
  static async getToolContract(toolName) {
    const all = await this.loadTools();
    return all.find((t) => t.function?.name === toolName) || null;
  }

  /**
   * Execute a tool by name with arguments and security validation.
   */
  static async execute(toolName, args = {}, context = {}, isConfirmed = false) {
    const contract = await this.getToolContract(toolName);
    if (!contract) {
      throw new Error(`Tool '${toolName}' is not registered in Kiaan Universal AI Gateway.`);
    }

    const handler = this.handlerMap[toolName];
    if (!handler) {
      throw new Error(`Handler for tool '${toolName}' is not implemented in Node.js engine.`);
    }

    // Check Human-In-The-Loop approval gate
    if (contract.approvalRequired !== 'none' && !isConfirmed) {
      return {
        approvalRequired: true,
        approvalLevel: contract.approvalRequired,
        toolName,
        domain: contract.domain,
        parameters: args,
        message: `Action requires human confirmation before execution. Click 'Approve' to proceed.`
      };
    }

    // Execute deterministic Node.js handler
    try {
      const executionResult = await handler(args, context);
      return {
        approvalRequired: false,
        executed: true,
        toolName,
        domain: contract.domain,
        result: executionResult
      };
    } catch (execErr) {
      console.error(`[Tool Execution Error] ${toolName}:`, execErr.message);
      return {
        approvalRequired: false,
        executed: false,
        toolName,
        error: execErr.message
      };
    }
  }
}
