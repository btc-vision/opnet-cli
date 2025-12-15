/**
 * Compile command - Build plugin to .opnet binary
 *
 * @module commands/CompileCommand
 */

import * as fs from 'fs';
import * as path from 'path';
import * as esbuild from 'esbuild';
import bytenode from 'bytenode';
import { BaseCommand } from './BaseCommand.js';
import { loadManifest, getManifestPath } from '../lib/manifest.js';
import { buildOpnetBinary, formatFileSize, computeChecksum } from '../lib/binary.js';
import { CLIWallet } from '../lib/wallet.js';
import { loadCredentials, canSign } from '../lib/credentials.js';
import { CLIMldsaLevel } from '../types/index.js';

interface CompileOptions {
    output?: string;
    dir?: string;
    sign: boolean;
    minify: boolean;
    sourcemap: boolean;
}

export class CompileCommand extends BaseCommand {
    constructor() {
        super('compile', 'Compile plugin to .opnet binary format');
    }

    protected configure(): void {
        this.command
            .option('-o, --output <path>', 'Output file path')
            .option('-d, --dir <path>', 'Plugin directory (default: current)')
            .option('--no-sign', 'Skip signing (produce unsigned binary)')
            .option('--minify', 'Minify the bundled code', true)
            .option('--sourcemap', 'Generate source maps', false)
            .action((options: CompileOptions) => this.execute(options));
    }

    private async execute(options: CompileOptions): Promise<void> {
        try {
            const projectDir = options.dir ? path.resolve(options.dir) : process.cwd();
            const manifestPath = getManifestPath(projectDir);

            // Load and validate manifest
            this.logger.info('Loading plugin manifest...');
            const manifest = loadManifest(manifestPath);
            this.logger.success(`Loaded manifest: ${manifest.name}@${manifest.version}`);

            // Check for source files
            const srcDir = path.join(projectDir, 'src');
            const entryPoint = path.join(srcDir, 'index.ts');

            if (!fs.existsSync(entryPoint)) {
                this.exitWithError(`Entry point not found: ${entryPoint}`);
            }

            // Bundle with esbuild
            this.logger.info('Bundling TypeScript...');
            const bundleDir = path.join(projectDir, 'build', '.bundle');
            fs.mkdirSync(bundleDir, { recursive: true });

            const bundlePath = path.join(bundleDir, 'bundle.js');

            await esbuild.build({
                entryPoints: [entryPoint],
                bundle: true,
                platform: 'node',
                target: 'es2022',
                format: 'cjs', // bytenode requires CommonJS
                outfile: bundlePath,
                minify: options.minify,
                sourcemap: options.sourcemap,
                treeShaking: true,
                external: [
                    '@btc-vision/plugin-sdk',
                    '@btc-vision/transaction',
                    '@btc-vision/bitcoin',
                    'opnet',
                ],
            });
            this.logger.success('TypeScript bundled');

            // Compile to V8 bytecode
            this.logger.info('Compiling to V8 bytecode...');
            const bytecodePath = path.join(bundleDir, 'bundle.jsc');

            await bytenode.compileFile({
                filename: bundlePath,
                output: bytecodePath,
                electron: false,
            });

            const bytecode = fs.readFileSync(bytecodePath);
            this.logger.success(`V8 bytecode generated (${formatFileSize(bytecode.length)})`);

            // Check for proto file
            let proto = Buffer.alloc(0);
            const protoPath = path.join(projectDir, 'plugin.proto');
            if (fs.existsSync(protoPath)) {
                proto = fs.readFileSync(protoPath);
                this.logger.info(`Found proto file (${formatFileSize(proto.length)})`);
            }

            // Prepare signing
            let publicKey: Buffer;
            let signature: Buffer;
            let mldsaLevel: CLIMldsaLevel;

            if (options.sign) {
                this.logger.info('Loading wallet for signing...');
                const credentials = loadCredentials();

                if (!credentials || !canSign(credentials)) {
                    this.logger.fail('No credentials configured');
                    this.logger.warn('To sign plugins, run: opnet login');
                    this.logger.warn('Or use --no-sign to skip signing.');
                    process.exit(1);
                }

                const wallet = CLIWallet.fromCredentials(credentials);
                mldsaLevel = wallet.securityLevel;
                publicKey = wallet.mldsaPublicKey;

                this.logger.success(`Wallet loaded (MLDSA-${mldsaLevel})`);

                // Compute checksum and sign
                this.logger.info('Signing plugin...');
                const metadataBytes = Buffer.from(JSON.stringify(manifest), 'utf-8');
                const checksum = computeChecksum(metadataBytes, bytecode, proto);

                signature = wallet.signMLDSA(checksum);
                this.logger.success(`Plugin signed (${formatFileSize(signature.length)} signature)`);
            } else {
                this.logger.warn('Skipping signing (--no-sign)');
                // Use dummy values for unsigned binary
                mldsaLevel = 44;
                publicKey = Buffer.alloc(1312); // MLDSA-44 public key size
                signature = Buffer.alloc(2420); // MLDSA-44 signature size
            }

            // Build .opnet binary
            this.logger.info('Assembling .opnet binary...');
            const binary = buildOpnetBinary({
                mldsaLevel,
                publicKey,
                signature,
                metadata: manifest,
                bytecode,
                proto,
            });
            this.logger.success(`Binary assembled (${formatFileSize(binary.length)})`);

            // Write output
            const outputPath =
                options.output ||
                path.join(
                    projectDir,
                    'build',
                    `${manifest.name.replace(/^@/, '').replace(/\//g, '-')}.opnet`,
                );
            const outputDir = path.dirname(outputPath);
            fs.mkdirSync(outputDir, { recursive: true });
            fs.writeFileSync(outputPath, binary);

            // Clean up bundle directory
            fs.rmSync(bundleDir, { recursive: true, force: true });

            // Summary
            console.log('');
            this.logger.success('Compilation successful!');
            console.log('');
            console.log(`Output:       ${outputPath}`);
            console.log(`Size:         ${formatFileSize(binary.length)}`);
            console.log(`Plugin:       ${manifest.name}@${manifest.version}`);
            console.log(`Type:         ${manifest.pluginType}`);
            console.log(`MLDSA Level:  ${mldsaLevel}`);
            console.log(`Signed:       ${options.sign ? 'Yes' : 'No'}`);
            console.log('');

            if (!options.sign) {
                this.logger.warn('Note: This binary is unsigned and cannot be published.');
                this.logger.warn('Use `opnet sign` to sign it, or compile with signing enabled.');
                console.log('');
            }
        } catch (error) {
            this.logger.fail('Compilation failed');
            this.exitWithError(this.formatError(error));
        }
    }
}

export const compileCommand = new CompileCommand().getCommand();
