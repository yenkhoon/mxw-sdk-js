'use strict';

import { describe, it } from 'mocha';
import { expect } from 'chai';
import { mxw, MultiSig } from '../src.ts/index';
import { errors } from '../src.ts/index';
import { nodeProvider } from "./env";
import { formatMxw, } from '../src.ts/utils';
import { smallestUnitName } from '../src.ts/utils/units';

let indent = "     ";
let silent = false;
let silentRpc = true;
let slowThreshold = 9000;

let providerConnection: mxw.providers.Provider;
let wallet: mxw.Wallet;
let provider: mxw.Wallet;
let issuer: mxw.Wallet;
let middleware: mxw.Wallet;
let walletNonKYC: mxw.Wallet;

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

        walletNonKYC = mxw.Wallet.fromMnemonic(nodeProvider.airDrop).connect(providerConnection);
        expect(walletNonKYC).to.exist;
        if (!silent) console.log(indent, "walletNonKYC:", JSON.stringify({ address: walletNonKYC.address, mnemonic: walletNonKYC.mnemonic }));

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


///============================= start : MULTIPLE signers =============================
describe('Suite: MultiSig - Case 1. Invalid Cases with TWO signers', function () {
    this.slow(slowThreshold); // define the threshold for slow indicator
    it("Create", function () {
        let signers = [issuer.address];

        multiSigWalletProperties = {
            threshold: 1,
            signers: signers,
        };

        return MultiSig.MultiSigWallet.create(multiSigWalletProperties, wallet, defaultOverrides).then((multiSigWalletRes) => {
            expect(multiSigWalletRes).to.exist;
            if (!silent) console.log(multiSigWalletRes);
            multiSigWallet = multiSigWalletRes as MultiSig.MultiSigWallet;
        });
    });

    it("Query", function () {
        return MultiSig.MultiSigWallet.fromGroupAddress(multiSigWallet.address, wallet).then((res) => {
            if (!silent) console.log(indent, "Created MultiSigWallet:", JSON.stringify(res.multisigAccountState));
            multiSigWallet = res
        });
    });

    it("Multisig account Update", function () {

        let signers = [wallet.address, issuer.address];
        updateMultiSigWalletProperties = {
            owner: wallet.address,
            groupAddress: multiSigWallet.address.toString(),
            threshold: 2,
            signers: signers,
        };
        return MultiSig.MultiSigWallet.update(updateMultiSigWalletProperties, wallet).then((txReceipt) => {
            expect(txReceipt).to.exist;
        });

    });

    it("Top-up group account", function () {
        let value = mxw.utils.parseMxw("89");
        let overrides = {
            logSignaturePayload: defaultOverrides.logSignaturePayload,
            logSignedTransaction: defaultOverrides.logSignedTransaction,
            memo: "Hello Blockchain!"
        }
        return wallet.provider.getTransactionFee("bank", "bank-send", {
            from: wallet.address,
            to: multiSigWallet.address,
            value,
            memo: overrides.memo
        }).then((fee) => {
            overrides["fee"] = fee;
            return wallet.transfer(multiSigWallet.address, value, overrides).then((receipt) => {
                expect(receipt).to.exist;
                if (!silent) console.log(indent, "transfer.receipt:", JSON.stringify(receipt));
            });
        });
    });

    it("Group-address for Get balance", function () {
        return multiSigWallet.getBalance().then((balance) => {
            expect(balance).to.exist;
            if (!silent) console.log(indent, "Group-address Balance:", formatMxw(balance), "(" + multiSigWallet.address + ")");
        });
    });

    it("Create Multisig Tx, using TWO signers", function () {
        if (!silent) console.log(indent, "\nstart: ==================Create Multisig Tx, using TWO signers\n");

        let transaction = providerConnection.getTransactionRequest("bank", "bank-send", {
            from: multiSigWallet.address,
            to: wallet.address,
            value: mxw.utils.parseMxw("1"),
            memo: "pipipapipu",
            denom: smallestUnitName
        });

        return providerConnection.getTransactionFee(undefined, undefined, { tx: transaction }).then((fee) => {
            transaction["fee"] = fee;
            return multiSigWallet.createTransaction(transaction).then((txReceipt) => {
              expect(txReceipt).to.exist;
                if (!silent) console.log(indent, "Create-MultiSig-Tx.receipt: ", JSON.stringify(txReceipt));
                if (!silent) console.log(indent, "\nend: ==================Create Multisig Tx, using TWO signers\n");
            });

        });

    });

    it("Sign multiSig Transaction by 2nd-signer, Error due to : Insufficient balance to do transaction by sender-issuer", function () {
       if (!silent) console.log(indent, "\nstart: ==================Sign multiSig Transaction by 2nd-signer, Error due to : Insufficient balance to do transaction by sender-issuer_nft\n");

       let anotherSigner = new MultiSig.MultiSigWallet(multiSigWallet.address, issuer)
       anotherSigner.refresh();
       return anotherSigner.confirmTransaction(0).then((respond) => {
           expect(respond).to.exist;
           if (!silent) console.log(indent, "Sign-MultiSig-Tx.receipt: ", JSON.stringify(respond));
       }).catch(error => {
           if (!silent) console.log(indent, "error.code: ", error.code);
           if (!silent) console.log(indent, "Sign-MultiSig-Tx.Error: ", JSON.stringify(error));
           if (!silent) console.log(indent, "\nend: ==================Sign multiSig Transaction by 2nd-signer, Error due to : Insufficient balance to do transaction by sender-issuer_nft\n");
       });

    });

    it("Clean up", function () {
        providerConnection.removeAllListeners();
    });
});


describe('Suite: MultiSig - Case 2. Valid Case with TWO signers', function () {
    this.slow(slowThreshold); // define the threshold for slow indicator
    it("Create", function () {
        let signers = [wallet.address, issuer.address];

        multiSigWalletProperties = {
            threshold: 2,
            signers: signers,
        };

        return MultiSig.MultiSigWallet.create(multiSigWalletProperties, wallet, defaultOverrides).then((multiSigWalletRes) => {
            expect(multiSigWalletRes).to.exist;
            if (!silent) console.log(multiSigWalletRes);
            multiSigWallet = multiSigWalletRes as MultiSig.MultiSigWallet;
        });
    });

    it("Query", function () {
        return MultiSig.MultiSigWallet.fromGroupAddress(multiSigWallet.address, wallet).then((res) => {
            if (!silent) console.log(indent, "Created MultiSigWallet:", JSON.stringify(res.multisigAccountState));
            multiSigWallet = res
        });
    });

    it("Multisig account Update", function () {

        let signers = [wallet.address, issuer.address];
        updateMultiSigWalletProperties = {
            owner: wallet.address,
            groupAddress: multiSigWallet.address.toString(),
            threshold: 2,
            signers: signers,
        };
        return MultiSig.MultiSigWallet.update(updateMultiSigWalletProperties, wallet).then((txReceipt) => {
            expect(txReceipt).to.exist;
        });

    });

    it("Top-up group account", function () {
        let value = mxw.utils.parseMxw("89");
        let overrides = {
            logSignaturePayload: defaultOverrides.logSignaturePayload,
            logSignedTransaction: defaultOverrides.logSignedTransaction,
            memo: "Hello Blockchain!"
        }
        return wallet.provider.getTransactionFee("bank", "bank-send", {
            from: wallet.address,
            to: multiSigWallet.address,
            value,
            memo: overrides.memo
        }).then((fee) => {
            overrides["fee"] = fee;
            return wallet.transfer(multiSigWallet.address, value, overrides).then((receipt) => {
                expect(receipt).to.exist;
                if (!silent) console.log(indent, "transfer.receipt:", JSON.stringify(receipt));
            });
        });
    });

    it("Group-address for Get balance", function () {
        return multiSigWallet.getBalance().then((balance) => {
            expect(balance).to.exist;
            if (!silent) console.log(indent, "Group-address Balance:", formatMxw(balance), "(" + multiSigWallet.address + ")");
        });
    });

    it("Top-up issuer-account", function () {
        let value = mxw.utils.parseMxw("167");
        let overrides = {
            logSignaturePayload: defaultOverrides.logSignaturePayload,
            logSignedTransaction: defaultOverrides.logSignedTransaction,
            memo: "Hello Blockchain!"
        }
        return wallet.provider.getTransactionFee("bank", "bank-send", {
            from: wallet.address,
            to: issuer.address,
            value,
            memo: overrides.memo,
            denom: smallestUnitName
        }).then((fee) => {
            overrides["fee"] = fee;
            return wallet.transfer(issuer.address, value, overrides).then((receipt) => {
                expect(receipt).to.exist;
                if (!silent) console.log(indent, "Top-up.receipt:", JSON.stringify(receipt));
            });
        });
    });

    it("Issuer-address for Get balance", function () {
        return issuer.getBalance().then((balance) => {
            expect(balance).to.exist;
            if (!silent) console.log(indent, "issuer-address Balance:", formatMxw(balance), "(" + issuer.address + ")");
        });
    });

    it("Create Multisig Tx, with Valid Signer", function () {
        if (!silent) console.log(indent, "\nstart: ==================Create Multisig Tx, with Valid Signer\n");

        let transaction = providerConnection.getTransactionRequest("bank", "bank-send", {
            from: multiSigWallet.address,
            to: wallet.address,
            value: mxw.utils.parseMxw("1"),
            memo: "pipipapipu",
            denom: smallestUnitName
        });

        return providerConnection.getTransactionFee(undefined, undefined, { tx: transaction }).then((fee) => {
            transaction["fee"] = fee;
            return multiSigWallet.createTransaction(transaction).then((txReceipt) => {
              expect(txReceipt).to.exist;
                if (!silent) console.log(indent, "Create-MultiSig-Tx.receipt: ", JSON.stringify(txReceipt));
                if (!silent) console.log(indent, "\nend: ==================Create Multisig Tx, with Valid Signer\n");
            });

        });

    });

    it("Sign multiSig Transaction by 2nd signer - Issuer", function () {
       if (!silent) console.log(indent, "\nstart: ==================Sign multiSig Transaction by 2nd signer - Issuer\n");

       let overrides = {
            accountNumber: multiSigWallet.multisigAccountState.value.accountNumber,
            nonce: 0   //TxID = 0  (create-internal-tx)              
        }

       let signer2 = new MultiSig.MultiSigWallet(multiSigWallet.address, issuer)
       signer2.refresh();
       return signer2.confirmTransaction(0, overrides).then((respond) => {
           expect(respond).to.exist;
           if (!silent) console.log(indent, "Sign-MultiSig-Tx.receipt: ", JSON.stringify(respond));
           if (!silent) console.log(indent, "\nend: ==================Sign multiSig Transaction by 2nd signer - Issuer\n");
       }).catch(error => {
           if (!silent) console.log(indent, "error.code: ", error.code);
           if (!silent) console.log(indent, "Sign-MultiSig-Tx.Error: ", JSON.stringify(error));
           if (!silent) console.log(indent, "\nend: ==================Sign multiSig Transaction by 2nd signer - Issuer\n");
       });

    });

    it("Clean up", function () {
        providerConnection.removeAllListeners();
    });
});


