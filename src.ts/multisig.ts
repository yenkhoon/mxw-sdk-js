'use strict';

import * as errors from './errors';
import { Provider, TransactionRequest, TransactionResponse, TransactionReceipt, BlockTag, AccountState, MultiSigPendingTx } from './providers/abstract-provider';
import { Signer } from './abstract-signer';

import { defineReadOnly, resolveProperties, checkProperties } from './utils/properties';
import { populateTransaction, parse as parseTransaction } from './utils/transaction';

import { checkFormat, checkString, checkNumber, checkAny, checkBigNumber, isUndefinedOrNullOrEmpty } from './utils/misc';
import { BigNumberish, Arrayish, getMultiSigAddress, BigNumber, bigNumberify } from './utils';
import { smallestUnitName } from './utils/units';

export interface MultiSigWalletProperties {
    threshold: number,
    signers: string[],
}

export interface UpdateMultiSigWalletProperties {
    owner: string,
    groupAddress: string,
    threshold: number,
    signers: any,
}

export class MultiSigWallet extends Signer {

    readonly provider: Provider;
    readonly signer: Signer;

    private groupAddress: string;
    private _multisigAccountState: AccountState;
    private accountNumber: BigNumber;

    constructor(groupAddress: string, signerOrProvider: Signer | Provider) {
        super();
        errors.checkNew(this, MultiSigWallet);
        if (!groupAddress) {
            errors.throwError('group address is required', errors.MISSING_ARGUMENT, { arg: 'group address' });
        }
        defineReadOnly(this, 'groupAddress', groupAddress);

        if (Signer.isSigner(signerOrProvider)) {
            defineReadOnly(this, 'provider', signerOrProvider.provider);
            defineReadOnly(this, 'signer', signerOrProvider);
        } else if (Provider.isProvider(signerOrProvider)) {
            defineReadOnly(this, 'provider', signerOrProvider);
            defineReadOnly(this, 'signer', null);
        } else {
            errors.throwError('invalid signer or provider', errors.INVALID_ARGUMENT, { arg: 'signerOrProvider', value: signerOrProvider });
        }
    }

    get multisigAccountState() {
        return this._multisigAccountState;
    }
    get address(): string { return this.groupAddress; }
    get hexAddress(): string { return ""; }

    get isUsable() {
        if (!this.groupAddress) {
            errors.throwError('not initialized', errors.NOT_INITIALIZED, { arg: 'groupAddress' });
        }
        return true;
    }

    getAddress() {
        return Promise.resolve(this.address);
    }

    getHexAddress() {
        return Promise.resolve(this.hexAddress);
    }

    getPublicKeyType() {
        return errors.throwError('multisig wallet does not have public key', errors.NOT_IMPLEMENTED, {});
    }

    getCompressedPublicKey() {
        return errors.throwError('multisig wallet does not have public key', errors.NOT_IMPLEMENTED, {});
    }

    sign(transaction: TransactionRequest, overrides?: any) {
        return errors.throwError('multisig wallet does not have private key for signing', errors.NOT_IMPLEMENTED, {});
    }

    signMessage(message: Arrayish | string, excludeRecoveryParam?: boolean) {
        return errors.throwError('multisig wallet does not have private key for signing', errors.NOT_IMPLEMENTED, {});
    }

    sendTransaction(transaction: TransactionRequest, overrides?: any) {
        return errors.throwError('multisig wallet does not support send transaction', errors.NOT_IMPLEMENTED, {});
    }

    createTransaction(transaction: TransactionRequest, overrides?: any): Promise<TransactionResponse | TransactionReceipt> {
        return this.getCreateTransactionRequest(transaction, overrides).then((tx) => {
            return this.sendRawTransaction(tx, overrides).then((response) => {
                if (overrides && overrides.sendOnly) {
                    return response;
                }
                let confirmations = (overrides && overrides.confirmations) ? Number(overrides.confirmations) : null;

                return this.signer.provider.waitForTransaction(response.hash, confirmations).then((receipt) => {
                    if (1 == receipt.status) {
                        return receipt;
                    }
                    throw this.signer.provider.checkTransactionReceipt(receipt, errors.CALL_EXCEPTION, "create multisig transaction failed", {
                        method: "auth-createMutiSigTx",
                        receipt,
                        response
                    });
                });
            });
        });
    }

