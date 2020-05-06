'use strict';

import { describe, it } from 'mocha';
import { expect } from 'chai';
import { mxw, nonFungibleToken as token, MultiSig } from '../src.ts/index';
import { errors } from '../src.ts/index';
import { nodeProvider } from "./env";
import { formatMxw, } from '../src.ts/utils';
import { smallestUnitName } from '../src.ts/utils/units';
import { bigNumberify, hexlify, randomBytes } from '../src.ts/utils';

import { NonFungibleTokenActions} from '../src.ts/non-fungible-token';
import { NonFungibleTokenItem } from '../src.ts/non-fungible-token-item';
import * as crypto from "crypto";


let indent = "     ";
let silent = true;
let silentRpc = true;
let slowThreshold = 9000;

let providerConnection: mxw.providers.Provider;
let wallet: mxw.Wallet;
let provider: mxw.Wallet;
let issuer: mxw.Wallet;
let middleware: mxw.Wallet;
let walletNonKYC: mxw.Wallet;

let nonFungibleToken: token.NonFungibleToken;
let nonFungibleTokenItem: token.NonFungibleTokenItem;

let sampleSymbol: string;
let sampleItemId: string;

let multiSigWalletProperties: MultiSig.MultiSigWalletProperties;
let multiSigWallet: MultiSig.MultiSigWallet;
let multiSigWallet2: MultiSig.MultiSigWallet;


let defaultOverrides = {
    logSignaturePayload: function (payload) {
        if (!silentRpc) console.log(indent, "\nsignaturePayload:", JSON.stringify(payload));
    },
    logSignedTransaction: function (signedTransaction) {
        if (!silentRpc) console.log(indent, "\nsignedTransaction:", signedTransaction);
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

        walletNonKYC = mxw.Wallet.fromMnemonic(nodeProvider.airDrop).connect(providerConnection);
        expect(walletNonKYC).to.exist;
        if (!silent) console.log(indent, "walletNonKYC:", JSON.stringify({ address: walletNonKYC.address, mnemonic: walletNonKYC.mnemonic }));

        wallet = mxw.Wallet.fromMnemonic(nodeProvider.kyc.issuer).connect(providerConnection);
        expect(wallet).to.exist;
        if (!silent) console.log(indent, "Wallet:", JSON.stringify({ address: wallet.address, mnemonic: wallet.mnemonic }));

        provider = mxw.Wallet.fromMnemonic(nodeProvider.nonFungibleToken.provider).connect(providerConnection);
        expect(provider).to.exist;
        if (!silent) console.log(indent, "NFTs Provider:", JSON.stringify({ address: provider.address, mnemonic: provider.mnemonic }));

        issuer = mxw.Wallet.fromMnemonic(nodeProvider.nonFungibleToken.issuer).connect(providerConnection);
        expect(issuer).to.exist;
        if (!silent) console.log(indent, "NFTs Issuer:", JSON.stringify({ address: issuer.address, mnemonic: issuer.mnemonic }));

        middleware = mxw.Wallet.fromMnemonic(nodeProvider.nonFungibleToken.middleware).connect(providerConnection);
        expect(middleware).to.exist;
        if (!silent) console.log(indent, "NFTs middleware:", JSON.stringify({ address: middleware.address, mnemonic: issuer.mnemonic }));

        if (!silent) console.log(indent, "Fee collector:", JSON.stringify({ address: nodeProvider.nonFungibleToken.feeCollector }));

    });
});

