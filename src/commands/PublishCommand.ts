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
import { formatFileSize, parseOpnetBinary, verifyChecksum } from '../lib/binary.js';
import { CLIWallet } from '../lib/wallet.js';
import { canSign, loadCredentials } from '../lib/credentials.js';
import { uploadPlugin } from '../lib/ipfs.js';
import {
    computePermissionsHash,
    encodeDependencies,
    getPackage,
    getRegistryContract,
    getScope,
    mldsaLevelToRegistry,
    parsePackageName,
    pluginTypeToRegistry,
} from '../lib/registry.js';
import {
    buildTransactionParams,
    checkBalance,
    DEFAULT_FEE_RATE,
    DEFAULT_MAX_SAT_TO_SPEND,
    formatSats,
    getWalletAddress,
    waitForTransactionConfirmation,
} from '../lib/transaction.js';
import { CLIMldsaLevel, NetworkName } from '../types/index.js';
import { PsbtOutputExtended, Satoshi } from '@btc-vision/bitcoin';
import { StrippedTransactionOutput, TransactionOutputFlags } from 'opnet';

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
                    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as {
                        name: string;
                    };
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

            const meta = parsed.metadata;
            const mldsaLevel = ([44, 65, 87] as const)[parsed.mldsaLevel] as CLIMldsaLevel;
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
                this.logger.log(`Binary signer: ${binaryPkHash.substring(0, 32)}...`);
                this.logger.log(`Your key:      ${walletPkHash.substring(0, 32)}...`);
                process.exit(1);
            }
            this.logger.success('Wallet verified');

            // Check registry status
            this.logger.info('Checking registry status...');
            const { scope } = parsePackageName(meta.name);
            const network = (options?.network || 'mainnet') as NetworkName;

            // Check if scoped package
            if (scope) {
                const scopeInfo = await getScope(scope, network);

                if (!scopeInfo) {
                    this.logger.fail(`Scope @${scope} is not registered`);
                    this.logger.warn(
                        `Register the scope first with: opnet scope register ${scope}`,
                    );
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
            this.logger.log('');
            this.logger.info('Publishing Summary');
            this.logger.log('─'.repeat(50));
            this.logger.log(`Package:      ${meta.name}`);
            this.logger.log(`Version:      ${meta.version}`);
            this.logger.log(`Type:         ${meta.pluginType}`);
            this.logger.log(`OPNet:        ${meta.opnetVersion}`);
            this.logger.log(`Size:         ${formatFileSize(data.length)}`);
            this.logger.log(`MLDSA Level:  ${mldsaLevel}`);
            this.logger.log(`Network:      ${options?.network}`);
            this.logger.log(`Status:       ${isNewPackage ? 'New package' : 'New version'}`);
            this.logger.log('');

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

            // Check wallet balance
            this.logger.info('Checking wallet balance...');
            const { sufficient, balance } = await checkBalance(wallet, network);
            if (!sufficient) {
                this.logger.fail('Insufficient balance');
                this.logger.error(`Wallet balance: ${formatSats(balance)}`);
                this.logger.error('Please fund your wallet before publishing.');
                process.exit(1);
            }
            this.logger.success(`Wallet balance: ${formatSats(balance)}`);

            // Get contract with sender for write operations
            const sender = getWalletAddress(wallet);
            const contract = getRegistryContract(network, sender);

            const treasuryAddress = await contract.getTreasuryAddress();

            const extraUtxo: PsbtOutputExtended = {
                address: treasuryAddress.properties.treasuryAddress,
                value: 10_000n as Satoshi,
            };

            let txParams = buildTransactionParams(
                wallet,
                network,
                DEFAULT_MAX_SAT_TO_SPEND,
                DEFAULT_FEE_RATE,
                extraUtxo,
            );

            // Register package if new
            if (isNewPackage) {
                this.logger.info('Registering new package...');

                const outSimulation: StrippedTransactionOutput[] = [
                    {
                        index: 1,
                        to: treasuryAddress.properties.treasuryAddress,
                        value: 10_000n,
                        flags: TransactionOutputFlags.hasTo,
                        scriptPubKey: undefined,
                    },
                ];

                contract.setTransactionDetails({
                    inputs: [],
                    outputs: outSimulation,
                });

                const registerResult = await contract.registerPackage(meta.name);
                if (registerResult.revert) {
                    this.logger.fail('Package registration would fail');
                    this.logger.error(`Reason: ${registerResult.revert}`);
                    process.exit(1);
                }

                if (registerResult.estimatedGas) {
                    this.logger.info(`Estimated gas: ${registerResult.estimatedGas} gas`);
                }

                const registerReceipt = await registerResult.sendTransaction(txParams);
                this.logger.success('Package registration transaction sent');
                this.logger.log(`Transaction ID: ${registerReceipt.transactionId}`);
                this.logger.log('');

                // Wait for registration transaction to be confirmed
                const confirmationResult = await waitForTransactionConfirmation(
                    registerReceipt.transactionId,
                    network,
                    {
                        message: 'Waiting for package registration to confirm',
                    },
                );

                if (!confirmationResult.confirmed) {
                    if (confirmationResult.revert) {
                        this.logger.fail('Package registration failed');
                        this.logger.error(`Reason: ${confirmationResult.revert}`);
                    } else if (confirmationResult.error) {
                        this.logger.fail('Package registration not confirmed');
                        this.logger.error(confirmationResult.error);
                    }
                    process.exit(1);
                }

                this.logger.log('');
            }

            txParams = buildTransactionParams(
                wallet,
                network,
                DEFAULT_MAX_SAT_TO_SPEND,
                DEFAULT_FEE_RATE,
            );

            // Publish version
            this.logger.info('Publishing version...');

            const publishResult = await contract.publishVersion(
                meta.name,
                meta.version,
                pinResult.cid,
                parsed.checksum,
                parsed.signature,
                mldsaLevelToRegistry(mldsaLevel),
                meta.opnetVersion,
                pluginTypeToRegistry(meta.pluginType),
                permissionsHash,
                dependencies,
            );

            if (publishResult.revert) {
                this.logger.fail('Version publishing would fail');
                this.logger.error(`Reason: ${publishResult.revert}`);
                process.exit(1);
            }

            if (publishResult.estimatedGas) {
                this.logger.info(`Estimated gas: ${publishResult.estimatedGas} gas`);
            }

            const publishReceipt = await publishResult.sendTransaction(txParams);

            this.logger.log('');
            this.logger.success('Plugin published successfully!');
            this.logger.log('');
            this.logger.log(`Package:        ${meta.name}`);
            this.logger.log(`Version:        ${meta.version}`);
            this.logger.log(`IPFS CID:       ${pinResult.cid}`);
            this.logger.log(`Transaction ID: ${publishReceipt.transactionId}`);
            this.logger.log(`Fees paid:      ${formatSats(publishReceipt.estimatedFees)}`);
            this.logger.log(`Gateway:        https://ipfs.opnet.org/ipfs/${pinResult.cid}`);
            this.logger.log('');
        } catch (error) {
            this.logger.fail(`Publishing failed`);
            if (this.isUserCancelled(error)) {
                this.logger.warn('Publishing cancelled.');
                process.exit(0);
            }
            this.exitWithError(this.formatError(error));
        }
    }
}

export const publishCommand = new PublishCommand().getCommand();
