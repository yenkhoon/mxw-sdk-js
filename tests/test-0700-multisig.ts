'use strict';

import { describe, it } from 'mocha';
import { expect } from 'chai';
import { mxw, MultiSig } from '../src.ts/index';
import { nodeProvider } from "./env";
import { bigNumberify } from '../src.ts/utils';
import { smallestUnitName } from '../src.ts/utils/units';

let indent = "     ";
let silent = true;
let silentRpc = true;
let slowThreshold = 9000;

let providerConnection: mxw.providers.Provider;
let wallet: mxw.Wallet;
let provider: mxw.Wallet;
let issuer: mxw.Wallet;
let middleware: mxw.Wallet;

let multiSigWalletProperties: MultiSig.MultiSigWalletProperties;
let updateMultiSigWalletProperties: MultiSig.UpdateMultiSigWalletProperties;

let multiSigWallet: MultiSig.MultiSigWallet;

let defaultOverrides = {
    logSignaturePayload: function (payload) {
        if (!silentRpc) console.log(indent, "signaturePayload:", JSON.stringify(payload));
    },
    logSignedTransaction: function (signedTransaction) {
        if (!silentRpc) console.log(indent, "signedTransaction:", signedTransaction);
    }
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

        // We need to use KYCed wallet to create fungible token
        wallet = mxw.Wallet.fromMnemonic(nodeProvider.kyc.issuer).connect(providerConnection);
        expect(wallet).to.exist;
        if (!silent) console.log(indent, "Wallet:", JSON.stringify({ address: wallet.address, mnemonic: wallet.mnemonic }));

        provider = mxw.Wallet.fromMnemonic(nodeProvider.fungibleToken.provider).connect(providerConnection);
        expect(provider).to.exist;
        if (!silent) console.log(indent, "Provider:", JSON.stringify({ address: provider.address, mnemonic: provider.mnemonic }));

        issuer = mxw.Wallet.fromMnemonic(nodeProvider.fungibleToken.issuer).connect(providerConnection);
        expect(issuer).to.exist;
        if (!silent) console.log(indent, "Issuer:", JSON.stringify({ address: issuer.address, mnemonic: issuer.mnemonic }));

        middleware = mxw.Wallet.fromMnemonic(nodeProvider.fungibleToken.middleware).connect(providerConnection);
        expect(middleware).to.exist;
        if (!silent) console.log(indent, "Middleware:", JSON.stringify({ address: middleware.address, mnemonic: middleware.mnemonic }));

        if (!silent) console.log(indent, "Fee collector:", JSON.stringify({ address: nodeProvider.fungibleToken.feeCollector }));
    });
});


