/**
 * Install command - Download and verify plugins from registry
 *
 * @module commands/InstallCommand
 */

import * as fs from 'fs';
import * as path from 'path';
import { BaseCommand } from './BaseCommand.js';
import { getPackage, getVersion, registryToMldsaLevel } from '../lib/registry.js';
import { fetchFromIPFS, isValidCid } from '../lib/ipfs.js';
import { formatFileSize, parseOpnetBinary, verifyChecksum } from '../lib/binary.js';
import { CLIWallet } from '../lib/wallet.js';
import { NetworkName } from '../types/index.js';

interface InstallOptions {
    output?: string;
    network: string;
    skipVerify?: boolean;
}

export class InstallCommand extends BaseCommand {
    constructor() {
        super('install', 'Download and verify a plugin from the registry');
    }

    protected configure(): void {
        this.command
            .argument('<package>', 'Package name[@version] or IPFS CID')
            .option('-o, --output <path>', 'Output directory (default: ./plugins/)')
            .option('-n, --network <network>', 'Network', 'mainnet')
            .option('--skip-verify', 'Skip signature verification')
            .action((packageInput: string, options?: InstallOptions) =>
                this.execute(packageInput, options || { network: 'mainnet' }),
            );
    }

    private async execute(packageInput: string, options?: InstallOptions): Promise<void> {
        try {
            let cid: string;
            let packageName: string;
            let version: string;

            // Check if input is a CID
            if (isValidCid(packageInput)) {
                cid = packageInput;
                packageName = 'unknown';
                version = 'unknown';
                this.logger.info(`Installing from CID: ${cid}`);
            } else {
                // Parse package name and version
                const atIndex = packageInput.lastIndexOf('@');
                if (atIndex > 0 && !packageInput.startsWith('@')) {
                    packageName = packageInput.substring(0, atIndex);
                    version = packageInput.substring(atIndex + 1);
                } else if (packageInput.startsWith('@') && packageInput.indexOf('@', 1) > 0) {
                    const secondAt = packageInput.indexOf('@', 1);
                    packageName = packageInput.substring(0, secondAt);
                    version = packageInput.substring(secondAt + 1);
                } else {
                    packageName = packageInput;
                    version = 'latest';
                }

                // Fetch from registry
                this.logger.info(`Fetching ${packageName}...`);
                const network = (options?.network || 'mainnet') as NetworkName;

                const packageInfo = await getPackage(packageName, network);
                if (!packageInfo) {
                    this.logger.fail('Package not found');
                    this.logger.error(`Package "${packageName}" does not exist.`);
                    process.exit(1);
                }

                // Resolve version
                if (version === 'latest') {
                    version = packageInfo.latestVersion;
                }

                const versionInfo = await getVersion(packageName, version, network);
                if (!versionInfo) {
                    this.logger.fail('Version not found');
                    this.logger.error(`Version "${version}" does not exist.`);
                    process.exit(1);
                }

                if (versionInfo.deprecated) {
                    this.logger.warn(`Version ${version} is deprecated`);
                }

                cid = versionInfo.ipfsCid;
                this.logger.success(`Found: ${packageName}@${version}`);

                // Display info
                this.logger.log('');
                this.logger.log(`IPFS CID:    ${cid}`);
                this.logger.log(`MLDSA Level: ${registryToMldsaLevel(versionInfo.mldsaLevel)}`);
                this.logger.log(`Publisher:   ${versionInfo.publisher}`);
                this.logger.log('');
            }

            // Download from IPFS
            this.logger.info('Downloading from IPFS...');
            const result = await fetchFromIPFS(cid);
            this.logger.success(`Downloaded (${formatFileSize(result.size)})`);

            // Parse and verify
            this.logger.info('Verifying binary...');
            const parsed = parseOpnetBinary(result.data);

            // Verify checksum
            if (!verifyChecksum(parsed)) {
                this.logger.fail('Checksum verification failed');
                this.logger.error('The binary appears to be corrupted.');
                process.exit(1);
            }

            // Verify signature
            if (!options?.skipVerify) {
                const isUnsigned = parsed.publicKey.every((b) => b === 0);
                if (isUnsigned) {
                    this.logger.warn('Binary is unsigned');
                } else {
                    const actualMldsaLevel = ([44, 65, 87] as const)[parsed.mldsaLevel];
                    const signatureValid = CLIWallet.verifyMLDSA(
                        parsed.checksum,
                        parsed.signature,
                        parsed.publicKey,
                        actualMldsaLevel,
                    );

                    if (!signatureValid) {
                        this.logger.fail('Signature verification failed');
                        this.logger.error('The binary signature is invalid.');
                        process.exit(1);
                    }
                    this.logger.success('Signature verified');
                }
            } else {
                this.logger.warn('Skipping signature verification');
            }

            // Update package name from metadata
            if (packageName === 'unknown') {
                packageName = parsed.metadata.name;
                version = parsed.metadata.version;
            }

            // Determine output path
            const outputDir = options?.output || path.join(process.cwd(), 'plugins');
            fs.mkdirSync(outputDir, { recursive: true });

            const fileName = `${packageName.replace(/^@/, '').replace(/\//g, '-')}-${version}.opnet`;
            const outputPath = path.join(outputDir, fileName);

            // Save file
            this.logger.info('Saving plugin...');
            fs.writeFileSync(outputPath, result.data);
            this.logger.success('Plugin installed');

            // Summary
            this.logger.log('');
            this.logger.success('Plugin installed successfully!');
            this.logger.log('');
            this.logger.log(`Package:  ${parsed.metadata.name}`);
            this.logger.log(`Version:  ${parsed.metadata.version}`);
            this.logger.log(`Type:     ${parsed.metadata.pluginType}`);
            this.logger.log(`Size:     ${formatFileSize(result.size)}`);
            this.logger.log(`Output:   ${outputPath}`);
            this.logger.log('');
        } catch (error) {
            this.logger.fail('Installation failed');
            this.exitWithError(this.formatError(error));
        }
    }
}

export const installCommand = new InstallCommand().getCommand();
