/**
 * Config command - Manage CLI configuration
 *
 * @module commands/ConfigCommand
 */

import { Command } from 'commander';
import * as os from 'os';
import * as path from 'path';
import { BaseCommand } from './BaseCommand.js';
import { displayConfig, getConfigValue, saveConfig, setConfigValue } from '../lib/config.js';
import { CLIConfig } from '../types/index.js';

export class ConfigCommand extends BaseCommand {
    constructor() {
        super('config', 'Manage CLI configuration');
    }

    protected configure(): void {
        this.command
            .addCommand(this.createGetCommand())
            .addCommand(this.createSetCommand())
            .addCommand(this.createListCommand())
            .addCommand(this.createResetCommand())
            .addCommand(this.createPathCommand());
    }

    private createGetCommand(): Command {
        return new Command('get')
            .description('Get a configuration value')
            .argument('[key]', 'Configuration key (dot notation, e.g., rpcUrls.mainnet)')
            .action((key?: string) => {
                this.handleGet(key);
            });
    }

    private createSetCommand(): Command {
        return new Command('set')
            .description('Set a configuration value')
            .argument('<key>', 'Configuration key (dot notation)')
            .argument('<value>', 'Value to set')
            .action((key: string, value: string) => {
                this.handleSet(key, value);
            });
    }

    private createListCommand(): Command {
        return new Command('list').description('List all configuration values').action(() => {
            this.handleList();
        });
    }

    private createResetCommand(): Command {
        return new Command('reset')
            .description('Reset configuration to defaults')
            .option('-y, --yes', 'Skip confirmation')
            .action((options: { yes?: boolean }) => {
                this.handleReset(options.yes);
            });
    }

    private createPathCommand(): Command {
        return new Command('path').description('Show configuration file path').action(() => {
            this.handlePath();
        });
    }

    private handleGet(key?: string): void {
        if (!key) {
            this.logger.log(displayConfig());
            return;
        }

        const value = getConfigValue(key);
        if (value === undefined) {
            this.exitWithError(`Configuration key not found: ${key}`);
        }

        if (typeof value === 'object') {
            this.logger.log(JSON.stringify(value, null, 2));
        } else {
            this.logger.log(String(value));
        }
    }

    private handleSet(key: string, value: string): void {
        let parsedValue: unknown = value;
        try {
            parsedValue = JSON.parse(value);
        } catch {
            // Keep as string if not valid JSON
        }

        setConfigValue(key, parsedValue);
        this.logger.success(`Set ${key} = ${JSON.stringify(parsedValue)}`);
    }

    private handleList(): void {
        this.logger.log(displayConfig());
    }

    private handleReset(confirmed?: boolean): void {
        if (!confirmed) {
            this.logger.warn('This will reset all configuration to defaults.');
            this.logger.info('Use --yes to confirm.');
            return;
        }

        const defaultConfig: CLIConfig = {
            defaultNetwork: 'mainnet',
            rpcUrls: {
                mainnet: 'https://api.opnet.org',
                testnet: 'https://testnet.opnet.org',
                regtest: 'http://localhost:9001',
            },
            ipfsGateway: 'https://ipfs.opnet.org/ipfs/',
            ipfsGateways: [
                'https://ipfs.opnet.org/ipfs/',
                'https://ipfs.io/ipfs/',
                'https://cloudflare-ipfs.com/ipfs/',
                'https://dweb.link/ipfs/',
            ],
            ipfsPinningEndpoint: 'https://ipfs.opnet.org/api/v0/add',
            ipfsPinningApiKey: '',
            ipfsPinningAuthHeader: 'Authorization',
            registryAddresses: {
                mainnet: '',
                testnet: '',
                regtest: '',
            },
            defaultMldsaLevel: 44,
            indexerUrl: 'https://indexer.opnet.org',
        };

        saveConfig(defaultConfig);
        this.logger.success('Configuration reset to defaults.');
    }

    private handlePath(): void {
        this.logger.log(path.join(os.homedir(), '.opnet', 'config.json'));
    }
}

export const configCommand = new ConfigCommand().getCommand();
