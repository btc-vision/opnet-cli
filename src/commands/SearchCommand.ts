/**
 * Search command - Search for plugins in the registry
 *
 * @module commands/SearchCommand
 */

import { BaseCommand } from './BaseCommand.js';
import {
    getPackage,
    getVersion,
    registryToMldsaLevel,
    registryToPluginType,
    VersionInfo,
} from '../lib/registry.js';
import { NetworkName } from '../types/index.js';

interface SearchOptions {
    network: string;
    json?: boolean;
}

export class SearchCommand extends BaseCommand {
    constructor() {
        super('search', 'Search for plugins in the registry');
    }

    protected configure(): void {
        this.command
            .argument('<query>', 'Package name or search query')
            .option('-n, --network <network>', 'Network', 'mainnet')
            .option('--json', 'Output as JSON')
            .action((query: string, options?: SearchOptions) =>
                this.execute(query, options || { network: 'mainnet' }),
            );
    }

    private async execute(query: string, options?: SearchOptions): Promise<void> {
        try {
            const network = (options?.network || 'mainnet') as NetworkName;

            // Direct package lookup
            this.logger.info(`Searching for "${query}"...`);

            const packageInfo = await getPackage(query, network);

            if (!packageInfo) {
                this.logger.fail('No results');

                if (options?.json) {
                    this.logger.log(JSON.stringify({ results: [], query }));
                } else {
                    this.logger.log('');
                    this.logger.warn(`No package found matching "${query}".`);
                    this.logger.log('');
                    this.logger.info('Tips:');
                    this.logger.info('  - For scoped packages, use @scope/name');
                    this.logger.info('  - Package names are case-sensitive');
                    this.logger.info('  - Try searching without the version');
                }
                return;
            }

            // Get latest version details
            let latestVersionInfo: VersionInfo | null = null;
            if (packageInfo.latestVersion) {
                latestVersionInfo = await getVersion(query, packageInfo.latestVersion, network);
            }

            this.logger.success('Package found');

            if (options?.json) {
                const output = {
                    results: [
                        {
                            name: query,
                            latestVersion: packageInfo.latestVersion,
                            versionCount: Number(packageInfo.versionCount),
                            createdAt: Number(packageInfo.createdAt),
                            owner: packageInfo.owner.toString(),
                            details: latestVersionInfo
                                ? {
                                      ipfsCid: latestVersionInfo.ipfsCid,
                                      mldsaLevel: registryToMldsaLevel(
                                          latestVersionInfo.mldsaLevel,
                                      ),
                                      pluginType: registryToPluginType(
                                          latestVersionInfo.pluginType,
                                      ),
                                      opnetVersion: latestVersionInfo.opnetVersionRange,
                                      deprecated: latestVersionInfo.deprecated,
                                      publishedAt: Number(latestVersionInfo.publishedAt),
                                  }
                                : null,
                        },
                    ],
                    query,
                };
                this.logger.log(JSON.stringify(output, null, 2));
                return;
            }

            // Display results
            this.logger.log('');
            this.logger.info('Package Information');
            this.logger.info('─'.repeat(60));
            this.logger.log('');
            this.logger.info(`Name:         ${query}`);
            this.logger.info(`Latest:       ${packageInfo.latestVersion || 'N/A'}`);
            this.logger.info(`Versions:     ${packageInfo.versionCount}`);
            this.logger.info(`Owner:        ${packageInfo.owner}`);

            if (latestVersionInfo) {
                this.logger.log('');
                this.logger.info('Latest Version Details:');
                this.logger.info(
                    `  Type:          ${registryToPluginType(latestVersionInfo.pluginType)}`,
                );
                this.logger.info(
                    `  MLDSA Level:   ${registryToMldsaLevel(latestVersionInfo.mldsaLevel)}`,
                );
                this.logger.info(`  OPNet Range:   ${latestVersionInfo.opnetVersionRange}`);
                this.logger.info(`  IPFS CID:      ${latestVersionInfo.ipfsCid}`);
                this.logger.info(`  Deprecated:    ${latestVersionInfo.deprecated ? 'Yes' : 'No'}`);

                this.logger.info(`  Published at:  Block ${latestVersionInfo.publishedAt}`);
            }

            this.logger.log('');
            this.logger.info('Install with:');
            this.logger.info(`  opnet install ${query}`);
            this.logger.info(`  opnet install ${query}@${packageInfo.latestVersion}`);
            this.logger.log('');
        } catch (error) {
            this.logger.fail('Search failed');
            this.exitWithError(this.formatError(error));
        }
    }
}

export const searchCommand = new SearchCommand().getCommand();
