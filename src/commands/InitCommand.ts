/**
 * Init command - Initialize a new OPNet plugin project
 *
 * @module commands/InitCommand
 */

import * as fs from 'fs';
import * as path from 'path';
import { confirm, input, select } from '@inquirer/prompts';
import { BaseCommand } from './BaseCommand.js';
import { validatePluginName } from '../lib/manifest.js';

interface InitOptions {
    template: string;
    yes?: boolean;
    force?: boolean;
}

export class InitCommand extends BaseCommand {
    constructor() {
        super('init', 'Initialize a new OPNet plugin project');
    }

    protected configure(): void {
        this.command
            .argument('[name]', 'Plugin name')
            .option('-t, --template <type>', 'Template type (standalone, library)', 'standalone')
            .option('-y, --yes', 'Skip prompts and use defaults')
            .option('--force', 'Overwrite existing files')
            .action((name?: string, options?: InitOptions) => this.execute(name, options));
    }

    private async execute(name?: string, options?: InitOptions): Promise<void> {
        try {
            const config = await this.gatherConfig(name, options);
            await this.createProject(config, options?.force);

            this.logger.success('Plugin initialized successfully!');
            this.logger.log('');
            this.logger.log('Next steps:');
            this.logger.log('  1. npm install');
            this.logger.log('  2. Edit src/index.ts');
            this.logger.log('  3. npm run build');
            this.logger.log('  4. opnet compile');
            this.logger.log('');
        } catch (error) {
            if (this.isUserCancelled(error)) {
                this.logger.warn('Initialization cancelled.');
                process.exit(0);
            }
            this.exitWithError(this.formatError(error));
        }
    }

    private async gatherConfig(
        name?: string,
        options?: InitOptions,
    ): Promise<{
        pluginName: string;
        authorName: string;
        authorEmail?: string;
        description?: string;
        pluginType: 'standalone' | 'library';
    }> {
        if (options?.yes && name) {
            return {
                pluginName: name,
                authorName: 'Author',
                pluginType: (options.template as 'standalone' | 'library') || 'standalone',
            };
        }

        this.logger.info('\nOPNet Plugin Initialization\n');

        const pluginName =
            name ||
            (await input({
                message: 'Plugin name:',
                default: path.basename(process.cwd()),
                validate: (value) => {
                    const errors = validatePluginName(value);
                    return errors.length > 0 ? errors[0] : true;
                },
            }));

        const description = (await input({ message: 'Description:', default: '' })) || undefined;
        const authorName = await input({
            message: 'Author name:',
            default: process.env.USER || 'Author',
        });
        const authorEmail =
            (await input({ message: 'Author email (optional):', default: '' })) || undefined;

        const pluginType = await select({
            message: 'Plugin type:',
            choices: [
                {
                    name: 'Standalone',
                    value: 'standalone' as const,
                    description: 'Independent plugin',
                },
                { name: 'Library', value: 'library' as const, description: 'Shared library' },
            ],
            default: options?.template || 'standalone',
        });

        return { pluginName, authorName, authorEmail, description, pluginType };
    }

    private async createProject(
        config: {
            pluginName: string;
            authorName: string;
            authorEmail?: string;
            description?: string;
            pluginType: 'standalone' | 'library';
        },
        force?: boolean,
    ): Promise<void> {
        const nameErrors = validatePluginName(config.pluginName);
        if (nameErrors.length > 0) {
            this.exitWithError(`Invalid plugin name: ${nameErrors.join(', ')}`);
        }

        const projectDir = process.cwd();
        const pluginJsonPath = path.join(projectDir, 'plugin.json');

        if (fs.existsSync(pluginJsonPath) && !force) {
            const overwrite = await confirm({
                message: 'plugin.json exists. Overwrite?',
                default: false,
            });
            if (!overwrite) {
                this.logger.warn('Initialization cancelled.');
                return;
            }
        }

        this.logger.info('Creating project structure...');

        // Create directories
        for (const dir of ['src', 'dist', 'build', 'test']) {
            const dirPath = path.join(projectDir, dir);
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
            }
        }

        // Create plugin.json
        this.createPluginJson(projectDir, config);
        this.logger.success('  Created plugin.json');

        // Create package.json
        this.createPackageJson(projectDir, config, force);

        // Create tsconfig.json
        this.createTsConfig(projectDir, force);

        // Create src/index.ts
        this.createEntryPoint(projectDir, config, force);

        // Create .gitignore
        this.createGitignore(projectDir, force);

        // Create README.md
        this.createReadme(projectDir, config, force);

        // Create ESLint config
        this.createEslintConfig(projectDir, force);

