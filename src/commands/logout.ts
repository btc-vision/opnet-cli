/**
 * Logout command - Remove stored credentials
 *
 * @module commands/logout
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { confirm } from '@inquirer/prompts';
import { deleteCredentials, hasCredentials, getCredentialSource } from '../lib/credentials.js';

export const logoutCommand = new Command('logout')
    .description('Remove stored wallet credentials')
    .option('-y, --yes', 'Skip confirmation prompt')
    .action(async (options: { yes?: boolean }) => {
        try {
            if (!hasCredentials()) {
                console.log(chalk.yellow('No credentials found.'));
                return;
            }

            const source = getCredentialSource();

            // Check if credentials are from environment
            if (source.startsWith('environment')) {
                console.log(chalk.yellow(`Credentials are set via ${source}.`));
                console.log(chalk.yellow('To remove them, unset the environment variables:'));
                console.log(chalk.dim('  unset OPNET_MNEMONIC'));
                console.log(chalk.dim('  unset OPNET_PRIVATE_KEY'));
                console.log(chalk.dim('  unset OPNET_MLDSA_KEY'));
                return;
            }

            // Confirmation
            if (!options.yes) {
                console.log(chalk.yellow('This will remove your stored credentials from:'));
                console.log(chalk.dim(`  ${source}`));

                const confirmed = await confirm({
                    message: 'Are you sure you want to logout?',
                    default: false,
                });

                if (!confirmed) {
                    console.log(chalk.yellow('Logout cancelled.'));
                    return;
                }
            }

            const deleted = deleteCredentials();

            if (deleted) {
                console.log(chalk.green('Credentials removed successfully.'));
            } else {
                console.log(chalk.yellow('No credentials file found to remove.'));
            }

        } catch (error) {
            if (error instanceof Error && error.message.includes('User force closed')) {
                console.log(chalk.yellow('\nLogout cancelled.'));
                process.exit(0);
            }
            console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
            process.exit(1);
        }
    });