describe('Suite: MultiSig - Case 3. Invalid Case with TWO signers', function () {
    this.slow(slowThreshold); // define the threshold for slow indicator
    it("Create", function () {
        let signers = [wallet.address, issuer.address];

        multiSigWalletProperties = {
            threshold: 2,
            signers: signers,
        };

        return MultiSig.MultiSigWallet.create(multiSigWalletProperties, wallet, defaultOverrides).then((multiSigWalletRes) => {
            expect(multiSigWalletRes).to.exist;
            if (!silent) console.log(multiSigWalletRes);
            multiSigWallet = multiSigWalletRes as MultiSig.MultiSigWallet;
        });
    });

    it("Query", function () {
        return MultiSig.MultiSigWallet.fromGroupAddress(multiSigWallet.address, wallet).then((res) => {
            if (!silent) console.log(indent, "Created MultiSigWallet:", JSON.stringify(res.multisigAccountState));
            multiSigWallet = res
        });
    });

    it("Top-up group account", function () {
        let value = mxw.utils.parseMxw("89");
        let overrides = {
            logSignaturePayload: defaultOverrides.logSignaturePayload,
            logSignedTransaction: defaultOverrides.logSignedTransaction,
            memo: "Hello Blockchain!"
        }
        return wallet.provider.getTransactionFee("bank", "bank-send", {
            from: wallet.address,
            to: multiSigWallet.address,
            value,
            memo: overrides.memo
        }).then((fee) => {
            overrides["fee"] = fee;
            return wallet.transfer(multiSigWallet.address, value, overrides).then((receipt) => {
                expect(receipt).to.exist;
                if (!silent) console.log(indent, "transfer.receipt:", JSON.stringify(receipt));
            });
        });
    });

    it("Group-address for Get balance", function () {
        return multiSigWallet.getBalance().then((balance) => {
            expect(balance).to.exist;
            if (!silent) console.log(indent, "Group-address Balance:", formatMxw(balance), "(" + multiSigWallet.address + ")");
        });
    });

    it("Create Multisig Tx, Error due to : Invalid Group-address", function () {
        if (!silent) console.log(indent, "\nstart: ==================Create Multisig Tx, Error due to : Invalid Group-address\n");

        let transaction = providerConnection.getTransactionRequest("bank", "bank-send", {
            from: wallet.address,
            to: wallet.address,
            value: mxw.utils.parseMxw("1"),
            memo: "pipipapipu",
            denom: smallestUnitName
        });

        return providerConnection.getTransactionFee(undefined, undefined, { tx: transaction }).then((fee) => {
            transaction["fee"] = fee;
            return multiSigWallet.createTransaction(transaction).then((txReceipt) => {
              expect(txReceipt).to.exist;
                if (!silent) console.log(indent, "Create-MultiSig-Tx.receipt: ", JSON.stringify(txReceipt));
            }).catch(error => {
                if (!silent) console.log(indent, "error.code: ", error.code);
                if (!silent) console.log(indent, "Create Multisig Tx.Error: ", JSON.stringify(error));
                if (!silent) console.log(indent, "\nend: ==================Create Multisig Tx, Error due to : Invalid Group-address\n");
            });
     
        });

    });

    it("Create Multisig Tx, with Valid Group-address", function () {
        if (!silent) console.log(indent, "\nstart: ==================Create Multisig Tx, with Valid Group-address\n");

        let transaction = providerConnection.getTransactionRequest("bank", "bank-send", {
            from: multiSigWallet.address,
            to: wallet.address,
            value: mxw.utils.parseMxw("1"),
            memo: "pipipapipu",
            denom: smallestUnitName
        });

        return providerConnection.getTransactionFee(undefined, undefined, { tx: transaction }).then((fee) => {
            transaction["fee"] = fee;
            return multiSigWallet.createTransaction(transaction).then((txReceipt) => {
              expect(txReceipt).to.exist;
                if (!silent) console.log(indent, "Create-MultiSig-Tx.receipt: ", JSON.stringify(txReceipt));
                if (!silent) console.log(indent, "\nend: ==================Create Multisig Tx, with Valid Group-address\n");
            });

        });

    });

    it("Top-up middleware-account", function () {
        let value = mxw.utils.parseMxw("155");
        let overrides = {
            logSignaturePayload: defaultOverrides.logSignaturePayload,
            logSignedTransaction: defaultOverrides.logSignedTransaction,
            memo: "Hello Blockchain!"
        }
        return wallet.provider.getTransactionFee("bank", "bank-send", {
            from: wallet.address,
            to: middleware.address,
            value,
            memo: overrides.memo,
            denom: smallestUnitName
        }).then((fee) => {
            overrides["fee"] = fee;
            return wallet.transfer(middleware.address, value, overrides).then((receipt) => {
                expect(receipt).to.exist;
                if (!silent) console.log(indent, "Top-up.receipt:", JSON.stringify(receipt));
            });
        });
    });

    it("middleware-address for Get balance", function () {
        return middleware.getBalance().then((balance) => {
            expect(balance).to.exist;
            if (!silent) console.log(indent, "middleware-address Balance:", formatMxw(balance), "(" + middleware.address + ")");
        });
    });

    it("Sign multiSig Transaction by 2nd signer, Error due to : Sender is not group account's signer, middleware", function () {
       if (!silent) console.log(indent, "\nstart: ==================Sign multiSig Transaction by 2nd signer, Error due to : Invalid 2nd-Sender, middleware\n");

       let anotherSigner = new MultiSig.MultiSigWallet(multiSigWallet.address, middleware)
       anotherSigner.refresh();
       return anotherSigner.confirmTransaction(0).then((respond) => {
           expect(respond).to.exist;
           if (!silent) console.log(indent, "Sign-MultiSig-Tx.receipt: ", JSON.stringify(respond));
       }).catch(error => {
           if (!silent) console.log(indent, "error.code: ", error.code);
           if (!silent) console.log(indent, "Sign-MultiSig-Tx.Error: ", JSON.stringify(error));
           if (!silent) console.log(indent, "\nend: ==================Sign multiSig Transaction by 2nd signer, Error due to : Invalid 2nd-Sender, middleware\n");
       });

    });

    it("Clean up", function () {
        providerConnection.removeAllListeners();
    });
});

