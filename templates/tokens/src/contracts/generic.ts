import { u128, u256 } from 'as-bignum/assembly';
import {
    Address,
    BytesWriter,
    Calldata,
    encodeSelector,
    Map,
    OP_20,
    OP20Utils,
    Selector,
} from '@btc-vision/btc-runtime/runtime';

@final
export class <%CONTRACT_NAME%> extends OP_20 {
    constructor() {
        super(u128.fromString('<%TOKEN_MAX_SUPPLY%>').toU256(), <%TOKEN_DECIMALS%>, '<%TOKEN_NAME%>', '<%TOKEN_SYMBOL%>');
    }

    // "solidityLikeConstructor" This is a solidity-like constructor. This method will only run once.
    public onInstantiated(): void {
        if(!this.isInstantiated) {
            super.onInstantiated(); // IMPORTANT.

            // Add your logic here. Eg, minting the initial supply:
            // this._mint(Blockchain.origin, maxSupply);
        }
}

    public override callMethod(method: Selector, calldata: Calldata): BytesWriter {
        switch (method) {
            /*
            case encodeSelector('YOUR_METHOD_NAME_HERE'):
                return this.YOUR_METHOD_NAME_HERE(calldata);
            */
            case encodeSelector('airdrop'):
                return this.airdrop(calldata);
            default:
                return super.callMethod(method, calldata);
        }
    }

    private airdrop(calldata: Calldata): BytesWriter {
        const drops: Map<Address, u256> = calldata.readAddressValueTuple();

        const addresses: Address[] = drops.keys();
        for (let i: i32 = 0; i < addresses.length; i++) {
            const address = addresses[i];
            const amount = drops.get(address);

            this._mint(address, amount);
        }

        const writer: BytesWriter = new BytesWriter();
        writer.writeBoolean(true);

        return writer;
    }
}