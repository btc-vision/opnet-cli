/**
 * Keygen command - Generate MLDSA keypairs and mnemonics
 *
 * @module commands/keygen
 */

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import { generateMLDSAKeypair, generateMnemonic, computePublicKeyHash } from '../lib/wallet.js';
import { isValidMldsaLevel } from '../lib/credentials.js';
import { MLDSALevel } from '../types/index.js';

export const keygenCommand = new Command('keygen')
    .description('Generate cryptographic keys')
    .addCommand(
        new Command('mnemonic')
            .description('Generate a new BIP-39 mnemonic phrase')
            .option('-o, --output <file>', 'Write mnemonic to file (secure permissions)')
            .action((options: { output?: string }) => {
                try {
                    const mnemonic = generateMnemonic();

                    if (options.output) {
                        // Write to file with secure permissions
                        fs.writeFileSync(options.output, mnemonic + '\n', { mode: 0o600 });
                        console.log(chalk.green(`Mnemonic saved to: ${options.output}`));
                        console.log(chalk.yellow('Keep this file secure and backed up!'));
                    } else {
                        console.log(chalk.cyan('\nNew BIP-39 Mnemonic Phrase:\n'));
                        console.log(chalk.bold(mnemonic));
                        console.log('');
                        console.log(chalk.yellow('IMPORTANT: Write down these words and store them securely.'));
                        console.log(chalk.yellow('Anyone with this phrase can access your wallet.'));
                        console.log(chalk.yellow('Never share this phrase with anyone.'));
                    }

                } catch (error) {
                    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
                    process.exit(1);
                }
            }),
    )
    .addCommand(
        new Command('mldsa')
            .description('Generate a standalone MLDSA keypair')
            .option('-l, --level <level>', 'MLDSA security level (44, 65, 87)', '44')
            .option('-o, --output <prefix>', 'Write keys to files with prefix')
            .option('--json', 'Output as JSON')
            .action((options: { level: string; output?: string; json?: boolean }) => {
                try {
                    const levelNum = parseInt(options.level, 10);
                    if (!isValidMldsaLevel(levelNum)) {
                        console.error(chalk.red(`Invalid MLDSA level: ${options.level}`));
                        console.error('Valid levels: 44, 65, 87');
                        process.exit(1);
                    }

                    const level = levelNum as MLDSALevel;
                    console.log(chalk.dim(`Generating MLDSA-${level} keypair...`));

                    const keypair = generateMLDSAKeypair(level);
                    const publicKeyHash = computePublicKeyHash(keypair.publicKey);

                    if (options.output) {
                        // Write keys to files
                        const privateKeyPath = `${options.output}.private.key`;
                        const publicKeyPath = `${options.output}.public.key`;

                        fs.writeFileSync(privateKeyPath, keypair.privateKey.toString('hex') + '\n', {
                            mode: 0o600,
                        });
                        fs.writeFileSync(publicKeyPath, keypair.publicKey.toString('hex') + '\n', {
                            mode: 0o644,
                        });

                        console.log(chalk.green(`\nKeys generated successfully!`));
                        console.log(chalk.dim(`  Private key: ${privateKeyPath}`));
                        console.log(chalk.dim(`  Public key:  ${publicKeyPath}`));
                        console.log('');
                        console.log(`${chalk.bold('Public Key Hash:')} ${publicKeyHash}`);
                        console.log('');
                        console.log(chalk.yellow('IMPORTANT: Keep the private key secure!'));

                    } else if (options.json) {
                        // Output as JSON
                        const output = {
                            level,
                            privateKey: keypair.privateKey.toString('hex'),
                            publicKey: keypair.publicKey.toString('hex'),
                            publicKeyHash,
                            privateKeySize: keypair.privateKey.length,
                            publicKeySize: keypair.publicKey.length,
                        };
                        console.log(JSON.stringify(output, null, 2));

                    } else {
                        // Display to console
                        console.log(chalk.cyan(`\nMLDSA-${level} Keypair:\n`));
                        console.log(`${chalk.bold('Public Key Hash:')} ${publicKeyHash}`);
                        console.log(`${chalk.bold('Public Key Size:')} ${keypair.publicKey.length} bytes`);
                        console.log(`${chalk.bold('Private Key Size:')} ${keypair.privateKey.length} bytes`);
                        console.log('');
                        console.log(chalk.bold('Public Key (hex):'));
                        console.log(chalk.dim(keypair.publicKey.toString('hex')));
                        console.log('');
                        console.log(chalk.bold('Private Key (hex):'));
                        console.log(chalk.dim(keypair.privateKey.toString('hex')));
                        console.log('');
                        console.log(chalk.yellow('IMPORTANT: Store the private key securely!'));
                        console.log(chalk.yellow('Use --output <prefix> to save to files.'));
                    }

                } catch (error) {
                    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
                    process.exit(1);
                }
            }),
    )
    .addCommand(
        new Command('info')
            .description('Show information about MLDSA key sizes')
            .action(() => {
                console.log(chalk.cyan('\nMLDSA Key Sizes:\n'));
                console.log(chalk.dim('─'.repeat(60)));
                console.log(
                    `${'Level'.padEnd(12)}${'Public Key'.padEnd(15)}${'Private Key'.padEnd(15)}${'Signature'.padEnd(15)}`,
                );
                console.log(chalk.dim('─'.repeat(60)));
                console.log(
                    `${'MLDSA-44'.padEnd(12)}${'1,312 bytes'.padEnd(15)}${'2,560 bytes'.padEnd(15)}${'2,420 bytes'.padEnd(15)}`,
                );
                console.log(
                    `${'MLDSA-65'.padEnd(12)}${'1,952 bytes'.padEnd(15)}${'4,032 bytes'.padEnd(15)}${'3,309 bytes'.padEnd(15)}`,
                );
                console.log(
                    `${'MLDSA-87'.padEnd(12)}${'2,592 bytes'.padEnd(15)}${'4,896 bytes'.padEnd(15)}${'4,627 bytes'.padEnd(15)}`,
                );
                console.log(chalk.dim('─'.repeat(60)));
                console.log('');
                console.log('Security levels:');
                console.log(chalk.dim('  MLDSA-44: ~128-bit security (fastest, smallest)'));
                console.log(chalk.dim('  MLDSA-65: ~192-bit security (balanced)'));
                console.log(chalk.dim('  MLDSA-87: ~256-bit security (highest security)'));
                console.log('');
            }),
    );