describe('Suite: MultiSig - Case 4. Invalid Case base on Nonce, TxID', function () {
    this.slow(slowThreshold); // define the threshold for slow indicator
    it("Create", function () {
        let signers = [wallet.address, middleware.address];

        multiSigWalletProperties = {
            threshold: 2,
            signers: signers,
        };

        return MultiSig.MultiSigWallet.create(multiSigWalletProperties, wallet, defaultOverrides).then((multiSigWalletRes) => {
            expect(multiSigWalletRes).to.exist;
            if (!silent) console.log(multiSigWalletRes);
            multiSigWallet = multiSigWalletRes as MultiSig.MultiSigWallet;
        });
    });

    it("Query", function () {
        return MultiSig.MultiSigWallet.fromGroupAddress(multiSigWallet.address, wallet).then((res) => {
            if (!silent) console.log(indent, "Created MultiSigWallet:", JSON.stringify(res.multisigAccountState));
            multiSigWallet = res
        });
    });

    it("Top-up group account", function () {
        let value = mxw.utils.parseMxw("89");
        let overrides = {
            logSignaturePayload: defaultOverrides.logSignaturePayload,
            logSignedTransaction: defaultOverrides.logSignedTransaction,
            memo: "Hello Blockchain!"
        }
        return wallet.provider.getTransactionFee("bank", "bank-send", {
            from: wallet.address,
            to: multiSigWallet.address,
            value,
            memo: overrides.memo
        }).then((fee) => {
            overrides["fee"] = fee;
            return wallet.transfer(multiSigWallet.address, value, overrides).then((receipt) => {
                expect(receipt).to.exist;
                if (!silent) console.log(indent, "transfer.receipt:", JSON.stringify(receipt));
            });
        });
    });

    it("Group-address for Get balance", function () {
        return multiSigWallet.getBalance().then((balance) => {
            expect(balance).to.exist;
            if (!silent) console.log(indent, "Group-address Balance:", formatMxw(balance), "(" + multiSigWallet.address + ")");
        });
    });

    it("Top-up middleware-account", function () {
        let value = mxw.utils.parseMxw("155");
        let overrides = {
            logSignaturePayload: defaultOverrides.logSignaturePayload,
            logSignedTransaction: defaultOverrides.logSignedTransaction,
            memo: "Hello Blockchain!"
        }
        return wallet.provider.getTransactionFee("bank", "bank-send", {
            from: wallet.address,
            to: middleware.address,
            value,
            memo: overrides.memo,
            denom: smallestUnitName
        }).then((fee) => {
            overrides["fee"] = fee;
            return wallet.transfer(middleware.address, value, overrides).then((receipt) => {
                expect(receipt).to.exist;
                if (!silent) console.log(indent, "Top-up.receipt:", JSON.stringify(receipt));
            });
        });
    });

    it("middleware-address for Get balance", function () {
        return middleware.getBalance().then((balance) => {
            expect(balance).to.exist;
            if (!silent) console.log(indent, "middleware-address Balance:", formatMxw(balance), "(" + middleware.address + ")");
        });
    });

    it("Create Multisig Tx, Error due to : Signature verification failed due to Invalid nonce value", function () {
        if (!silent) console.log(indent, "\nstart: ==================Create Multisig Tx, Error due to : Signature verification failed due to Invalid nonce value\n");

        let transaction = providerConnection.getTransactionRequest("bank", "bank-send", {
            from: wallet.address,
            to: wallet.address,
            value: mxw.utils.parseMxw("1"),
            memo: "pipipapipu",
            denom: smallestUnitName
        });

        let overrides = {
            accountNumber: multiSigWallet.multisigAccountState.value.accountNumber,
            nonce: 1            // should be ZERO        
        }

        return providerConnection.getTransactionFee(undefined, undefined, { tx: transaction }).then((fee) => {
            transaction["fee"] = fee;
            return multiSigWallet.createTransaction(transaction, overrides).then((txReceipt) => {
              expect(txReceipt).to.exist;
                if (!silent) console.log(indent, "Create-MultiSig-Tx.receipt: ", JSON.stringify(txReceipt));
            }).catch(error => {
                if (!silent) console.log(indent, "error.code: ", error.code);
                if (!silent) console.log(indent, "Create Multisig Tx.Error: ", JSON.stringify(error));
                if (!silent) console.log(indent, "\nend: ==================Create Multisig Tx, Error due to : Signature verification failed due to Invalid nonce value\n");
            });
     
        });

    });

    it("Create Multisig Tx, using TWO signers", function () {
        if (!silent) console.log(indent, "\nstart: ==================Create Multisig Tx, using TWO signers\n");

        let transaction = providerConnection.getTransactionRequest("bank", "bank-send", {
            from: multiSigWallet.address,
            to: wallet.address,
            value: mxw.utils.parseMxw("1"),
            memo: "pipipapipu",
            denom: smallestUnitName
        });

        return providerConnection.getTransactionFee(undefined, undefined, { tx: transaction }).then((fee) => {
            transaction["fee"] = fee;
            return multiSigWallet.createTransaction(transaction).then((txReceipt) => {
              expect(txReceipt).to.exist;
                if (!silent) console.log(indent, "Create-MultiSig-Tx.receipt: ", JSON.stringify(txReceipt));
                if (!silent) console.log(indent, "\nend: ==================Create Multisig Tx, using TWO signers\n");
            });

        });

    });

    it("Sign multiSig Transaction by 2nd signer, Error due to : Signature verification failed due to Invalid txID value", function () {
       if (!silent) console.log(indent, "\nstart: ==================Sign multiSig Transaction by 2nd signer, Error due to : Signature verification failed due to Invalid txID value\n");

       let anotherSigner = new MultiSig.MultiSigWallet(multiSigWallet.address, middleware)
       anotherSigner.refresh();
       return anotherSigner.confirmTransaction(1).then((respond) => {
           expect(respond).to.exist;
           if (!silent) console.log(indent, "Sign-MultiSig-Tx.receipt: ", JSON.stringify(respond));
       }).catch(error => {
           if (!silent) console.log(indent, "error.code: ", error.code);
           if (!silent) console.log(indent, "Sign-MultiSig-Tx.Error: ", JSON.stringify(error));
           if (!silent) console.log(indent, "\nend: ==================Sign multiSig Transaction by 2nd signer, Error due to : Signature verification failed due to Invalid txID value\n");
       });

    });

    it("Clean up", function () {
        providerConnection.removeAllListeners();
    });
});

