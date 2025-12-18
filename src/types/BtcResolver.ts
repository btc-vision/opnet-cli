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

/** Default price to register a domain (6+ chars): 100,000 sats (0.001 BTC) */
export const DEFAULT_DOMAIN_PRICE_SATS = 100_000n;

/** Tier 0 - ULTRA LEGENDARY (10 BTC): satoshi, bitcoin, eth, binance, coinbase, etc. */
export const PREMIUM_TIER_0_PRICE_SATS = 1_000_000_000n;

/** Tier 1 - LEGENDARY (1 BTC): 1-char domains + top crypto keywords */
export const PREMIUM_TIER_1_PRICE_SATS = 100_000_000n;

/** Tier 2 - PREMIUM (0.25 BTC): 2-char domains + major exchanges/protocols */
export const PREMIUM_TIER_2_PRICE_SATS = 25_000_000n;

/** Tier 3 - HIGH VALUE (0.1 BTC): 3-char domains + high-value keywords */
export const PREMIUM_TIER_3_PRICE_SATS = 10_000_000n;

/** Tier 4 - VALUABLE (0.05 BTC): 4-char domains + valuable keywords */
export const PREMIUM_TIER_4_PRICE_SATS = 5_000_000n;

/** Tier 5 - COMMON PREMIUM (0.01 BTC): 5-char domains + common keywords */
export const PREMIUM_TIER_5_PRICE_SATS = 1_000_000n;

/** Tier 6 - NOTABLE (0.005 BTC): Notable keywords */
export const PREMIUM_TIER_6_PRICE_SATS = 500_000n;

// =========================================================================
// PREMIUM DOMAIN LISTS (for client-side tier detection)
// =========================================================================

/** Tier 0 - Ultra legendary domains (10 BTC) */
export const PREMIUM_TIER_0_DOMAINS: string[] = [
    // Crypto founders & legends
    'satoshi', 'nakamoto', 'vitalik', 'cz', 'sbf', 'gavin', 'hal', 'finney',
    // Core crypto terms
    'bitcoin', 'btc', 'ethereum', 'eth', 'crypto', 'blockchain', 'defi', 'web3',
    'nft', 'dao', 'dex', 'cex', 'token', 'coin', 'wallet', 'exchange',
    // Major exchanges
    'binance', 'coinbase', 'kraken', 'gemini', 'ftx', 'bitfinex', 'bitstamp',
    'huobi', 'okx', 'okex', 'kucoin', 'bybit', 'bitget', 'mexc', 'gateio',
    // Major protocols
    'uniswap', 'aave', 'compound', 'maker', 'curve', 'sushi', 'pancakeswap',
    'opensea', 'blur', 'looksrare', 'rarible', 'foundation',
    // Meme coins
    'pepe', 'doge', 'shiba', 'shib', 'floki', 'bonk', 'wojak', 'meme',
    'dogecoin', 'shibarium', 'babydoge',
    // Tech giants
    'apple', 'google', 'amazon', 'microsoft', 'meta', 'facebook', 'twitter',
    'tesla', 'nvidia', 'intel', 'amd', 'oracle', 'ibm', 'samsung',
    // Premium single words
    'money', 'gold', 'bank', 'pay', 'cash', 'trade', 'invest', 'rich',
    'moon', 'lambo', 'whale', 'alpha', 'sigma', 'chad', 'based',
    'king', 'queen', 'god', 'lord', 'master', 'legend', 'epic', 'rare',
];

/** Tier 1 - Legendary domains (1 BTC) - checked for 1-char + keywords */
export const PREMIUM_TIER_1_DOMAINS: string[] = [
    'swap', 'stake', 'yield', 'farm', 'pool', 'vault', 'bridge', 'layer',
    'chain', 'block', 'hash', 'node', 'miner', 'validator', 'staker',
    'solana', 'sol', 'cardano', 'ada', 'polkadot', 'dot', 'avalanche', 'avax',
    'polygon', 'matic', 'arbitrum', 'arb', 'optimism', 'base', 'zksync',
];

/** Tier 2 - Premium domains (0.25 BTC) - checked for 2-char + keywords */
export const PREMIUM_TIER_2_DOMAINS: string[] = [
    'link', 'atom', 'near', 'algo', 'ftm', 'sand', 'mana', 'axs', 'ape',
    'lido', 'rocket', 'eigen', 'blur', 'magic', 'looks', 'x2y2',
    'safe', 'gnosis', 'ens', 'lens', 'punk', 'bayc', 'mayc', 'azuki',
];

/** Tier 3 - High value domains (0.1 BTC) */
export const PREMIUM_TIER_3_DOMAINS: string[] = [
    'game', 'games', 'play', 'bet', 'casino', 'poker', 'dice', 'slots',
    'news', 'media', 'blog', 'forum', 'chat', 'social', 'network',
    'shop', 'store', 'market', 'buy', 'sell', 'auction', 'bid',
];

/** Tier 4 - Valuable domains (0.05 BTC) */
export const PREMIUM_TIER_4_DOMAINS: string[] = [
    'john', 'james', 'david', 'michael', 'robert', 'william', 'richard',
    'mary', 'jennifer', 'linda', 'elizabeth', 'barbara', 'susan', 'jessica',
    'smith', 'johnson', 'williams', 'brown', 'jones', 'garcia', 'miller',
];

