import { ABIRegistry, Blockchain } from '@btc-vision/btc-runtime/runtime';
import { <%CONTRACT_NAME%> } from './contracts/<%CONTRACT_NAME%>';

export function defineSelectors(): void {
    /** OP_NET */
    ABIRegistry.defineGetterSelector('address', false);
    ABIRegistry.defineGetterSelector('owner', false);
    ABIRegistry.defineMethodSelector('isAddressOwner', false);

    /** OP_20 */
    ABIRegistry.defineMethodSelector('allowance', false);
    ABIRegistry.defineMethodSelector('approve', true);
    ABIRegistry.defineMethodSelector('balanceOf', false);
    ABIRegistry.defineMethodSelector('burn', true);
    ABIRegistry.defineMethodSelector('mint', true);
    ABIRegistry.defineMethodSelector('transfer', true);
    ABIRegistry.defineMethodSelector('transferFrom', true);

    ABIRegistry.defineGetterSelector('decimals', false);
    ABIRegistry.defineGetterSelector('name', false);
    ABIRegistry.defineGetterSelector('symbol', false);
    ABIRegistry.defineGetterSelector('totalSupply', false);
    ABIRegistry.defineGetterSelector('maxSupply', false);
    
    ABIRegistry.defineMethodSelector('airdrop', true);
}

// DO NOT TOUCH TO THIS.
Blockchain.contract = () => {
    // ONLY CHANGE THE CONTRACT CLASS NAME.
    const contract = new <%CONTRACT_NAME%>();
    contract.onInstantiated();

    // DO NOT ADD CUSTOM LOGIC HERE.

    return contract;
}

// VERY IMPORTANT
export * from '@btc-vision/btc-runtime/runtime/exports';