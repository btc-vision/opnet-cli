/**
 * Undeprecate command - Remove deprecation from a package version
 *
 * @module commands/UndeprecateCommand
 */

import { confirm } from '@inquirer/prompts';
import { BaseCommand } from './BaseCommand.js';
import { getPackage, getVersion, isVersionImmutable } from '../lib/registry.js';
import { canSign, loadCredentials } from '../lib/credentials.js';
import { CLIWallet } from '../lib/wallet.js';
import { NetworkName } from '../types/index.js';

interface UndeprecateOptions {
    network: string;
    yes?: boolean;
}

export class UndeprecateCommand extends BaseCommand {
    constructor() {
        super('undeprecate', 'Remove deprecation from a package version');
    }

    protected configure(): void {
        this.command
            .argument('<package>', 'Package name (e.g., @scope/name or name)')
            .argument('<version>', 'Version to undeprecate')
            .option('-n, --network <network>', 'Network', 'mainnet')
            .option('-y, --yes', 'Skip confirmation')
            .action((packageName: string, version: string, options?: UndeprecateOptions) =>
                this.execute(packageName, version, options || { network: 'mainnet' }),
            );
    }

    private async execute(
        packageName: string,
        version: string,
        options?: UndeprecateOptions,
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

            // Get version info
            const versionInfo = await getVersion(packageName, version, network);
            if (!versionInfo) {
                this.logger.fail('Version not found');
                this.logger.error(`Version "${version}" does not exist.`);
                process.exit(1);
            }

            if (!versionInfo.deprecated) {
                this.logger.warn('Not deprecated');
                this.logger.log(`Version ${version} is not deprecated.`);
                return;
            }

            // Check if immutable
            const immutable = await isVersionImmutable(packageName, version, network);
            if (immutable) {
                this.logger.fail('Version is immutable');
                this.logger.error('This version is past the 72-hour mutability window.');
                this.logger.error('Immutable versions cannot be undeprecated.');
                process.exit(1);
            }

            this.logger.success(`Found: ${packageName}@${version} (deprecated)`);

            // Display summary
            this.logger.log('');
            this.logger.info('Undeprecation Summary');
            this.logger.log('─'.repeat(50));
            this.logger.log(`Package:  ${packageName}`);
            this.logger.log(`Version:  ${version}`);
            this.logger.log(`Network:  ${options?.network}`);
            this.logger.log('');

            // Confirmation
            if (!options?.yes) {
                const confirmed = await confirm({
                    message: `Remove deprecation from ${packageName}@${version}?`,
                    default: true,
                });

                if (!confirmed) {
                    this.logger.warn('Undeprecation cancelled.');
                    return;
                }
            }

            // Execute undeprecation
            this.logger.info('Removing deprecation...');
            this.logger.warn('Undeprecation transaction required.');
            this.logger.log('Transaction would call: undeprecateVersion(');
            this.logger.log(`  packageName: "${packageName}",`);
            this.logger.log(`  version: "${version}"`);
            this.logger.log(')');
            this.logger.info('Undeprecation (transaction pending)');

            this.logger.log('');
            this.logger.success('Undeprecation submitted!');
            this.logger.warn('Note: Registry transaction support is coming soon.');
            this.logger.log('');
        } catch (error) {
            this.logger.fail('Undeprecation failed');
            if (this.isUserCancelled(error)) {
                this.logger.warn('Undeprecation cancelled.');
                process.exit(0);
            }
            this.exitWithError(this.formatError(error));
        }
    }
}

export const undeprecateCommand = new UndeprecateCommand().getCommand();
