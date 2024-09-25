import { ABIRegistry, Blockchain } from '@btc-vision/btc-runtime/runtime';
import { <%CONTRACT_NAME%> } from './contracts/<%CONTRACT_NAME%>';

export function defineSelectors(): void {
    /** OP_NET */
    ABIRegistry.defineGetterSelector('address', false);
    ABIRegistry.defineGetterSelector('owner', false);
    ABIRegistry.defineMethodSelector('isAddressOwner', false);

    // <%CONTRACT_NAME%> contract
    /*
    Register your contract functions here using the ABIRegistry.defineMethodSelector();
    First parameter is the contract function name.
    Second parameter is a boolean indicating if the function can write.
    */
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
