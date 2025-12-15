/**
 * Publish command - Publish plugin to the OPNet registry
 *
 * @module commands/PublishCommand
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { confirm } from '@inquirer/prompts';
import { BaseCommand } from './BaseCommand.js';
import { parseOpnetBinary, formatFileSize, verifyChecksum } from '../lib/binary.js';
import { CLIWallet } from '../lib/wallet.js';
import { loadCredentials, canSign } from '../lib/credentials.js';
import { uploadPlugin } from '../lib/ipfs.js';
import {
    getPackage,
    getScope,
    parsePackageName,
    computePermissionsHash,
    encodeDependencies,
    pluginTypeToRegistry,
    mldsaLevelToRegistry,
} from '../lib/registry.js';
import { MLDSALevel, NetworkName } from '../types/index.js';

interface PublishOptions {
    network: string;
    dryRun?: boolean;
    yes?: boolean;
}

export class PublishCommand extends BaseCommand {
    constructor() {
        super('publish', 'Publish a plugin to the OPNet registry');
    }

    protected configure(): void {
        this.command
            .argument('[file]', 'Path to .opnet file (default: ./build/<name>.opnet)')
            .option('-n, --network <network>', 'Network to publish to', 'mainnet')
            .option('--dry-run', 'Show what would be published without publishing')
            .option('-y, --yes', 'Skip confirmation prompts')
            .action((file?: string, options?: PublishOptions) =>
                this.execute(file, options || { network: 'mainnet' }),
            );
    }

    private async execute(file?: string, options?: PublishOptions): Promise<void> {
        try {
            // Find the .opnet file
            let binaryPath = file;
            if (!binaryPath) {
                const manifestPath = path.join(process.cwd(), 'plugin.json');
                if (fs.existsSync(manifestPath)) {
                    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
                    const name = manifest.name.replace(/^@/, '').replace(/\//g, '-');
                    binaryPath = path.join(process.cwd(), 'build', `${name}.opnet`);
                }
            }

            if (!binaryPath || !fs.existsSync(binaryPath)) {
                this.logger.fail('No .opnet file found.');
                this.logger.info('Run `opnet compile` first or specify the file path.');
                process.exit(1);
            }

            // Parse and validate binary
            this.logger.info('Parsing plugin binary...');
            const data = fs.readFileSync(binaryPath);
            const parsed = parseOpnetBinary(data);

            // Verify checksum
            if (!verifyChecksum(parsed)) {
                this.logger.fail('Checksum verification failed');
                this.logger.error('The binary appears to be corrupted.');
                process.exit(1);
            }

            // Check if signed
            const isUnsigned = parsed.publicKey.every((b) => b === 0);
            if (isUnsigned) {
                this.logger.fail('Binary is unsigned');
                this.logger.error('Cannot publish unsigned binaries.');
                this.logger.info('Run `opnet sign` to sign the binary.');
                process.exit(1);
            }

            const meta = parsed.metadataObj;
            const mldsaLevel = ([44, 65, 87] as const)[parsed.mldsaLevel] as MLDSALevel;
            this.logger.success(`Parsed: ${meta.name}@${meta.version}`);

            // Load wallet and verify ownership
            this.logger.info('Loading wallet...');
            const credentials = loadCredentials();
            if (!credentials || !canSign(credentials)) {
                this.logger.fail('No credentials configured');
                this.logger.warn('Run `opnet login` to configure your wallet.');
                process.exit(1);
            }

            const wallet = CLIWallet.fromCredentials(credentials);
            const walletPkHash = wallet.mldsaPublicKeyHash;
            const binaryPkHash = crypto.createHash('sha256').update(parsed.publicKey).digest('hex');

            if (walletPkHash !== binaryPkHash) {
                this.logger.fail('Wallet mismatch');
                this.logger.error('The binary was signed with a different key.');
                console.log(`Binary signer: ${binaryPkHash.substring(0, 32)}...`);
                console.log(`Your key:      ${walletPkHash.substring(0, 32)}...`);
                process.exit(1);
            }
            this.logger.success('Wallet verified');

            // Check registry status
            this.logger.info('Checking registry status...');
            const { scope, name } = parsePackageName(meta.name);
            const network = (options?.network || 'mainnet') as NetworkName;

            // Check if scoped package
            if (scope) {
                const scopeInfo = await getScope(scope, network);
                if (!scopeInfo) {
                    this.logger.fail(`Scope @${scope} is not registered`);
                    this.logger.warn(`Register the scope first with: opnet scope register ${scope}`);
                    process.exit(1);
                }
            }

            const packageInfo = await getPackage(meta.name, network);
            const isNewPackage = !packageInfo;
            this.logger.success(
                isNewPackage
                    ? 'New package registration'
                    : `Existing package (${packageInfo.versionCount} versions)`,
            );

            // Display summary
            console.log('');
            this.logger.info('Publishing Summary');
            console.log('─'.repeat(50));
            console.log(`Package:      ${meta.name}`);
            console.log(`Version:      ${meta.version}`);
            console.log(`Type:         ${meta.pluginType}`);
            console.log(`OPNet:        ${meta.opnetVersion}`);
            console.log(`Size:         ${formatFileSize(data.length)}`);
            console.log(`MLDSA Level:  ${mldsaLevel}`);
            console.log(`Network:      ${options?.network}`);
            console.log(`Status:       ${isNewPackage ? 'New package' : 'New version'}`);
            console.log('');

            if (options?.dryRun) {
                this.logger.warn('Dry run - no changes made.');
                return;
            }

            // Confirmation
            if (!options?.yes) {
                const confirmed = await confirm({
                    message: 'Publish this plugin?',
                    default: true,
                });

                if (!confirmed) {
                    this.logger.warn('Publishing cancelled.');
                    return;
                }
            }

            // Upload to IPFS
            this.logger.info('Uploading to IPFS...');
            const pinResult = await uploadPlugin(binaryPath);
            this.logger.success(`Uploaded to IPFS: ${pinResult.cid}`);

            // Prepare registry data
            const permissionsHash = computePermissionsHash(meta.permissions);
            const dependencies = encodeDependencies(meta.dependencies || {});

            // Register package if new
            if (isNewPackage) {
                this.logger.info('Registering package...');
                this.logger.warn('Package registration required.');
                console.log(`Transaction would call: registerPackage("${meta.name}")`);
                this.logger.info('Package registration (transaction pending)');
            }

            // Publish version
            this.logger.info('Publishing version...');
            this.logger.warn('Version publishing required.');
            console.log('Transaction would call: publishVersion(');
            console.log(`  packageName: "${meta.name}",`);
            console.log(`  version: "${meta.version}",`);
            console.log(`  ipfsCid: "${pinResult.cid}",`);
            console.log(`  checksum: <32 bytes>,`);
            console.log(`  signature: <${parsed.signature.length} bytes>,`);
            console.log(`  mldsaLevel: ${mldsaLevelToRegistry(mldsaLevel)},`);
            console.log(`  opnetVersionRange: "${meta.opnetVersion}",`);
            console.log(`  pluginType: ${pluginTypeToRegistry(meta.pluginType)},`);
            console.log(`  permissionsHash: <32 bytes>,`);
            console.log(`  dependencies: <${dependencies.length} bytes>`);
            console.log(')');
            this.logger.info('Version publishing (transaction pending)');

            console.log('');
            this.logger.success('Plugin uploaded successfully!');
            console.log('');
            console.log(`IPFS CID:  ${pinResult.cid}`);
            console.log(`Gateway:   https://ipfs.opnet.org/ipfs/${pinResult.cid}`);
            console.log('');
            this.logger.warn('Note: Registry transaction support is coming soon.');
            this.logger.warn('The binary has been uploaded to IPFS and is ready for registry submission.');
            console.log('');
        } catch (error) {
            this.logger.fail('Publishing failed');
            if (this.isUserCancelled(error)) {
                this.logger.warn('Publishing cancelled.');
                process.exit(0);
            }
            this.exitWithError(this.formatError(error));
        }
    }
}

export const publishCommand = new PublishCommand().getCommand();
