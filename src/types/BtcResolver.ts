/**
 * BtcResolver Contract Type Definitions
 *
 * Types for the BTC Name Resolver contract that manages .btc domains
 * and contenthash storage for decentralized websites.
 */

import { Address } from '@btc-vision/transaction';
import { CallResult, IOP_NETContract, OPNetEvent } from 'opnet';

// =========================================================================
// CONTENTHASH TYPES
// =========================================================================

/** CIDv0 (Qm... prefixed, base58btc, 46 chars) */
export const CONTENTHASH_TYPE_CIDv0 = 1;
/** CIDv1 (bafy... prefixed, base32) */
export const CONTENTHASH_TYPE_CIDv1 = 2;
/** IPNS identifier (k... prefixed, base36) */
export const CONTENTHASH_TYPE_IPNS = 3;
/** Raw SHA-256 hash (32 bytes, stored as u256) */
export const CONTENTHASH_TYPE_SHA256 = 4;

export type ContenthashType =
    | typeof CONTENTHASH_TYPE_CIDv0
    | typeof CONTENTHASH_TYPE_CIDv1
    | typeof CONTENTHASH_TYPE_IPNS
    | typeof CONTENTHASH_TYPE_SHA256;

// =========================================================================
// PRICING CONSTANTS (in satoshis)
// =========================================================================

/** Default price to register a domain: 100,000 sats */
export const DEFAULT_DOMAIN_PRICE_SATS = 100_000n;
/** Premium pricing for short domains (3 chars): 1,000,000 sats */
export const PREMIUM_3_CHAR_PRICE_SATS = 1_000_000n;
/** Premium pricing for short domains (4 chars): 500,000 sats */
export const PREMIUM_4_CHAR_PRICE_SATS = 500_000n;

// =========================================================================
// EVENT DEFINITIONS
// =========================================================================

export type DomainRegisteredEvent = {
    readonly domainHash: bigint;
    readonly owner: Address;
    readonly timestamp: bigint;
};

export type DomainTransferInitiatedEvent = {
    readonly domainHash: bigint;
    readonly currentOwner: Address;
    readonly newOwner: Address;
    readonly timestamp: bigint;
};

export type DomainTransferCompletedEvent = {
    readonly domainHash: bigint;
    readonly previousOwner: Address;
    readonly newOwner: Address;
    readonly timestamp: bigint;
};

export type DomainTransferCancelledEvent = {
    readonly domainHash: bigint;
    readonly owner: Address;
    readonly timestamp: bigint;
};

export type SubdomainCreatedEvent = {
    readonly parentDomainHash: bigint;
    readonly subdomainHash: bigint;
    readonly owner: Address;
    readonly timestamp: bigint;
};

export type SubdomainDeletedEvent = {
    readonly parentDomainHash: bigint;
    readonly subdomainHash: bigint;
    readonly timestamp: bigint;
};

export type ContenthashChangedEvent = {
    readonly nameHash: bigint;
    readonly contenthashType: number;
    readonly timestamp: bigint;
};

export type ContenthashClearedEvent = {
    readonly nameHash: bigint;
    readonly timestamp: bigint;
};

export type TTLChangedEvent = {
    readonly nameHash: bigint;
    readonly oldTTL: bigint;
    readonly newTTL: bigint;
    readonly timestamp: bigint;
};

export type DomainPriceChangedEvent = {
    readonly oldPrice: bigint;
    readonly newPrice: bigint;
    readonly timestamp: bigint;
};

export type TreasuryChangedEvent = {
    readonly previousAddressHash: bigint;
    readonly newAddressHash: bigint;
    readonly timestamp: bigint;
};

// =========================================================================
// CALL RESULTS
// =========================================================================