describe('Suite: MultiSig - Case 5. Valid Case with THREE signers, for TWO rounds testing', function () {
    this.slow(slowThreshold); // define the threshold for slow indicator
    it("Create", function () {
        let signers = [wallet.address, issuer.address];

        multiSigWalletProperties = {
            threshold: 2,
            signers: signers,
        };

        return MultiSig.MultiSigWallet.create(multiSigWalletProperties, wallet, defaultOverrides).then((multiSigWalletRes) => {
            expect(multiSigWalletRes).to.exist;
            if (!silent) console.log(multiSigWalletRes);
            multiSigWallet = multiSigWalletRes as MultiSig.MultiSigWallet;
        });
    });

    it("Query", function () {
        return MultiSig.MultiSigWallet.fromGroupAddress(multiSigWallet.address, wallet).then((res) => {
            if (!silent) console.log(indent, "Created MultiSigWallet:", JSON.stringify(res.multisigAccountState));
            multiSigWallet = res
        });
    });

    it("Multisig account Update", function () {

        let signers = [wallet.address, issuer.address, middleware.address];
        updateMultiSigWalletProperties = {
            owner: wallet.address,
            groupAddress: multiSigWallet.address.toString(),
            threshold: 3,
            signers: signers,
        };
        return MultiSig.MultiSigWallet.update(updateMultiSigWalletProperties, wallet).then((txReceipt) => {
            expect(txReceipt).to.exist;
        });

    });

    it("Top-up group account", function () {
        let value = mxw.utils.parseMxw("89");
        let overrides = {
            logSignaturePayload: defaultOverrides.logSignaturePayload,
            logSignedTransaction: defaultOverrides.logSignedTransaction,
            memo: "Hello Blockchain!"
        }
        return wallet.provider.getTransactionFee("bank", "bank-send", {
            from: wallet.address,
            to: multiSigWallet.address,
            value,
            memo: overrides.memo
        }).then((fee) => {
            overrides["fee"] = fee;
            return wallet.transfer(multiSigWallet.address, value, overrides).then((receipt) => {
                expect(receipt).to.exist;
                if (!silent) console.log(indent, "transfer.receipt:", JSON.stringify(receipt));
            });
        });
    });

    it("Group-address for Get balance", function () {
        return multiSigWallet.getBalance().then((balance) => {
            expect(balance).to.exist;
            if (!silent) console.log(indent, "Group-address Balance:", formatMxw(balance), "(" + multiSigWallet.address + ")");
        });
    });

    it("Top-up issuer-account", function () {
        let value = mxw.utils.parseMxw("167");
        let overrides = {
            logSignaturePayload: defaultOverrides.logSignaturePayload,
            logSignedTransaction: defaultOverrides.logSignedTransaction,
            memo: "Hello Blockchain!"
        }
        return wallet.provider.getTransactionFee("bank", "bank-send", {
            from: wallet.address,
            to: issuer.address,
            value,
            memo: overrides.memo,
            denom: smallestUnitName
        }).then((fee) => {
            overrides["fee"] = fee;
            return wallet.transfer(issuer.address, value, overrides).then((receipt) => {
                expect(receipt).to.exist;
                if (!silent) console.log(indent, "Issuer Top-up.receipt:", JSON.stringify(receipt));
            });
        });
    });

    it("Issuer-address for Get balance", function () {
        return issuer.getBalance().then((balance) => {
            expect(balance).to.exist;
            if (!silent) console.log(indent, "Issuer-address Balance:", formatMxw(balance), "(" + issuer.address + ")");
        });
    });

    it("Top-up middleware-account", function () {
        let value = mxw.utils.parseMxw("115");
        let overrides = {
            logSignaturePayload: defaultOverrides.logSignaturePayload,
            logSignedTransaction: defaultOverrides.logSignedTransaction,
            memo: "Hello Blockchain!"
        }
        return wallet.provider.getTransactionFee("bank", "bank-send", {
            from: wallet.address,
            to: middleware.address,
            value,
            memo: overrides.memo,
            denom: smallestUnitName
        }).then((fee) => {
            overrides["fee"] = fee;
            return wallet.transfer(middleware.address, value, overrides).then((receipt) => {
                expect(receipt).to.exist;
                if (!silent) console.log(indent, "Middleware Top-up.receipt:", JSON.stringify(receipt));
            });
        });
    });

    it("Middleware-address for Get balance", function () {
        return middleware.getBalance().then((balance) => {
            expect(balance).to.exist;
            if (!silent) console.log(indent, "middleware-address Balance:", formatMxw(balance), "(" + middleware.address + ")");
        });
    });


    it("1st-round : Create Multisig Tx, with Valid Signer", function () {
        this.slow(5000); // define the threshold for slow indicator
        if (!silent) console.log(indent, "\nstart: ==================Create Multisig Tx, with Valid Signer\n");

        let transaction = providerConnection.getTransactionRequest("bank", "bank-send", {
            from: multiSigWallet.address,
            to: wallet.address,
            value: mxw.utils.parseMxw("1"),
            memo: "pipipapipu",
            denom: smallestUnitName
        });

        let overrides = {
            accountNumber: multiSigWallet.multisigAccountState.value.accountNumber,
            nonce: 0           
        }

        return providerConnection.getTransactionFee(undefined, undefined, { tx: transaction }).then((fee) => {
            transaction["fee"] = fee;
            return multiSigWallet.createTransaction(transaction, overrides).then((txReceipt) => {
              expect(txReceipt).to.exist;
                if (!silent) console.log(indent, "Create-MultiSig-Tx.receipt: ", JSON.stringify(txReceipt));
                if (!silent) console.log(indent, "\nend: ==================Create Multisig Tx, with Valid Signer\n");
            });

        });

    });

    it("1st-round : Sign multiSig Transaction by 2nd signer - Issuer", function () {
       this.slow(5000); // define the threshold for slow indicator
       if (!silent) console.log(indent, "\nstart: ==================1st-round : Sign multiSig Transaction by 2nd signer - Issuer\n");

       let overrides = {
        accountNumber: multiSigWallet.multisigAccountState.value.accountNumber,
        nonce: 0           
        }

       let signer2 = new MultiSig.MultiSigWallet(multiSigWallet.address, issuer)
       signer2.refresh();
       return signer2.confirmTransaction(0, overrides).then((respond) => {
           expect(respond).to.exist;
           if (!silent) console.log(indent, "Sign-MultiSig-Tx.receipt: ", JSON.stringify(respond));
           if (!silent) console.log(indent, "\nend: ==================1st-round : Sign multiSig Transaction by 2nd signer - Issuer\n");
       }).catch(error => {
           if (!silent) console.log(indent, "error.code: ", error.code);
           if (!silent) console.log(indent, "Sign-MultiSig-Tx.Error: ", JSON.stringify(error));
           if (!silent) console.log(indent, "\nend: ==================1st-round : Sign multiSig Transaction by 2nd signer - Issuer\n");
       });

    });

    it("1st-round : Sign multiSig Transaction by 3rd signer - Middleware", function () {
        this.slow(5000); // define the threshold for slow indicator
        if (!silent) console.log(indent, "\nstart: ==================1st-round : Sign multiSig Transaction by 3rd signer - Middleware\n");
 
        let overrides = {
         accountNumber: multiSigWallet.multisigAccountState.value.accountNumber,
         nonce: 0           
         }
 
        //  if (!silent) console.log(indent, "\n........[accountNumber]: ", overrides["accountNumber"]);
        //  if (!silent) console.log(indent, "\n........[nonce]: ", overrides["nonce"]);
 
        let signer3 = new MultiSig.MultiSigWallet(multiSigWallet.address, middleware)
        signer3.refresh();
        return signer3.confirmTransaction(0, overrides).then((respond) => {
            expect(respond).to.exist;
            if (!silent) console.log(indent, "Sign-MultiSig-Tx.receipt: ", JSON.stringify(respond));
            if (!silent) console.log(indent, "\nend: ==================1st-round : Sign multiSig Transaction by 3rd signer - Middleware\n");
        }).catch(error => {
            if (!silent) console.log(indent, "error.code: ", error.code);
            if (!silent) console.log(indent, "Sign-MultiSig-Tx.Error: ", JSON.stringify(error));
            if (!silent) console.log(indent, "\nend: ==================1st-round : Sign multiSig Transaction by 3rd signer - Middleware\n");
        });
 
     });
 

    it("2nd-round : Create Multisig Tx, with Signer-1 : middleware", function () {
        this.slow(5000); // define the threshold for slow indicator
        if (!silent) console.log(indent, "\nstart: ==================2nd-round : Create Multisig Tx, with Signer-1 : middleware\n");

        let transaction = providerConnection.getTransactionRequest("bank", "bank-send", {
            from: multiSigWallet.address,
            to: wallet.address,
            value: mxw.utils.parseMxw("1"),
            memo: "pipipapipu",
            denom: smallestUnitName
        });

        let overrides = {
            accountNumber: multiSigWallet.multisigAccountState.value.accountNumber,
            nonce: 1           
        }

        let signer1 = new MultiSig.MultiSigWallet(multiSigWallet.address, middleware)
        signer1.refresh();
 
        return providerConnection.getTransactionFee(undefined, undefined, { tx: transaction }).then((fee) => {
            transaction["fee"] = fee;
            return signer1.createTransaction(transaction, overrides).then((txReceipt) => {
              expect(txReceipt).to.exist;
                if (!silent) console.log(indent, "Create-MultiSig-Tx.receipt: ", JSON.stringify(txReceipt));
                if (!silent) console.log(indent, "\nend: ==================2nd-round : Create Multisig Tx, with Signer-1 : middleware\n");
            });

        });

    });

    it("2nd-round : Sign multiSig Transaction by 2nd signer - Issuer", function () {
       this.slow(5000); // define the threshold for slow indicator
       if (!silent) console.log(indent, "\nstart: ==================2nd-round : Sign multiSig Transaction by 2nd signer - Issuer\n");

       let overrides = {
        accountNumber: multiSigWallet.multisigAccountState.value.accountNumber,
        nonce: 1           
        }


       let signer2 = new MultiSig.MultiSigWallet(multiSigWallet.address, issuer)
       signer2.refresh();
       return signer2.confirmTransaction(1, overrides).then((respond) => {
           expect(respond).to.exist;
           if (!silent) console.log(indent, "Sign-MultiSig-Tx.receipt: ", JSON.stringify(respond));
           if (!silent) console.log(indent, "\nend: ==================2nd-round : Sign multiSig Transaction by 2nd signer - Issuer\n");
       }).catch(error => {
           if (!silent) console.log(indent, "error.code: ", error.code);
           if (!silent) console.log(indent, "Sign-MultiSig-Tx.Error: ", JSON.stringify(error));
           if (!silent) console.log(indent, "\nend: ==================2nd-round : Sign multiSig Transaction by 2nd signer - Issuer\n");
       });

    });

    it("2nd-round : Sign multiSig Transaction by 3rd signer - Wallet", function () {
        this.slow(5000); // define the threshold for slow indicator
        if (!silent) console.log(indent, "\nstart: ==================2nd-round : Sign multiSig Transaction by 3rd signer - Wallet\n");
 
        let overrides = {
         accountNumber: multiSigWallet.multisigAccountState.value.accountNumber,
         nonce: 1           
         }
 
        let signer3 = new MultiSig.MultiSigWallet(multiSigWallet.address, wallet)
        signer3.refresh();
        return signer3.confirmTransaction(1, overrides).then((respond) => {
            expect(respond).to.exist;
            if (!silent) console.log(indent, "Sign-MultiSig-Tx.receipt: ", JSON.stringify(respond));
            if (!silent) console.log(indent, "\nend: ==================2nd-round : Sign multiSig Transaction by 3rd signer - Wallet\n");
        }).catch(error => {
            if (!silent) console.log(indent, "error.code: ", error.code);
            if (!silent) console.log(indent, "Sign-MultiSig-Tx.Error: ", JSON.stringify(error));
            if (!silent) console.log(indent, "\nend: ==================2nd-round : Sign multiSig Transaction by 3rd signer - Wallet\n");
        });
 
     });

    it("Clean up", function () {
        providerConnection.removeAllListeners();
    });
});


