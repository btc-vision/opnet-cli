/**
 * Logout command - Remove stored credentials
 *
 * @module commands/LogoutCommand
 */

import { confirm } from '@inquirer/prompts';
import { BaseCommand } from './BaseCommand.js';
import { deleteCredentials, hasCredentials, getCredentialSource } from '../lib/credentials.js';

interface LogoutOptions {
    yes?: boolean;
}

export class LogoutCommand extends BaseCommand {
    constructor() {
        super('logout', 'Remove stored wallet credentials');
    }

    protected configure(): void {
        this.command
            .option('-y, --yes', 'Skip confirmation prompt')
            .action((options: LogoutOptions) => this.execute(options));
    }

    private async execute(options: LogoutOptions): Promise<void> {
        try {
            if (!hasCredentials()) {
                this.logger.warn('No credentials found.');
                return;
            }

            const source = getCredentialSource();

            if (source.startsWith('environment')) {
                this.logger.warn(`Credentials are set via ${source}.`);
                this.logger.info('To remove them, unset the environment variables:');
                this.logger.info('  unset OPNET_MNEMONIC');
                this.logger.info('  unset OPNET_PRIVATE_KEY');
                this.logger.info('  unset OPNET_MLDSA_KEY');
                return;
            }

            if (!options.yes) {
                this.logger.warn('This will remove your stored credentials from:');
                this.logger.info(`  ${source}`);

                const confirmed = await confirm({
                    message: 'Are you sure you want to logout?',
                    default: false,
                });

                if (!confirmed) {
                    this.logger.warn('Logout cancelled.');
                    return;
                }
            }

            const deleted = deleteCredentials();

            if (deleted) {
                this.logger.success('Credentials removed successfully.');
            } else {
                this.logger.warn('No credentials file found to remove.');
            }

        } catch (error) {
            if (this.isUserCancelled(error)) {
                this.logger.warn('Logout cancelled.');
                process.exit(0);
            }
            this.exitWithError(this.formatError(error));
        }
    }
}

export const logoutCommand = new LogoutCommand().getCommand();
