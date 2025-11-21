/**
 * Historical Data Cache
 * Caches market data locally to reduce API calls
 */

import fs from 'fs';
import path from 'path';

const CACHE_DIR = path.join(process.cwd(), 'cache', 'historical');
const CACHE_EXPIRY_DAYS = 1; // Cache expires after 1 day

export class HistoricalDataCache {
  constructor() {
    this.ensureCacheDir();
  }

  /**
   * Ensure cache directory exists
   */
  ensureCacheDir() {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
  }

  /**
   * Get cache file path for a symbol
   */
  getCacheFilePath(symbol, outputsize = 'compact') {
    return path.join(CACHE_DIR, `${symbol}_${outputsize}.json`);
  }

  /**
   * Check if cached data exists and is fresh
   */
  isCacheFresh(symbol, outputsize = 'compact') {
    const filePath = this.getCacheFilePath(symbol, outputsize);

    if (!fs.existsSync(filePath)) {
      return false;
    }

    try {
      const stats = fs.statSync(filePath);
      const fileAge = Date.now() - stats.mtime.getTime();
      const maxAge = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000; // Convert days to ms

      return fileAge < maxAge;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get cached data for a symbol
   */
  get(symbol, outputsize = 'compact') {
    const filePath = this.getCacheFilePath(symbol, outputsize);

    if (!this.isCacheFresh(symbol, outputsize)) {
      return null;
    }

    try {
      const data = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(data);
      console.log(`  📦 Using cached data for ${symbol} (${parsed.prices?.length || 0} data points)`);
      return parsed;
    } catch (error) {
      console.error(`  ⚠️  Error reading cache for ${symbol}:`, error.message);
      return null;
    }
  }

  /**
   * Save data to cache
   */
  set(symbol, data, outputsize = 'compact') {
    const filePath = this.getCacheFilePath(symbol, outputsize);

    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      console.log(`  💾 Cached data for ${symbol} (${data.prices?.length || 0} data points)`);
    } catch (error) {
      console.error(`  ⚠️  Error writing cache for ${symbol}:`, error.message);
    }
  }

  /**
   * Clear cache for a specific symbol
   */
  clear(symbol, outputsize = 'compact') {
    const filePath = this.getCacheFilePath(symbol, outputsize);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`  🗑️  Cleared cache for ${symbol}`);
    }
  }

  /**
   * Clear all cache
   */
  clearAll() {
    if (fs.existsSync(CACHE_DIR)) {
      const files = fs.readdirSync(CACHE_DIR);
      for (const file of files) {
        fs.unlinkSync(path.join(CACHE_DIR, file));
      }
      console.log(`  🗑️  Cleared all cache (${files.length} files)`);
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    if (!fs.existsSync(CACHE_DIR)) {
      return { files: 0, totalSize: 0 };
    }

    const files = fs.readdirSync(CACHE_DIR);
    let totalSize = 0;

    for (const file of files) {
      const stats = fs.statSync(path.join(CACHE_DIR, file));
      totalSize += stats.size;
    }

    return {
      files: files.length,
      totalSize,
      totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
    };
  }
}
