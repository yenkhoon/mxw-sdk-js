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
let middleware_alias: mxw.Wallet;
let issuer_alias: mxw.Wallet;
let middleware_fungibleToken: mxw.Wallet;
let issuer_fungibleToken: mxw.Wallet;

let nonFungibleToken: token.NonFungibleToken;

let sampleSymbol: string;
let sampleItemId: string;
let mintedNFTItem: NonFungibleTokenItem;

let multiSigWalletProperties: MultiSig.MultiSigWalletProperties;
let updateMultiSigWalletProperties: MultiSig.UpdateMultiSigWalletProperties;
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
        console.log(indent, "\nwalletNonKYC:", JSON.stringify({ address: walletNonKYC.address, mnemonic: walletNonKYC.mnemonic }));

        wallet = mxw.Wallet.fromMnemonic(nodeProvider.kyc.issuer).connect(providerConnection);
        expect(wallet).to.exist;
        console.log(indent, "\nWallet:", JSON.stringify({ address: wallet.address, mnemonic: wallet.mnemonic }));

        provider = mxw.Wallet.fromMnemonic(nodeProvider.nonFungibleToken.provider).connect(providerConnection);
        expect(provider).to.exist;
        console.log(indent, "\nNFTs Provider:", JSON.stringify({ address: provider.address, mnemonic: provider.mnemonic }));

        issuer = mxw.Wallet.fromMnemonic(nodeProvider.nonFungibleToken.issuer).connect(providerConnection);
        expect(issuer).to.exist;
        console.log(indent, "\nNFTs Issuer:", JSON.stringify({ address: issuer.address, mnemonic: issuer.mnemonic }));

        middleware = mxw.Wallet.fromMnemonic(nodeProvider.nonFungibleToken.middleware).connect(providerConnection);
        expect(middleware).to.exist;
        console.log(indent, "\nNFTs middleware:", JSON.stringify({ address: middleware.address, mnemonic: middleware.mnemonic }));

        middleware_alias = mxw.Wallet.fromMnemonic(nodeProvider.alias.middleware).connect(providerConnection);
        expect(middleware_alias).to.exist;
        console.log(indent, "\nALIAS middleware:", JSON.stringify({ address: middleware_alias.address, mnemonic: middleware_alias.mnemonic }));

        issuer_alias = mxw.Wallet.fromMnemonic(nodeProvider.alias.issuer).connect(providerConnection);
        expect(issuer_alias).to.exist;
        console.log(indent, "\nALIAS issuer:", JSON.stringify({ address: issuer_alias.address, mnemonic: issuer_alias.mnemonic }));

        middleware_fungibleToken = mxw.Wallet.fromMnemonic(nodeProvider.fungibleToken.middleware).connect(providerConnection);
        expect(middleware_fungibleToken).to.exist;
        console.log(indent, "\nFTs middleware:", JSON.stringify({ address: middleware_fungibleToken.address, mnemonic: middleware_fungibleToken.mnemonic }));

        issuer_fungibleToken = mxw.Wallet.fromMnemonic(nodeProvider.fungibleToken.issuer).connect(providerConnection);
        expect(issuer_fungibleToken).to.exist;
        console.log(indent, "\nFTs issuer:", JSON.stringify({ address: issuer_fungibleToken.address, mnemonic: issuer_fungibleToken.mnemonic }));

        if (!silent) console.log(indent, "Fee collector:", JSON.stringify({ address: nodeProvider.nonFungibleToken.feeCollector }));

    });
});

//-D:1. create-token 
//-D:2. Approve (non-multisig)
//-D:3.1 mintItem
//-D:3.2 endorseItem (non-multisig)
//-D:3.3 transferItem (non-multisig)
//-D:3.4 burnItem
//-D:4.1 transferTokenOwnership
//-D:4.2 Verify (non-multisig)
//-D:4.3 AcceptTokenOwnership
//-Dx:5. Multisig Process : Multisig-transfer-ownership ---- YK yet to ready this in SDK