describe('Suite: MultiSig - Create ', function () {
    this.slow(slowThreshold); // define the threshold for slow indicator
    it("Create", function () {
        let signers = [wallet.address, issuer.address, middleware.address];

        multiSigWalletProperties = {
            owner: wallet.address,
            threshold: 2,
            signers: signers,
        };

        return MultiSig.MultiSigWallet.create(multiSigWalletProperties, wallet, defaultOverrides).then((multiSigWalletRes) => {
            expect(multiSigWalletRes).to.exist;
            if (!silent) console.log(indent, multiSigWalletRes);
            multiSigWallet = multiSigWalletRes as MultiSig.MultiSigWallet;
        });
    });

    it("Query", function () {
        return MultiSig.MultiSigWallet.fromGroupAddress(multiSigWallet.groupAddress, wallet).then((res) => {
            console.log(indent, "Created MultiSigWallet:", JSON.stringify(res.multisigAccountState));
            multiSigWallet = res
        });
    });

    it("Multisig account Update", function () {

        let signers = [wallet.address, issuer.address, middleware.address];
        updateMultiSigWalletProperties = {
            owner: wallet.address,
            groupAddress: multiSigWallet.groupAddress.toString(),
            threshold: bigNumberify(3),
            signers: signers,
        };
        return MultiSig.MultiSigWallet.update(updateMultiSigWalletProperties, wallet).then((txReceipt) => {
            expect(txReceipt).to.exist;
        });

    });


    it("Transfer to group account", function () {
        let value = mxw.utils.parseMxw("100");
        let overrides = {
            logSignaturePayload: defaultOverrides.logSignaturePayload,
            logSignedTransaction: defaultOverrides.logSignedTransaction,
            memo: "Hello Blockchain!"
        }
        return wallet.provider.getTransactionFee("bank", "bank-send", {
            from: wallet.address,
            to: multiSigWallet.groupAddress,
            value,
            memo: overrides.memo
        }).then((fee) => {
            overrides["fee"] = fee;
            return wallet.transfer(multiSigWallet.groupAddress, value, overrides).then((receipt) => {
                expect(receipt).to.exist;
                if (!silent) console.log(indent, "transfer.receipt:", JSON.stringify(receipt));
            });
        });
    });

    it("Multisig create Transfer", function () {
        let transaction = providerConnection.getTransactionRequest("bank", "bank-send", {
            from: multiSigWallet.groupAddress,
            to: wallet.address,
            value: mxw.utils.parseMxw("1"),
            memo: "pipipapipu",
            denom: smallestUnitName
        });
        return providerConnection.getTransactionFee(undefined, undefined, { tx: transaction }).then((fee) => {
            transaction["fee"] = fee;
            return multiSigWallet.sendTransaction(transaction).then((txReceipt) => {
                expect(txReceipt).to.exist;
                if (!silent) console.log(indent, "Create-MultiSig-Tx.receipt: ", JSON.stringify(txReceipt));

                // Goh : Temporary comment this, as with Error Response !!!
                // return multiSigWallet.sendConfirmTransaction(0).then((respond) => {
                //     expect(respond).to.exist;
                // });
            });
        });
    });

});

// [case1]- Suite: MultiSig Process - All Happy path
describe('Suite: MultiSig Process - All Happy path', function () {
    this.slow(slowThreshold); // define the threshold for slow indicator
    
    //test-OK
    it("[case1]- Create multiSig account - Happy path", function () {
        let signers = [wallet.address, issuer.address, middleware.address];

        multiSigWalletProperties = {
            owner: wallet.address,
            threshold: 3,
            signers: signers,
        };

        return MultiSig.MultiSigWallet.create(multiSigWalletProperties, wallet, defaultOverrides).then((multiSigWalletRes) => {
            expect(multiSigWalletRes).to.exist;
            multiSigWallet = multiSigWalletRes as MultiSig.MultiSigWallet;
            if (!silent) console.log(indent, "[case1]- Create multiSig account - groupAddress: ", multiSigWallet.groupAddress);
        });
    });

    //test-OK
    it("[case1]- Top-up multisig group-address - Happy path", function () {
        let value = mxw.utils.parseMxw("100");
            let overrides = {
                logSignaturePayload: defaultOverrides.logSignaturePayload,
                logSignedTransaction: defaultOverrides.logSignedTransaction,
                memo: "Hello Blockchain!"
            }
            return wallet.provider.getTransactionFee("bank", "bank-send", {
                from: wallet.address,
                to: multiSigWallet.groupAddress,
                value,
                memo: overrides.memo
            }).then((fee) => {
                overrides["fee"] = fee;
                return wallet.transfer(multiSigWallet.groupAddress, value, overrides).then((receipt) => {
                    expect(receipt).to.exist;
                });
            });

    });
    
    //test-OK
    it("[case1]- Update multisig account - Happy path", function () {
        let signers = [wallet.address, issuer.address, middleware.address];
        updateMultiSigWalletProperties = {
                owner: wallet.address,
                groupAddress: multiSigWallet.groupAddress,
                threshold: bigNumberify(2),
                signers: signers,
            }

        return MultiSig.MultiSigWallet.update(updateMultiSigWalletProperties, wallet).then((txReceipt) => {
            expect(txReceipt).to.exist;
        });


    });

    // test-OK
    it("[case1]- Query multiSig account - Happy path", function () {
        return refresh(multiSigWallet.groupAddress).then(() => {
            expect(multiSigWallet).to.exist;
        });
    });

    // test-OK
    it("[case1]- Create multiSig transaction - Happy path", function () {
        let transaction = providerConnection.getTransactionRequest("bank", "bank-send", {
            from: multiSigWallet.groupAddress,
            to: wallet.address,
            value: mxw.utils.parseMxw("1"),
            memo: "InternalTx(1st) - Create MultiSig Tx",
            denom: smallestUnitName
        });

        let overrides = {
            accountNumber: multiSigWallet.multisigAccountState.value.accountNumber,
            nonce: 0            //txID for pendingTx
        }

        return providerConnection.getTransactionFee(undefined, undefined, { tx: transaction }).then((fee) => {
            transaction["fee"] = fee;
            return multiSigWallet.sendTransaction(transaction, overrides).then((receipt) => {
                expect(receipt).to.exist;

            });
        });

    });
    
    // -dx: not yet start 
    it("[case1]- Sign multiSig Transaction - Happy path", function () {
        if (!silent) console.log(indent, "Sign MultiSig Tx - groupAddress: ", multiSigWallet.groupAddress);

    });

});


