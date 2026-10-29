import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PRODUCTS_FILE_PATH = path.resolve(__dirname, '../../../../products.json');

/**
 * ManifestService
 * 
 * Manages SaaS product manifests, domain definitions, and multi-tenant scoping.
 */
export class ManifestService {
  static cachedManifest = null;
  static lastLoadTime = 0;

  /**
   * Load products.json manifest.
   */
  static async loadProducts(forceReload = false) {
    const now = Date.now();
    if (!forceReload && this.cachedManifest && now - this.lastLoadTime < 30000) {
      return this.cachedManifest;
    }

    try {
      const raw = await fs.readFile(PRODUCTS_FILE_PATH, 'utf-8');
      const data = JSON.parse(raw);
      this.cachedManifest = data.products || [];
      this.lastLoadTime = now;
      return this.cachedManifest;
    } catch (err) {
      console.warn('[ManifestService] Could not load products.json:', err.message);
      return [];
    }
  }

  /**
   * List all products.
   */
  static async listProducts() {
    return this.loadProducts();
  }

  /**
   * Get single product by ID or category.
   */
  static async getProduct(identifier) {
    const products = await this.loadProducts();
    return (
      products.find((p) => p.id === identifier || p.category === identifier) || null
    );
  }

  /**
   * Register or merge an audited product manifest (From Option A audit runs).
   */
  static async registerProduct(productData) {
    if (!productData || !productData.id || !productData.name) {
      throw new Error('Invalid product manifest: id and name are required.');
    }

    const products = await this.loadProducts(true);
    const existingIndex = products.findIndex((p) => p.id === productData.id);

    if (existingIndex !== -1) {
      products[existingIndex] = { ...products[existingIndex], ...productData };
    } else {
      products.push(productData);
    }

    this.cachedManifest = products;
    this.lastLoadTime = Date.now();

    try {
      const payload = {
        version: '1.0.0',
        organization: 'Kiaan Technology',
        products
      };
      await fs.writeFile(PRODUCTS_FILE_PATH, JSON.stringify(payload, null, 2), 'utf-8');
    } catch (writeErr) {
      console.warn('[ManifestService] Could not persist registered product to file:', writeErr.message);
    }

    return productData;
  }
}