// Case 2. Valid Case with MULTIPLE signers
describe('Suite: MultiSig - Case 1. Valid Case with MULTIPLE signers', function () {
    this.slow(slowThreshold); // define the threshold for slow indicator

    // Create multisig-Account for Group-address 1
    it("Create", function () {
        let signers = [middleware_alias.address];
        multiSigWalletProperties = {
            threshold: 1,
            signers: signers,
        };

        return MultiSig.MultiSigWallet.create(multiSigWalletProperties, wallet, defaultOverrides).then((multiSigWalletRes) => {
            expect(multiSigWalletRes).to.exist;
            multiSigWallet = multiSigWalletRes as MultiSig.MultiSigWallet;
            console.log(indent, "\ngroupAddress: ", multiSigWallet.address);
        });
    });

    it("Query", function () {
        return MultiSig.MultiSigWallet.fromGroupAddress(multiSigWallet.address, wallet).then((res) => {
            if (!silent) console.log(indent, "\nCreated MultiSigWallet:", JSON.stringify(res.multisigAccountState));
            multiSigWallet = res
        });
    });

    // Update multisig-Account for Group-address 1
    it("Multisig account Update", function () {

        let signers = [middleware_alias.address, issuer_alias.address];
        updateMultiSigWalletProperties = {
            owner: wallet.address,
            groupAddress: multiSigWallet.address.toString(),
            threshold: 2,
            signers: signers,
        };
        return MultiSig.MultiSigWallet.update(updateMultiSigWalletProperties, wallet).then((multiSigWalletRes) => {
            expect(multiSigWalletRes).to.exist;
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
                if (!silent) console.log(indent, "\nTop-up group-address.receipt:", JSON.stringify(receipt));
            });
        });
    });

    // check group-address Bal.
    it("Group Address for Get balance", function () {
        return multiSigWallet.getBalance().then((balance) => {
            expect(balance).to.exist;
            if (!silent) console.log(indent, "\nGroup-address Balance:", formatMxw(balance), "(" + multiSigWallet.address + ")");
        });
    });

    it("Wallet-address for Get balance", function () {
        return wallet.getBalance().then((balance) => {
            expect(balance).to.exist;
            if (!silent) console.log(indent, "\nWallet-address Balance:", formatMxw(balance), "(" + wallet.address + ")");
        });
    });

    // 1st-signer
    it("Top-up issuer-account", function () {
        let value = mxw.utils.parseMxw("112");
        let overrides = {
            logSignaturePayload: defaultOverrides.logSignaturePayload,
            logSignedTransaction: defaultOverrides.logSignedTransaction,
            memo: "Hello Blockchain!"
        }
        return wallet.provider.getTransactionFee("bank", "bank-send", {
            from: wallet.address,
            to: issuer_alias.address,
            value,
            memo: overrides.memo,
            denom: smallestUnitName
        }).then((fee) => {
            overrides["fee"] = fee;
            return wallet.transfer(issuer_alias.address, value, overrides).then((receipt) => {
                expect(receipt).to.exist;
                if (!silent) console.log(indent, "\nTop-up.receipt:", JSON.stringify(receipt));
            });
        });
    });

    // 1st-signer
    it("Issuer-address for Get balance", function () {
        return issuer_alias.getBalance().then((balance) => {
            expect(balance).to.exist;
            if (!silent) console.log(indent, "\nissuer-address Balance:", formatMxw(balance), "(" + issuer_alias.address + ")");
        });
    });

    // 2nd-signer
    it("Top-up middleware-account", function () {
        let value = mxw.utils.parseMxw("119");
        let overrides = {
            logSignaturePayload: defaultOverrides.logSignaturePayload,
            logSignedTransaction: defaultOverrides.logSignedTransaction,
            memo: "Hello Blockchain!"
        }
        return wallet.provider.getTransactionFee("bank", "bank-send", {
            from: wallet.address,
            to: middleware_alias.address,
            value,
            memo: overrides.memo,
            denom: smallestUnitName
        }).then((fee) => {
            overrides["fee"] = fee;
            return wallet.transfer(middleware_alias.address, value, overrides).then((receipt) => {
                expect(receipt).to.exist;
                if (!silent) console.log(indent, "\nTop-up.receipt:", JSON.stringify(receipt));
            });
        });
    });

    // 2nd-signer
    it("Middleware-address for Get balance", function () {
        return middleware_alias.getBalance().then((balance) => {
            expect(balance).to.exist;
            if (!silent) console.log(indent, "\nmiddleware-address Balance:", formatMxw(balance), "(" + middleware_alias.address + ")");
        });
    });

    //-D:1.1 create-TX-token : issuer_alias
    it("Create Multisig Tx by signer1-issuer_alias, create-NFTs-token", function () {
        if (!silent) console.log(indent, "\nstart: ==================Create Multisig Tx by signer1-issuer_alias, create-NFTs-token\n");

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
            nonce: 0   //TxID = 0  (create-internal-tx)              
        }

        let signer1 = new MultiSig.MultiSigWallet(multiSigWallet.address, issuer_alias)
        signer1.refresh();

        return providerConnection.getTransactionFee(undefined, undefined, { tx: transaction }).then((fee) => {
            transaction["fee"] = fee;
            return signer1.createTransaction(transaction, overrides).then((receipt) => {
                expect(receipt).to.exist;
                if (!silent) console.log(indent, "\nCreate-MultiSig-Tx.receipt: ", JSON.stringify(receipt));
                if (!silent) console.log(indent, "\nhash: ", receipt.hash, " and value: ", JSON.stringify(receipt.value));
                if (!silent) console.log(indent, "\nend: ==================Create Multisig Tx by signer1-issuer_alias, create-NFTs-token\n");
            });
        });

    });

    //-D:1.2 create-TX-token : middleware_alias
    it("Sign Multisig Tx by signer2-middleware_alias, create-NFTs-token", function () {
        if (!silent) console.log(indent, "\nstart: ==================Sign Multisig Tx by signer2-middleware_alias, create-NFTs-token\n");
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
            nonce: 0   //TxID = 0  (create-internal-tx)              
        }

        let signer2 = new MultiSig.MultiSigWallet(multiSigWallet.address, middleware_alias)
        signer2.refresh();

        return providerConnection.getTransactionFee(undefined, undefined, { tx: transaction }).then((fee) => {
            transaction["fee"] = fee;
            return signer2.confirmTransaction(0, overrides).then((receipt) => {
                expect(receipt).to.exist;
                if (!silent) console.log(indent, "\nCreate-MultiSig-Tx.receipt: ", JSON.stringify(receipt));
                if (!silent) console.log(indent, "\nhash: ", receipt.hash, " and value: ", JSON.stringify(receipt.value));
                if (!silent) console.log(indent, "\nend: ==================Sign Multisig Tx by signer2-middleware_alias, create-NFTs-token\n");
            });
        });

    });
    

    //-D:
    it("Query", function () {
        if (!silent) console.log(indent, "\nQuery......nonFungibleToken: ", JSON.stringify(nonFungibleToken));
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

    //-D:3.1.1 mintItem : Item-owner == issuer
    //1. create-TX-[mint-NFTs-item] : middleware_alias
    it("Create Multisig Tx by signer1-middleware_alias, mint-NFTs-item", function () {
        if (!silent) console.log(indent, "\nstart: ==================Create Multisig Tx by signer1-middleware_alias, mint-NFTs-item\n");

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

        nonFungibleToken = transaction as token.NonFungibleToken;
        if (!silent) console.log(indent, "\n......nonFungibleToken: ", JSON.stringify(nonFungibleToken));
        let overrides = {
            accountNumber: multiSigWallet.multisigAccountState.value.accountNumber,
            nonce: 1   //TxID = 1  (create-internal-tx)              
        }
        let signer1 = new MultiSig.MultiSigWallet(multiSigWallet.address, middleware_alias)
        signer1.refresh();

        return providerConnection.getTransactionFee(undefined, undefined, { tx: transaction }).then((fee) => {
            transaction["fee"] = fee;
            return signer1.createTransaction(transaction, overrides).then((receipt) => {
                expect(receipt).to.exist;
                if (!silent) console.log(indent, "\nCreate-MultiSig-Tx.receipt: ", JSON.stringify(receipt));
                if (!silent) console.log(indent, "\nhash: ", receipt.hash, " and value: ", JSON.stringify(receipt.value));
                if (!silent) console.log(indent, "\nend: ==================Create Multisig Tx by signer1-middleware_alias, mint-NFTs-item\n");
            });
        });
    });
    
    //-D:3.1.2 sign-TX : mintItem : Item-owner == issuer 
    //2. sign-TX-[mint-NFTs-item] : issuer_alias
    it("Sign Multisig Tx by signer2-issuer_alias, mint-NFTs-item", function () {
        if (!silent) console.log(indent, "\nstart: ==================Sign Multisig Tx by signer2-issuer_alias, mint-NFTs-item\n");
 
        let overrides = {
            accountNumber: multiSigWallet.multisigAccountState.value.accountNumber,
            nonce: 1           
        }

        let signer2 = new MultiSig.MultiSigWallet(multiSigWallet.address, issuer_alias)
        signer2.refresh();
        return signer2.confirmTransaction(1, overrides).then((respond) => {
            expect(respond).to.exist;
            if (!silent) console.log(indent, "Sign-MultiSig-Tx.receipt: ", JSON.stringify(respond));
            if (!silent) console.log(indent, "\nend: ==================Sign Multisig Tx by signer2-issuer_alias, mint-NFTs-item\n");
        }).catch(error => {
            if (!silent) console.log(indent, "error.code: ", error.code);
            if (!silent) console.log(indent, "Sign-MultiSig-Tx.Error: ", JSON.stringify(error));
            if (!silent) console.log(indent, "\nend: ==================Sign Multisig Tx by signer2-issuer_alias, mint-NFTs-item\n");
        });
 
    });

    //-D:
    it("Query-2nd", function () {
        if (!silent) console.log(indent, "\nQuery-2nd......nonFungibleToken: ", JSON.stringify(nonFungibleToken));
        return refresh(sampleSymbol).then(() => {
            expect(nonFungibleToken).to.exist;
            if (!silent) console.log(indent, "\nQuery-2nd Created Token:", JSON.stringify(nonFungibleToken.state.symbol));
        });
    });

     //-D:
     //let mintedNFTItem: NonFungibleTokenItem;
     it("Get Token properties & Item properties of this Item", function () {
        if (!silent) console.log(indent, "\n[Get Token properties & Item properties]......Token:", JSON.stringify(nonFungibleToken.state.symbol));

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

    //-D:3.4.1 burnItem
    //1. create-TX-[burnItem-NFTs-item] : middleware_alias
    it("Create Multisig Tx by signer2-middleware_alias, burn-NFTs-item", function () {

        if (!silent) console.log(indent, "\nstart: ==================Create Multisig Tx by signer2-middleware_alias, burn-NFTs-item\n");

        // Tx - Internal Tx
        let transaction = providerConnection.getTransactionRequest("nonFungible", "burnNonFungibleItem", {
            symbol: nonFungibleToken.state.symbol,
            from: multiSigWallet.address,
            itemID: mintedNFTItem.state.id,
            memo: "MEMO: Burn NFTs Item - " + mintedNFTItem.state.id,
        });

        nonFungibleToken = transaction as token.NonFungibleToken;
        if (!silent) console.log(indent, "\n......nonFungibleToken: ", JSON.stringify(nonFungibleToken));
        let overrides = {
            accountNumber: multiSigWallet.multisigAccountState.value.accountNumber,
            nonce: 2   //TxID = 2  (create-internal-tx)              
        }

        let signer1 = new MultiSig.MultiSigWallet(multiSigWallet.address, middleware_alias)
        signer1.refresh();

        return providerConnection.getTransactionFee(undefined, undefined, { tx: transaction }).then((fee) => {
            transaction["fee"] = fee;
            return signer1.createTransaction(transaction, overrides).then((receipt) => {
                expect(receipt).to.exist;
                if (!silent) console.log(indent, "\n[Create Multisig Tx, burn-NFTs-item].receipt: ", JSON.stringify(receipt));
                if (!silent) console.log(indent, "\nhash: ", receipt.hash, " and value: ", JSON.stringify(receipt.value));
                if (!silent) console.log(indent, "\nend: ==================Create Multisig Tx by signer2-middleware_alias, burn-NFTs-item\n");
            });
        });

    });

    //-D:3.4.2 burnItem
    //2. sign-TX-[burnItem-NFTs-item] : issuer_alias
    it("Sign Multisig Tx by signer2-issuer_alias, burn-NFTs-item", function () {
        if (!silent) console.log(indent, "\nstart: ==================Sign Multisig Tx by signer2-issuer_alias, burn-NFTs-item\n");
 
        let overrides = {
            accountNumber: multiSigWallet.multisigAccountState.value.accountNumber,
            nonce: 2           
        }

        let signer2 = new MultiSig.MultiSigWallet(multiSigWallet.address, issuer_alias)
        signer2.refresh();
        return signer2.confirmTransaction(2, overrides).then((respond) => {
            expect(respond).to.exist;
            if (!silent) console.log(indent, "Sign-MultiSig-Tx.receipt: ", JSON.stringify(respond));
            if (!silent) console.log(indent, "\nend: ==================Sign Multisig Tx by signer2-issuer_alias, burn-NFTs-item\n");
        }).catch(error => {
            if (!silent) console.log(indent, "error.code: ", error.code);
            if (!silent) console.log(indent, "Sign-MultiSig-Tx.Error: ", JSON.stringify(error));
            if (!silent) console.log(indent, "\nend: ==================Sign Multisig Tx by signer2-issuer_alias, burn-NFTs-item\n");
        });
 
    });

    //Create multisig Group-address 2 :
    it("Top-up issuer_fungibleToken", function () {
        let value = mxw.utils.parseMxw("131");
        let overrides = {
            logSignaturePayload: defaultOverrides.logSignaturePayload,
            logSignedTransaction: defaultOverrides.logSignedTransaction,
            memo: "Hello Blockchain!"
        }
        return wallet.provider.getTransactionFee("bank", "bank-send", {
            from: wallet.address,
            to: issuer_fungibleToken.address,
            value,
            memo: overrides.memo,
            denom: smallestUnitName
        }).then((fee) => {
            overrides["fee"] = fee;
            return wallet.transfer(issuer_fungibleToken.address, value, overrides).then((receipt) => {
                expect(receipt).to.exist;
                if (!silent) console.log(indent, "\nTop-up.receipt:", JSON.stringify(receipt));
            });
        });
    });

    //Create multisig Group-address 2 :
    it("issuer_fungibleToken for Get balance", function () {
        return issuer_fungibleToken.getBalance().then((balance) => {
            expect(balance).to.exist;
            if (!silent) console.log(indent, "\nissuer_fungibleToken Balance:", formatMxw(balance), "(" + issuer_fungibleToken.address + ")");
        });
    });

    //Create multisig Group-address 2 :
    it("Top-up middleware_fungibleToken", function () {
        let value = mxw.utils.parseMxw("132");
        let overrides = {
            logSignaturePayload: defaultOverrides.logSignaturePayload,
            logSignedTransaction: defaultOverrides.logSignedTransaction,
            memo: "Hello Blockchain!"
        }
        return wallet.provider.getTransactionFee("bank", "bank-send", {
            from: wallet.address,
            to: middleware_fungibleToken.address,
            value,
            memo: overrides.memo,
            denom: smallestUnitName
        }).then((fee) => {
            overrides["fee"] = fee;
            return wallet.transfer(middleware_fungibleToken.address, value, overrides).then((receipt) => {
                expect(receipt).to.exist;
                if (!silent) console.log(indent, "\nTop-up.receipt:", JSON.stringify(receipt));
            });
        });
    });

    //Create multisig Group-address 2 :
    it("middleware_fungibleToken for Get balance", function () {
        return middleware_fungibleToken.getBalance().then((balance) => {
            expect(balance).to.exist;
            if (!silent) console.log(indent, "\nmiddleware_fungibleToken Balance:", formatMxw(balance), "(" + middleware_fungibleToken.address + ")");
        });
    });

    //Create multisig Group-address 2 :
    it("Create", function () {
        let signers = [middleware_fungibleToken.address];
        multiSigWalletProperties = {
            threshold: 1,
            signers: signers,
        };

        return MultiSig.MultiSigWallet.create(multiSigWalletProperties, issuer_fungibleToken, defaultOverrides).then((multiSigWalletRes) => {
            expect(multiSigWalletRes).to.exist;
            multiSigWallet2 = multiSigWalletRes as MultiSig.MultiSigWallet;
            if (!silent) console.log(indent, "groupAddress-2: ", multiSigWallet2.address);
        });
    });

    //Create multisig Group-address 2 :
    it("Query", function () {
        return MultiSig.MultiSigWallet.fromGroupAddress(multiSigWallet2.address, middleware).then((res) => {
            console.log(indent, "Created MultiSigWallet-2:", JSON.stringify(res.multisigAccountState));
            multiSigWallet2 = res
        });
    });

    //Create multisig Group-address 2 :
    // Tx - Top-up Group-address 2:
    it("Top-up group account-2", function () {
        let value = mxw.utils.parseMxw("65555");
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
    
    //-D:
    it("Query-3rd", function () {
        if (!silent) console.log(indent, "\nQuery-3rd......nonFungibleToken: ", JSON.stringify(nonFungibleToken));
        return refresh(sampleSymbol).then(() => {
            expect(nonFungibleToken).to.exist;
            if (!silent) console.log(indent, "\nQuery-3rd Created Token:", JSON.stringify(nonFungibleToken.state.symbol));
        });
    });

    //-D:4.1.1 transferTokenOwnership
    //1. create-TX-[transfer-token-ownership] : middleware_alias
    it("Create Multisig Tx by signer1-middleware_alias, transfer-token-ownership", function () {
        if (!silent) console.log(indent, "\nstart: ==================Create Multisig Tx by signer1-middleware_alias, transfer-token-ownership\n");

        if (!silent) console.log(indent, "\n......Token:", JSON.stringify(nonFungibleToken.state.symbol));

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

        let signer1 = new MultiSig.MultiSigWallet(multiSigWallet.address, middleware_alias)
        signer1.refresh();

        return providerConnection.getTransactionFee(undefined, undefined, { tx: transaction }).then((fee) => {
            transaction["fee"] = fee;
            return signer1.createTransaction(transaction, overrides).then((receipt) => {
                expect(receipt).to.exist;
                if (!silent) console.log(indent, "\n[Create Multisig Tx, transfer-token-ownership].receipt: ", JSON.stringify(receipt));
                if (!silent) console.log(indent, "\nhash: ", receipt.hash, " and value: ", JSON.stringify(receipt.value));
                if (!silent) console.log(indent, "\nend: ==================Create Multisig Tx by signer1-middleware_alias, transfer-token-ownership\n");
            });
        });

    });
    
    //-D:4.1.2 transferTokenOwnership
    //2. sign-TX-[transfer-token-ownership] : issuer_alias
    it("Sign Multisig Tx by signer2-issuer_alias, transfer-token-ownership", function () {
        if (!silent) console.log(indent, "\nstart: ==================Sign Multisig Tx by signer2-issuer_alias, transfer-token-ownership\n");
 
        let overrides = {
            accountNumber: multiSigWallet.multisigAccountState.value.accountNumber,
            nonce: 3           
        }

        let signer2 = new MultiSig.MultiSigWallet(multiSigWallet.address, issuer_alias)
        signer2.refresh();
        return signer2.confirmTransaction(3, overrides).then((respond) => {
            expect(respond).to.exist;
            if (!silent) console.log(indent, "Sign-MultiSig-Tx.receipt: ", JSON.stringify(respond));
            if (!silent) console.log(indent, "\nend: ==================Sign Multisig Tx by signer2-issuer_alias, transfer-token-ownership\n");
        }).catch(error => {
            if (!silent) console.log(indent, "error.code: ", error.code);
            if (!silent) console.log(indent, "Sign-MultiSig-Tx.Error: ", JSON.stringify(error));
            if (!silent) console.log(indent, "\nend: ==================Sign Multisig Tx by signer2-issuer_alias, transfer-token-ownership\n");
        });
 
    });

    //-D:
    it("Query-4th", function () {
        if (!silent) console.log(indent, "\nQuery-4th......start\n");
        return refresh(sampleSymbol).then(() => {
            expect(nonFungibleToken).to.exist;
            if (!silent) console.log(indent, "\nQuery-4th Created Token:", JSON.stringify(nonFungibleToken.state.symbol));
        });
    });

    //-D:4.2 Verify (non-multisig)
    // refer : Approve transfer ownership
    it("verify-transfer-token-ownership", function () {

        if (!silent) console.log(indent, "\n[verify-transfer-token-ownership]......Token:", JSON.stringify(nonFungibleToken.state.symbol));
        return performNonFungibleTokenStatus(nonFungibleToken.state.symbol, token.NonFungibleToken.approveNonFungibleTokenOwnership).then((receipt) => {
                if (!silent) console.log(indent, "[verify-transfer-token-ownership].RECEIPT:", JSON.stringify(receipt));
        });
    });

    //-D:4.3 AcceptTokenOwnership
    it("Create Multisig Tx by signer1-middleware_fungibleToken, accept-token-ownership", function () {
        if (!silent) console.log(indent, "\nstart: ==================Create Multisig Tx by signer1-middleware_fungibleToken, accept-token-ownership\n");

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

        let signer1 = new MultiSig.MultiSigWallet(multiSigWallet2.address, middleware_fungibleToken)
        signer1.refresh();
        return providerConnection.getTransactionFee(undefined, undefined, { tx: transaction }).then((fee) => {
            transaction["fee"] = fee;
            return signer1.createTransaction(transaction, overrides).then((receipt) => {
                expect(receipt).to.exist;
                if (!silent) console.log(indent, "\n[Create Multisig Tx, accept-token-ownership].receipt: ", JSON.stringify(receipt));
                if (!silent) console.log(indent, "\nhash: ", receipt.hash, " and value: ", JSON.stringify(receipt.value));
                if (!silent) console.log(indent, "\nend: ==================Create Multisig Tx by signer1-middleware_fungibleToken, accept-token-ownership\n");
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