///============================= start : SINGLE signers =============================
describe('Suite: MultiSig - Create ', function () {
    this.slow(slowThreshold); // define the threshold for slow indicator
    it("Create", function () {
        let signers = [wallet.address, issuer.address, middleware.address];

        multiSigWalletProperties = {
            threshold: 2,
            signers: signers,
        };

        return MultiSig.MultiSigWallet.create(multiSigWalletProperties, wallet, defaultOverrides).then((multiSigWalletRes) => {
            expect(multiSigWalletRes).to.exist;
            if (!silent) console.log(multiSigWalletRes);
            multiSigWallet = multiSigWalletRes as MultiSig.MultiSigWallet;
        });
    });

    it("Query", function () {
        return MultiSig.MultiSigWallet.fromGroupAddress(multiSigWallet.address, wallet).then((res) => {
            if (!silent) console.log(indent, "Created MultiSigWallet:", JSON.stringify(res.multisigAccountState));
            multiSigWallet = res
        });
    });

    it("Multisig account Update", function () {

        let signers = [wallet.address, issuer.address, middleware.address];
        updateMultiSigWalletProperties = {
            owner: wallet.address,
            groupAddress: multiSigWallet.address.toString(),
            threshold: 2,
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
            to: multiSigWallet.address,
            value,
            memo: overrides.memo
        }).then((fee) => {
            overrides["fee"] = fee;
            return wallet.transfer(multiSigWallet.address, value, overrides).then((receipt) => {
                expect(receipt).to.exist;
                if (!silent) console.log(indent, "transfer.receipt:", JSON.stringify(receipt));
            });
        });
    });

    it("Multisig create Transfer", function () {
        let transaction = providerConnection.getTransactionRequest("bank", "bank-send", {
            from: multiSigWallet.address,
            to: wallet.address,
            value: mxw.utils.parseMxw("1"),
            memo: "pipipapipu",
            denom: smallestUnitName
        });

        return providerConnection.getTransactionFee(undefined, undefined, { tx: transaction }).then((fee) => {
            transaction["fee"] = fee;
            return multiSigWallet.createTransaction(transaction).then((txReceipt) => {
              expect(txReceipt).to.exist;
                if (!silent) console.log(indent, "Create-MultiSig-Tx.receipt: ", JSON.stringify(txReceipt));
            });

        });

    });

    it("Sign multiSig Transaction", function () {
        let transaction = providerConnection.getTransactionRequest("bank", "bank-send", {
            from: multiSigWallet.address,
            to: wallet.address,
            value: mxw.utils.parseMxw("1"),
            memo: "pipipapipu",
            denom: smallestUnitName
        });

        let overrides = {
            accountNumber: multiSigWallet.multisigAccountState.value.accountNumber,
            nonce: 0           
        }

        return providerConnection.getTransactionFee(undefined, undefined, { tx: transaction }).then((fee) => {
            transaction["fee"] = fee;
            let anotherSigner = new MultiSig.MultiSigWallet(multiSigWallet.address, wallet)
            anotherSigner.refresh();
            
            return anotherSigner.confirmTransaction(0, overrides).then((respond) => {
                expect(respond).to.exist;
                if (!silent) console.log(indent, "Sign-MultiSig-Tx.receipt: ", JSON.stringify(respond));
            }).catch(error => {
                if (!silent) console.log(indent, "error.code: ", error.code);
                if (!silent) console.log(indent, "Sign-MultiSig-Tx.Error: ", JSON.stringify(error));
            });

        });

    });

    it("Clean up", function () {
        providerConnection.removeAllListeners();
    });
});


