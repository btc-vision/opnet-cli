/**
 * Transfer command - Initiate ownership transfer
 *
 * @module commands/TransferCommand
 */

import { confirm, input } from '@inquirer/prompts';
import { BaseCommand } from './BaseCommand.js';
import {
    getPackage,
    getPendingScopeTransfer,
    getPendingTransfer,
    getScope,
} from '../lib/registry.js';
import { canSign, loadCredentials } from '../lib/credentials.js';
import { CLIWallet } from '../lib/wallet.js';
import { NetworkName } from '../types/index.js';

interface TransferOptions {
    network: string;
    yes?: boolean;
    cancel?: boolean;
}

export class TransferCommand extends BaseCommand {
    constructor() {
        super('transfer', 'Initiate ownership transfer of a package or scope');
    }

    protected configure(): void {
        this.command
            .argument('<name>', 'Package name or @scope')
            .argument('[newOwner]', 'New owner address')
            .option('-n, --network <network>', 'Network', 'mainnet')
            .option('-y, --yes', 'Skip confirmation')
            .option('--cancel', 'Cancel pending transfer')
            .action((name: string, newOwner?: string, options?: TransferOptions) =>
                this.execute(name, newOwner, options || { network: 'mainnet' }),
            );
    }

    private async execute(
        name: string,
        newOwner?: string,
        options?: TransferOptions,
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

            const network = (options?.network || 'mainnet') as NetworkName;
            const isScope = name.startsWith('@') && !name.includes('/');
            const displayName = isScope ? name : `package ${name}`;

            if (options?.cancel) {
                await this.handleCancel(name, isScope, network, options);
                return;
            }

            // Initiate transfer
            let targetOwner = newOwner;
            if (!targetOwner) {
                targetOwner = await input({
                    message: 'New owner address:',
                    validate: (value) => {
                        if (!value || value.length < 20) {
                            return 'Please enter a valid address';
                        }
                        return true;
                    },
                });
            }

            // Verify target exists
            this.logger.info(`Checking ${displayName}...`);

            if (isScope) {
                const scopeName = name.substring(1);
                const scopeInfo = await getScope(scopeName, network);
                if (!scopeInfo) {
                    this.logger.fail('Scope not found');
                    this.logger.error(`Scope "${name}" does not exist.`);
                    process.exit(1);
                }
                this.logger.success(`Found scope ${name}`);
            } else {
                const packageInfo = await getPackage(name, network);
                if (!packageInfo) {
                    this.logger.fail('Package not found');
                    this.logger.error(`Package "${name}" does not exist.`);
                    process.exit(1);
                }
                this.logger.success(`Found package ${name}`);
            }

            // Display summary
            this.logger.log('');
            this.logger.info('Transfer Summary');
            this.logger.log('─'.repeat(50));
            this.logger.log(`Type:       ${isScope ? 'Scope' : 'Package'}`);
            this.logger.log(`Name:       ${name}`);
            this.logger.log(`New Owner: ${targetOwner}`);
            this.logger.log(`Network:    ${options?.network}`);
            this.logger.log('');

            this.logger.warn(
                'Note: The new owner must call `opnet accept` to complete the transfer.',
            );
            this.logger.log('');

            // Confirmation
            if (!options?.yes) {
                const confirmed = await confirm({
                    message: `Initiate transfer of ${displayName}?`,
                    default: false,
                });

                if (!confirmed) {
                    this.logger.warn('Transfer cancelled.');
                    return;
                }
            }

            // Execute transfer
            this.logger.info('Initiating transfer...');

            if (isScope) {
                const scopeName = name.substring(1);
                this.logger.warn('Transfer transaction required.');
                this.logger.log('Transaction would call: initiateScopeTransfer(');
                this.logger.log(`  scopeName: "${scopeName}",`);
                this.logger.log(`  newOwner: "${targetOwner}"`);
                this.logger.log(')');
            } else {
                this.logger.warn('Transfer transaction required.');
                this.logger.log('Transaction would call: initiateTransfer(');
                this.logger.log(`  packageName: "${name}",`);
                this.logger.log(`  newOwner: "${targetOwner}"`);
                this.logger.log(')');
            }
            this.logger.info('Transfer (transaction pending)');

            this.logger.log('');
            this.logger.success('Transfer initiated!');
            this.logger.warn('Note: Registry transaction support is coming soon.');
            this.logger.log('');
        } catch (error) {
            this.logger.fail('Transfer failed');
            if (this.isUserCancelled(error)) {
                this.logger.warn('Transfer cancelled.');
                process.exit(0);
            }
            this.exitWithError(this.formatError(error));
        }
    }

    private async handleCancel(
        name: string,
        isScope: boolean,
        network: NetworkName,
        options: TransferOptions,
    ): Promise<void> {
        this.logger.info('Checking pending transfer...');

        if (isScope) {
            const scopeName = name.substring(1);
            const pending = await getPendingScopeTransfer(scopeName, network);
            if (!pending) {
                this.logger.warn('No pending transfer');
                this.logger.log(`No pending transfer for ${name}.`);
                return;
            }
            this.logger.success(`Found pending transfer to ${pending.pendingOwner}`);

            if (!options?.yes) {
                const confirmed = await confirm({
                    message: `Cancel ownership transfer of ${name}?`,
                    default: true,
                });
                if (!confirmed) {
                    this.logger.warn('Cancelled.');
                    return;
                }
            }

            this.logger.info('Cancelling transfer...');
            this.logger.warn('Cancellation transaction required.');
            this.logger.log('Transaction would call: cancelScopeTransfer(');
            this.logger.log(`  scopeName: "${scopeName}"`);
            this.logger.log(')');
            this.logger.info('Cancellation (transaction pending)');
        } else {
            const pending = await getPendingTransfer(name, network);
            if (!pending) {
                this.logger.warn('No pending transfer');
                this.logger.log(`No pending transfer for ${name}.`);
                return;
            }
            this.logger.success(`Found pending transfer to ${pending.pendingOwner}`);

            if (!options?.yes) {
                const confirmed = await confirm({
                    message: `Cancel ownership transfer of ${name}?`,
                    default: true,
                });
                if (!confirmed) {
                    this.logger.warn('Cancelled.');
                    return;
                }
            }

            this.logger.info('Cancelling transfer...');
            this.logger.warn('Cancellation transaction required.');
            this.logger.log('Transaction would call: cancelTransfer(');
            this.logger.log(`  packageName: "${name}"`);
            this.logger.log(')');
            this.logger.info('Cancellation (transaction pending)');
        }

        this.logger.log('');
        this.logger.success('Transfer cancellation submitted!');
        this.logger.warn('Note: Registry transaction support is coming soon.');
        this.logger.log('');
    }
}

export const transferCommand = new TransferCommand().getCommand();
