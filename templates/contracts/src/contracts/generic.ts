import { u128, u256 } from 'as-bignum/assembly';

import {
    Address,
    AddressMemoryMap,
    Blockchain,
    BytesWriter,
    Calldata,
    encodeSelector,
    MemorySlotData,
    OP_NET,
    OP20Utils,
    Revert,
    SafeMath,
    Selector,
    StoredU256,
    TransferHelper,
} from '@btc-vision/btc-runtime/runtime';

@final
export class <%CONTRACT_NAME%> extends OP_NET {

    constructor() {
        super();
    }

    // "solidityLikeConstructor" This is a solidity-like constructor. This method will only run once.
    public onInstantiated(): void {
        if(!this.isInstantiated) {
            super.onInstantiated(); // IMPORTANT.

        // Add your logic here.
    }
}

    public override callMethod(method: Selector, calldata: Calldata): BytesWriter {
        switch (method) {
            /*
            case encodeSelector('YOUR_METHOD_NAME_HERE'):
                return this.YOUR_METHOD_NAME_HERE(calldata);
            */
            default:
                return super.callMethod(method, calldata);
        }
    }

    public override callView(method: Selector): BytesWriter {
        const response = new BytesWriter();

        switch (method) {
            /*
           case encodeSelector('YOUR_METHOD_NAME_HERE'):
               return this.YOUR_METHOD_NAME_HERE();
           */
            default:
                return super.callView(method);
        }

        return response;
    }
}
