'use strict';

import * as constants from './constants';
import * as errors from './errors';

import { Signer } from './abstract-signer';
import { Wallet } from './wallet';


import * as auth from './kyc';
import { Kyc, KycKeyComponent, KycData, KycTransaction, KycRevoke, KycRevokeTransaction, KycSignature } from './kyc';
import * as token from './token';
import * as nonFungibleToken from './non-fungible-token';
import * as nonFungibleTokenItem from './non-fungible-token-item';
import * as nameService from './name-service';

import * as utils from './utils';
import * as providers from './providers';
import * as wordlists from './wordlists';
import * as MultiSig from './multisig';

////////////////////////
// Compile-Time Constants

// This is generated by "npm run dist"
import { version } from './_version';

////////////////////////
// Helper Functions

function getDefaultProvider(network?: utils.Network | string): providers.BaseProvider {
    if (network == null) { network = 'homestead'; }
    let n = utils.getNetwork(network);
    if (!n || !n._defaultProvider) {
        errors.throwError('unsupported getDefaultProvider network', errors.UNSUPPORTED_OPERATION, {
            operation: 'getDefaultProvider',
            network: network
        });
    }
    return n._defaultProvider(providers);
}

export {
    Signer,
    Wallet,
    MultiSig,
    
    Kyc,
    KycKeyComponent,
    KycData,
    KycTransaction,
    KycRevoke,
    KycRevokeTransaction,
    KycSignature,

    auth,
    token,
    nonFungibleToken,
    nonFungibleTokenItem,
    nameService,
    
    wordlists,
    
    getDefaultProvider,
    providers,

    constants,
    errors,

    utils,

    ////////////////////////
    // Compile-Time Constants

    version,

};