    getCreateTransactionRequest(transaction: TransactionRequest, overrides?: any) {
        if (!this.signer) {
            errors.throwError('create multisig transaction require signer', errors.NOT_INITIALIZED, { arg: 'signer' });
        }
        if (!this.provider) {
            errors.throwError("missing provider", errors.NOT_INITIALIZED, { arg: "provider" });
        }

        return resolveProperties({ signerAddress: this.signer.getAddress() }).then(({ signerAddress }) => {
            if (!signerAddress) {
                return errors.throwError('create multisig transaction', errors.MISSING_ARGUMENT, { arg: 'signerAddress' });
            }
            return populateTransaction(transaction, this.provider, signerAddress, overrides).then((internalTransaction) => {
                return this.signInternalTransaction(internalTransaction, overrides).then((signedInternalTransaction) => {
                    if (signedInternalTransaction.hash) {
                        delete signedInternalTransaction.hash;
                    }
                    let tx = this.provider.getTransactionRequest("multisig", "auth-createMutiSigTx", {
                        groupAddress: this.groupAddress,
                        stdTx: signedInternalTransaction.value,
                        sender: signerAddress,
                        memo: (overrides && overrides.memo) ? overrides.memo : ""
                    });
                    tx.fee = (overrides && overrides.fee) ? overrides.fee : this.provider.getTransactionFee(undefined, undefined, { tx });

                    return tx;
                });
            });
        });
    }

    confirmTransaction(transactionId: BigNumberish, overrides?: any) {
        return this.getConfirmTransactionRequest(transactionId, overrides).then((tx) => {
            return this.sendRawTransaction(tx, overrides).then((response) => {
                if (overrides && overrides.sendOnly) {
                    return response;
                }
                let confirmations = (overrides && overrides.confirmations) ? Number(overrides.confirmations) : null;

                return this.signer.provider.waitForTransaction(response.hash, confirmations).then((receipt) => {
                    if (1 == receipt.status) {
                        return receipt;
                    }
                    throw this.signer.provider.checkTransactionReceipt(receipt, errors.CALL_EXCEPTION, "confirm multisig transaction failed", {
                        method: "auth-signMutiSigTx",
                        receipt,
                        response
                    });
                });
            });
        });
    }

    getConfirmTransactionRequest(transactionId: BigNumberish, overrides?: any) {
        if (!this.signer) {
            errors.throwError('confirm multisig transaction require signer', errors.NOT_INITIALIZED, { arg: 'signer' });
        }
        if (!this.provider) {
            errors.throwError("missing provider", errors.NOT_INITIALIZED, { arg: "provider" });
        }

        return this.getPendingTransactionRequest(transactionId, overrides).then((pendingTx) => {
            return populateTransaction(pendingTx, this.provider, this.signer.getAddress(), overrides).then((internalPendingTransaction) => {
                return this.signInternalTransaction(internalPendingTransaction, overrides);
            }).then((signedPendingTx) => {
                return resolveProperties({ signerAddress: this.signer.getAddress() }).then(({ signerAddress }) => {
                    let tx = this.provider.getTransactionRequest("multisig", "auth-signMutiSigTx", {
                        groupAddress: this.groupAddress,
                        txId: transactionId,
                        sender: signerAddress,
                        // there is always signed by one signer for pendingTx so take the first one.
                        signature: signedPendingTx.value.signatures[0],
                        memo: (overrides && overrides.memo) ? overrides.memo : ""
                    });
                    tx.fee = (overrides && overrides.fee) ? overrides.fee : this.provider.getTransactionFee(undefined, undefined, { tx });

                    return tx;
                });
            });
        });
    }