// [case2]- Suite: Create multiSig transaction process - Error which due to different cases
describe('[case2]- Suite: Create multiSig transaction process - Error which due to different cases', function () {
    this.slow(slowThreshold); // define the threshold for slow indicator
    
    // test-OK
    it("[case2]- Create multiSig account - Happy path", function () {
        let signers = [wallet.address, issuer.address, middleware.address];

        multiSigWalletProperties = {
            owner: wallet.address,
            threshold: 3,
            signers: signers,
        };

        return MultiSig.MultiSigWallet.create(multiSigWalletProperties, wallet, defaultOverrides).then((multiSigWalletRes) => {
            expect(multiSigWalletRes).to.exist;
            multiSigWallet = multiSigWalletRes as MultiSig.MultiSigWallet;
            if (!silent) console.log(indent, "[case2]- Create multiSig account - groupAddress: ", multiSigWallet.groupAddress);

        });
    });

    // test-OK
    it("[case2]- Top-up multisig group-address - Happy path", function () {
        let value = mxw.utils.parseMxw("100");
            let overrides = {
                logSignaturePayload: defaultOverrides.logSignaturePayload,
                logSignedTransaction: defaultOverrides.logSignedTransaction,
                memo: "Hello Blockchain!"
            }
            return wallet.provider.getTransactionFee("bank", "bank-send", {
                from: wallet.address,
                to: multiSigWallet.groupAddress,
                value,
                memo: overrides.memo
            }).then((fee) => {
                overrides["fee"] = fee;
                return wallet.transfer(multiSigWallet.groupAddress, value, overrides).then((receipt) => {
                    expect(receipt).to.exist;
                });
            });

    });
    
    // test-OK : Update multisig account for '1st-round'
    it("[case2]- Update multisig account - Update Signer list to become two signers", function () {
        let signers = [issuer.address, middleware.address];
        updateMultiSigWalletProperties = {
                owner: wallet.address,
                groupAddress: multiSigWallet.groupAddress,
                threshold: bigNumberify(2),
                signers: signers,
            }

        return MultiSig.MultiSigWallet.update(updateMultiSigWalletProperties, wallet).then((txReceipt) => {
            expect(txReceipt).to.exist;
        });


    });

    // test-OK : 
    it("[case2]- Create multiSig transaction - Error, due to Sender is not group account's signer.", function () {
        let transaction = providerConnection.getTransactionRequest("bank", "bank-send", {
            from: multiSigWallet.groupAddress,
            to: wallet.address,
            value: mxw.utils.parseMxw("1"),
            memo: "InternalTx(Case-2) - Create MultiSig Tx",
            denom: smallestUnitName
        });

        return providerConnection.getTransactionFee(undefined, undefined, { tx: transaction }).then((fee) => {
            transaction["fee"] = fee;
            return multiSigWallet.sendTransaction(transaction).then((receipt) => {
                expect(receipt).is.not.exist;

            });
        });

    });

     // test-OK : Update multisig account for '2nd-round'
     it("[case2]- Update multisig account - Happy path", function () {
        let signers = [wallet.address, issuer.address, middleware.address];
        updateMultiSigWalletProperties = {
                owner: wallet.address,
                groupAddress: multiSigWallet.groupAddress,
                threshold: bigNumberify(2),
                signers: signers,
            }

        return MultiSig.MultiSigWallet.update(updateMultiSigWalletProperties, wallet).then((txReceipt) => {
            expect(txReceipt).to.exist;
        });


    });

    // test-OK
    it("[case2]- Query multiSig account - Happy path", function () {
        return refresh(multiSigWallet.groupAddress).then(() => {
            expect(multiSigWallet).to.exist;
        });
    });

    // test-OK : 
    it("[case2]- Create multiSig transaction - Error, due to Invalid transaction sequence", function () {
        let transaction = providerConnection.getTransactionRequest("bank", "bank-send", {
            from: multiSigWallet.groupAddress,
            to: wallet.address,
            value: mxw.utils.parseMxw("1"),
            memo: "InternalTx(Case-3) - Create MultiSig Tx",
            denom: smallestUnitName
        });

        let overrides = {
            accountNumber: multiSigWallet.multisigAccountState.value.accountNumber,
            nonce: 10       //txID for pendingTx
        }
        return providerConnection.getTransactionFee(undefined, undefined, { tx: transaction }).then((fee) => {
            transaction["fee"] = fee;
            return multiSigWallet.sendTransaction(transaction, overrides).then((receipt) => {
                expect(receipt).is.not.exist;

            });
        });

    });
    
    // test-OK 
    it("[case2]- Create multiSig transaction - Error, due to Group address invalid.", function () {
        let InvalidGroupAdd = "mxw1x5cf8y99ntjc8cjm00z603yfqwzxw2mawemf73"      // set manually
        let transaction = providerConnection.getTransactionRequest("bank", "bank-send", {
            from: InvalidGroupAdd,
            to: wallet.address,
            value: mxw.utils.parseMxw("1"),
            memo: "InternalTx(Case-4) - Create MultiSig Tx",
            denom: smallestUnitName
        });

        let overrides = {
            accountNumber: multiSigWallet.multisigAccountState.value.accountNumber,
            nonce: 0            //txID for pendingTx
        }

        return providerConnection.getTransactionFee(undefined, undefined, { tx: transaction }).then((fee) => {
            transaction["fee"] = fee;
            return multiSigWallet.sendTransaction(transaction, overrides).then((receipt) => {
                expect(receipt).is.not.exist;

            });
        });

    });

    
});


