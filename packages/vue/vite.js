import Transformer from './Transformer.js';
import {spawnSync} from 'child_process';
import fs from 'fs';
import path from "path";
import Cleanup from "./Cleanup.js";
import {SourceMapGenerator, SourceMapConsumer} from 'source-map';

const pendingTransforms = new Map();

// Set it to prod by default, just to be safe.
let isProd = true;
let fusionConfig = {};
let viteServer;

function clearStorageDirectories(config) {
  try {
    // Clear JavaScript storage directory
    if (fs.existsSync(config.paths.jsStorage)) {
      fs.rmSync(config.paths.jsStorage, {recursive: true, force: true});
      fs.mkdirSync(config.paths.jsStorage, {recursive: true});
    }

    // Clear PHP storage directory
    if (fs.existsSync(config.paths.phpStorage)) {
      fs.rmSync(config.paths.phpStorage, {recursive: true, force: true});
      fs.mkdirSync(config.paths.phpStorage, {recursive: true});
    }
  } catch (error) {
    console.error('Error clearing storage directories:', error);
  }
}

export default function fusionForVue(options = {}) {
  options = {
    artisan: 'php artisan',
    ...options
  }

  return {
    name: 'fusion-vue',
    enforce: 'pre',

    config() {
      const [php, ...args] = options.artisan.split(' ');

      const result = spawnSync(php, [...args, 'fusion:config'], {encoding: 'utf-8'});

      if (result.error) {
        throw new Error(`Error retrieving config: ${result.error.message}`);
      }

      try {
        fusionConfig = JSON.parse(result.stdout);
        fusionConfig.artisan = options.artisan;
      } catch (err) {
        throw new Error(`Couldn't parse config JSON. Raw output: ${result.stdout}`);
      }

      return {
        resolve: {
          alias: {
            '$fusion': fusionConfig.paths.jsStorage,
          },
        },
      };
    },

    configResolved(config) {
      isProd = config.isProduction;

      // Clear storage directories only for production builds
      if (isProd) {
        clearStorageDirectories(fusionConfig);
      }
    },

    configureServer(server) {
      viteServer = server;

      server.watcher.on('all', async (event, filename) => {
        if (filename === fusionConfig.paths.config) {
          server.restart();
        }

        if (event === 'unlink' || event === 'unlinkDir') {
          pendingTransforms.delete(filename);

          // @TODO debounce
          (new Cleanup({config: fusionConfig})).run();
          return;
        }

        if (filename.endsWith('.vue') && !pendingTransforms.has(filename)) {
          const timeout = setTimeout(async () => {
            try {
              const fileContent = fs.readFileSync(filename, 'utf-8');

              await new Transformer({
                config: fusionConfig,
                code: fileContent,
                filename: filename,
                isProd,
                // Enable source maps
                sourceMap: true
              }).transform();
            } catch (error) {
              console.error(`Error processing ${filename}:`, error);
            } finally {
              pendingTransforms.delete(filename);
            }
          }, 50);

          pendingTransforms.set(filename, timeout);
        }
      });
    },

    async transform(code, filename) {
      if (!filename.endsWith('.vue')) {
        return null; // Return null to let Vite handle non-Vue files
      }

      if (pendingTransforms.has(filename)) {
        clearTimeout(pendingTransforms.get(filename));
        pendingTransforms.delete(filename);
      }

      // Create transformer with source map enabled
      const transformer = new Transformer({
        config: fusionConfig,
        code,
        filename,
        isProd,
        // Enable source maps for all transformations
        sourceMap: true
      });

      // Get the transformation result (code + source map)
      const result = await transformer.transform();

      // When using Recast, the transformer would return both code and source map
      // For now, we're simulating this behavior
      if (typeof result === 'object' && result.code && result.map) {
        // Return both the code and the source map
        return {
          code: result.code,
          map: result.map
        };
      }

      // Handle legacy string return format
      // This is temporary until Transformer is fully migrated to return source maps
      if (typeof result === 'string') {
        // Generate a simple source map
        const sourceMap = new SourceMapGenerator({
          file: path.basename(filename),
        });

        // Add a mapping from the original file to the transformed file
        // This is a simplistic mapping - recast would provide more accurate ones
        sourceMap.addMapping({
          generated: {line: 1, column: 0},
          original: {line: 1, column: 0},
          source: path.basename(filename)
        });

        return {
          code: result,
          // Convert to the format Vite expects
          map: sourceMap.toString()
        };
      }

      return null;
    },
  }
}