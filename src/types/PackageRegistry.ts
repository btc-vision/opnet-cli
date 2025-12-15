import { Address, AddressMap } from '@btc-vision/transaction';
import { CallResult, OPNetEvent, IOP_NETContract } from 'opnet';

// ------------------------------------------------------------------
// Event Definitions
// ------------------------------------------------------------------
export type TreasuryAddressChangedEvent = {
    readonly previousAddressHash: bigint;
    readonly newAddressHash: bigint;
    readonly timestamp: bigint;
};
export type ScopePriceChangedEvent = {
    readonly oldPrice: bigint;
    readonly newPrice: bigint;
    readonly timestamp: bigint;
};
export type PackagePriceChangedEvent = {
    readonly oldPrice: bigint;
    readonly newPrice: bigint;
    readonly timestamp: bigint;
};
export type ScopeRegisteredEvent = {
    readonly scopeHash: bigint;
    readonly owner: Address;
    readonly timestamp: bigint;
};
export type ScopeTransferInitiatedEvent = {
    readonly scopeHash: bigint;
    readonly currentOwner: Address;
    readonly newOwner: Address;
    readonly timestamp: bigint;
};
export type ScopeTransferCompletedEvent = {
    readonly scopeHash: bigint;
    readonly previousOwner: Address;
    readonly newOwner: Address;
    readonly timestamp: bigint;
};
export type ScopeTransferCancelledEvent = {
    readonly scopeHash: bigint;
    readonly owner: Address;
    readonly timestamp: bigint;
};
export type PackageRegisteredEvent = {
    readonly packageHash: bigint;
    readonly owner: Address;
    readonly timestamp: bigint;
};
export type VersionPublishedEvent = {
    readonly packageHash: bigint;
    readonly versionHash: bigint;
    readonly publisher: Address;
    readonly checksum: bigint;
    readonly timestamp: bigint;
    readonly mldsaLevel: number;
    readonly pluginType: number;
};
export type VersionDeprecatedEvent = {
    readonly packageHash: bigint;
    readonly versionHash: bigint;
    readonly timestamp: bigint;
};
export type VersionUndeprecatedEvent = {
    readonly packageHash: bigint;
    readonly versionHash: bigint;
    readonly timestamp: bigint;
};
export type PackageTransferInitiatedEvent = {
    readonly packageHash: bigint;
    readonly currentOwner: Address;
    readonly newOwner: Address;
    readonly timestamp: bigint;
};
export type PackageTransferCompletedEvent = {
    readonly packageHash: bigint;
    readonly previousOwner: Address;
    readonly newOwner: Address;
    readonly timestamp: bigint;
};
export type PackageTransferCancelledEvent = {
    readonly packageHash: bigint;
    readonly owner: Address;
    readonly timestamp: bigint;
};

// ------------------------------------------------------------------
// Call Results
// ------------------------------------------------------------------

/**
 * @description Represents the result of the setTreasuryAddress function call.
 */
export type SetTreasuryAddress = CallResult<{}, OPNetEvent<TreasuryAddressChangedEvent>[]>;

/**
 * @description Represents the result of the setScopePrice function call.
 */
export type SetScopePrice = CallResult<{}, OPNetEvent<ScopePriceChangedEvent>[]>;

/**
 * @description Represents the result of the setPackagePrice function call.
 */
export type SetPackagePrice = CallResult<{}, OPNetEvent<PackagePriceChangedEvent>[]>;

/**
 * @description Represents the result of the registerScope function call.
 */
export type RegisterScope = CallResult<{}, OPNetEvent<ScopeRegisteredEvent>[]>;

/**
 * @description Represents the result of the initiateScopeTransfer function call.
 */
export type InitiateScopeTransfer = CallResult<{}, OPNetEvent<ScopeTransferInitiatedEvent>[]>;

/**
 * @description Represents the result of the acceptScopeTransfer function call.
 */
export type AcceptScopeTransfer = CallResult<{}, OPNetEvent<ScopeTransferCompletedEvent>[]>;

/**
 * @description Represents the result of the cancelScopeTransfer function call.
 */
export type CancelScopeTransfer = CallResult<{}, OPNetEvent<ScopeTransferCancelledEvent>[]>;

/**
 * @description Represents the result of the registerPackage function call.
 */
export type RegisterPackage = CallResult<{}, OPNetEvent<PackageRegisteredEvent>[]>;

/**
 * @description Represents the result of the publishVersion function call.
 */
export type PublishVersion = CallResult<{}, OPNetEvent<VersionPublishedEvent>[]>;

/**
 * @description Represents the result of the deprecateVersion function call.
 */
export type DeprecateVersion = CallResult<{}, OPNetEvent<VersionDeprecatedEvent>[]>;

/**
 * @description Represents the result of the undeprecateVersion function call.
 */
export type UndeprecateVersion = CallResult<{}, OPNetEvent<VersionUndeprecatedEvent>[]>;

/**
 * @description Represents the result of the initiateTransfer function call.
 */