// Case 1. Valid Case with ONE signer
describe('Suite: MultiSig - Case 1. Valid Case with ONE signer', function () {
    this.slow(slowThreshold); // define the threshold for slow indicator

    // Create multisig Group-address 2 :
    it("Create", function () {
        let signers = [middleware.address];
        multiSigWalletProperties = {
            threshold: 1,
            signers: signers,
        };

        return MultiSig.MultiSigWallet.create(multiSigWalletProperties, middleware, defaultOverrides).then((multiSigWalletRes) => {
            expect(multiSigWalletRes).to.exist;
            multiSigWallet2 = multiSigWalletRes as MultiSig.MultiSigWallet;
            if (!silent) console.log(indent, "groupAddress-2: ", multiSigWallet2.address);
        });
    });

    // Create multisig Group-address 2 :
    it("Query", function () {
        return MultiSig.MultiSigWallet.fromGroupAddress(multiSigWallet2.address, middleware).then((res) => {
            console.log(indent, "Created MultiSigWallet-2:", JSON.stringify(res.multisigAccountState));
            multiSigWallet2 = res
        });
    });

    // Create multisig Group-address 2 :
    // Tx - Top-up Group-address 2:
    it("Top-up group account-2", function () {
        let value = mxw.utils.parseMxw("75555");
        let overrides = {
            logSignaturePayload: defaultOverrides.logSignaturePayload,
            logSignedTransaction: defaultOverrides.logSignedTransaction,
            memo: "Hello Blockchain!"
        }
        return wallet.provider.getTransactionFee("bank", "bank-send", {
            from: wallet.address,
            to: multiSigWallet2.address,
            value,
            memo: overrides.memo,
            denom: smallestUnitName
        }).then((fee) => {
            overrides["fee"] = fee;
            return wallet.transfer(multiSigWallet2.address, value, overrides).then((receipt) => {
                expect(receipt).to.exist;
                if (!silent) console.log(indent, "Top-up group-address-2.receipt:", JSON.stringify(receipt));
            });
        });
    });


    // Create multisig Group-address 1 :
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

    // Create multisig Group-address 1 :
    it("Query", function () {
        return MultiSig.MultiSigWallet.fromGroupAddress(multiSigWallet.address, wallet).then((res) => {
            console.log(indent, "Created MultiSigWallet:", JSON.stringify(res.multisigAccountState));
            multiSigWallet = res
        });
    });

    // Create multisig Group-address 1 :
    // Tx - Top-up Group-address
    it("Top-up group account-1", function () {
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

    //-D:1. create-token 
    it("Create Multisig Tx, create-NFTs-token", function () {

        if (!silent) console.log(indent, "\nstart: ==================Create Multisig Tx, create-NFTs-token\n");

        sampleSymbol = "NFT" + hexlify(randomBytes(4)).substring(2);
        if (!silent) console.log(indent, "\n===================================sampleSymbol:", sampleSymbol);

        // Tx - Internal Tx
        let transaction = providerConnection.getTransactionRequest("nonFungible", "createNonFungibleToken", {
            appFeeTo: nodeProvider.nonFungibleToken.feeCollector,
            appFeeValue: bigNumberify("1"),
            name: "MY" + sampleSymbol,
            owner: multiSigWallet.address,
            memo: "MEMO: Create NFTs token - " + sampleSymbol,
            metadata: "token-metadata",
            properties: "token-properties",
            symbol: sampleSymbol,
        });

        nonFungibleToken = transaction as token.NonFungibleToken;
        if (!silent) console.log(indent, "\n......nonFungibleToken: ", JSON.stringify(nonFungibleToken));

        let overrides = {
            accountNumber: multiSigWallet.multisigAccountState.value.accountNumber,
            nonce: 0   //TxID = 0 (create-internal-tx)              
        }

        return providerConnection.getTransactionFee(undefined, undefined, { tx: transaction }).then((fee) => {
            transaction["fee"] = fee;
            return multiSigWallet.createTransaction(transaction, overrides).then((receipt) => {
                expect(receipt).to.exist;
                if (!silent) console.log(indent, "\nCreate-MultiSig-Tx.receipt: ", JSON.stringify(receipt));
                if (!silent) console.log(indent, "\nhash: ", receipt.hash, " and value: ", JSON.stringify(receipt.value));
                if (!silent) console.log(indent, "\nend: ==================Create Multisig Tx, create-NFTs-token\n");
            });
        });
    });

    //-D:
    it("Query", function () {

        if (!silent) console.log(indent, "\nb4 [Query]......nonFungibleToken: ", JSON.stringify(nonFungibleToken));
        return refresh(sampleSymbol).then(() => {
            expect(nonFungibleToken).to.exist;
            if (!silent) console.log(indent, "\nQuery Created Token:", JSON.stringify(nonFungibleToken.state.symbol));
        });
    });

    //-D:2. Approve (non-multisig)
    it("Approve-NFTs-token", function () {

        if (!silent) console.log(indent, "\n[Approve-NFTs-token]......Token:", JSON.stringify(nonFungibleToken.state.symbol));
        let overrides = {
            tokenFees: [
                { action: NonFungibleTokenActions.transfer, feeName: "default" },
                { action: NonFungibleTokenActions.transferOwnership, feeName: "default" },
                { action: NonFungibleTokenActions.acceptOwnership, feeName: "default" }
            ],
            endorserList: [provider.address, issuer.address],
            mintLimit: 1,
            transferLimit: 1,
            burnable: true,
            transferable: true,
            modifiable: false,
            pub: false,   // not public
            issuer: issuer.address,
            provider: provider.address

        };
        if (!silent) console.log(indent, "\n[Approve-NFTs-token]......nonFungibleToken.symbol: ", nonFungibleToken.state.symbol);

        return performNonFungibleTokenStatus(nonFungibleToken.state.symbol, token.NonFungibleToken.approveNonFungibleToken, overrides).then((receipt) => {
            if (!silent) console.log(indent, "\nRECEIPT:", JSON.stringify(receipt));
        });
    });

    //-D:3.1 mintItem : Item-owner == issuer
    it("Create Multisig Tx, mint-NFTs-item", function () {

        if (!silent) console.log(indent, "\nstart: ==================Create Multisig Tx, mint-NFTs-item\n");

        sampleItemId = crypto.randomBytes(16).toString('hex');
        if (!silent) console.log(indent, "\n===================================sampleItemId:", sampleItemId);

        // Tx - Internal Tx
        let transaction = providerConnection.getTransactionRequest("nonFungible", "mintNonFungibleItem", {
            itemID: sampleItemId,
            symbol: nonFungibleToken.state.symbol,
            owner: multiSigWallet.address,
            to: issuer.address,
            properties: "item properties",
            metadata: "item metadata",
            memo: "MEMO: Create NFTs Item - " + sampleItemId,
        });

        nonFungibleTokenItem = transaction as token.NonFungibleTokenItem;
        if (!silent) console.log(indent, "\n......nonFungibleTokenItem: ", JSON.stringify(nonFungibleTokenItem));

        let overrides = {
            accountNumber: multiSigWallet.multisigAccountState.value.accountNumber,
            nonce: 1   //TxID = 1  (create-internal-tx)              
        }

        return providerConnection.getTransactionFee(undefined, undefined, { tx: transaction }).then((fee) => {
            transaction["fee"] = fee;
            return multiSigWallet.createTransaction(transaction, overrides).then((receipt) => {
                expect(receipt).to.exist;
                if (!silent) console.log(indent, "\nCreate-MultiSig-Tx.receipt: ", JSON.stringify(receipt));
                if (!silent) console.log(indent, "\nhash: ", receipt.hash, " and value: ", JSON.stringify(receipt.value));
                if (!silent) console.log(indent, "\nend: ==================Create Multisig Tx, mint-NFTs-item\n");
            });
        });
    });
    
    //-D:
    let mintedNFTItem: NonFungibleTokenItem;
    it("Get Token properties & Item properties of this Item", function () {
        return NonFungibleTokenItem.fromSymbol(nonFungibleToken.state.symbol, sampleItemId, issuer).then((nftItem) => {
            expect(nftItem).exist;
            mintedNFTItem = nftItem;
            expect(mintedNFTItem.parent.symbol).to.equal(nonFungibleToken.state.symbol);

            if (!silent) console.log(indent, "\nGet Token Info: ", mintedNFTItem.parent.state);
            if (!silent) console.log(indent, "\nGet Item Info: ", mintedNFTItem.state);
        })
    });

    //-D:3.2 endorseItem (non-multisig)
    it("Endorse", function () {
        let nftItemInstance = new NonFungibleTokenItem(nonFungibleToken.state.symbol, mintedNFTItem.state.id, issuer);
        return nftItemInstance.endorse().then((receipt) => {
            expect(receipt.status).to.equal(1);
            if (!silent) console.log(indent, "\nendorseItem: ", JSON.stringify(receipt));
        });
    });


    //-D:3.3 transferItem (non-multisig)
    it("Transfer NFT Item", function () {
        return mintedNFTItem.transfer(multiSigWallet.address).then((receipt) => {
            expect(receipt.status).to.equal(1);
            if (!silent) console.log(indent, "\nTransfer NFT Item, RECEIPT: ", JSON.stringify(receipt));
        }).catch(error => {
            expect(error.code).to.equal(errors.NOT_ALLOWED);
            if (!silent) console.log(indent, "\nTransfer NFT Item, Error: ", JSON.stringify(error));
        });
    });

    //-D:3.4 burnItem
    it("Create Multisig Tx, burn-NFTs-item", function () {

        if (!silent) console.log(indent, "\nstart: ==================Create Multisig Tx, burn-NFTs-item\n");

        // Tx - Internal Tx
        let transaction = providerConnection.getTransactionRequest("nonFungible", "burnNonFungibleItem", {
            symbol: nonFungibleToken.state.symbol,
            from: multiSigWallet.address,
            itemID: mintedNFTItem.state.id,
            memo: "MEMO: Burn NFTs Item - " + mintedNFTItem.state.id,
        });

        nonFungibleTokenItem = transaction as token.NonFungibleTokenItem;
        if (!silent) console.log(indent, "\n......nonFungibleTokenItem: ", JSON.stringify(nonFungibleTokenItem));
        let overrides = {
            accountNumber: multiSigWallet.multisigAccountState.value.accountNumber,
            nonce: 2   //TxID = 2  (create-internal-tx)              
        }
        return providerConnection.getTransactionFee(undefined, undefined, { tx: transaction }).then((fee) => {
            transaction["fee"] = fee;
            return multiSigWallet.createTransaction(transaction, overrides).then((receipt) => {
                expect(receipt).to.exist;
                if (!silent) console.log(indent, "\n[Create Multisig Tx, burn-NFTs-item].receipt: ", JSON.stringify(receipt));
                if (!silent) console.log(indent, "\nhash: ", receipt.hash, " and value: ", JSON.stringify(receipt.value));
                if (!silent) console.log(indent, "\nend: ==================Create Multisig Tx, burn-NFTs-item\n");
            });
        });

    });

    //-D:4.1 transferTokenOwnership
    it("Create Multisig Tx, transfer-token-ownership", function () {

        if (!silent) console.log(indent, "\nstart: ==================Create Multisig Tx, transfer-token-ownership\n");

        // Tx - Internal Tx
        let transaction = providerConnection.getTransactionRequest("nonFungible", "transferNonFungibleTokenOwnership", {
            symbol: nonFungibleToken.state.symbol,
            from: multiSigWallet.address,
            to: multiSigWallet2.address,
            memo: "MEMO: transfer-token-ownership - " + nonFungibleToken.state.symbol,
        });

        let overrides = {
            accountNumber: multiSigWallet.multisigAccountState.value.accountNumber,
            nonce: 3   //TxID = 3  (create-internal-tx)              
        }
        return providerConnection.getTransactionFee(undefined, undefined, { tx: transaction }).then((fee) => {
            transaction["fee"] = fee;
            return multiSigWallet.createTransaction(transaction, overrides).then((receipt) => {
                expect(receipt).to.exist;
                if (!silent) console.log(indent, "\n[Create Multisig Tx, transfer-token-ownership].receipt: ", JSON.stringify(receipt));
                if (!silent) console.log(indent, "\nhash: ", receipt.hash, " and value: ", JSON.stringify(receipt.value));
                if (!silent) console.log(indent, "\nend: ==================Create Multisig Tx, transfer-token-ownership\n");
            });
        });

    });

    //-D:4.2 Verify (non-multisig)
    // refer : Approve transfer ownership
    it("verify-transfer-token-ownership", function () {
        return performNonFungibleTokenStatus(nonFungibleToken.state.symbol, token.NonFungibleToken.approveNonFungibleTokenOwnership).then((receipt) => {
        ///goh123--Error---return performNonFungibleTokenStatus(nonFungibleToken.state.symbol, token.NonFungibleToken.approveNonFungibleTokenOwnership(nonFungibleToken.state.symbol, issuer)).then((receipt) => {
                if (!silent) console.log(indent, "[verify-transfer-token-ownership].RECEIPT:", JSON.stringify(receipt));
        });
    });

    //-D:4.3 AcceptTokenOwnership
    it("Create Multisig Tx, accept-token-ownership", function () {

        if (!silent) console.log(indent, "\nstart: ==================Create Multisig Tx, accept-token-ownership\n");

        // Tx - Internal Tx
        let transaction = providerConnection.getTransactionRequest("nonFungible", "acceptNonFungibleTokenOwnership", {
            symbol: nonFungibleToken.state.symbol,
            from: multiSigWallet2.address,
            memo: "MEMO: accept-token-ownership - " + nonFungibleToken.state.symbol,

        });

        let overrides = {
            accountNumber: multiSigWallet2.multisigAccountState.value.accountNumber,
            nonce: 0   //TxID = 0  (create-internal-tx)              
        }
        return providerConnection.getTransactionFee(undefined, undefined, { tx: transaction }).then((fee) => {
            transaction["fee"] = fee;
            return multiSigWallet2.createTransaction(transaction, overrides).then((receipt) => {
                expect(receipt).to.exist;
                if (!silent) console.log(indent, "\n[Create Multisig Tx, accept-token-ownership].receipt: ", JSON.stringify(receipt));
                if (!silent) console.log(indent, "\nhash: ", receipt.hash, " and value: ", JSON.stringify(receipt.value));
                if (!silent) console.log(indent, "\nend: ==================Create Multisig Tx, accept-token-ownership\n");
            });
        });

    });

    it("Clean up", function () {
        providerConnection.removeAllListeners();
    });
});
    

function performNonFungibleTokenStatus(symbol: string, perform: any, overrides?: any) {
    return perform(symbol, provider, overrides).then((transaction) => {
        return token.NonFungibleToken.signNonFungibleTokenStatusTransaction(transaction, issuer);
    }).then((transaction) => {

        return token.NonFungibleToken.sendNonFungibleTokenStatusTransaction(transaction, middleware).then((receipt) => {
            expect(receipt.status).to.equal(1);

            if (overrides && overrides.notRefresh) {
                return receipt;
            }
            return refresh(symbol).then(() => {
                return receipt;
            });
        });
    });
}


function refresh(symbol: string) {
    return token.NonFungibleToken.fromSymbol(symbol, multiSigWallet, null).then((token) => {
        expect(token).to.exist;
        nonFungibleToken = token;
        if (!silent) console.log(indent, "\nrefresh()....................STATE:", JSON.stringify(nonFungibleToken.state));
    });
}


