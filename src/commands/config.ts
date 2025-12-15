/**
 * Config command - Manage CLI configuration
 *
 * @module commands/config
 */

import { Command } from 'commander';
import chalk from 'chalk';
import {
    loadConfig,
    saveConfig,
    getConfigValue,
    setConfigValue,
    displayConfig,
} from '../lib/config.js';

export const configCommand = new Command('config')
    .description('Manage CLI configuration')
    .addCommand(
        new Command('get')
            .description('Get a configuration value')
            .argument('[key]', 'Configuration key (dot notation, e.g., rpcUrls.mainnet)')
            .action((key?: string) => {
                if (!key) {
                    // Show all config
                    console.log(displayConfig());
                    return;
                }

                const value = getConfigValue(key);
                if (value === undefined) {
                    console.error(chalk.red(`Configuration key not found: ${key}`));
                    process.exit(1);
                }

                if (typeof value === 'object') {
                    console.log(JSON.stringify(value, null, 2));
                } else {
                    console.log(value);
                }
            }),
    )
    .addCommand(
        new Command('set')
            .description('Set a configuration value')
            .argument('<key>', 'Configuration key (dot notation)')
            .argument('<value>', 'Value to set')
            .action((key: string, value: string) => {
                // Try to parse as JSON for objects/arrays/numbers
                let parsedValue: unknown = value;
                try {
                    parsedValue = JSON.parse(value);
                } catch {
                    // Keep as string if not valid JSON
                }

                setConfigValue(key, parsedValue);
                console.log(chalk.green(`Set ${key} = ${JSON.stringify(parsedValue)}`));
            }),
    )
    .addCommand(
        new Command('list')
            .description('List all configuration values')
            .action(() => {
                console.log(displayConfig());
            }),
    )
    .addCommand(
        new Command('reset')
            .description('Reset configuration to defaults')
            .option('-y, --yes', 'Skip confirmation')
            .action((options: { yes?: boolean }) => {
                if (!options.yes) {
                    console.log(chalk.yellow('This will reset all configuration to defaults.'));
                    console.log('Use --yes to confirm.');
                    return;
                }

                const defaultConfig = {
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
                    defaultMldsaLevel: 44 as const,
                    indexerUrl: 'https://indexer.opnet.org',
                };

                saveConfig(defaultConfig);
                console.log(chalk.green('Configuration reset to defaults.'));
            }),
    )
    .addCommand(
        new Command('path')
            .description('Show configuration file path')
            .action(() => {
                const os = require('os');
                const path = require('path');
                console.log(path.join(os.homedir(), '.opnet', 'config.json'));
            }),
    );
