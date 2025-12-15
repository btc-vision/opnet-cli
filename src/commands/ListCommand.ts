/**
 * List command - List installed plugins
 *
 * @module commands/ListCommand
 */

import * as fs from 'fs';
import * as path from 'path';
import { BaseCommand } from './BaseCommand.js';
import { parseOpnetBinary, formatFileSize } from '../lib/binary.js';
import { MLDSALevel } from '../types/index.js';

interface ListOptions {
    dir?: string;
    json?: boolean;
    verbose?: boolean;
}

interface PluginInfo {
    file: string;
    name: string;
    version: string;
    type: string;
    size: number;
    signed: boolean;
    mldsaLevel: MLDSALevel;
    author: string;
    description?: string;
}

export class ListCommand extends BaseCommand {
    constructor() {
        super('list', 'List installed plugins');
    }

    protected configure(): void {
        this.command
            .alias('ls')
            .option('-d, --dir <path>', 'Plugins directory (default: ./plugins/)')
            .option('--json', 'Output as JSON')
            .option('-v, --verbose', 'Show detailed information')
            .action((options?: ListOptions) => this.execute(options));
    }

    private execute(options?: ListOptions): void {
        try {
            const pluginsDir = options?.dir || path.join(process.cwd(), 'plugins');

            if (!fs.existsSync(pluginsDir)) {
                if (options?.json) {
                    this.logger.log(JSON.stringify({ plugins: [], directory: pluginsDir }));
                } else {
                    this.logger.warn('No plugins directory found.');
                    this.logger.info(`Expected: ${pluginsDir}`);
                }
                return;
            }

            // Find all .opnet files
            const files = fs.readdirSync(pluginsDir).filter((f) => f.endsWith('.opnet'));

            if (files.length === 0) {
                if (options?.json) {
                    this.logger.log(JSON.stringify({ plugins: [], directory: pluginsDir }));
                } else {
                    this.logger.warn('No plugins installed.');
                }
                return;
            }

            const plugins: PluginInfo[] = [];

            // Parse each plugin
            for (const file of files) {
                const filePath = path.join(pluginsDir, file);

                try {
                    const data = fs.readFileSync(filePath);
                    const parsed = parseOpnetBinary(data);
                    const isUnsigned = parsed.publicKey.every((b) => b === 0);
                    const mldsaLevel = ([44, 65, 87] as const)[parsed.mldsaLevel];

                    plugins.push({
                        file,
                        name: parsed.metadata.name,
                        version: parsed.metadata.version,
                        type: parsed.metadata.pluginType,
                        size: data.length,
                        signed: !isUnsigned,
                        mldsaLevel,
                        author: parsed.metadata.author.name,
                        description: parsed.metadata.description,
                    });
                } catch {
                    plugins.push({
                        file,
                        name: '(invalid)',
                        version: '-',
                        type: '-',
                        size: fs.statSync(filePath).size,
                        signed: false,
                        mldsaLevel: 44,
                        author: '-',
                    });
                }
            }

            // Sort by name
            plugins.sort((a, b) => a.name.localeCompare(b.name));

            if (options?.json) {
                this.logger.log(JSON.stringify({ plugins, directory: pluginsDir }, null, 2));
                return;
            }

            // Display
            this.logger.info('\nInstalled Plugins\n');
            this.logger.info(`Directory: ${pluginsDir}`);
            this.logger.log('');

            if (options?.verbose) {
                // Detailed list
                for (const plugin of plugins) {
                    this.logger.info('─'.repeat(60));
                    this.logger.info(`${plugin.name} @ ${plugin.version}`);
                    this.logger.info(`  Type:      ${plugin.type}`);
                    this.logger.info(`  Size:      ${formatFileSize(plugin.size)}`);
                    this.logger.info(`  Signed:    ${plugin.signed ? 'Yes' : 'No'}`);
                    this.logger.info(`  MLDSA:     ${plugin.mldsaLevel}`);
                    this.logger.info(`  Author:    ${plugin.author}`);
                    if (plugin.description) {
                        this.logger.info(`  Desc:      ${plugin.description}`);
                    }
                    this.logger.info(`  File:      ${plugin.file}`);
                }
            } else {
                // Simple table
                const nameWidth = Math.max(20, ...plugins.map((p) => p.name.length)) + 2;
                const versionWidth = 12;
                const typeWidth = 12;
                const sizeWidth = 10;

                this.logger.info(
                    'Name'.padEnd(nameWidth) + 'Version'.padEnd(versionWidth) + 'Type'.padEnd(typeWidth) + 'Size'.padEnd(sizeWidth) + 'Signed',
                );
                this.logger.info('─'.repeat(nameWidth + versionWidth + typeWidth + sizeWidth + 8));

                for (const plugin of plugins) {
                    const signedText = plugin.signed ? 'Yes' : 'No';
                    this.logger.info(
                        `${plugin.name.padEnd(nameWidth)}${plugin.version.padEnd(versionWidth)}${plugin.type.padEnd(typeWidth)}${formatFileSize(plugin.size).padEnd(sizeWidth)}${signedText}`,
                    );
                }
            }

            this.logger.log('');
            this.logger.info(`Total: ${plugins.length} plugin${plugins.length === 1 ? '' : 's'}`);
            this.logger.log('');
        } catch (error) {
            this.exitWithError(this.formatError(error));
        }
    }
}

export const listCommand = new ListCommand().getCommand();