        // Create Prettier config
        this.createPrettierConfig(projectDir, force);
    }

    private createPluginJson(
        projectDir: string,
        config: {
            pluginName: string;
            authorName: string;
            authorEmail?: string;
            description?: string;
            pluginType: 'standalone' | 'library';
        },
    ): void {
        const manifest: Record<string, unknown> = {
            name: config.pluginName,
            version: '1.0.0',
            opnetVersion: '>=0.0.1',
            main: 'dist/index.jsc',
            target: 'bytenode',
            type: 'plugin',
            author: config.authorEmail
                ? { name: config.authorName, email: config.authorEmail }
                : { name: config.authorName },
            pluginType: config.pluginType,
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
                    txSubmit: false,
                },
                api: {
                    addEndpoints: false,
                    addWebsocket: false,
                },
                threading: {
                    maxWorkers: 1,
                    maxMemoryMB: 256,
                },
                filesystem: {
                    configDir: false,
                    tempDir: false,
                },
                blockchain: {
                    blocks: false,
                    transactions: false,
                    contracts: false,
                    utxos: false,
                },
            },
            resources: {
                memory: {
                    maxHeapMB: 256,
                    maxOldGenMB: 128,
                    maxYoungGenMB: 64,
                },
                cpu: {
                    maxThreads: 2,
                    priority: 'normal',
                },
                timeout: {
                    initMs: 30000,
                    hookMs: 5000,
                    shutdownMs: 10000,
                },
            },
            lifecycle: {
                loadPriority: 100,
                enabledByDefault: true,
                requiresRestart: false,
            },
            dependencies: {},
        };

        if (config.description) {
            manifest.description = config.description;
        }

        fs.writeFileSync(path.join(projectDir, 'plugin.json'), JSON.stringify(manifest, null, 4));
    }

    private createPackageJson(
        projectDir: string,
        config: {
            pluginName: string;
            authorName: string;
            authorEmail?: string;
            description?: string;
        },
        force?: boolean,
    ): void {
        const packageJsonPath = path.join(projectDir, 'package.json');
        if (fs.existsSync(packageJsonPath) && !force) return;

        const packageJson = {
            name: config.pluginName,
            version: '1.0.0',
            description: config.description || 'OPNet plugin',
            type: 'module',
            main: 'dist/index.js',
            scripts: {
                build: 'tsc',
                compile: 'npx opnet compile',
                verify: 'npx opnet verify',
                lint: 'eslint src/',
                format: 'prettier --write src/',
            },
            author: config.authorEmail
                ? `${config.authorName} <${config.authorEmail}>`
                : config.authorName,
            license: 'Apache-2.0',
            dependencies: { '@btc-vision/plugin-sdk': '^1.0.0' },
            devDependencies: {
                '@eslint/js': '^9.39.0',
                '@types/node': '^25.0.0',
                eslint: '^9.39.0',
                prettier: '^3.6.0',
                typescript: '^5.8.0',
                'typescript-eslint': '^8.39.0',
                '@btc-vision/cli': '^1.0.0',
            },
        };

        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 4));
        this.logger.success('  Created package.json');
    }

    private createTsConfig(projectDir: string, force?: boolean): void {
        const tsconfigPath = path.join(projectDir, 'tsconfig.json');
        if (fs.existsSync(tsconfigPath) && !force) return;

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
                declaration: true,
                sourceMap: true,
            },
            include: ['src/**/*'],
            exclude: ['node_modules', 'dist', 'build'],
        };

        fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 4));
        this.logger.success('  Created tsconfig.json');
    }

    private createEntryPoint(
        projectDir: string,
        config: { pluginName: string; pluginType: 'standalone' | 'library' },
        force?: boolean,
    ): void {
        const indexPath = path.join(projectDir, 'src', 'index.ts');
        if (fs.existsSync(indexPath) && !force) return;

        const className = this.toPascalCase(config.pluginName);
        const content =
            config.pluginType === 'standalone'
                ? `import { PluginBase, IPluginContext } from '@btc-vision/plugin-sdk';

/**
 * ${className} Plugin
 *
 * Extend PluginBase and override only the hooks you need.
 * See the plugin-sdk documentation for available hooks.
 */
export default class ${className}Plugin extends PluginBase {
    /**
     * Called when the plugin is loaded.
     * Always call super.onLoad(context) first to initialize this.context.
     */
    public async onLoad(context: IPluginContext): Promise<void> {
        await super.onLoad(context);
        this.context.logger.info('${className} plugin loaded');
    }

    /**
     * Called when the plugin is being unloaded.
     * Clean up any resources here.
     */
    public async onUnload(): Promise<void> {
        this.context.logger.info('${className} plugin unloading');
    }

    /**
     * Called when the plugin is enabled.
     */
    public async onEnable(): Promise<void> {
        this.context.logger.info('${className} plugin enabled');
    }

    /**
     * Called when the plugin is disabled.
     */
    public async onDisable(): Promise<void> {
        this.context.logger.info('${className} plugin disabled');
    }
}
`
                : `export * from './lib/index.js';
`;

        fs.writeFileSync(indexPath, content);
        this.logger.success('  Created src/index.ts');

        if (config.pluginType === 'library') {
            const libDir = path.join(projectDir, 'src', 'lib');
            fs.mkdirSync(libDir, { recursive: true });
            fs.writeFileSync(
                path.join(libDir, 'index.ts'),
                `export function hello(): string {
    return 'Hello from ${config.pluginName}!';
}
`,
            );
            this.logger.success('  Created src/lib/index.ts');
        }
    }

    private createGitignore(projectDir: string, force?: boolean): void {
        const gitignorePath = path.join(projectDir, '.gitignore');
        if (fs.existsSync(gitignorePath) && !force) return;

        fs.writeFileSync(
            gitignorePath,
            `node_modules/
dist/
build/
*.jsc
*.opnet
.idea/
.vscode/
.DS_Store
.env
*.log
coverage/
`,
        );
        this.logger.success('  Created .gitignore');
    }

    private createReadme(
        projectDir: string,
        config: { pluginName: string; description?: string; pluginType: string },
        force?: boolean,
    ): void {
        const readmePath = path.join(projectDir, 'README.md');
        if (fs.existsSync(readmePath) && !force) return;

        fs.writeFileSync(
            readmePath,
            `# ${config.pluginName}

${config.description || `An OPNet ${config.pluginType} plugin.`}

## Installation

\`\`\`bash
npm install
\`\`\`

## Development

\`\`\`bash
npm run build    # Build TypeScript
npm run compile  # Compile to .opnet
npm run verify   # Verify binary
\`\`\`

## License

Apache-2.0
`,
        );
        this.logger.success('  Created README.md');
    }

    private createEslintConfig(projectDir: string, force?: boolean): void {
        const eslintPath = path.join(projectDir, 'eslint.config.js');
        if (fs.existsSync(eslintPath) && !force) return;

        const content = `// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.strictTypeChecked,
    {
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigDirName: import.meta.dirname,
            },
        },
        rules: {
            'no-undef': 'off',
            '@typescript-eslint/no-unused-vars': 'off',
            'no-empty': 'off',
            '@typescript-eslint/restrict-template-expressions': 'off',
            '@typescript-eslint/only-throw-error': 'off',
            '@typescript-eslint/no-unnecessary-condition': 'off',
            '@typescript-eslint/unbound-method': 'warn',
            '@typescript-eslint/no-confusing-void-expression': 'off',
            '@typescript-eslint/no-extraneous-class': 'off',
            'no-async-promise-executor': 'off',
            '@typescript-eslint/no-misused-promises': 'off',
            '@typescript-eslint/no-unnecessary-type-parameters': 'off',
            '@typescript-eslint/no-duplicate-enum-values': 'off',
            'prefer-spread': 'off',
            '@typescript-eslint/no-empty-object-type': 'off',
            '@typescript-eslint/no-base-to-string': 'off',
            '@typescript-eslint/no-dynamic-delete': 'off',
            '@typescript-eslint/no-redundant-type-constituents': 'off',
        },
    },
    {
        files: ['**/*.js'],
        ...tseslint.configs.disableTypeChecked,
    },
);
`;

        fs.writeFileSync(eslintPath, content);
        this.logger.success('  Created eslint.config.js');
    }

    private createPrettierConfig(projectDir: string, force?: boolean): void {
        const prettierPath = path.join(projectDir, '.prettierrc.json');
        if (fs.existsSync(prettierPath) && !force) return;

        const config = {
            printWidth: 100,
            trailingComma: 'all',
            tabWidth: 4,
            semi: true,
            singleQuote: true,
            quoteProps: 'as-needed',
            bracketSpacing: true,
            bracketSameLine: true,
            arrowParens: 'always',
            singleAttributePerLine: true,
        };

        fs.writeFileSync(prettierPath, JSON.stringify(config, null, 4));
        this.logger.success('  Created .prettierrc.json');
    }

    private toPascalCase(str: string): string {
        return str
            .split(/[-_]/)
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join('');
    }
}

export const initCommand = new InitCommand().getCommand();
