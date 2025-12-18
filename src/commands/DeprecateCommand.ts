/**
 * Deprecate command - Mark a package version as deprecated
 *
 * @module commands/DeprecateCommand
 */

import { confirm, input } from '@inquirer/prompts';
import { BaseCommand } from './BaseCommand.js';
import { getPackage, getRegistryContract, getVersion, isVersionImmutable, } from '../lib/registry.js';
import { canSign, loadCredentials } from '../lib/credentials.js';
import { CLIWallet } from '../lib/wallet.js';
import { buildTransactionParams, checkBalance, formatSats, getWalletAddress, } from '../lib/transaction.js';
import { NetworkName } from '../types/index.js';

interface DeprecateOptions {
    message?: string;
    network: string;
    yes?: boolean;
}

export class DeprecateCommand extends BaseCommand {
    constructor() {
        super('deprecate', 'Mark a package version as deprecated');
    }

    protected configure(): void {
        this.command
            .argument('<package>', 'Package name (e.g., @scope/name or name)')
            .argument('[version]', 'Version to deprecate (default: latest)')
            .option('-m, --message <message>', 'Deprecation reason/message')
            .option('-n, --network <network>', 'Network', 'mainnet')
            .option('-y, --yes', 'Skip confirmation')
            .action((packageName: string, version?: string, options?: DeprecateOptions) =>
                this.execute(packageName, version, options || { network: 'mainnet' }),
            );
    }

    private async execute(
        packageName: string,
        version?: string,
        options?: DeprecateOptions,
    ): Promise<void> {
        try {
            // Load credentials
            this.logger.info('Loading wallet...');
            const credentials = loadCredentials();
            if (!credentials || !canSign(credentials)) {
                this.logger.fail('No credentials configured');
                this.logger.warn('Run `opnet login` to configure your wallet.');
                process.exit(1);
            }
            const wallet = CLIWallet.fromCredentials(credentials);
            this.logger.success('Wallet loaded');

            // Get package info
            this.logger.info('Fetching package info...');
            const network = (options?.network || 'mainnet') as NetworkName;
            const packageInfo = await getPackage(packageName, network);

            if (!packageInfo) {
                this.logger.fail('Package not found');
                this.logger.error(`Package "${packageName}" does not exist.`);
                process.exit(1);
            }

            // Determine version
            const targetVersion = version || packageInfo.latestVersion;
            if (!targetVersion) {
                this.logger.fail('No version specified');
                this.logger.error('Package has no versions.');
                process.exit(1);
            }

            // Get version info
            const versionInfo = await getVersion(packageName, targetVersion, network);
            if (!versionInfo) {
                this.logger.fail('Version not found');
                this.logger.error(`Version "${targetVersion}" does not exist.`);
                process.exit(1);
            }

            if (versionInfo.deprecated) {
                this.logger.warn('Already deprecated');
                this.logger.log(`Version ${targetVersion} is already deprecated.`);
                return;
            }

            // Check if immutable
            const immutable = await isVersionImmutable(packageName, targetVersion, network);
            if (immutable) {
                this.logger.fail('Version is immutable');
                this.logger.error('This version is past the 72-hour mutability window.');
                this.logger.error('Immutable versions cannot be deprecated.');
                process.exit(1);
            }

            this.logger.success(`Found: ${packageName}@${targetVersion}`);

            // Get deprecation message
            let message = options?.message;
            if (!message && !options?.yes) {
                message = await input({
                    message: 'Deprecation reason (optional):',
                    default: '',
                });
            }
            message = message || 'No reason provided';

            // Display summary
            this.logger.log('');
            this.logger.info('Deprecation Summary');
            this.logger.log('─'.repeat(50));
            this.logger.log(`Package:  ${packageName}`);
            this.logger.log(`Version:  ${targetVersion}`);
            this.logger.log(`Reason:   ${message}`);
            this.logger.log(`Network:  ${options?.network}`);
            this.logger.log('');

            // Confirmation
            if (!options?.yes) {
                const confirmed = await confirm({
                    message: `Deprecate ${packageName}@${targetVersion}?`,
                    default: false,
                });

                if (!confirmed) {
                    this.logger.warn('Deprecation cancelled.');
                    return;
                }
            }

            // Check wallet balance
            this.logger.info('Checking wallet balance...');
            const { sufficient, balance } = await checkBalance(wallet, network);
            if (!sufficient) {
                this.logger.fail('Insufficient balance');
                this.logger.error(`Wallet balance: ${formatSats(balance)}`);
                this.logger.error('Please fund your wallet before deprecating.');
                process.exit(1);
            }
            this.logger.success(`Wallet balance: ${formatSats(balance)}`);

            // Execute deprecation
            this.logger.info('Deprecating version...');

            const sender = getWalletAddress(wallet);
            const contract = getRegistryContract(network, sender);
            const txParams = buildTransactionParams(wallet, network);

            const deprecateResult = await contract.deprecateVersion(
                packageName,
                targetVersion,
                message,
            );

            if (deprecateResult.revert) {
                this.logger.fail('Deprecation would fail');
                this.logger.error(`Reason: ${deprecateResult.revert}`);
                process.exit(1);
            }

            if (deprecateResult.estimatedGas) {
                this.logger.info(`Estimated gas: ${deprecateResult.estimatedGas} gas`);
            }

            const receipt = await deprecateResult.sendTransaction(txParams);

            this.logger.log('');
            this.logger.success('Version deprecated successfully!');
            this.logger.log('');
            this.logger.log(`Package:        ${packageName}`);
            this.logger.log(`Version:        ${targetVersion}`);
            this.logger.log(`Reason:         ${message}`);
            this.logger.log(`Transaction ID: ${receipt.transactionId}`);
            this.logger.log(`Fees paid:      ${formatSats(receipt.estimatedFees)}`);
            this.logger.log('');
        } catch (error) {
            this.logger.fail('Deprecation failed');
            if (this.isUserCancelled(error)) {
                this.logger.warn('Deprecation cancelled.');
                process.exit(0);
            }
            this.exitWithError(this.formatError(error));
        }
    }
}

export const deprecateCommand = new DeprecateCommand().getCommand();
