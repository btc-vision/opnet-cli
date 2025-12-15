/**
 * Update command - Update installed plugins
 *
 * @module commands/UpdateCommand
 */

import * as fs from 'fs';
import * as path from 'path';
import { BaseCommand } from './BaseCommand.js';
import { parseOpnetBinary, formatFileSize, verifyChecksum } from '../lib/binary.js';
import { getPackage, getVersion } from '../lib/registry.js';
import { fetchFromIPFS } from '../lib/ipfs.js';
import { CLIWallet } from '../lib/wallet.js';
import { NetworkName } from '../types/index.js';

interface UpdateOptions {
    dir?: string;
    network: string;
    skipVerify?: boolean;
}

interface UpdateInfo {
    file: string;
    name: string;
    currentVersion: string;
    latestVersion: string;
    cid: string;
}

export class UpdateCommand extends BaseCommand {
    constructor() {
        super('update', 'Update installed plugins to latest versions');
    }

    protected configure(): void {
        this.command
            .argument('[package]', 'Specific package to update (default: all)')
            .option('-d, --dir <path>', 'Plugins directory (default: ./plugins/)')
            .option('-n, --network <network>', 'Network', 'mainnet')
            .option('--skip-verify', 'Skip signature verification')
            .action((packageName?: string, options?: UpdateOptions) =>
                this.execute(packageName, options || { network: 'mainnet' }),
            );
    }

    private async execute(packageName?: string, options?: UpdateOptions): Promise<void> {
        try {
            const pluginsDir = options?.dir || path.join(process.cwd(), 'plugins');

            if (!fs.existsSync(pluginsDir)) {
                this.logger.warn('No plugins directory found.');
                console.log(`Expected: ${pluginsDir}`);
                return;
            }

            // Find all .opnet files
            const files = fs.readdirSync(pluginsDir).filter((f) => f.endsWith('.opnet'));

            if (files.length === 0) {
                this.logger.warn('No plugins installed.');
                return;
            }

            const network = (options?.network || 'mainnet') as NetworkName;
            const updates: UpdateInfo[] = [];

            // Check for updates
            this.logger.info('\nChecking for updates...\n');

            for (const file of files) {
                const filePath = path.join(pluginsDir, file);

                try {
                    const data = fs.readFileSync(filePath);
                    const parsed = parseOpnetBinary(data);
                    const name = parsed.metadataObj.name;

                    // Filter by package name if specified
                    if (packageName && name !== packageName) {
                        continue;
                    }

                    this.logger.info(`Checking ${name}...`);

                    const packageInfo = await getPackage(name, network);
                    if (!packageInfo) {
                        this.logger.info(`${name}: not found in registry`);
                        continue;
                    }

                    const currentVersion = parsed.metadataObj.version;
                    const latestVersion = packageInfo.latestVersion;

                    if (currentVersion === latestVersion) {
                        this.logger.success(`${name}@${currentVersion}: up to date`);
                        continue;
                    }

                    // Get latest version info
                    const versionInfo = await getVersion(name, latestVersion, network);
                    if (!versionInfo) {
                        this.logger.warn(`${name}: latest version info unavailable`);
                        continue;
                    }

                    this.logger.info(`${name}: ${currentVersion} -> ${latestVersion}`);
                    updates.push({
                        file,
                        name,
                        currentVersion,
                        latestVersion,
                        cid: versionInfo.ipfsCid,
                    });
                } catch {
                    this.logger.warn(`${file}: failed to parse`);
                }
            }

            if (updates.length === 0) {
                console.log('');
                this.logger.success('All plugins are up to date!');
                return;
            }

            // Display updates
            console.log('');
            this.logger.info('Available Updates:');
            console.log('─'.repeat(60));
            for (const update of updates) {
                console.log(`  ${update.name}: ${update.currentVersion} -> ${update.latestVersion}`);
            }
            console.log('');

            // Perform updates
            for (const update of updates) {
                this.logger.info(`Updating ${update.name}...`);

                try {
                    // Download from IPFS
                    const result = await fetchFromIPFS(update.cid);

                    // Verify
                    const parsed = parseOpnetBinary(result.data);

                    if (!verifyChecksum(parsed)) {
                        this.logger.fail(`${update.name}: checksum failed`);
                        continue;
                    }

                    if (!options?.skipVerify) {
                        const isUnsigned = parsed.publicKey.every((b) => b === 0);
                        if (!isUnsigned) {
                            const mldsaLevel = ([44, 65, 87] as const)[parsed.mldsaLevel];
                            const signatureValid = CLIWallet.verifyMLDSA(
                                parsed.checksum,
                                parsed.signature,
                                parsed.publicKey,
                                mldsaLevel,
                            );

                            if (!signatureValid) {
                                this.logger.fail(`${update.name}: signature invalid`);
                                continue;
                            }
                        }
                    }

                    // Save updated plugin
                    const newFileName = `${update.name.replace(/^@/, '').replace(/\//g, '-')}-${update.latestVersion}.opnet`;
                    const newFilePath = path.join(pluginsDir, newFileName);

                    fs.writeFileSync(newFilePath, result.data);

                    // Remove old file if different
                    const oldFilePath = path.join(pluginsDir, update.file);
                    if (oldFilePath !== newFilePath && fs.existsSync(oldFilePath)) {
                        fs.unlinkSync(oldFilePath);
                    }

                    this.logger.success(`${update.name}: updated to ${update.latestVersion}`);
                } catch (error) {
                    this.logger.fail(
                        `${update.name}: ${error instanceof Error ? error.message : String(error)}`,
                    );
                }
            }

            console.log('');
            this.logger.success('Update complete!');
            console.log('');
        } catch (error) {
            this.logger.fail('Update failed');
            this.exitWithError(this.formatError(error));
        }
    }
}

export const updateCommand = new UpdateCommand().getCommand();
