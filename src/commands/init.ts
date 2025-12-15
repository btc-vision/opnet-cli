/**
 * Init command - Initialize a new OPNet plugin project
 *
 * @module commands/init
 */

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { input, select, confirm } from '@inquirer/prompts';
import { validatePluginName } from '../lib/manifest.js';
import { getDefaultMldsaLevel } from '../lib/config.js';

export const initCommand = new Command('init')
    .description('Initialize a new OPNet plugin project')
    .argument('[name]', 'Plugin name')
    .option('-t, --template <type>', 'Template type (standalone, library)', 'standalone')
    .option('-y, --yes', 'Skip prompts and use defaults')
    .option('--force', 'Overwrite existing files')
    .action(async (name?: string, options?: {
        template: string;
        yes?: boolean;
        force?: boolean;
    }) => {
        try {
            let pluginName: string;
            let authorName: string;
            let authorEmail: string | undefined;
            let description: string | undefined;
            let pluginType: 'standalone' | 'library';

            if (options?.yes && name) {
                // Use defaults
                pluginName = name;
                authorName = 'Author';
                pluginType = options.template as 'standalone' | 'library';
            } else {
                // Interactive mode
                console.log(chalk.cyan('\nOPNet Plugin Initialization\n'));

                pluginName = name || await input({
                    message: 'Plugin name:',
                    default: path.basename(process.cwd()),
                    validate: (value) => {
                        const errors = validatePluginName(value);
                        if (errors.length > 0) {
                            return errors[0];
                        }
                        return true;
                    },
                });

                description = await input({
                    message: 'Description:',
                    default: '',
                });

                authorName = await input({
                    message: 'Author name:',
                    default: process.env.USER || 'Author',
                });

                authorEmail = await input({
                    message: 'Author email (optional):',
                    default: '',
                }) || undefined;

                pluginType = await select({
                    message: 'Plugin type:',
                    choices: [
                        {
                            name: 'Standalone',
                            value: 'standalone' as const,
                            description: 'Independent plugin that runs on its own',
                        },
                        {
                            name: 'Library',
                            value: 'library' as const,
                            description: 'Shared library used by other plugins',
                        },
                    ],
                    default: options?.template || 'standalone',
                });
            }

            // Validate plugin name
            const nameErrors = validatePluginName(pluginName);
            if (nameErrors.length > 0) {
                console.error(chalk.red(`Invalid plugin name: ${nameErrors.join(', ')}`));
                process.exit(1);
            }

            // Determine project directory
            const projectDir = process.cwd();
            const pluginJsonPath = path.join(projectDir, 'plugin.json');

            // Check if already initialized
            if (fs.existsSync(pluginJsonPath) && !options?.force) {
                const overwrite = await confirm({
                    message: 'plugin.json already exists. Overwrite?',
                    default: false,
                });
                if (!overwrite) {
                    console.log(chalk.yellow('Initialization cancelled.'));
                    return;
                }
            }

            // Create project structure
            console.log(chalk.dim('\nCreating project structure...'));

            // Create directories
            const dirs = ['src', 'dist', 'build', 'test'];
            for (const dir of dirs) {
                const dirPath = path.join(projectDir, dir);
                if (!fs.existsSync(dirPath)) {
                    fs.mkdirSync(dirPath, { recursive: true });
                }
            }

            // Create plugin.json
            const manifest = {
                name: pluginName,
                version: '1.0.0',
                opnetVersion: '^1.0.0',
                main: 'dist/index.jsc',
                target: 'bytenode',
                type: 'plugin',
                author: {
                    name: authorName,
                    email: authorEmail,
                },
                description: description || undefined,
                pluginType,
                permissions: {
                    database: {
                        enabled: false,
                        collections: [],
                    },
                    blocks: {
                        preProcess: false,
                        postProcess: false,
                        onChange: false,
                    },
                    epochs: {
                        onChange: false,
                        onFinalized: false,
                    },
                    mempool: {
                        txFeed: false,
                    },
                    api: {
                        addEndpoints: false,
                        addWebsocket: false,
                    },
                    filesystem: {
                        configDir: false,
                        tempDir: false,
                    },
                },
                resources: {
                    maxMemoryMB: 256,
                    maxCpuPercent: 25,
                    maxStorageMB: 100,
                },
                dependencies: {},
                lifecycle: {
                    autoStart: true,
                    restartOnCrash: true,
                    maxRestarts: 3,
                },
            };

            fs.writeFileSync(
                pluginJsonPath,
                JSON.stringify(manifest, null, 4),
            );
            console.log(chalk.green('  Created plugin.json'));

            // Create package.json
            const packageJsonPath = path.join(projectDir, 'package.json');
            if (!fs.existsSync(packageJsonPath) || options?.force) {
                const packageJson = {
                    name: pluginName,
                    version: '1.0.0',
                    description: description || `OPNet ${pluginType} plugin`,
                    type: 'module',
                    main: 'dist/index.js',
                    scripts: {
                        build: 'tsc',
                        compile: 'opnet compile',
                        verify: 'opnet verify',
                        lint: 'eslint src/',
                        test: 'jest',
                    },
                    author: authorEmail ? `${authorName} <${authorEmail}>` : authorName,
                    license: 'Apache-2.0',
                    dependencies: {
                        '@btc-vision/plugin-sdk': '^1.0.0',
                    },
                    devDependencies: {
                        '@types/node': '^22.0.0',
                        typescript: '^5.8.0',
                        '@btc-vision/cli': '^1.0.0',
                    },
                };

                fs.writeFileSync(
                    packageJsonPath,
                    JSON.stringify(packageJson, null, 4),
                );
                console.log(chalk.green('  Created package.json'));
            }

            // Create tsconfig.json
            const tsconfigPath = path.join(projectDir, 'tsconfig.json');
            if (!fs.existsSync(tsconfigPath) || options?.force) {
                const tsconfig = {
                    compilerOptions: {
                        target: 'ES2022',
                        module: 'NodeNext',
                        moduleResolution: 'NodeNext',
                        lib: ['ES2022'],
                        outDir: './dist',
                        rootDir: './src',
                        strict: true,
                        esModuleInterop: true,
                        skipLibCheck: true,
                        forceConsistentCasingInFileNames: true,
                        resolveJsonModule: true,
                        declaration: true,
                        declarationMap: true,
                        sourceMap: true,
                    },
                    include: ['src/**/*'],
                    exclude: ['node_modules', 'dist', 'build', 'test'],
                };

                fs.writeFileSync(
                    tsconfigPath,
                    JSON.stringify(tsconfig, null, 4),
                );
                console.log(chalk.green('  Created tsconfig.json'));
            }

            // Create src/index.ts
            const indexPath = path.join(projectDir, 'src', 'index.ts');
            if (!fs.existsSync(indexPath) || options?.force) {
                const indexContent = pluginType === 'standalone'
                    ? `/**
 * ${pluginName} - OPNet Standalone Plugin
 */

import { PluginBase, PluginContext } from '@btc-vision/plugin-sdk';

export default class ${toPascalCase(pluginName)}Plugin extends PluginBase {
    public readonly name = '${pluginName}';
    public readonly version = '1.0.0';

    public async onInitialize(context: PluginContext): Promise<void> {
        this.logger.info('Plugin initialized');
    }

    public async onStart(): Promise<void> {
        this.logger.info('Plugin started');
    }

    public async onStop(): Promise<void> {
        this.logger.info('Plugin stopped');
    }
}
`
                    : `/**
 * ${pluginName} - OPNet Library Plugin
 */

export * from './lib/index.js';
`;

                fs.writeFileSync(indexPath, indexContent);
                console.log(chalk.green('  Created src/index.ts'));
            }

            // Create lib directory for library type
            if (pluginType === 'library') {
                const libDir = path.join(projectDir, 'src', 'lib');
                if (!fs.existsSync(libDir)) {
                    fs.mkdirSync(libDir, { recursive: true });
                }

                const libIndexPath = path.join(libDir, 'index.ts');
                if (!fs.existsSync(libIndexPath) || options?.force) {
                    fs.writeFileSync(
                        libIndexPath,
                        `/**
 * ${pluginName} library exports
 */

export function hello(): string {
    return 'Hello from ${pluginName}!';
}
`,
                    );
                    console.log(chalk.green('  Created src/lib/index.ts'));
                }
            }

            // Create .gitignore
            const gitignorePath = path.join(projectDir, '.gitignore');
            if (!fs.existsSync(gitignorePath) || options?.force) {
                const gitignore = `# Dependencies
node_modules/

# Build outputs
dist/
build/
*.jsc
*.opnet

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Environment
.env
.env.local

# Logs
*.log
npm-debug.log*

# Test coverage
coverage/
`;

                fs.writeFileSync(gitignorePath, gitignore);
                console.log(chalk.green('  Created .gitignore'));
            }

            // Create README.md
            const readmePath = path.join(projectDir, 'README.md');
            if (!fs.existsSync(readmePath) || options?.force) {
                const readme = `# ${pluginName}

${description || `An OPNet ${pluginType} plugin.`}

## Installation

\`\`\`bash
npm install
\`\`\`

## Development

\`\`\`bash
# Build TypeScript
npm run build

# Compile to .opnet binary
npm run compile

# Verify the compiled binary
npm run verify
\`\`\`

## License

Apache-2.0
`;

                fs.writeFileSync(readmePath, readme);
                console.log(chalk.green('  Created README.md'));
            }

            console.log('');
            console.log(chalk.green('Plugin initialized successfully!'));
            console.log('');
            console.log('Next steps:');
            console.log(chalk.dim('  1. npm install'));
            console.log(chalk.dim('  2. Edit src/index.ts'));
            console.log(chalk.dim('  3. npm run build'));
            console.log(chalk.dim('  4. opnet compile'));
            console.log('');

        } catch (error) {
            if (error instanceof Error && error.message.includes('User force closed')) {
                console.log(chalk.yellow('\nInitialization cancelled.'));
                process.exit(0);
            }
            console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
            process.exit(1);
        }
    });

/**
 * Convert kebab-case to PascalCase
 */
function toPascalCase(str: string): string {
    return str
        .split(/[-_]/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('');
}
