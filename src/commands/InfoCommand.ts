/**
 * Info command - Display plugin or .opnet file information
 *
 * @module commands/InfoCommand
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { BaseCommand } from './BaseCommand.js';
import { parseOpnetBinary, formatFileSize } from '../lib/binary.js';
import { loadManifest, getManifestPath } from '../lib/manifest.js';
import { MLDSALevel, PluginPermissions } from '../types/index.js';

interface InfoOptions {
    json?: boolean;
}

export class InfoCommand extends BaseCommand {
    constructor() {
        super('info', 'Display information about a plugin or .opnet file');
    }

    protected configure(): void {
        this.command
            .argument('[path]', 'Path to plugin directory or .opnet file (default: current directory)')
            .option('--json', 'Output as JSON')
            .action((inputPath?: string, options?: InfoOptions) => this.execute(inputPath, options));
    }

    private async execute(inputPath?: string, options?: InfoOptions): Promise<void> {
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
        const mldsaLevel = ([44, 65, 87] as const)[parsed.mldsaLevel] as MLDSALevel;

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
                metadata: parsed.metadataObj,
                sizes: {
                    metadata: Buffer.from(parsed.metadata).length,
                    bytecode: parsed.bytecode.length,
                    proto: parsed.proto.length,
                    publicKey: parsed.publicKey.length,
                    signature: parsed.signature.length,
                },
            };
            console.log(JSON.stringify(output, null, 2));
            return;
        }

        const meta = parsed.metadataObj;

        this.logger.info('\nOPNet Binary Information\n');
        console.log('─'.repeat(60));

        console.log(`File:            ${filePath}`);
        console.log(`Size:            ${formatFileSize(data.length)}`);
        console.log(`Format:          v${parsed.formatVersion}`);
        console.log('');

        console.log('Plugin:');
        console.log(`  Name:           ${meta.name}`);
        console.log(`  Version:        ${meta.version}`);
        console.log(`  Type:           ${meta.pluginType}`);
        console.log(`  OPNet:          ${meta.opnetVersion}`);
        if (meta.description) {
            console.log(`  Description:    ${meta.description}`);
        }
        console.log('');

        console.log('Author:');
        console.log(`  Name:           ${meta.author.name}`);
        if (meta.author.email) {
            console.log(`  Email:          ${meta.author.email}`);
        }
        console.log('');

        console.log('Cryptography:');
        console.log(`  MLDSA Level:    MLDSA-${mldsaLevel}`);
        console.log(`  Signed:         ${isUnsigned ? 'No' : 'Yes'}`);
        if (!isUnsigned) {
            console.log(`  Publisher:      ${publicKeyHash.substring(0, 32)}...`);
        }
        console.log('');

        console.log('Sizes:');
        console.log(`  Bytecode:       ${formatFileSize(parsed.bytecode.length)}`);
        console.log(`  Metadata:       ${formatFileSize(Buffer.from(parsed.metadata).length)}`);
        console.log(`  Proto:          ${formatFileSize(parsed.proto.length)}`);
        console.log('');

        console.log('Permissions:');
        this.displayPermissions(meta.permissions);
        console.log('');

        if (Object.keys(meta.dependencies || {}).length > 0) {
            console.log('Dependencies:');
            for (const [name, version] of Object.entries(meta.dependencies || {})) {
                console.log(`  ${name}: ${version}`);
            }
            console.log('');
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
            console.log(JSON.stringify(output, null, 2));
            return;
        }

        this.logger.info('\nOPNet Plugin Project\n');
        console.log('─'.repeat(60));

        console.log(`Directory:      ${projectDir}`);
        console.log('');

        console.log('Plugin:');
        console.log(`  Name:           ${manifest.name}`);
        console.log(`  Version:        ${manifest.version}`);
        console.log(`  Type:           ${manifest.pluginType}`);
        console.log(`  OPNet:          ${manifest.opnetVersion}`);
        if (manifest.description) {
            console.log(`  Description:    ${manifest.description}`);
        }
        console.log('');

        console.log('Author:');
        console.log(`  Name:           ${manifest.author.name}`);
        if (manifest.author.email) {
            console.log(`  Email:          ${manifest.author.email}`);
        }
        console.log('');

        console.log('Status:');
        console.log(`  Source:         ${hasSrc ? 'Found' : 'Missing'}`);
        console.log(`  Dependencies:   ${hasNodeModules ? 'Installed' : 'Not installed'}`);
        console.log(
            `  Compiled:       ${hasBinary ? `Yes (${formatFileSize(binarySize!)})` : 'No'}`,
        );
        console.log('');

        console.log('Permissions:');
        this.displayPermissions(manifest.permissions);
        console.log('');

        console.log('Resources:');
        console.log(`  Max Memory:     ${manifest.resources.maxMemoryMB} MB`);
        console.log(`  Max CPU:        ${manifest.resources.maxCpuPercent}%`);
        console.log(`  Max Storage:    ${manifest.resources.maxStorageMB} MB`);
        console.log('');

        if (Object.keys(manifest.dependencies || {}).length > 0) {
            console.log('Plugin Dependencies:');
            for (const [name, version] of Object.entries(manifest.dependencies || {})) {
                console.log(`  ${name}: ${version}`);
            }
            console.log('');
        }

        console.log('Lifecycle:');
        console.log(`  Auto Start:     ${manifest.lifecycle.autoStart ? 'Yes' : 'No'}`);
        console.log(`  Restart:        ${manifest.lifecycle.restartOnCrash ? 'Yes' : 'No'}`);
        console.log(`  Max Restarts:   ${manifest.lifecycle.maxRestarts}`);
        console.log('');
    }

    private displayPermissions(permissions: PluginPermissions): void {
        const db = permissions.database.enabled;
        const blocks =
            permissions.blocks.preProcess ||
            permissions.blocks.postProcess ||
            permissions.blocks.onChange;
        const epochs = permissions.epochs.onChange || permissions.epochs.onFinalized;
        const mempool = permissions.mempool.txFeed;
        const api = permissions.api.addEndpoints || permissions.api.addWebsocket;
        const fsPerms = permissions.filesystem.configDir || permissions.filesystem.tempDir;

        console.log(`  Database:       ${db ? 'Yes' : 'No'}`);
        console.log(`  Block Hooks:    ${blocks ? 'Yes' : 'No'}`);
        console.log(`  Epoch Hooks:    ${epochs ? 'Yes' : 'No'}`);
        console.log(`  Mempool Feed:   ${mempool ? 'Yes' : 'No'}`);
        console.log(`  API Endpoints:  ${api ? 'Yes' : 'No'}`);
        console.log(`  Filesystem:     ${fsPerms ? 'Yes' : 'No'}`);
    }
}

export const infoCommand = new InfoCommand().getCommand();