/** Tier 5 - Common premium domains (0.01 BTC) */
export const PREMIUM_TIER_5_DOMAINS: string[] = [
    'hello', 'world', 'test', 'demo', 'example', 'sample', 'default',
    'admin', 'user', 'guest', 'member', 'account', 'profile', 'settings',
];

/** Tier 6 - Notable domains (0.005 BTC) */
export const PREMIUM_TIER_6_DOMAINS: string[] = [
    'about', 'contact', 'help', 'support', 'faq', 'terms', 'privacy',
    'home', 'index', 'main', 'start', 'begin', 'intro', 'welcome',
];

/**
 * Pricing tier information
 */
export interface PricingTier {
    tier: number;
    name: string;
    price: bigint;
    description: string;
}

/**
 * Get pricing tier information for a domain
 * Note: This is a client-side approximation. The contract is the source of truth.
 */
export function getPricingTier(domainName: string): PricingTier {
    const name = domainName.toLowerCase();
    const len = name.length;

    // Check Tier 0 - Ultra Legendary
    if (PREMIUM_TIER_0_DOMAINS.includes(name)) {
        return {
            tier: 0,
            name: 'Ultra Legendary',
            price: PREMIUM_TIER_0_PRICE_SATS,
            description: '10 BTC - Iconic crypto/tech names',
        };
    }

    // 1-char domains are Tier 1
    if (len === 1) {
        return {
            tier: 1,
            name: 'Legendary',
            price: PREMIUM_TIER_1_PRICE_SATS,
            description: '1 BTC - Single character domain',
        };
    }

    // 2-char domains are Tier 2
    if (len === 2) {
        return {
            tier: 2,
            name: 'Premium',
            price: PREMIUM_TIER_2_PRICE_SATS,
            description: '0.25 BTC - Two character domain',
        };
    }

    // Check keyword lists
    if (PREMIUM_TIER_1_DOMAINS.includes(name)) {
        return {
            tier: 1,
            name: 'Legendary',
            price: PREMIUM_TIER_1_PRICE_SATS,
            description: '1 BTC - Top crypto keyword',
        };
    }

    if (PREMIUM_TIER_2_DOMAINS.includes(name)) {
        return {
            tier: 2,
            name: 'Premium',
            price: PREMIUM_TIER_2_PRICE_SATS,
            description: '0.25 BTC - Major protocol/project',
        };
    }

    if (PREMIUM_TIER_3_DOMAINS.includes(name)) {
        return {
            tier: 3,
            name: 'High Value',
            price: PREMIUM_TIER_3_PRICE_SATS,
            description: '0.1 BTC - High-value keyword',
        };
    }

    if (PREMIUM_TIER_4_DOMAINS.includes(name)) {
        return {
            tier: 4,
            name: 'Valuable',
            price: PREMIUM_TIER_4_PRICE_SATS,
            description: '0.05 BTC - Valuable keyword',
        };
    }

    if (PREMIUM_TIER_5_DOMAINS.includes(name)) {
        return {
            tier: 5,
            name: 'Common Premium',
            price: PREMIUM_TIER_5_PRICE_SATS,
            description: '0.01 BTC - Common keyword',
        };
    }

    if (PREMIUM_TIER_6_DOMAINS.includes(name)) {
        return {
            tier: 6,
            name: 'Notable',
            price: PREMIUM_TIER_6_PRICE_SATS,
            description: '0.005 BTC - Notable keyword',
        };
    }

    // Length-based pricing for non-keyword domains
    if (len === 3) {
        return {
            tier: 3,
            name: 'High Value',
            price: PREMIUM_TIER_3_PRICE_SATS,
            description: '0.1 BTC - Three character domain',
        };
    }

    if (len === 4) {
        return {
            tier: 4,
            name: 'Valuable',
            price: PREMIUM_TIER_4_PRICE_SATS,
            description: '0.05 BTC - Four character domain',
        };
    }

    if (len === 5) {
        return {
            tier: 5,
            name: 'Common Premium',
            price: PREMIUM_TIER_5_PRICE_SATS,
            description: '0.01 BTC - Five character domain',
        };
    }

    // Default pricing (6+ chars)
    return {
        tier: 7,
        name: 'Standard',
        price: DEFAULT_DOMAIN_PRICE_SATS,
        description: '0.001 BTC - Standard domain',
    };
}

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
export type TransferDomain = CallResult<{}, OPNetEvent<DomainTransferCompletedEvent>[]>;
export type TransferDomainBySignature = CallResult<{}, OPNetEvent<DomainTransferCompletedEvent>[]>;
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

    // Domain transfers (two-step)
    initiateTransfer(domainName: string, newOwner: Address): Promise<InitiateTransfer>;
    acceptTransfer(domainName: string): Promise<AcceptTransfer>;
    cancelTransfer(domainName: string): Promise<CancelTransfer>;

    // Domain transfers (direct)
    transferDomain(domainName: string, newOwner: Address): Promise<TransferDomain>;
    transferDomainBySignature(
        ownerAddress: Uint8Array,
        ownerTweakedPublicKey: Uint8Array,
        domainName: string,
        newOwner: Address,
        deadline: bigint,
        signature: Uint8Array,
    ): Promise<TransferDomainBySignature>;

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