describe('Suite: MultiSig - Create-multisig-acc, Update-multisig-acc', function () {
    this.slow(slowThreshold); // define the threshold for slow indicator

    //-OK
    it("Create Multisig Acc : Error due to number of thresholds bigger than signers list", function () {
        if (!silent) console.log(indent, "\nstart: ==================Create Multisig Acc : Error due to number of thresholds bigger than signers list\n");

        let signers = [issuer.address];
        multiSigWalletProperties = {
            threshold: 3,
            signers: signers,
        };

        return MultiSig.MultiSigWallet.create(multiSigWalletProperties, wallet, defaultOverrides).then((multiSigWalletRes) => {
        }).catch(error => {
            expect(error.code).to.equal(errors.UNEXPECTED_RESULT);
            if (!silent) console.log(indent, "Create-MultiSig-Acc.Error: ", JSON.stringify(error));
            if (!silent) console.log(indent, "\nend: ==================Create Multisig Acc : Error due to number of thresholds bigger than signers list\n");
        });

    });

    //-OK
    it("Create Multisig Acc : Error due to signers list is not allowed be empty", function () {
        if (!silent) console.log(indent, "\nstart: ==================Create Multisig Acc : Error due to signers list is not allowed be empty\n");

        let signers = [];
        multiSigWalletProperties = {
            threshold: 1,
            signers: signers,
        };

        return MultiSig.MultiSigWallet.create(multiSigWalletProperties, wallet, defaultOverrides).then((multiSigWalletRes) => {

        }).catch(error => {
            expect(error.code).to.equal(errors.UNEXPECTED_RESULT);
            if (!silent) console.log(indent, "Create-MultiSig-Acc.Error: ", JSON.stringify(error));
            if (!silent) console.log(indent, "\nend: ==================Create Multisig Acc : Error due to signers list is not allowed be empty\n");
        });

    });

    //-OK
    it("Create Multisig Acc : Error due to KYC registration is required for owner", function () {
        if (!silent) console.log(indent, "\nstart: ==================Create Multisig Acc : Error due to KYC registration is required for owner\n");

        let signers = [issuer.address];
        multiSigWalletProperties = {
            // owner: walletNonKYC.address,
            threshold: 1,
            signers: signers,
        };

        return MultiSig.MultiSigWallet.create(multiSigWalletProperties, walletNonKYC, defaultOverrides).then((multiSigWalletRes) => {

        }).catch(error => {
            expect(error.code).to.equal(errors.KYC_REQUIRED);
            if (!silent) console.log(indent, "Create-MultiSig-Acc.Error: ", JSON.stringify(error));
            if (!silent) console.log(indent, "\nend: ==================Create Multisig Acc : Error due to KYC registration is required for owner\n");
        });

    });

     //-OK
     it("Create Multisig Acc : Happy-path - commit.", function () {
        if (!silent) console.log(indent, "\nstart: ==================Create Multisig Acc : Happy-path - commit.\n");

        let signers = [issuer.address, middleware.address];
        multiSigWalletProperties = {
            threshold: 2,
            signers: signers,
        };

        return MultiSig.MultiSigWallet.create(multiSigWalletProperties, wallet, defaultOverrides).then((multiSigWalletRes) => {
            expect(multiSigWalletRes).to.exist;
            multiSigWallet = multiSigWalletRes as MultiSig.MultiSigWallet;
            if (!silent) console.log(indent, "groupAddress: ", multiSigWallet.address);
            if (!silent) console.log(indent, "\nend: ==================Create Multisig Acc : Happy-path - commit.\n");
        });

    });

    it("Query: group-address info", function () {
        return MultiSig.MultiSigWallet.fromGroupAddress(multiSigWallet.address, wallet).then((res) => {
            console.log(indent, "Created MultiSigWallet:", JSON.stringify(res.multisigAccountState));
            multiSigWallet = res
        });
    });

    //-OK
    it("Update Multisig Acc : Error due to number of thresholds bigger than signers list", function () {
        if (!silent) console.log(indent, "\nstart: ==================Update Multisig Acc : Error due to number of thresholds bigger than signers list\n");

        let signers = [issuer.address];
        updateMultiSigWalletProperties = {
            owner: wallet.address,
            groupAddress: multiSigWallet.address.toString(),
            threshold: (3),
            signers: signers,
        };

        return MultiSig.MultiSigWallet.update(updateMultiSigWalletProperties, wallet).then((txReceipt) => {
            expect(txReceipt).to.exist;
        }).catch(error => {
            expect(error.code).to.equal(errors.UNEXPECTED_RESULT);
            // if (!silent) console.log(indent, "error.code: ", error.code);
            if (!silent) console.log(indent, "Update-MultiSig-Acc.Error: ", JSON.stringify(error));
            if (!silent) console.log(indent, "\nend: ==================Update Multisig Acc : Error due to number of thresholds bigger than signers list\n");
        });

    });


    //-OK
    it("Update Multisig Acc : Error due to signers list is not allowed be empty", function () {
        if (!silent) console.log(indent, "\nstart: ==================Update Multisig Acc : Error due to signers list is not allowed be empty\n");

        let signers = [];
        updateMultiSigWalletProperties = {
            owner: wallet.address,
            groupAddress: multiSigWallet.address.toString(),
            threshold: (1),
            signers: signers,
        };

        return MultiSig.MultiSigWallet.update(updateMultiSigWalletProperties, wallet).then((txReceipt) => {
            expect(txReceipt).to.exist;
        }).catch(error => {
            expect(error.code).to.equal(errors.UNEXPECTED_RESULT);
            // if (!silent) console.log(indent, "error.code: ", error.code);
            if (!silent) console.log(indent, "Update-MultiSig-Acc.Error: ", JSON.stringify(error));
            if (!silent) console.log(indent, "\nend: ==================Update Multisig Acc : Error due to signers list is not allowed be empty\n");
        });

    });

    //-OK
    it("Update Multisig Acc : Error due to KYC registration is required for owner", function () {
        if (!silent) console.log(indent, "\nstart: ==================Update Multisig Acc : Error due to KYC registration is required for owner\n");

        let signers = [];
        updateMultiSigWalletProperties = {
            owner: walletNonKYC.address,
            groupAddress: multiSigWallet.address.toString(),
            threshold: (1),
            signers: signers,
        };

        return MultiSig.MultiSigWallet.update(updateMultiSigWalletProperties, walletNonKYC).then((txReceipt) => {
            expect(txReceipt).to.exist;
        }).catch(error => {
            expect(error.code).to.equal(errors.UNEXPECTED_RESULT);
            if (!silent) console.log(indent, "Update-MultiSig-Acc.Error: ", JSON.stringify(error));
            if (!silent) console.log(indent, "\nend: ==================Update Multisig Acc : Error due to KYC registration is required for owner\n");
        });


    });

    //-OK
    it("Update Multisig Acc : Happy-path - commit.", function () {
        if (!silent) console.log(indent, "\nstart: ==================Update Multisig Acc : Happy-path - commit.\n");

        let signers = [issuer.address, middleware.address];
        multiSigWalletProperties = {
            threshold: 2,
            signers: signers,
        };

        return MultiSig.MultiSigWallet.create(multiSigWalletProperties, wallet, defaultOverrides).then((multiSigWalletRes) => {
            expect(multiSigWalletRes).to.exist;
            multiSigWallet = multiSigWalletRes as MultiSig.MultiSigWallet;
            if (!silent) console.log(indent, "groupAddress: ", multiSigWallet.address);
            if (!silent) console.log(indent, "\nend: ==================Update Multisig Acc : Happy-path - commit.\n");
        });

    });

    it("Query: group-address info", function () {
        return MultiSig.MultiSigWallet.fromGroupAddress(multiSigWallet.address, wallet).then((res) => {
            console.log(indent, "Updated MultiSigWallet:", JSON.stringify(res.multisigAccountState));
            multiSigWallet = res
        });
    });

    it("Clean up", function () {
        providerConnection.removeAllListeners();
    });

});


describe('Suite: MultiSig - Case 1. Invalid Internal-tx', function () {
    this.slow(slowThreshold); // define the threshold for slow indicator

    it("Create", function () {
        let signers = [wallet.address];

        multiSigWalletProperties = {
            threshold: 1,
            signers: signers,
        };

        return MultiSig.MultiSigWallet.create(multiSigWalletProperties, wallet, defaultOverrides).then((multiSigWalletRes) => {
            expect(multiSigWalletRes).to.exist;
            multiSigWallet = multiSigWalletRes as MultiSig.MultiSigWallet;
            if (!silent) console.log(indent, "groupAddress: ", multiSigWallet.address);
        });
    });

    it("Query", function () {
        return MultiSig.MultiSigWallet.fromGroupAddress(multiSigWallet.address, wallet).then((res) => {
            console.log(indent, "Created MultiSigWallet:", JSON.stringify(res.multisigAccountState));
            multiSigWallet = res
        });
    });

    // Tx - Top-up Group-address
    it("Top-up group account", function () {
        let value = mxw.utils.parseMxw("110");
        let overrides = {
            logSignaturePayload: defaultOverrides.logSignaturePayload,
            logSignedTransaction: defaultOverrides.logSignedTransaction,
            memo: "Hello Blockchain!"
        }
        return wallet.provider.getTransactionFee("bank", "bank-send", {
            from: wallet.address,
            to: multiSigWallet.address,
            value,
            memo: overrides.memo,
            denom: smallestUnitName
        }).then((fee) => {
            overrides["fee"] = fee;
            return wallet.transfer(multiSigWallet.address, value, overrides).then((receipt) => {
                expect(receipt).to.exist;
                if (!silent) console.log(indent, "Top-up group-address.receipt:", JSON.stringify(receipt));
            });
        });
    });

    it("Group-address for Get balance", function () {
        return multiSigWallet.getBalance().then((balance) => {
            expect(balance).to.exist;
            if (!silent) console.log(indent, "Group-address Balance:", formatMxw(balance), "(" + multiSigWallet.address + ")");
        });
    });

    it("Create Multisig Tx, Error due to : Internal-tx - Insufficient balance to do transaction by sender-groupAddress", function () {
        if (!silent) console.log(indent, "\nstart: ==================Create Multisig Tx, Error due to : Internal-tx - Insufficient balance to do transaction by sender-groupAddress\n");

        // Tx - Internal Tx
        let transaction = providerConnection.getTransactionRequest("bank", "bank-send", {
            from: multiSigWallet.address,
            to: middleware.address,
            value: mxw.utils.parseMxw("7100"),
            memo: "pipipapipu",
            denom: smallestUnitName
        });

        let overrides = {
            accountNumber: multiSigWallet.multisigAccountState.value.accountNumber,
            nonce: 0           
        }

        return providerConnection.getTransactionFee(undefined, undefined, { tx: transaction }).then((fee) => {
            transaction["fee"] = fee;
            return multiSigWallet.createTransaction(transaction, overrides).then((receipt) => {
                expect(receipt).to.exist;
                if (!silent) console.log(indent, "hash: ", receipt.hash, " and value: ", JSON.stringify(receipt.value));
                if (!silent) console.log(indent, "\nend: ==================Create Multisig Tx, Error due to : Internal-tx - Insufficient balance to do transaction by sender-groupAddress\n");
            });
        });
    });

    it("Clean up", function () {
        providerConnection.removeAllListeners();
    });
});