export type SetTreasuryAddress = CallResult<{}, OPNetEvent<TreasuryChangedEvent>[]>;
export type SetDomainPrice = CallResult<{}, OPNetEvent<DomainPriceChangedEvent>[]>;
export type RegisterDomain = CallResult<{}, OPNetEvent<DomainRegisteredEvent>[]>;
export type InitiateTransfer = CallResult<{}, OPNetEvent<DomainTransferInitiatedEvent>[]>;
export type AcceptTransfer = CallResult<{}, OPNetEvent<DomainTransferCompletedEvent>[]>;
export type CancelTransfer = CallResult<{}, OPNetEvent<DomainTransferCancelledEvent>[]>;
export type CreateSubdomain = CallResult<{}, OPNetEvent<SubdomainCreatedEvent>[]>;
export type DeleteSubdomain = CallResult<{}, OPNetEvent<SubdomainDeletedEvent>[]>;
export type SetContenthashCIDv0 = CallResult<{}, OPNetEvent<ContenthashChangedEvent>[]>;
export type SetContenthashCIDv1 = CallResult<{}, OPNetEvent<ContenthashChangedEvent>[]>;
export type SetContenthashIPNS = CallResult<{}, OPNetEvent<ContenthashChangedEvent>[]>;
export type SetContenthashSHA256 = CallResult<{}, OPNetEvent<ContenthashChangedEvent>[]>;
export type ClearContenthash = CallResult<{}, OPNetEvent<ContenthashClearedEvent>[]>;
export type SetTTL = CallResult<{}, OPNetEvent<TTLChangedEvent>[]>;

export type GetDomain = CallResult<
    {
        exists: boolean;
        owner: Address;
        createdAt: bigint;
        ttl: bigint;
    },
    OPNetEvent<never>[]
>;

export type GetSubdomain = CallResult<
    {
        exists: boolean;
        owner: Address;
        parentHash: Uint8Array;
        ttl: bigint;
    },
    OPNetEvent<never>[]
>;

export type GetContenthash = CallResult<
    {
        hashType: number;
        hashData: Uint8Array;
        hashString: string;
    },
    OPNetEvent<never>[]
>;

export type Resolve = CallResult<
    {
        owner: Address;
    },
    OPNetEvent<never>[]
>;

export type GetPendingTransfer = CallResult<
    {
        pendingOwner: Address;
        initiatedAt: bigint;
    },
    OPNetEvent<never>[]
>;

export type GetTreasuryAddress = CallResult<
    {
        treasuryAddress: string;
    },
    OPNetEvent<never>[]
>;

export type GetDomainPrice = CallResult<
    {
        priceSats: bigint;
    },
    OPNetEvent<never>[]
>;

export type GetBaseDomainPrice = CallResult<
    {
        priceSats: bigint;
    },
    OPNetEvent<never>[]
>;

// =========================================================================
// CONTRACT INTERFACE
// =========================================================================

export interface IBtcResolver extends IOP_NETContract {
    // Admin methods
    setTreasuryAddress(treasuryAddress: string): Promise<SetTreasuryAddress>;
    setDomainPrice(priceSats: bigint): Promise<SetDomainPrice>;

    // Domain registration
    registerDomain(domainName: string): Promise<RegisterDomain>;

    // Domain transfers
    initiateTransfer(domainName: string, newOwner: Address): Promise<InitiateTransfer>;
    acceptTransfer(domainName: string): Promise<AcceptTransfer>;
    cancelTransfer(domainName: string): Promise<CancelTransfer>;

    // Subdomain management
    createSubdomain(
        parentDomain: string,
        subdomainLabel: string,
        subdomainOwner: Address,
    ): Promise<CreateSubdomain>;
    deleteSubdomain(parentDomain: string, subdomainLabel: string): Promise<DeleteSubdomain>;

    // Contenthash management
    setContenthashCIDv0(name: string, cid: string): Promise<SetContenthashCIDv0>;
    setContenthashCIDv1(name: string, cid: string): Promise<SetContenthashCIDv1>;
    setContenthashIPNS(name: string, ipnsId: string): Promise<SetContenthashIPNS>;
    setContenthashSHA256(name: string, hash: Uint8Array): Promise<SetContenthashSHA256>;
    clearContenthash(name: string): Promise<ClearContenthash>;

    // TTL management
    setTTL(name: string, ttl: bigint): Promise<SetTTL>;

    // View methods
    getDomain(domainName: string): Promise<GetDomain>;
    getSubdomain(fullName: string): Promise<GetSubdomain>;
    getContenthash(name: string): Promise<GetContenthash>;
    resolve(name: string): Promise<Resolve>;
    getPendingTransfer(domainName: string): Promise<GetPendingTransfer>;
    getTreasuryAddress(): Promise<GetTreasuryAddress>;
    getDomainPrice(domainName: string): Promise<GetDomainPrice>;
    getBaseDomainPrice(): Promise<GetBaseDomainPrice>;
}