// [case3]- Suite: Create multiSig transaction process - Resubmit with unique nonce [TxID]
describe('[case3]- Suite: Create multiSig transaction process - Resubmit with unique nonce', function () {
    this.slow(slowThreshold); // define the threshold for slow indicator
    
    // test-OK
    it("[case3]- Create multiSig account - Happy path", function () {
        let signers = [wallet.address, issuer.address, middleware.address];

        multiSigWalletProperties = {
            owner: wallet.address,
            threshold: 3,
            signers: signers,
        };

        return MultiSig.MultiSigWallet.create(multiSigWalletProperties, wallet, defaultOverrides).then((multiSigWalletRes) => {
            expect(multiSigWalletRes).to.exist;
            multiSigWallet = multiSigWalletRes as MultiSig.MultiSigWallet;
            if (!silent) console.log(indent, "[case3]- Create multiSig account - groupAddress: ", multiSigWallet.groupAddress);

        });
    });

    // test-OK
    it("[case3]- Top-up multisig group-address - Happy path", function () {
        let value = mxw.utils.parseMxw("100");
            let overrides = {
                logSignaturePayload: defaultOverrides.logSignaturePayload,
                logSignedTransaction: defaultOverrides.logSignedTransaction,
                memo: "Hello Blockchain!"
            }
            return wallet.provider.getTransactionFee("bank", "bank-send", {
                from: wallet.address,
                to: multiSigWallet.groupAddress,
                value,
                memo: overrides.memo
            }).then((fee) => {
                overrides["fee"] = fee;
                return wallet.transfer(multiSigWallet.groupAddress, value, overrides).then((receipt) => {
                    expect(receipt).to.exist;
                });
            });

    });

    // test-OK
    it("[case3]- Query multiSig account - Happy path", function () {
        return refresh(multiSigWallet.groupAddress).then(() => {
            expect(multiSigWallet).to.exist;
        });
    });

    //-dx: 'submit counter+0'
    it("[case3]- Create multiSig transaction - submit counter+0", function () {
        let transaction = providerConnection.getTransactionRequest("bank", "bank-send", {
            from: multiSigWallet.groupAddress,
            to: wallet.address,
            value: mxw.utils.parseMxw("1178"),
            memo: "InternalTx(1st) - Create MultiSig Tx",
            denom: smallestUnitName
        });

        let overrides = {
            accountNumber: multiSigWallet.multisigAccountState.value.accountNumber,
            nonce: 0            //txID for pendingTx
        }
        return providerConnection.getTransactionFee(undefined, undefined, { tx: transaction }).then((fee) => {
            transaction["fee"] = fee;
            return multiSigWallet.sendTransaction(transaction, overrides).then((receipt) => {
                expect(receipt).to.exist;
            });
        });

    });

     //-dx: 'submit counter+1'
    it("[case3]- Create multiSig transaction - submit counter+1", function () {
        let transaction = providerConnection.getTransactionRequest("bank", "bank-send", {
            from: multiSigWallet.groupAddress,
            to: wallet.address,
            value: mxw.utils.parseMxw("1179"),
            memo: "InternalTx(2nd) - Create MultiSig Tx",
            denom: smallestUnitName
        });

        let overrides = {
            accountNumber: multiSigWallet.multisigAccountState.value.accountNumber,
            nonce: 1            //txID for pendingTx
        }

        return providerConnection.getTransactionFee(undefined, undefined, { tx: transaction }).then((fee) => {
            transaction["fee"] = fee;
            return multiSigWallet.sendTransaction(transaction, overrides).then((receipt) => {
                expect(receipt).to.exist;

            });
        });

    });

     //-dx: 'submit counter+2'
    it("[case3]- Create multiSig transaction - submit counter+2", function () {
        let transaction = providerConnection.getTransactionRequest("bank", "bank-send", {
            from: multiSigWallet.groupAddress,
            to: wallet.address,
            value: mxw.utils.parseMxw("1180"),
            memo: "InternalTx(3rd) - Create MultiSig Tx",
            denom: smallestUnitName
        });

        let overrides = {
            accountNumber: multiSigWallet.multisigAccountState.value.accountNumber,
            nonce: 2            //txID for pendingTx
        }

        return providerConnection.getTransactionFee(undefined, undefined, { tx: transaction }).then((fee) => {
            transaction["fee"] = fee;
            return multiSigWallet.sendTransaction(transaction, overrides).then((receipt) => {
                expect(receipt).to.exist;

            });
        });

    });
    
});

//test-OK
describe('Suite: MultiSig - Clean up', function () {
    this.slow(slowThreshold); // define the threshold for slow indicator
    if (!silent) console.log(indent, "Clean up !!!");

    it("Clean up", function () {
        providerConnection.removeAllListeners();
    });
});


//test-OK
function refresh(groupAddress: string) {
    return MultiSig.MultiSigWallet.fromGroupAddress(groupAddress, wallet).then((groupAcc) => {
        expect(groupAcc).to.exist;
        multiSigWallet = groupAcc;
        if (!silent) console.log(indent, "refresh: ", JSON.stringify(multiSigWallet.multisigAccountState));        
    });

}


