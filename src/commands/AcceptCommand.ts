/**
 * Accept command - Accept ownership transfer
 *
 * @module commands/AcceptCommand
 */

import { confirm } from '@inquirer/prompts';
import { BaseCommand } from './BaseCommand.js';
import { getPendingScopeTransfer, getPendingTransfer } from '../lib/registry.js';
import { canSign, loadCredentials } from '../lib/credentials.js';
import { CLIWallet } from '../lib/wallet.js';
import { NetworkName } from '../types/index.js';

interface AcceptOptions {
    network: string;
    yes?: boolean;
}

export class AcceptCommand extends BaseCommand {
    constructor() {
        super('accept', 'Accept pending ownership transfer');
    }

    protected configure(): void {
        this.command
            .argument('<name>', 'Package name or @scope')
            .option('-n, --network <network>', 'Network', 'mainnet')
            .option('-y, --yes', 'Skip confirmation')
            .action((name: string, options?: AcceptOptions) =>
                this.execute(name, options || { network: 'mainnet' }),
            );
    }

    private async execute(name: string, options?: AcceptOptions): Promise<void> {
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

            // Check for pending transfer
            this.logger.info('Checking pending transfer...');

            if (isScope) {
                const scopeName = name.substring(1);
                const pending = await getPendingScopeTransfer(scopeName, network);

                if (!pending) {
                    this.logger.warn('No pending transfer');
                    this.logger.log(`No pending transfer for ${name}.`);
                    return;
                }

                this.logger.success('Found pending transfer');

                // Display summary
                this.logger.log('');
                this.logger.info('Accept Transfer');
                this.logger.log('─'.repeat(50));
                this.logger.log(`Type:     Scope`);
                this.logger.log(`Name:     ${name}`);
                this.logger.log(`Network:  ${options?.network}`);
                this.logger.log('');

                // Confirmation
                if (!options?.yes) {
                    const confirmed = await confirm({
                        message: `Accept ownership of ${name}?`,
                        default: true,
                    });

                    if (!confirmed) {
                        this.logger.warn('Transfer acceptance cancelled.');
                        return;
                    }
                }

                // Execute acceptance
                this.logger.info('Accepting transfer...');
                this.logger.warn('Acceptance transaction required.');
                this.logger.log('Transaction would call: acceptScopeTransfer(');
                this.logger.log(`  scopeName: "${scopeName}"`);
                this.logger.log(')');
            } else {
                const pending = await getPendingTransfer(name, network);

                if (!pending) {
                    this.logger.warn('No pending transfer');
                    this.logger.log(`No pending transfer for ${name}.`);
                    return;
                }

                this.logger.success('Found pending transfer');

                // Display summary
                this.logger.log('');
                this.logger.info('Accept Transfer');
                this.logger.log('─'.repeat(50));
                this.logger.log(`Type:     Package`);
                this.logger.log(`Name:     ${name}`);
                this.logger.log(`Network:  ${options?.network}`);
                this.logger.log('');

                // Confirmation
                if (!options?.yes) {
                    const confirmed = await confirm({
                        message: `Accept ownership of ${name}?`,
                        default: true,
                    });

                    if (!confirmed) {
                        this.logger.warn('Transfer acceptance cancelled.');
                        return;
                    }
                }

                // Execute acceptance
                this.logger.info('Accepting transfer...');
                this.logger.warn('Acceptance transaction required.');
                this.logger.log('Transaction would call: acceptTransfer(');
                this.logger.log(`  packageName: "${name}"`);
                this.logger.log(')');
            }

            this.logger.info('Acceptance (transaction pending)');

            this.logger.log('');
            this.logger.success('Transfer acceptance submitted!');
            this.logger.warn('Note: Registry transaction support is coming soon.');
            this.logger.log('');
        } catch (error) {
            this.logger.fail('Acceptance failed');
            if (this.isUserCancelled(error)) {
                this.logger.warn('Acceptance cancelled.');
                process.exit(0);
            }
            this.exitWithError(this.formatError(error));
        }
    }
}

export const acceptCommand = new AcceptCommand().getCommand();
