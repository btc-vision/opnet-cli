/**
 * Info command - Display plugin or .opnet file information
 *
 * @module commands/InfoCommand
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { IPluginPermissions } from '@btc-vision/plugin-sdk';
import { BaseCommand } from './BaseCommand.js';
import { formatFileSize, getParsedMldsaLevel, parseOpnetBinary } from '../lib/binary.js';
import { getManifestPath, loadManifest } from '../lib/manifest.js';

interface InfoOptions {
    json?: boolean;
}

export class InfoCommand extends BaseCommand {
    constructor() {
        super('info', 'Display information about a plugin or .opnet file');
    }

    protected configure(): void {
        this.command
            .argument(
                '[path]',
                'Path to plugin directory or .opnet file (default: current directory)',
            )
            .option('--json', 'Output as JSON')
            .action((inputPath?: string, options?: InfoOptions) =>
                this.execute(inputPath, options),
            );
    }

    private execute(inputPath?: string, options?: InfoOptions): void {
        try {
            const targetPath = inputPath ? path.resolve(inputPath) : process.cwd();

            if (!fs.existsSync(targetPath)) {
                this.exitWithError(`Path not found: ${targetPath}`);
            }

            const stat = fs.statSync(targetPath);

            if (stat.isFile() && targetPath.endsWith('.opnet')) {
                this.displayBinaryInfo(targetPath, options?.json);
            } else if (stat.isDirectory()) {
                this.displayProjectInfo(targetPath, options?.json);
            } else if (stat.isFile() && targetPath.endsWith('plugin.json')) {
                this.displayProjectInfo(path.dirname(targetPath), options?.json);
            } else {
                this.exitWithError('Invalid path. Provide a plugin directory or .opnet file.');
            }
        } catch (error) {
            this.exitWithError(this.formatError(error));
        }
    }

    private displayBinaryInfo(filePath: string, json?: boolean): void {
        const data = fs.readFileSync(filePath);
        const parsed = parseOpnetBinary(data);
        const mldsaLevel = getParsedMldsaLevel(parsed);

        const isUnsigned = parsed.publicKey.every((b) => b === 0);
        const publicKeyHash = crypto.createHash('sha256').update(parsed.publicKey).digest('hex');

        if (json) {
            const output = {
                type: 'binary',
                file: filePath,
                fileSize: data.length,
                formatVersion: parsed.formatVersion,
                mldsaLevel,
                signed: !isUnsigned,
                publicKeyHash: isUnsigned ? null : publicKeyHash,
                metadata: parsed.metadata,
                sizes: {
                    metadata: parsed.rawMetadata.length,
                    bytecode: parsed.bytecode.length,
                    proto: parsed.proto?.length ?? 0,
                    publicKey: parsed.publicKey.length,
                    signature: parsed.signature.length,
                },
            };
            this.logger.log(JSON.stringify(output, null, 2));
            return;
        }

        const meta = parsed.metadata;

        this.logger.info('\nOPNet Binary Information\n');
        this.logger.log('─'.repeat(60));

        this.logger.log(`File:            ${filePath}`);
        this.logger.log(`Size:            ${formatFileSize(data.length)}`);
        this.logger.log(`Format:          v${parsed.formatVersion}`);
        this.logger.log('');

        this.logger.log('Plugin:');
        this.logger.log(`  Name:           ${meta.name}`);
        this.logger.log(`  Version:        ${meta.version}`);
        this.logger.log(`  Type:           ${meta.pluginType}`);
        this.logger.log(`  OPNet:          ${meta.opnetVersion}`);
        if (meta.description) {
            this.logger.log(`  Description:    ${meta.description}`);
        }
        this.logger.log('');

        this.logger.log('Author:');
        this.logger.log(`  Name:           ${meta.author.name}`);
        if (meta.author.email) {
            this.logger.log(`  Email:          ${meta.author.email}`);
        }
        this.logger.log('');

        this.logger.log('Cryptography:');
        this.logger.log(`  MLDSA Level:    MLDSA-${mldsaLevel}`);
        this.logger.log(`  Signed:         ${isUnsigned ? 'No' : 'Yes'}`);
        if (!isUnsigned) {
            this.logger.log(`  Publisher:      ${publicKeyHash.substring(0, 32)}...`);
        }
        this.logger.log('');

        this.logger.log('Sizes:');
        this.logger.log(`  Bytecode:       ${formatFileSize(parsed.bytecode.length)}`);
        this.logger.log(`  Metadata:       ${formatFileSize(parsed.rawMetadata.length)}`);
        this.logger.log(`  Proto:          ${formatFileSize(parsed.proto?.length ?? 0)}`);
        this.logger.log('');

        this.logger.log('Permissions:');
        this.displayPermissions(meta.permissions);
        this.logger.log('');

        if (Object.keys(meta.dependencies || {}).length > 0) {
            this.logger.log('Dependencies:');
            for (const [name, version] of Object.entries(meta.dependencies || {})) {
                this.logger.log(`  ${name}: ${version}`);
            }
            this.logger.log('');
        }
    }

    private displayProjectInfo(projectDir: string, json?: boolean): void {
        const manifestPath = getManifestPath(projectDir);

        if (!fs.existsSync(manifestPath)) {
            this.logger.fail('No plugin.json found in this directory.');
            this.logger.info('Run `opnet init` to create a new plugin project.');
            process.exit(1);
        }

        const manifest = loadManifest(manifestPath);

        // Check for compiled binary
        const binaryPath = path.join(
            projectDir,
            'build',
            `${manifest.name.replace(/^@/, '').replace(/\//g, '-')}.opnet`,
        );
        const hasBinary = fs.existsSync(binaryPath);
        let binarySize: number | null = null;
        if (hasBinary) {
            binarySize = fs.statSync(binaryPath).size;
        }

        // Check for source files
        const srcDir = path.join(projectDir, 'src');
        const hasSrc = fs.existsSync(srcDir);

        // Check for node_modules
        const hasNodeModules = fs.existsSync(path.join(projectDir, 'node_modules'));

        if (json) {
            const output = {
                type: 'project',
                directory: projectDir,
                manifest,
                compiled: hasBinary,
                binaryPath: hasBinary ? binaryPath : null,
                binarySize,
                hasSource: hasSrc,
                hasNodeModules,
            };
            this.logger.log(JSON.stringify(output, null, 2));
            return;
        }

        this.logger.info('\nOPNet Plugin Project\n');
        this.logger.log('─'.repeat(60));

        this.logger.log(`Directory:      ${projectDir}`);
        this.logger.log('');

        this.logger.log('Plugin:');
        this.logger.log(`  Name:           ${manifest.name}`);
        this.logger.log(`  Version:        ${manifest.version}`);
        this.logger.log(`  Type:           ${manifest.pluginType}`);
        this.logger.log(`  OPNet:          ${manifest.opnetVersion}`);
        if (manifest.description) {
            this.logger.log(`  Description:    ${manifest.description}`);
        }
        this.logger.log('');

        this.logger.log('Author:');
        this.logger.log(`  Name:           ${manifest.author.name}`);
        if (manifest.author.email) {
            this.logger.log(`  Email:          ${manifest.author.email}`);
        }
        this.logger.log('');

        this.logger.log('Status:');
        this.logger.log(`  Source:         ${hasSrc ? 'Found' : 'Missing'}`);
        this.logger.log(`  Dependencies:   ${hasNodeModules ? 'Installed' : 'Not installed'}`);
        this.logger.log(
            `  Compiled:       ${hasBinary && binarySize !== null ? `Yes (${formatFileSize(binarySize)})` : 'No'}`,
        );
        this.logger.log('');

        this.logger.log('Permissions:');
        this.displayPermissions(manifest.permissions);
        this.logger.log('');

        if (manifest.resources) {
            this.logger.log('Resources:');
            if (manifest.resources.memory) {
                this.logger.log(
                    `  Max Heap:       ${manifest.resources.memory.maxHeapMB ?? 'N/A'} MB`,
                );
            }
            if (manifest.resources.cpu) {
                this.logger.log(`  Max Threads:    ${manifest.resources.cpu.maxThreads ?? 'N/A'}`);
                this.logger.log(`  Priority:       ${manifest.resources.cpu.priority ?? 'normal'}`);
            }
            if (manifest.resources.timeout) {
                this.logger.log(
                    `  Init Timeout:   ${manifest.resources.timeout.initMs ?? 'N/A'} ms`,
                );
                this.logger.log(
                    `  Hook Timeout:   ${manifest.resources.timeout.hookMs ?? 'N/A'} ms`,
                );
            }
            this.logger.log('');
        }

        if (Object.keys(manifest.dependencies || {}).length > 0) {
            this.logger.log('Plugin Dependencies:');
            for (const [name, version] of Object.entries(manifest.dependencies || {})) {
                this.logger.log(`  ${name}: ${version}`);
            }
            this.logger.log('');
        }

        if (manifest.lifecycle) {
            this.logger.log('Lifecycle:');
            this.logger.log(`  Load Priority:  ${manifest.lifecycle.loadPriority ?? 100}`);
            this.logger.log(
                `  Enabled:        ${manifest.lifecycle.enabledByDefault !== false ? 'Yes' : 'No'}`,
            );
            this.logger.log(
                `  Requires Restart: ${manifest.lifecycle.requiresRestart ? 'Yes' : 'No'}`,
            );
            this.logger.log('');
        }
    }

    private displayPermissions(permissions?: IPluginPermissions): void {
        if (!permissions) {
            this.logger.log('  (none configured)');
            return;
        }
        const db = permissions.database?.enabled ?? false;
        const blocks =
            permissions.blocks?.preProcess ||
            permissions.blocks?.postProcess ||
            permissions.blocks?.onChange ||
            false;
        const epochs = permissions.epochs?.onChange || permissions.epochs?.onFinalized || false;
        const mempool = permissions.mempool?.txFeed ?? false;
        const api = permissions.api?.addEndpoints || permissions.api?.addWebsocket || false;
        const fsPerms =
            permissions.filesystem?.configDir || permissions.filesystem?.tempDir || false;

        this.logger.log(`  Database:       ${db ? 'Yes' : 'No'}`);
        this.logger.log(`  Block Hooks:    ${blocks ? 'Yes' : 'No'}`);
        this.logger.log(`  Epoch Hooks:    ${epochs ? 'Yes' : 'No'}`);
        this.logger.log(`  Mempool Feed:   ${mempool ? 'Yes' : 'No'}`);
        this.logger.log(`  API Endpoints:  ${api ? 'Yes' : 'No'}`);
        this.logger.log(`  Filesystem:     ${fsPerms ? 'Yes' : 'No'}`);
    }
}

export const infoCommand = new InfoCommand().getCommand();