describe('Suite: MultiSig - Case 2. Invalid Internal-tx', function () {
    this.slow(slowThreshold); // define the threshold for slow indicator

    it("Create", function () {
        let signers = [wallet.address];

        multiSigWalletProperties = {
            threshold: 1,
            signers: signers,
        };

        return MultiSig.MultiSigWallet.create(multiSigWalletProperties, wallet, defaultOverrides).then((multiSigWalletRes) => {
            expect(multiSigWalletRes).to.exist;
            multiSigWallet = multiSigWalletRes as MultiSig.MultiSigWallet;
            if (!silent) console.log(indent, "groupAddress: ", multiSigWallet.address);
        });
    });

    it("Query", function () {
        return MultiSig.MultiSigWallet.fromGroupAddress(multiSigWallet.address, wallet).then((res) => {
            console.log(indent, "Created MultiSigWallet:", JSON.stringify(res.multisigAccountState));
            multiSigWallet = res
        });
    });

    // Tx - Top-up Group-address
    it("Top-up group account", function () {
        let value = mxw.utils.parseMxw("110");
        let overrides = {
            logSignaturePayload: defaultOverrides.logSignaturePayload,
            logSignedTransaction: defaultOverrides.logSignedTransaction,
            memo: "Hello Blockchain!"
        }
        return wallet.provider.getTransactionFee("bank", "bank-send", {
            from: wallet.address,
            to: multiSigWallet.address,
            value,
            memo: overrides.memo,
            denom: smallestUnitName
        }).then((fee) => {
            overrides["fee"] = fee;
            return wallet.transfer(multiSigWallet.address, value, overrides).then((receipt) => {
                expect(receipt).to.exist;
                if (!silent) console.log(indent, "Top-up group-address.receipt:", JSON.stringify(receipt));
            });
        });
    });

    it("Group-address for Get balance", function () {
        return multiSigWallet.getBalance().then((balance) => {
            expect(balance).to.exist;
            if (!silent) console.log(indent, "Group-address Balance:", formatMxw(balance), "(" + multiSigWallet.address + ")");
        });
    });

    it("Create Multisig Tx, Error due to : Internal-tx - too long MEMO be used (maximum number of characters is 256 but received more than this limit of characters)", function () {
        if (!silent) console.log(indent, "\nstart: ==================Create Multisig Tx, Error due to : Internal-tx - too long MEMO be used (maximum number of characters is 256 but received more than this limit of characters)\n");
        // Tx - Internal Tx
        let transaction = providerConnection.getTransactionRequest("bank", "bank-send", {
            from: multiSigWallet.address,
            to: middleware.address,
            value: mxw.utils.parseMxw("31"),
            memo: "123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890xxxxxxxxxxxxxxYYYYYYYYYYYYYYYYYYYYzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz",
            denom: smallestUnitName
        });

        let overrides = {
            accountNumber: multiSigWallet.multisigAccountState.value.accountNumber,
            nonce: 0          
        }

        // if (!silent) console.log(indent, "\n........transaction: ", JSON.stringify(transaction), "\n");
        return providerConnection.getTransactionFee(undefined, undefined, { tx: transaction }).then((fee) => {
            transaction["fee"] = fee;
            return multiSigWallet.createTransaction(transaction, overrides).then((receipt) => {
                expect(receipt).to.exist;
                if (!silent) console.log(indent, "hash: ", receipt.hash, " and value: ", JSON.stringify(receipt.value));
                if (!silent) console.log(indent, "\nend: ==================Create Multisig Tx, Error due to : Internal-tx - too long MEMO be used (maximum number of characters is 256 but received more than this limit of characters)\n");
            });
        });
    });

    it("Clean up", function () {
        providerConnection.removeAllListeners();
    });
});


describe('Suite: MultiSig - Case 3. Invalid Cases', function () {
        this.slow(slowThreshold); // define the threshold for slow indicator

    it("Create", function () {
        let signers = [wallet.address];

        multiSigWalletProperties = {
            threshold: 1,
            signers: signers,
        };

        return MultiSig.MultiSigWallet.create(multiSigWalletProperties, wallet, defaultOverrides).then((multiSigWalletRes) => {
            expect(multiSigWalletRes).to.exist;
            multiSigWallet = multiSigWalletRes as MultiSig.MultiSigWallet;
            if (!silent) console.log(indent, "groupAddress: ", multiSigWallet.address);
        });
    });

    it("Query", function () {
        return MultiSig.MultiSigWallet.fromGroupAddress(multiSigWallet.address, wallet).then((res) => {
            if (!silent) console.log(indent, "Created MultiSigWallet:", JSON.stringify(res.multisigAccountState));
            multiSigWallet = res
        });
    });

    // Tx - Top-up Group-address
    it("Top-up group account", function () {
        let value = mxw.utils.parseMxw("45555");
        let overrides = {
            logSignaturePayload: defaultOverrides.logSignaturePayload,
            logSignedTransaction: defaultOverrides.logSignedTransaction,
            memo: "Hello Blockchain!"
        }
        return wallet.provider.getTransactionFee("bank", "bank-send", {
            from: wallet.address,
            to: multiSigWallet.address,
            value,
            memo: overrides.memo,
            denom: smallestUnitName
        }).then((fee) => {
            overrides["fee"] = fee;
            return wallet.transfer(multiSigWallet.address, value, overrides).then((receipt) => {
                expect(receipt).to.exist;
                if (!silent) console.log(indent, "Top-up group-address.receipt:", JSON.stringify(receipt));
            });
        });
    });

    // check group-address Bal.
    it("Group Address for Get balance", function () {
        return multiSigWallet.getBalance().then((balance) => {
            expect(balance).to.exist;
            if (!silent) console.log(indent, "Group-address Balance:", formatMxw(balance), "(" + multiSigWallet.address + ")");
        });
    });

    //1.-OK
    it("Create Multisig Tx, Error due to : Internal-tx - Invalid receiver (decoding bech32 failed)", function () {
        if (!silent) console.log(indent, "\nstart: ==================Create Multisig Tx, Error due to : Internal-tx - Invalid receiver (decoding bech32 failed)\n");
        // Tx - Internal Tx
        let transaction = providerConnection.getTransactionRequest("bank", "bank-send", {
            from: multiSigWallet.address,
            to: "bbb1x5cf8y99ntjc8cjm00z603yfqwzxw2mawemf73",         // Invalid address
            value: mxw.utils.parseMxw("1"),
            memo: "MEMO - Invalid receiver (invalid bech32 string length)",
            denom: smallestUnitName,
        });

        let overrides = {
            accountNumber: multiSigWallet.multisigAccountState.value.accountNumber,
            nonce: 0           
        }

        return providerConnection.getTransactionFee(undefined, undefined, { tx: transaction }).then((fee) => {
            transaction["fee"] = fee;
            return multiSigWallet.createTransaction(transaction, overrides).then((receipt) => {
                expect(receipt).to.exist;
            }).catch(error => {
                if (!silent) console.log(indent, "error.code: ", error.code);
                if (!silent) console.log(indent, "Create-MultiSig-Tx.Error: ", JSON.stringify(error));
                if (!silent) console.log(indent, "\nend: ==================Create Multisig Tx, Error due to : Internal-tx - Invalid receiver (decoding bech32 failed)\n");
            });
        });
    });

    it("Wallet-address for Get balance", function () {
        return wallet.getBalance().then((balance) => {
            expect(balance).to.exist;
            if (!silent) console.log(indent, "Wallet-address Balance:", formatMxw(balance), "(" + wallet.address + ")");
        });
    });

    //3.-OK
    it("Create Multisig Tx, OK : Internal-tx - A Valid receiver which not yet to KYC", function () {
        if (!silent) console.log(indent, "\nstart: ==================Create Multisig Tx, OK : Internal-tx - A Valid receiver which not yet to KYC\n");

        // Tx - Internal Tx
        let transaction = providerConnection.getTransactionRequest("bank", "bank-send", {
            from: multiSigWallet.address,
            to: walletNonKYC.address,
            value: mxw.utils.parseMxw("5"),
            memo: "MEMO - 3.1 A Valid receiver which not yet to KYC",
            denom: smallestUnitName,
        });

        let overrides = {
            accountNumber: multiSigWallet.multisigAccountState.value.accountNumber,
            nonce: 0           
        }

        return providerConnection.getTransactionFee(undefined, undefined, { tx: transaction }).then((fee) => {
            transaction["fee"] = fee;
            return multiSigWallet.createTransaction(transaction, overrides).then((receipt) => {
                expect(receipt).to.exist;
                if (!silent) console.log(indent, "hash: ", receipt.hash, " and value: ", JSON.stringify(receipt.value));
                if (!silent) console.log(indent, "\nend: ==================Create Multisig Tx, OK : Internal-tx - A Valid receiver which not yet to KYC\n");
            });
        });
    });

    //3.2-OK
    it("Create Multisig Tx, Error due to : Internal-tx - (Re-submit base 3.1) Signature verification failed due to Invalid nonce value", function () {
        if (!silent) console.log(indent, "\nstart: ==================Create Multisig Tx, OK : Internal-tx - A Valid receiver which not yet to KYC\n");

        // Tx - Internal Tx
        let transaction = providerConnection.getTransactionRequest("bank", "bank-send", {
            from: multiSigWallet.address,
            to: walletNonKYC.address,
            value: mxw.utils.parseMxw("6"),
            memo: "MEMO - 3.2 A Valid receiver which not yet to KYC",
            denom: smallestUnitName,
        });

        let overrides = {
            accountNumber: multiSigWallet.multisigAccountState.value.accountNumber,
            nonce: 1            // should be ZERO        
        }

        return providerConnection.getTransactionFee(undefined, undefined, { tx: transaction }).then((fee) => {
            transaction["fee"] = fee;
            return multiSigWallet.createTransaction(transaction, overrides).then((receipt) => {
                expect(receipt).to.exist;
            }).catch(error => {
                if (!silent) console.log(indent, "Create-MultiSig-Tx.Error: ", JSON.stringify(error));
                if (!silent) console.log(indent, "\nend: ==================Create Multisig Tx, OK : Internal-tx - A Valid receiver which not yet to KYC\n");
            });
        });
    });
    
    it("Top-up walletNonKYC-account", function () {
        let value = mxw.utils.parseMxw("100");
        let overrides = {
            logSignaturePayload: defaultOverrides.logSignaturePayload,
            logSignedTransaction: defaultOverrides.logSignedTransaction,
            memo: "Hello Blockchain!"
        }
        return wallet.provider.getTransactionFee("bank", "bank-send", {
            from: wallet.address,
            to: walletNonKYC.address,
            value,
            memo: overrides.memo,
            denom: smallestUnitName
        }).then((fee) => {
            overrides["fee"] = fee;
            return wallet.transfer(issuer.address, value, overrides).then((receipt) => {
                expect(receipt).to.exist;
                if (!silent) console.log(indent, "Top-up.receipt:", JSON.stringify(receipt));
            });
        });
    });

    it("WalletNonKYC-address for Get balance", function () {
        return walletNonKYC.getBalance().then((balance) => {
            expect(balance).to.exist;
            if (!silent) console.log(indent, "WalletNonKYC-address Balance:", formatMxw(balance), "(" + walletNonKYC.address + ")");
        });
    });

    //4.-OK
    it("Create Multisig Tx, Error due to : Internal-tx - Message signer is not whitelisted", function () {
        if (!silent) console.log(indent, "\nstart: ==================Create Multisig Tx, Error due to : Internal-tx - Message signer is not whitelisted\n");

        // Tx - Internal Tx
        let transaction = providerConnection.getTransactionRequest("bank", "bank-send", {
            from: walletNonKYC.address,
            to: issuer.address,
            value: mxw.utils.parseMxw("7"),
            memo: "MEMO - Message signer is not whitelisted",
            denom: smallestUnitName,
        });

        let overrides = {
            accountNumber: multiSigWallet.multisigAccountState.value.accountNumber,
            nonce: 0           
        }

        return providerConnection.getTransactionFee(undefined, undefined, { tx: transaction }).then((fee) => {
            transaction["fee"] = fee;
            return multiSigWallet.createTransaction(transaction, overrides).then((receipt) => {
                expect(receipt).to.exist;
            }).catch(error => {
                expect(error.code).to.equal("UNEXPECTED_RESULT");  
                if (!silent) console.log(indent, "Create-MultiSig-Tx.Error: ", JSON.stringify(error));
                if (!silent) console.log(indent, "\nend: ==================Create Multisig Tx, Error due to : Internal-tx - Message signer is not whitelisted\n");
            });
        });
    });

    //2. -OK
    it("Create Multisig Tx, Error due to : Internal-tx - Invalid denom for fund.", function () {
        if (!silent) console.log(indent, "\nstart: ==================Create Multisig Tx, Error due to : Internal-tx - Invalid denom for fund.\n");

        // Tx - Internal Tx
        let transaction = providerConnection.getTransactionRequest("bank", "bank-send", {
            from: multiSigWallet.address,
            to: issuer.address,
            value: mxw.utils.parseMxw("2"),
            memo: "MEMO - Invalid denom for fund.",
            denom: "abc",                   // as this format is wrong, need use CORRECT 'cin'
        });
        // if (!silent) console.log(indent, "Invalid denom for fund.........transaction:", JSON.stringify(transaction));

        let overrides = {
            accountNumber: multiSigWallet.multisigAccountState.value.accountNumber,
            nonce: 0           
        }

        return providerConnection.getTransactionFee(undefined, undefined, { tx: transaction }).then((fee) => {
            transaction["fee"] = fee;
            return multiSigWallet.createTransaction(transaction, overrides).then((receipt) => {
                expect(receipt).to.exist;
            }).catch(error => {
                if (!silent) console.log(indent, "Create-MultiSig-Tx.Error: ", JSON.stringify(error));
                if (!silent) console.log(indent, "\nend: ==================Create Multisig Tx, Error due to : Internal-tx - Invalid denom for fund.\n");
            });
        });
    });

    it("Clean up", function () {
        providerConnection.removeAllListeners();
    });
});


