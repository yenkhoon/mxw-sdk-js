'use strict';

import { describe, it } from 'mocha';
import { expect } from 'chai';
import { mxw, MultiSig } from '../src.ts/index';
import { nodeProvider } from "./env";
//import { smallestUnitName } from './utils/units';

let indent = "     ";
let silent = true;
let silentRpc = true;
let slowThreshold = 90;

let providerConnection: mxw.providers.Provider;
let multisig_acc1: mxw.Wallet;
let multisig_acc2: mxw.Wallet;
let multisig_acc3: mxw.Wallet;
let multisig_acc4: mxw.Wallet;

let multiSigWalletProperties: MultiSig.MultiSigWalletProperties;
let updateMultiSigWalletProperties: MultiSig.UpdateMultiSigWalletProperties;

let multiSigWallet: MultiSig.MultiSigWallet;

// TODO: move these to env.ts
const defaultOverrides = {
    logSignaturePayload: function (payload) {
        if (!silentRpc) console.log(indent, "signaturePayload:", JSON.stringify(payload));
    },
    logSignedTransaction: function (signedTransaction) {
        if (!silentRpc) console.log(indent, "signedTransaction:", signedTransaction);
    },
    memo: "",
    commit: false,
    async: false
}

const commitOverrides = {
    logSignaturePayload: function (payload) {
        if (!silentRpc) console.log(indent, "signaturePayload:", JSON.stringify(payload));
    },
    logSignedTransaction: function (signedTransaction) {
        if (!silentRpc) console.log(indent, "signedTransaction:", signedTransaction);
    },
    memo: "",
    commit: true,
    async: false
}

describe('Suite: MultiSignature Wallet', function () {
    this.slow(slowThreshold); // define the threshold for slow indicator

    if (silent) { silent = nodeProvider.trace.silent; }
    if (silentRpc) { silentRpc = nodeProvider.trace.silentRpc; }

    it("Initialize", function () {
        providerConnection = new mxw.providers.JsonRpcProvider(nodeProvider.connection, nodeProvider)
            .on("rpc", function (args) {
                if (!silentRpc) {
                    if ("response" == args.action) {
                        console.log(indent, "RPC REQ:", JSON.stringify(args.request));
                        console.log(indent, "    RES:", JSON.stringify(args.response));
                    }
                }
            }).on("responseLog", function (args) {
                if (!silentRpc) {
                    console.log(indent, "RES LOG:", JSON.stringify({ info: args.info, response: args.response }));
                }
            });

        multisig_acc1 = mxw.Wallet.fromMnemonic(nodeProvider.multisig.multisig_acc1).connect(providerConnection);
        expect(multisig_acc1).to.exist;

        multisig_acc2 = mxw.Wallet.fromMnemonic(nodeProvider.multisig.multisig_acc2).connect(providerConnection);
        expect(multisig_acc2).to.exist;

        multisig_acc3 = mxw.Wallet.fromMnemonic(nodeProvider.multisig.multisig_acc3).connect(providerConnection);
        expect(multisig_acc3).to.exist;

        multisig_acc4 = mxw.Wallet.fromMnemonic(nodeProvider.multisig.multisig_acc4).connect(providerConnection);
        expect(multisig_acc4).to.exist;
    });
});


describe('Suite: MultiSig - Create and Update', function () {
    this.slow(slowThreshold); // define the threshold for slow indicator
    it("Create", function () {

        let signers = [multisig_acc1.address, multisig_acc2.address, multisig_acc3.address];

        multiSigWalletProperties = {
            owner: multisig_acc1.address,
            threshold: 2,
            signers: signers,
        };

        return MultiSig.MultiSigWallet.create(multiSigWalletProperties, multisig_acc1, commitOverrides).then((multiSigWalletRes) => {
            expect(multiSigWalletRes).to.exist;
            multiSigWallet = multiSigWalletRes as MultiSig.MultiSigWallet;
        });
    });

    it("Query", function () {
        return MultiSig.MultiSigWallet.fromGroupAddress(multiSigWallet.groupAddress, multisig_acc1, defaultOverrides).then((res) => {
            expect(multiSigWallet).to.exist;
            expect(multiSigWallet.address).to.equal(res.multisigAccountState.value.address);
            expect(multiSigWalletProperties.threshold).to.equal(+res.multisigAccountState.value.multisig.threshold);
            expect(multiSigWalletProperties.signers).deep.equal(res.multisigAccountState.value.multisig.signers);
        });
    });

        it("Multisig account Update", function () {
            let signers = [multisig_acc1.address, multisig_acc2.address, multisig_acc4.address];
            updateMultiSigWalletProperties = {
                owner: multisig_acc1.address,
                groupAddress: multiSigWallet.groupAddress.toString(),
                threshold: 2,
                signers: signers,
            };
            return MultiSig.MultiSigWallet.update(updateMultiSigWalletProperties, multisig_acc1, defaultOverrides).then((txReceipt) => {
                expect(txReceipt).to.exist;
            });
        });
/*

        it("Transfer to group account", function () {
            let value = mxw.utils.parseMxw("100");
            let overrides = defaultOverrides;
            overrides.memo = "Hello Blockchain!";

            return multisig_acc1.multisig_acc2.getTransactionFee("bank", "bank-send", {
                from: multisig_acc1.address,
                to: multiSigWallet.groupAddress,
                value,
                memo: overrides.memo
            }).then((fee) => {
                overrides["fee"] = fee;
                return multisig_acc1.transfer(multiSigWallet.groupAddress, value, overrides).then((receipt) => {
                    expect(receipt).to.exist;
                    if (!silent) console.log(indent, "transfer.receipt:", JSON.stringify(receipt));
                });
            });
        });

        it("Multisig create Transfer", function () {
            let transaction = providerConnection.getTransactionRequest("bank", "bank-send", {
                from: multiSigWallet.groupAddress,
                to: multisig_acc1.address,
                value: mxw.utils.parseMxw("1"),
                memo: "pipipapipu",
                denom: smallestUnitName
            });
            return providerConnection.getTransactionFee(undefined, undefined, { tx: transaction }).then((fee) => {
                transaction["fee"] = fee;
                return multiSigWallet.sendTransaction(transaction).then((txReceipt) => {
                    expect(txReceipt).to.exist;
                });
            });
        });

        it("send confirmation", function () {
            return multiSigWallet.sendConfirmTransaction(0, defaultOverrides).then((respond) => {
                expect(respond).to.exist;
            });
        });
        */

    it("Clean up", function () {
        providerConnection.removeAllListeners();
    });
});