/**
 * Plugin manifest (plugin.json) utilities
 *
 * Uses @btc-vision/plugin-sdk for validation.
 *
 * @module lib/manifest
 */

import * as fs from 'fs';
import * as path from 'path';
import {
    IPluginMetadata,
    IPluginPermissions,
    validateManifest as sdkValidateManifest,
    IValidationResult,
    PLUGIN_NAME_REGEX,
    PLUGIN_MANIFEST_FILENAME,
    DEFAULT_PERMISSIONS,
    DEFAULT_RESOURCES,
    DEFAULT_LIFECYCLE,
} from '@btc-vision/plugin-sdk';

/** Scoped package name pattern */
const SCOPED_NAME_PATTERN = /^@[a-z][a-z0-9-]*\/[a-z][a-z0-9-]*$/;

/**
 * Validate a plugin name (scoped or unscoped)
 *
 * @param name - The name to validate
 * @returns Array of validation errors (empty if valid)
 */
export function validatePluginName(name: string): string[] {
    const errors: string[] = [];

    if (!name) {
        errors.push('Name is required');
        return errors;
    }

    // Check if scoped
    if (name.startsWith('@')) {
        if (!SCOPED_NAME_PATTERN.test(name)) {
            errors.push(
                'Scoped name must be @scope/name where scope and name are lowercase alphanumeric with hyphens, starting with a letter',
            );
        }
    } else {
        if (!PLUGIN_NAME_REGEX.test(name)) {
            errors.push(
                'Name must be lowercase alphanumeric with hyphens, starting with a letter',
            );
        }
    }

    // Check length
    if (name.length > 100) {
        errors.push('Name must be 100 characters or less');
    }

    return errors;
}

/**
 * Validate a complete plugin manifest using the SDK validator
 *
 * @param manifest - The manifest to validate
 * @returns Validation result with field-specific errors
 */
export function validateManifest(manifest: Partial<IPluginMetadata>): IValidationResult {
    return sdkValidateManifest(manifest);
}

/**
 * Validate plugin permissions
 *
 * @param permissions - The permissions object
 * @returns Array of validation errors (empty if valid)
 */
export function validatePermissions(permissions: IPluginPermissions): string[] {
    const errors: string[] = [];

    if (permissions.database?.enabled) {
        if (
            !permissions.database.collections ||
            !Array.isArray(permissions.database.collections)
        ) {
            errors.push('database.collections must be an array when database is enabled');
        }
    }

    return errors;
}

/**
 * Load and validate a plugin manifest from file
 *
 * @param manifestPath - Path to plugin.json
 * @returns The loaded manifest or throws with validation errors
 */
export function loadManifest(manifestPath: string): IPluginMetadata {
    const resolvedPath = path.resolve(manifestPath);

    if (!fs.existsSync(resolvedPath)) {
        throw new Error(`Manifest not found: ${resolvedPath}`);
    }

    let manifest: Partial<IPluginMetadata>;
    try {
        const content = fs.readFileSync(resolvedPath, 'utf-8');
        manifest = JSON.parse(content) as Partial<IPluginMetadata>;
    } catch (e) {
        throw new Error(`Failed to parse manifest: ${e instanceof Error ? e.message : String(e)}`);
    }

    const result = validateManifest(manifest);
    if (!result.valid) {
        const errorList = result.errors
            .map((e) => `  - ${e.path}: ${e.message}`)
            .join('\n');
        throw new Error(`Invalid manifest:\n${errorList}`);
    }

    return manifest as IPluginMetadata;
}

/**
 * Save a plugin manifest to file
 *
 * @param manifestPath - Path to save to
 * @param manifest - The manifest to save
 */
export function saveManifest(manifestPath: string, manifest: IPluginMetadata): void {
    const content = JSON.stringify(manifest, null, 4);
    fs.writeFileSync(manifestPath, content, 'utf-8');
}

/**
 * Create a default plugin manifest
 *
 * @param options - Manifest options
 * @returns A complete manifest with defaults
 */
export function createManifest(options: {
    name: string;
    author: string;
    email?: string;
    description?: string;
    pluginType: 'standalone' | 'library';
}): IPluginMetadata {
    return {
        name: options.name,
        version: '1.0.0',
        opnetVersion: '^1.0.0',
        main: 'dist/index.jsc',
        target: 'bytenode',
        type: 'plugin',
        checksum: '',
        author: {
            name: options.author,
            email: options.email,
        },
        description: options.description,
        pluginType: options.pluginType,
        permissions: DEFAULT_PERMISSIONS,
        resources: DEFAULT_RESOURCES,
        lifecycle: DEFAULT_LIFECYCLE,
        dependencies: {},
    };
}

/**
 * Get the manifest path for a directory
 *
 * @param dir - Directory to search
 * @returns Path to plugin.json
 */
export function getManifestPath(dir: string = process.cwd()): string {
    return path.join(dir, PLUGIN_MANIFEST_FILENAME);
}