    private getPendingTransactionRequest(transactionId: BigNumberish, overrides?: any) {
        return this.getPendingTx(transactionId.toString(), null, overrides).then((pendingTx) => {
            if (!pendingTx) {
                return errors.throwError('confirm multisig transaction failed, pending tx not found', errors.MISSING_ARGUMENT, { arg: 'transactionId' });
            }
            return pendingTx;
        }).then((pendingTx) => {
            // delete the returned signatures, we don need those to be include in signing payload.
            delete pendingTx.value.signatures;

            let tx: TransactionRequest = {
                type: pendingTx.type,
                value: {
                    msg: pendingTx.value.msg,
                    memo: pendingTx.value.memo
                },
                fee: pendingTx.value.fee,
                accountNumber: this.multisigAccountState.value.accountNumber
            }
            // signing pending tx the counter(nonce) will be transactionId.
            overrides = {
                ...overrides,
                nonce: transactionId.toString()
            }

            return tx;
        });
    }

    private signInternalTransaction(transaction: TransactionRequest, overrides?: any) {
        if (!this.signer) {
            errors.throwError('sign multisig transaction require signer', errors.NOT_INITIALIZED, { arg: 'signer' });
        }

        if (!this._multisigAccountState) {
            errors.throwError('multisig account state not found', errors.NOT_INITIALIZED, { arg: 'multisigAccountState' })
        }
        let override = {
            ...overrides,
            accountNumber: this.multisigAccountState.value.accountNumber,
            // cater for send confirm transaction, the counter will be using txId.
            nonce: (overrides && !isUndefinedOrNullOrEmpty(overrides.nonce)) ? bigNumberify(overrides.nonce) : this.multisigAccountState.value.multisig.counter
        }
        return this.signer.sign(transaction, override).then((signedTransaction) => {
            // Decode base64 signed transaction
            return parseTransaction(signedTransaction);
        });
    }


    private sendRawTransaction(transaction: TransactionRequest, overrides?: any) {
        // Removing multisig signature elements, so that it will be using wallet signature instead of multisig.
        if (overrides && overrides["accountNumber"]) {
            delete overrides["accountNumber"];
        }
        if (overrides && overrides["nonce"] !== null)  {
            delete overrides["nonce"];
        }
        return this.signer.sign(transaction, overrides).then((signedTransaction) => {
            return this.provider.sendTransaction(signedTransaction, overrides).catch(error => {
                // Clear the cached nonce when failure happened to prevent it out of sequence
                this.clearNonce();
                throw error;
            });
        });
    }

    /**
    * Create multisig wallet
    * @param properties multisig properties
    * @param signer signer wallet (owner of the group account)
    * @param overrides options
    */
    static create(properties: MultiSigWalletProperties, signer: Signer, overrides?: any): Promise<TransactionResponse | MultiSigWallet> {
        return this.getCreateTransactionRequest(properties, signer, overrides).then((tx) => {
            return signer.sendTransaction(tx, overrides).then((response) => {
                if (overrides && overrides.sendOnly) {
                    return response;
                }
                let confirmations = (overrides && overrides.confirmations) ? Number(overrides.confirmations) : null;

                return signer.provider.waitForTransaction(response.hash, confirmations).then((receipt) => {
                    if (1 == receipt.status) {
                        return resolveProperties({ signerAddress: signer.getAddress() }).then(({ signerAddress }) => {
                            let groupAddress = getMultiSigAddress(signerAddress, signer.getNonce().add(1))
                            return new MultiSigWallet(groupAddress, signer);
                        });
                    }
                    throw signer.provider.checkTransactionReceipt(receipt, errors.CALL_EXCEPTION, "create multisig wallet failed", {
                        method: "auth-createMultiSigAccount",
                        receipt
                    });
                });
            });
        });
    }