describe('Suite: MultiSig - Case 4. Valid Case with ONE signer', function () {
    this.slow(slowThreshold); // define the threshold for slow indicator

    it("Create", function () {
        let signers = [wallet.address];

        multiSigWalletProperties = {
            threshold: 1,
            signers: signers,
        };

        return MultiSig.MultiSigWallet.create(multiSigWalletProperties, wallet, defaultOverrides).then((multiSigWalletRes) => {
            expect(multiSigWalletRes).to.exist;
            multiSigWallet = multiSigWalletRes as MultiSig.MultiSigWallet;
            if (!silent) console.log(indent, "groupAddress: ", multiSigWallet.address);
        });
    });

    it("Query", function () {
        return MultiSig.MultiSigWallet.fromGroupAddress(multiSigWallet.address, wallet).then((res) => {
            console.log(indent, "Created MultiSigWallet:", JSON.stringify(res.multisigAccountState));
            multiSigWallet = res
        });
    });

    // Tx - Top-up Group-address
    it("Top-up group account", function () {
        let value = mxw.utils.parseMxw("45555");
        let overrides = {
            logSignaturePayload: defaultOverrides.logSignaturePayload,
            logSignedTransaction: defaultOverrides.logSignedTransaction,
            memo: "Hello Blockchain!"
        }
        return wallet.provider.getTransactionFee("bank", "bank-send", {
            from: wallet.address,
            to: multiSigWallet.address,
            value,
            memo: overrides.memo,
            denom: smallestUnitName
        }).then((fee) => {
            overrides["fee"] = fee;
            return wallet.transfer(multiSigWallet.address, value, overrides).then((receipt) => {
                expect(receipt).to.exist;
                if (!silent) console.log(indent, "Top-up group-address.receipt:", JSON.stringify(receipt));
            });
        });
    });

    // check group-address Bal.
    it("Group Address for Get balance", function () {
        return multiSigWallet.getBalance().then((balance) => {
            expect(balance).to.exist;
            if (!silent) console.log(indent, "Group-address Balance:", formatMxw(balance), "(" + multiSigWallet.address + ")");
        });
    });

    it("Wallet-address for Get balance", function () {
        return wallet.getBalance().then((balance) => {
            expect(balance).to.exist;
            if (!silent) console.log(indent, "Wallet-address Balance:", formatMxw(balance), "(" + wallet.address + ")");
        });
    });

    //5.-OK
    it("Create Multisig Tx, using ONE signer", function () {
        if (!silent) console.log(indent, "\nstart: ==================Create Multisig Tx, using ONE signer\n");

        // Tx - Internal Tx
        let transaction = providerConnection.getTransactionRequest("bank", "bank-send", {
            from: multiSigWallet.address,
            to: issuer.address,
            value: mxw.utils.parseMxw("8"),
            memo: "MEMO - Valid Sender and Receiver",
            denom: smallestUnitName,
        });

        let overrides = {
            accountNumber: multiSigWallet.multisigAccountState.value.accountNumber,
            nonce: 0                 
        }

        return providerConnection.getTransactionFee(undefined, undefined, { tx: transaction }).then((fee) => {
            transaction["fee"] = fee;
            return multiSigWallet.createTransaction(transaction, overrides).then((receipt) => {
                expect(receipt).to.exist;
                if (!silent) console.log(indent, "Create-MultiSig-Tx.receipt: ", JSON.stringify(receipt));
                if (!silent) console.log(indent, "hash: ", receipt.hash, " and value: ", JSON.stringify(receipt.value));
                if (!silent) console.log(indent, "\nend: ==================Create Multisig Tx, using ONE signer\n");
            });
        });
    });

    it("Clean up", function () {
        providerConnection.removeAllListeners();
    });
});


