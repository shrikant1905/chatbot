import { ManifestService } from '../services/manifestService.js';
import { ToolRegistry } from '../services/tools/toolRegistry.js';
import { concurrencyQueue } from '../services/queue/concurrencyQueue.js';

export class GatewayController {
  /**
   * List all 16 registered software products.
   */
  static async listProducts(req, res, next) {
    try {
      const products = await ManifestService.listProducts();
      res.json({ success: true, count: products.length, products });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Register or update a product manifest (Option A audit results).
   */
  static async registerProduct(req, res, next) {
    try {
      const product = await ManifestService.registerProduct(req.body);
      res.json({ success: true, message: 'Product manifest registered successfully', product });
    } catch (err) {
      next(err);
    }
  }

  /**
   * List all 50 tools or filter by domain.
   */
  static async listTools(req, res, next) {
    try {
      const { domain } = req.query;
      const tools = await ToolRegistry.getToolsForAi(domain);
      res.json({ success: true, count: tools.length, domain: domain || 'all', tools });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Direct execution of a tool.
   */
  static async executeTool(req, res, next) {
    try {
      const { toolName, parameters = {}, confirmed = false } = req.body;
      if (!toolName) {
        return res.status(400).json({ success: false, error: 'toolName is required' });
      }

      const execution = await ToolRegistry.execute(toolName, parameters, { user: req.user }, confirmed);
      res.json({ success: true, ...execution });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Approve and execute a pending Tier-3 tool.
   */
  static async approveTool(req, res, next) {
    try {
      const { toolName, parameters = {} } = req.body;
      if (!toolName) {
        return res.status(400).json({ success: false, error: 'toolName is required' });
      }

      const execution = await ToolRegistry.execute(toolName, parameters, { user: req.user }, true);
      res.json({ success: true, approved: true, ...execution });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Live concurrency queue & hot cache metrics.
   */
  static async getQueueMetrics(req, res, next) {
    try {
      const metrics = concurrencyQueue.getMetrics();
      res.json({ success: true, metrics });
    } catch (err) {
      next(err);
    }
  }
}