    static getCreateTransactionRequest(properties: MultiSigWalletProperties, signer: Signer, overrides?: any): Promise<TransactionRequest> {
        if (!Signer.isSigner(signer)) {
            errors.throwError('create multisig wallet transaction require signer', errors.MISSING_ARGUMENT, { arg: 'signer' });
        }
        if (properties && 'string' === typeof (properties)) {
            properties = JSON.parse(properties);
        }

        checkProperties(properties, {
            threshold: true,
            signers: true,
        }, true);

        return resolveProperties({ signerAddress: signer.getAddress() }).then(({ signerAddress }) => {
            if (!signerAddress) {
                errors.throwError('create multisig wallet require signer address', errors.MISSING_ARGUMENT, { required: 'signer' });
            }

            let multisig: MultiSigWalletProperties = checkFormat({
                threshold: checkNumber,
                signers: checkAny,
            }, properties);

            let tx = signer.provider.getTransactionRequest("multisig", "auth-createMultiSigAccount", {
                from: signerAddress,
                threshold: multisig.threshold,
                signers: multisig.signers,
                memo: (overrides && overrides.memo) ? overrides.memo : ""
            });
            tx.fee = (overrides && overrides.fee) ? overrides.fee : signer.provider.getTransactionFee(undefined, undefined, { tx });

            return tx;
        });
    }

    static update(properties: UpdateMultiSigWalletProperties, signer: Signer, overrides?: any): Promise<TransactionResponse | TransactionReceipt> {
        return this.getUpdateTransactionRequest(properties, signer, overrides).then((tx) => {
            return signer.sendTransaction(tx, overrides).then((response) => {
                if (overrides && overrides.sendOnly) {
                    return response;
                }
                let confirmations = (overrides && overrides.confirmations) ? Number(overrides.confirmations) : null;

                return signer.provider.waitForTransaction(response.hash, confirmations).then((receipt) => {
                    if (1 == receipt.status) {
                        return receipt;
                    }
                    throw signer.provider.checkTransactionReceipt(receipt, errors.CALL_EXCEPTION, "update multisig wallet failed", {
                        method: "auth-updateMultiSigAccount",
                        receipt
                    });
                });
            });
        });
    }

    static getUpdateTransactionRequest(properties: UpdateMultiSigWalletProperties, signer: Signer, overrides?: any): Promise<TransactionRequest> {
        if (!Signer.isSigner(signer)) {
            errors.throwError('update multisig wallet transaction require signer', errors.MISSING_ARGUMENT, { arg: 'signer' });
        }
        if (properties && 'string' === typeof (properties)) {
            properties = JSON.parse(properties);
        }
        checkProperties(properties, {
            owner: true,
            groupAddress: true,
            threshold: true,
            signers: true,
        }, true);
        return resolveProperties({ address: signer.getAddress() }).then(({ address }) => {
            if (!address) {
                errors.throwError('update multisig wallet require signer address', errors.MISSING_ARGUMENT, { required: 'signer' });
            }
            properties.owner = address; // Set signer address as owner
            let multisig: UpdateMultiSigWalletProperties = checkFormat({
                owner: checkString,
                groupAddress: checkString,
                threshold: checkBigNumber,
                signers: checkAny,
            }, properties);
            let tx = signer.provider.getTransactionRequest("multisig", "auth-updateMultiSigAccount", {
                owner: multisig.owner,
                groupAddress: multisig.groupAddress,
                threshold: multisig.threshold,
                signers: multisig.signers,
                memo: (overrides && overrides.memo) ? overrides.memo : ""
            });
            tx.fee = (overrides && overrides.fee) ? overrides.fee : signer.provider.getTransactionFee(undefined, undefined, { tx });

            return tx;
        });
    }

    /**
     * Load MultiSigWallet instance by address
     * @param symbol token symbol
     * @param signerOrProvider wallet object
     * @param overrides options
     */
    static fromGroupAddress(groupAddress: string, signerOrProvider: Signer | Provider, overrides?: any) {
        let groupAcc = new MultiSigWallet(groupAddress, signerOrProvider);
        return groupAcc.refresh(overrides).then(() => {
            return groupAcc;
        });
    }

