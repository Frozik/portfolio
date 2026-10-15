import { describeSubtleCryptoContract } from '../testing/subtle-crypto-contract';

describeSubtleCryptoContract('Node WebCrypto', () => crypto.subtle);
