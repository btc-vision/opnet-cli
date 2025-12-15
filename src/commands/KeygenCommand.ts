/**
 * Keygen command - Generate MLDSA keypairs and mnemonics
 *
 * @module commands/KeygenCommand
 */

import { Command } from 'commander';
import * as fs from 'fs';
import { BaseCommand } from './BaseCommand.js';
import { generateMLDSAKeypair, generateMnemonic, computePublicKeyHash } from '../lib/wallet.js';
import { isValidMldsaLevel } from '../lib/credentials.js';
import { CLIMldsaLevel } from '../types/index.js';

export class KeygenCommand extends BaseCommand {
    constructor() {
        super('keygen', 'Generate cryptographic keys');
    }

    protected configure(): void {
        this.command
            .addCommand(this.createMnemonicCommand())
            .addCommand(this.createMldsaCommand())
            .addCommand(this.createInfoCommand());
    }

    private createMnemonicCommand(): Command {
        return new Command('mnemonic')
            .description('Generate a new BIP-39 mnemonic phrase')
            .option('-o, --output <file>', 'Write mnemonic to file (secure permissions)')
            .action((options: { output?: string }) => this.handleMnemonic(options));
    }

    private createMldsaCommand(): Command {
        return new Command('mldsa')
            .description('Generate a standalone MLDSA keypair')
            .option('-l, --level <level>', 'MLDSA security level (44, 65, 87)', '44')
            .option('-o, --output <prefix>', 'Write keys to files with prefix')
            .option('--json', 'Output as JSON')
            .action((options: { level: string; output?: string; json?: boolean }) => {
                this.handleMldsa(options);
            });
    }

    private createInfoCommand(): Command {
        return new Command('info')
            .description('Show information about MLDSA key sizes')
            .action(() => this.handleInfo());
    }

    private handleMnemonic(options: { output?: string }): void {
        try {
            const mnemonic = generateMnemonic();

            if (options.output) {
                fs.writeFileSync(options.output, mnemonic + '\n', { mode: 0o600 });
                this.logger.success(`Mnemonic saved to: ${options.output}`);
                this.logger.warn('Keep this file secure and backed up!');
            } else {
                this.logger.info('\nNew BIP-39 Mnemonic Phrase:\n');
                console.log(mnemonic);
                console.log('');
                this.logger.warn('IMPORTANT: Write down these words and store them securely.');
                this.logger.warn('Anyone with this phrase can access your wallet.');
                this.logger.warn('Never share this phrase with anyone.');
            }

        } catch (error) {
            this.exitWithError(this.formatError(error));
        }
    }

    private handleMldsa(options: { level: string; output?: string; json?: boolean }): void {
        try {
            const levelNum = parseInt(options.level, 10);
            if (!isValidMldsaLevel(levelNum)) {
                this.exitWithError(`Invalid MLDSA level: ${options.level}. Valid: 44, 65, 87`);
                return; // Unreachable, but helps TypeScript
            }

            this.logger.info(`Generating MLDSA-${levelNum} keypair...`);

            const keypair = generateMLDSAKeypair(levelNum);
            const publicKeyHash = computePublicKeyHash(keypair.publicKey);

            if (options.output) {
                const privateKeyPath = `${options.output}.private.key`;
                const publicKeyPath = `${options.output}.public.key`;

                fs.writeFileSync(privateKeyPath, keypair.privateKey.toString('hex') + '\n', {
                    mode: 0o600,
                });
                fs.writeFileSync(publicKeyPath, keypair.publicKey.toString('hex') + '\n', {
                    mode: 0o644,
                });

                this.logger.success('Keys generated successfully!');
                this.logger.info(`  Private key: ${privateKeyPath}`);
                this.logger.info(`  Public key:  ${publicKeyPath}`);
                console.log('');
                console.log(`Public Key Hash: ${publicKeyHash}`);
                console.log('');
                this.logger.warn('IMPORTANT: Keep the private key secure!');

            } else if (options.json) {
                const output = {
                    level: levelNum,
                    privateKey: keypair.privateKey.toString('hex'),
                    publicKey: keypair.publicKey.toString('hex'),
                    publicKeyHash,
                    privateKeySize: keypair.privateKey.length,
                    publicKeySize: keypair.publicKey.length,
                };
                console.log(JSON.stringify(output, null, 2));

            } else {
                this.logger.info(`\nMLDSA-${levelNum} Keypair:\n`);
                console.log(`Public Key Hash: ${publicKeyHash}`);
                console.log(`Public Key Size: ${keypair.publicKey.length} bytes`);
                console.log(`Private Key Size: ${keypair.privateKey.length} bytes`);
                console.log('');
                console.log('Public Key (hex):');
                console.log(keypair.publicKey.toString('hex'));
                console.log('');
                console.log('Private Key (hex):');
                console.log(keypair.privateKey.toString('hex'));
                console.log('');
                this.logger.warn('IMPORTANT: Store the private key securely!');
                this.logger.warn('Use --output <prefix> to save to files.');
            }

        } catch (error) {
            this.exitWithError(this.formatError(error));
        }
    }

    private handleInfo(): void {
        this.logger.info('\nMLDSA Key Sizes:\n');
        console.log('─'.repeat(60));
        console.log(
            `${'Level'.padEnd(12)}${'Public Key'.padEnd(15)}${'Private Key'.padEnd(15)}${'Signature'.padEnd(15)}`,
        );
        console.log('─'.repeat(60));
        console.log(
            `${'MLDSA-44'.padEnd(12)}${'1,312 bytes'.padEnd(15)}${'2,560 bytes'.padEnd(15)}${'2,420 bytes'.padEnd(15)}`,
        );
        console.log(
            `${'MLDSA-65'.padEnd(12)}${'1,952 bytes'.padEnd(15)}${'4,032 bytes'.padEnd(15)}${'3,309 bytes'.padEnd(15)}`,
        );
        console.log(
            `${'MLDSA-87'.padEnd(12)}${'2,592 bytes'.padEnd(15)}${'4,896 bytes'.padEnd(15)}${'4,627 bytes'.padEnd(15)}`,
        );
        console.log('─'.repeat(60));
        console.log('');
        console.log('Security levels:');
        console.log('  MLDSA-44: ~128-bit security (fastest, smallest)');
        console.log('  MLDSA-65: ~192-bit security (balanced)');
        console.log('  MLDSA-87: ~256-bit security (highest security)');
        console.log('');
    }
}

export const keygenCommand = new KeygenCommand().getCommand();
