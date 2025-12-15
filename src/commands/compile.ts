/**
 * Compile command - Build plugin to .opnet binary
 *
 * @module commands/compile
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as esbuild from 'esbuild';
import bytenode from 'bytenode';
import { loadManifest, getManifestPath } from '../lib/manifest.js';
import { buildOpnetBinary, formatFileSize, computeChecksum } from '../lib/binary.js';
import { CLIWallet } from '../lib/wallet.js';
import { loadCredentials, canSign } from '../lib/credentials.js';
import { computePermissionsHash } from '../lib/registry.js';
import { MLDSALevel } from '../types/index.js';

export const compileCommand = new Command('compile')
    .description('Compile plugin to .opnet binary format')
    .option('-o, --output <path>', 'Output file path')
    .option('-d, --dir <path>', 'Plugin directory (default: current)')
    .option('--no-sign', 'Skip signing (produce unsigned binary)')
    .option('--minify', 'Minify the bundled code', true)
    .option('--sourcemap', 'Generate source maps', false)
    .action(async (options: {
        output?: string;
        dir?: string;
        sign: boolean;
        minify: boolean;
        sourcemap: boolean;
    }) => {
        const spinner = ora();

        try {
            const projectDir = options.dir ? path.resolve(options.dir) : process.cwd();
            const manifestPath = getManifestPath(projectDir);

            // Load and validate manifest
            spinner.start('Loading plugin manifest...');
            const manifest = loadManifest(manifestPath);
            spinner.succeed(`Loaded manifest: ${manifest.name}@${manifest.version}`);

            // Check for source files
            const srcDir = path.join(projectDir, 'src');
            const entryPoint = path.join(srcDir, 'index.ts');

            if (!fs.existsSync(entryPoint)) {
                throw new Error(`Entry point not found: ${entryPoint}`);
            }

            // Bundle with esbuild
            spinner.start('Bundling TypeScript...');
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
            spinner.succeed('TypeScript bundled');

            // Compile to V8 bytecode
            spinner.start('Compiling to V8 bytecode...');
            const bytecodePath = path.join(bundleDir, 'bundle.jsc');

            await bytenode.compileFile({
                filename: bundlePath,
                output: bytecodePath,
                electron: false,
            });

            const bytecode = fs.readFileSync(bytecodePath);
            spinner.succeed(`V8 bytecode generated (${formatFileSize(bytecode.length)})`);

            // Check for proto file
            let proto = Buffer.alloc(0);
            const protoPath = path.join(projectDir, 'plugin.proto');
            if (fs.existsSync(protoPath)) {
                proto = fs.readFileSync(protoPath);
                spinner.info(`Found proto file (${formatFileSize(proto.length)})`);
            }

            // Prepare signing
            let publicKey: Buffer;
            let signature: Buffer;
            let mldsaLevel: MLDSALevel;

            if (options.sign) {
                spinner.start('Loading wallet for signing...');
                const credentials = loadCredentials();

                if (!credentials || !canSign(credentials)) {
                    spinner.fail('No credentials configured');
                    console.log(chalk.yellow('\nTo sign plugins, run: opnet login'));
                    console.log(chalk.yellow('Or use --no-sign to skip signing.'));
                    process.exit(1);
                }

                const wallet = CLIWallet.fromCredentials(credentials);
                mldsaLevel = wallet.securityLevel;
                publicKey = wallet.mldsaPublicKey;

                spinner.succeed(`Wallet loaded (MLDSA-${mldsaLevel})`);

                // Compute checksum and sign
                spinner.start('Signing plugin...');
                const metadataBytes = Buffer.from(JSON.stringify(manifest), 'utf-8');
                const checksum = computeChecksum(metadataBytes, bytecode, proto);

                signature = wallet.signMLDSA(checksum);
                spinner.succeed(`Plugin signed (${formatFileSize(signature.length)} signature)`);

            } else {
                spinner.warn('Skipping signing (--no-sign)');
                // Use dummy values for unsigned binary
                mldsaLevel = 44;
                publicKey = Buffer.alloc(1312); // MLDSA-44 public key size
                signature = Buffer.alloc(2420); // MLDSA-44 signature size
            }

            // Build .opnet binary
            spinner.start('Assembling .opnet binary...');
            const binary = buildOpnetBinary({
                mldsaLevel,
                publicKey,
                signature,
                metadata: manifest,
                bytecode,
                proto,
            });
            spinner.succeed(`Binary assembled (${formatFileSize(binary.length)})`);

            // Write output
            const outputPath = options.output || path.join(
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
            console.log(chalk.green('Compilation successful!'));
            console.log('');
            console.log(`${chalk.bold('Output:')}       ${outputPath}`);
            console.log(`${chalk.bold('Size:')}         ${formatFileSize(binary.length)}`);
            console.log(`${chalk.bold('Plugin:')}       ${manifest.name}@${manifest.version}`);
            console.log(`${chalk.bold('Type:')}         ${manifest.pluginType}`);
            console.log(`${chalk.bold('MLDSA Level:')}  ${mldsaLevel}`);
            console.log(`${chalk.bold('Signed:')}       ${options.sign ? 'Yes' : 'No'}`);
            console.log('');

            if (!options.sign) {
                console.log(chalk.yellow('Note: This binary is unsigned and cannot be published.'));
                console.log(chalk.yellow('Use `opnet sign` to sign it, or compile with signing enabled.'));
                console.log('');
            }

        } catch (error) {
            spinner.fail('Compilation failed');
            console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : String(error)}`));
            process.exit(1);
        }
    });
