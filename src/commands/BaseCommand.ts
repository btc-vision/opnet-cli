/**
 * Base command class for OPNet CLI
 *
 * @module commands/BaseCommand
 */

import { Command } from 'commander';
import { Logger } from '@btc-vision/logger';

/**
 * Abstract base class for all CLI commands
 */
export abstract class BaseCommand {
    protected readonly logger: Logger;
    protected readonly command: Command;

    constructor(name: string, description: string) {
        this.logger = new Logger();
        this.command = new Command(name).description(description);
        this.configure();
    }

    /**
     * Get the configured command instance
     */
    public getCommand(): Command {
        return this.command;
    }

    /**
     * Configure the command with options and action
     */
    protected abstract configure(): void;

    /**
     * Format an error message for display
     */
    protected formatError(error: unknown): string {
        if (error instanceof Error) {
            return error.message;
        }
        return String(error);
    }

    /**
     * Exit with error
     */
    protected exitWithError(message: string, code: number = 1): never {
        this.logger.error(message);
        process.exit(code);
    }

    /**
     * Check if user cancelled (for inquirer)
     */
    protected isUserCancelled(error: unknown): boolean {
        return error instanceof Error && error.message.includes('User force closed');
    }
}