    /**
     * Query token account
     * @param blockTag reserved for future
     * @param overrides options
     */
    getPendingTx(txID: string, blockTag?: BlockTag, overrides?: any): Promise<MultiSigPendingTx> {
        if (!this.provider) {
            errors.throwError('not initialized', errors.NOT_INITIALIZED, { arg: 'itemID' });
        }
        if (!this.groupAddress) {
            errors.throwError('query multisig pending tx group address', errors.MISSING_ARGUMENT, { arg: 'groupAddress' });
        }

        return this.provider.getMultiSigPendingTx(this.groupAddress, txID, blockTag).then((result) => {
            if (!result) {
                errors.throwError('Pending tx is not available', errors.NOT_AVAILABLE, { arg: 'groupAddress' });
            }
            return result;
        });
    }

    refresh(overrides?: any) {
        return this.getState(null, { ...overrides, queryOnly: true }).then((state) => {
            this._multisigAccountState = state;
            return this;
        });
    }

    getState(blockTag?: BlockTag, overrides?: any) {
        if (!this.groupAddress) {
            errors.throwError('not initialized', errors.NOT_INITIALIZED, { arg: 'symbol' });
        }
        if (!this.provider) {
            errors.throwError('not initialized', errors.NOT_INITIALIZED, { arg: 'itemID' });
        }
        return this.provider.getAccountState(this.groupAddress, blockTag).then((result) => {
            if (!result) {
                errors.throwError('Group account state is not available', errors.NOT_AVAILABLE, { arg: 'groupAddress' });
            }
            if (this.groupAddress != result.value.address) {
                errors.throwError('Group account address mismatch', errors.UNEXPECTED_RESULT, { expected: this.groupAddress, returned: result });
            }
            if (!(overrides && overrides.queryOnly)) {
                this._multisigAccountState = result;
            }
            return result;
        });
    }

    getBalance(blockTag?: BlockTag) {
        if (!this.provider) { errors.throwError('missing provider', errors.NOT_INITIALIZED, { argument: 'provider' }); }
        return this.provider.getBalance(this.groupAddress, blockTag);
    }

    getAccountNumber(blockTag?: BlockTag) {
        if (!this.provider) { errors.throwError('missing provider', errors.NOT_INITIALIZED, { argument: 'provider' }); }
        if (!this.accountNumber) {
            return this.provider.getAccountNumber(this.address, blockTag).then((accountNumber) => {
                this.accountNumber = accountNumber;
                return Promise.resolve(this.accountNumber);
            });
        }
        return Promise.resolve(this.accountNumber);
    }

    transfer(addressOrName: string | Promise<string>, value: BigNumberish, overrides?: any): Promise<TransactionResponse | TransactionReceipt> {
        return this.getTransferTransactionRequest(addressOrName, value, overrides).then((tx) => {
            return this.createTransaction(tx, overrides);
        });
    }

    getTransferTransactionRequest(addressOrName: string | Promise<string>, value: BigNumberish, overrides?: any): Promise<TransactionRequest> {
        if (!this.provider) { errors.throwError('missing provider', errors.NOT_INITIALIZED, { argument: 'provider' }); }

        if (addressOrName instanceof Promise) {
            return addressOrName.then((address) => {
                return this.getTransferTransactionRequest(address, value, overrides);
            });
        }

        return this.provider.resolveName(addressOrName).then((address) => {
            let tx = this.provider.getTransactionRequest("bank", "bank-send", {
                from: this.address,
                to: address,
                value: value,
                memo: (overrides && overrides.memo) ? overrides.memo : "",
                denom: (overrides && overrides.denom) ? overrides.denom : smallestUnitName
            });
            tx.fee = (overrides && overrides.fee) ? overrides.fee : this.provider.getTransactionFee(undefined, undefined, { tx });

            return tx;
        });
    }

    getNonce() {
        if (!this.signer) {
            errors.throwError('get nonce require signer', errors.NOT_INITIALIZED, { arg: 'signer' });
        }
        return this.signer.getNonce();
    }

    clearNonce() {
        if (!this.signer) {
            errors.throwError('clear nonce require signer', errors.NOT_INITIALIZED, { arg: 'signer' });
        }
        this.signer.clearNonce();
    }
}