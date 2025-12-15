/**
 * Deprecate command - Mark a package version as deprecated
 *
 * @module commands/DeprecateCommand
 */

import { input, confirm } from '@inquirer/prompts';
import { BaseCommand } from './BaseCommand.js';
import { getPackage, getVersion, isVersionImmutable } from '../lib/registry.js';
import { loadCredentials, canSign } from '../lib/credentials.js';
import { CLIWallet } from '../lib/wallet.js';
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
            CLIWallet.fromCredentials(credentials);
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
                console.log(`Version ${targetVersion} is already deprecated.`);
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
            console.log('');
            this.logger.info('Deprecation Summary');
            console.log('─'.repeat(50));
            console.log(`Package:  ${packageName}`);
            console.log(`Version:  ${targetVersion}`);
            console.log(`Reason:   ${message}`);
            console.log(`Network:  ${options?.network}`);
            console.log('');

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

            // Execute deprecation
            this.logger.info('Deprecating version...');
            this.logger.warn('Deprecation transaction required.');
            console.log('Transaction would call: deprecateVersion(');
            console.log(`  packageName: "${packageName}",`);
            console.log(`  version: "${targetVersion}",`);
            console.log(`  reason: "${message}"`);
            console.log(')');
            this.logger.info('Deprecation (transaction pending)');

            console.log('');
            this.logger.success('Deprecation submitted!');
            this.logger.warn('Note: Registry transaction support is coming soon.');
            console.log('');
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
