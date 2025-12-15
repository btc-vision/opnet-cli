/**
 * Info command - Display plugin or .opnet file information
 *
 * @module commands/info
 */

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { parseOpnetBinary, formatFileSize } from '../lib/binary.js';
import { loadManifest, getManifestPath } from '../lib/manifest.js';
import { MLDSALevel } from '../types/index.js';

export const infoCommand = new Command('info')
    .description('Display information about a plugin or .opnet file')
    .argument('[path]', 'Path to plugin directory or .opnet file (default: current directory)')
    .option('--json', 'Output as JSON')
    .action(async (inputPath?: string, options?: { json?: boolean }) => {
        try {
            const targetPath = inputPath ? path.resolve(inputPath) : process.cwd();

            if (!fs.existsSync(targetPath)) {
                console.error(chalk.red(`Path not found: ${targetPath}`));
                process.exit(1);
            }

            const stat = fs.statSync(targetPath);

            if (stat.isFile() && targetPath.endsWith('.opnet')) {
                // Display .opnet binary info
                await displayBinaryInfo(targetPath, options?.json);
            } else if (stat.isDirectory()) {
                // Display plugin project info
                await displayProjectInfo(targetPath, options?.json);
            } else if (stat.isFile() && targetPath.endsWith('plugin.json')) {
                // Display manifest info
                await displayProjectInfo(path.dirname(targetPath), options?.json);
            } else {
                console.error(chalk.red('Invalid path. Provide a plugin directory or .opnet file.'));
                process.exit(1);
            }

        } catch (error) {
            console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
            process.exit(1);
        }
    });

async function displayBinaryInfo(filePath: string, json?: boolean): Promise<void> {
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

    console.log(chalk.cyan('\nOPNet Binary Information\n'));
    console.log(chalk.dim('─'.repeat(60)));

    console.log(`${chalk.bold('File:')}            ${filePath}`);
    console.log(`${chalk.bold('Size:')}            ${formatFileSize(data.length)}`);
    console.log(`${chalk.bold('Format:')}          v${parsed.formatVersion}`);
    console.log('');

    console.log(chalk.bold('Plugin:'));
    console.log(`  Name:           ${meta.name}`);
    console.log(`  Version:        ${meta.version}`);
    console.log(`  Type:           ${meta.pluginType}`);
    console.log(`  OPNet:          ${meta.opnetVersion}`);
    if (meta.description) {
        console.log(`  Description:    ${meta.description}`);
    }
    console.log('');

    console.log(chalk.bold('Author:'));
    console.log(`  Name:           ${meta.author.name}`);
    if (meta.author.email) {
        console.log(`  Email:          ${meta.author.email}`);
    }
    console.log('');

    console.log(chalk.bold('Cryptography:'));
    console.log(`  MLDSA Level:    MLDSA-${mldsaLevel}`);
    console.log(`  Signed:         ${isUnsigned ? chalk.yellow('No') : chalk.green('Yes')}`);
    if (!isUnsigned) {
        console.log(`  Publisher:      ${publicKeyHash.substring(0, 32)}...`);
    }
    console.log('');

    console.log(chalk.bold('Sizes:'));
    console.log(`  Bytecode:       ${formatFileSize(parsed.bytecode.length)}`);
    console.log(`  Metadata:       ${formatFileSize(Buffer.from(parsed.metadata).length)}`);
    console.log(`  Proto:          ${formatFileSize(parsed.proto.length)}`);
    console.log('');

    console.log(chalk.bold('Permissions:'));
    displayPermissions(meta.permissions);
    console.log('');

    if (Object.keys(meta.dependencies || {}).length > 0) {
        console.log(chalk.bold('Dependencies:'));
        for (const [name, version] of Object.entries(meta.dependencies || {})) {
            console.log(`  ${name}: ${version}`);
        }
        console.log('');
    }
}