export type InitiateTransfer = CallResult<{}, OPNetEvent<PackageTransferInitiatedEvent>[]>;

/**
 * @description Represents the result of the acceptTransfer function call.
 */
export type AcceptTransfer = CallResult<{}, OPNetEvent<PackageTransferCompletedEvent>[]>;

/**
 * @description Represents the result of the cancelTransfer function call.
 */
export type CancelTransfer = CallResult<{}, OPNetEvent<PackageTransferCancelledEvent>[]>;

/**
 * @description Represents the result of the getScope function call.
 */
export type GetScope = CallResult<
    {
        exists: boolean;
        owner: Address;
        createdAt: bigint;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the getScopeOwner function call.
 */
export type GetScopeOwner = CallResult<
    {
        owner: Address;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the getPackage function call.
 */
export type GetPackage = CallResult<
    {
        exists: boolean;
        owner: Address;
        createdAt: bigint;
        versionCount: bigint;
        latestVersion: string;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the getOwner function call.
 */
export type GetOwner = CallResult<
    {
        owner: Address;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the getVersion function call.
 */
export type GetVersion = CallResult<
    {
        exists: boolean;
        ipfsCid: string;
        checksum: Uint8Array;
        sigHash: Uint8Array;
        mldsaLevel: number;
        opnetVersionRange: string;
        pluginType: number;
        permissionsHash: Uint8Array;
        depsHash: Uint8Array;
        publisher: Address;
        publishedAt: bigint;
        deprecated: boolean;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the isDeprecated function call.
 */
export type IsDeprecated = CallResult<
    {
        deprecated: boolean;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the isImmutable function call.
 */
export type IsImmutable = CallResult<
    {
        immutable: boolean;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the getPendingTransfer function call.
 */
export type GetPendingTransfer = CallResult<
    {
        pendingOwner: Address;
        initiatedAt: bigint;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the getPendingScopeTransfer function call.
 */
export type GetPendingScopeTransfer = CallResult<
    {
        pendingOwner: Address;
        initiatedAt: bigint;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the getTreasuryAddress function call.
 */
export type GetTreasuryAddress = CallResult<
    {
        treasuryAddress: string;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the getScopePrice function call.
 */
export type GetScopePrice = CallResult<
    {
        priceSats: bigint;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the getPackagePrice function call.
 */
export type GetPackagePrice = CallResult<
    {
        priceSats: bigint;
    },
    OPNetEvent<never>[]
>;

// ------------------------------------------------------------------
// IPackageRegistry
// ------------------------------------------------------------------
export interface IPackageRegistry extends IOP_NETContract {
    setTreasuryAddress(treasuryAddress: string): Promise<SetTreasuryAddress>;
    setScopePrice(priceSats: bigint): Promise<SetScopePrice>;
    setPackagePrice(priceSats: bigint): Promise<SetPackagePrice>;
    registerScope(scopeName: string): Promise<RegisterScope>;
    initiateScopeTransfer(scopeName: string, newOwner: Address): Promise<InitiateScopeTransfer>;
    acceptScopeTransfer(scopeName: string): Promise<AcceptScopeTransfer>;
    cancelScopeTransfer(scopeName: string): Promise<CancelScopeTransfer>;
    registerPackage(packageName: string): Promise<RegisterPackage>;
    publishVersion(
        packageName: string,
        version: string,
        ipfsCid: string,
        checksum: Uint8Array,
        signature: Uint8Array,
        mldsaLevel: number,
        opnetVersionRange: string,
        pluginType: number,
        permissionsHash: Uint8Array,
        dependencies: Uint8Array,
    ): Promise<PublishVersion>;
    deprecateVersion(
        packageName: string,
        version: string,
        reason: string,
    ): Promise<DeprecateVersion>;
    undeprecateVersion(packageName: string, version: string): Promise<UndeprecateVersion>;
    initiateTransfer(packageName: string, newOwner: Address): Promise<InitiateTransfer>;
    acceptTransfer(packageName: string): Promise<AcceptTransfer>;
    cancelTransfer(packageName: string): Promise<CancelTransfer>;
    getScope(scopeName: string): Promise<GetScope>;
    getScopeOwner(scopeName: string): Promise<GetScopeOwner>;
    getPackage(packageName: string): Promise<GetPackage>;
    getOwner(packageName: string): Promise<GetOwner>;
    getVersion(packageName: string, version: string): Promise<GetVersion>;
    isDeprecated(packageName: string, version: string): Promise<IsDeprecated>;
    isImmutable(packageName: string, version: string): Promise<IsImmutable>;
    getPendingTransfer(packageName: string): Promise<GetPendingTransfer>;
    getPendingScopeTransfer(scopeName: string): Promise<GetPendingScopeTransfer>;
    getTreasuryAddress(): Promise<GetTreasuryAddress>;
    getScopePrice(): Promise<GetScopePrice>;
    getPackagePrice(): Promise<GetPackagePrice>;
}