async function displayProjectInfo(projectDir: string, json?: boolean): Promise<void> {
    const manifestPath = getManifestPath(projectDir);

    if (!fs.existsSync(manifestPath)) {
        console.error(chalk.red('No plugin.json found in this directory.'));
        console.error(chalk.dim('Run `opnet init` to create a new plugin project.'));
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

    console.log(chalk.cyan('\nOPNet Plugin Project\n'));
    console.log(chalk.dim('─'.repeat(60)));

    console.log(`${chalk.bold('Directory:')}      ${projectDir}`);
    console.log('');

    console.log(chalk.bold('Plugin:'));
    console.log(`  Name:           ${manifest.name}`);
    console.log(`  Version:        ${manifest.version}`);
    console.log(`  Type:           ${manifest.pluginType}`);
    console.log(`  OPNet:          ${manifest.opnetVersion}`);
    if (manifest.description) {
        console.log(`  Description:    ${manifest.description}`);
    }
    console.log('');

    console.log(chalk.bold('Author:'));
    console.log(`  Name:           ${manifest.author.name}`);
    if (manifest.author.email) {
        console.log(`  Email:          ${manifest.author.email}`);
    }
    console.log('');

    console.log(chalk.bold('Status:'));
    console.log(`  Source:         ${hasSrc ? chalk.green('Found') : chalk.red('Missing')}`);
    console.log(`  Dependencies:   ${hasNodeModules ? chalk.green('Installed') : chalk.yellow('Not installed')}`);
    console.log(`  Compiled:       ${hasBinary ? chalk.green(`Yes (${formatFileSize(binarySize!)})`) : chalk.yellow('No')}`);
    console.log('');

    console.log(chalk.bold('Permissions:'));
    displayPermissions(manifest.permissions);
    console.log('');

    console.log(chalk.bold('Resources:'));
    console.log(`  Max Memory:     ${manifest.resources.maxMemoryMB} MB`);
    console.log(`  Max CPU:        ${manifest.resources.maxCpuPercent}%`);
    console.log(`  Max Storage:    ${manifest.resources.maxStorageMB} MB`);
    console.log('');

    if (Object.keys(manifest.dependencies || {}).length > 0) {
        console.log(chalk.bold('Plugin Dependencies:'));
        for (const [name, version] of Object.entries(manifest.dependencies || {})) {
            console.log(`  ${name}: ${version}`);
        }
        console.log('');
    }

    console.log(chalk.bold('Lifecycle:'));
    console.log(`  Auto Start:     ${manifest.lifecycle.autoStart ? 'Yes' : 'No'}`);
    console.log(`  Restart:        ${manifest.lifecycle.restartOnCrash ? 'Yes' : 'No'}`);
    console.log(`  Max Restarts:   ${manifest.lifecycle.maxRestarts}`);
    console.log('');
}

function displayPermissions(permissions: {
    database: { enabled: boolean; collections: string[] };
    blocks: { preProcess: boolean; postProcess: boolean; onChange: boolean };
    epochs: { onChange: boolean; onFinalized: boolean };
    mempool: { txFeed: boolean };
    api: { addEndpoints: boolean; addWebsocket: boolean };
    filesystem: { configDir: boolean; tempDir: boolean };
}): void {
    const db = permissions.database.enabled;
    const blocks = permissions.blocks.preProcess || permissions.blocks.postProcess || permissions.blocks.onChange;
    const epochs = permissions.epochs.onChange || permissions.epochs.onFinalized;
    const mempool = permissions.mempool.txFeed;
    const api = permissions.api.addEndpoints || permissions.api.addWebsocket;
    const fs = permissions.filesystem.configDir || permissions.filesystem.tempDir;

    console.log(`  Database:       ${db ? chalk.green('Yes') : chalk.dim('No')}`);
    console.log(`  Block Hooks:    ${blocks ? chalk.green('Yes') : chalk.dim('No')}`);
    console.log(`  Epoch Hooks:    ${epochs ? chalk.green('Yes') : chalk.dim('No')}`);
    console.log(`  Mempool Feed:   ${mempool ? chalk.green('Yes') : chalk.dim('No')}`);
    console.log(`  API Endpoints:  ${api ? chalk.green('Yes') : chalk.dim('No')}`);
    console.log(`  Filesystem:     ${fs ? chalk.green('Yes') : chalk.dim('No')}`);
}
