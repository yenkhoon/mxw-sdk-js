'use strict';

interface Node {

    connection: {
        url: string,
        timeout: number
    },
    trace: {
        silent: boolean,
        silentRpc: boolean
    },
    chainId: string,
    name: string,
    airDrop: string,
    kyc: {
        provider: string,
        issuer: string,
        middleware: string
    },
    alias: {
        provider: string,
        issuer: string,
        middleware: string,
        feeCollector: string
    },

    fungibleToken: {
        provider: string,
        issuer: string,
        middleware: string,
        feeCollector: string,
    },

    nonFungibleToken: {
        provider: string,
        issuer: string,
        middleware: string,
        feeCollector: string,

    },
};



const localnet: Node = {

    connection: {
        url: "http://localhost:26657",
        timeout: 60000
    },

    trace: {
        silent: true,
        silentRpc: true
    },

    chainId: "maxonrow-chain",
    name: "mxw",
    airDrop: "gold damp garlic turn host harbor else bird wrestle quarter surround parrot fan naive burst effort impact hen aware step gym ribbon inform cost",
    kyc: {
        provider: "foot increase such wave plunge athlete gentle figure hub reunion transfer marriage rude license champion monkey fan balcony position birth onion circle hint cool",
        issuer: "brisk barrel dose panther slice album family math cup cute awesome mechanic pattern rack erupt enforce alcohol wolf boil autumn family avoid brother legal",
        middleware: "belt world purchase stick spare one music suggest dentist kit globe save snack sauce liquid face undo select ethics choose august rhythm cycle crucial"
    },
    alias: {
        provider: "frost anchor admit engage minute pony half half rival fiction radio oven pizza siren state virtual fiscal urge clap dentist captain pink viable strike",
        issuer: "have silly fat resemble radar viable evolve start side path later point wreck annual mesh shoulder attitude own label robot test gossip anxiety year",
        middleware: "snap youth depart side mail panel category human popular theme cotton receive club sell rebel matrix box opinion host sand oak century chair silk",
        feeCollector: "mxw123xwuat5h9x92w6vdtn4fl2l03t7d793qugxvc"
    },
    fungibleToken: {
        provider: "naive hire arctic injury camp twelve actor valid process voice return unusual glad hen ginger brisk clever solve toss expire type road blood green",
        issuer: "wreck fiber slice novel nurse guess plate oven cotton life thought tape addict thank frown ready rival walk dish short solution work arena nurse",
        middleware: "police toilet cupboard song blanket duty wrestle public bike cattle install page option spell scout crop pig answer access alarm gain fish absent pen",
        feeCollector: "mxw173qf9y2ae0cx8y07ez6qsl9k2gs2l5955hfc7x"
    },
    nonFungibleToken: {
        provider: "language indoor mushroom gold motor genuine tower ripple baby journey where offer crumble chuckle velvet dizzy trigger owner mother screen panic question cliff dish",
        issuer: "appear scale write grow tiger puppy trick kite exhibit distance target cliff coin silly because train matrix weather list chat stamp warfare hobby ocean",
        middleware: "guard loop tell accuse village list prevent sea dolphin weapon own track spike venue gun blind carry hawk weapon track rain amazing author eagle",
        feeCollector: "mxw1md4u2zxz2ne5vsf9t4uun7q2k0nc3ly5g22dne",
       
    }

};



const uatnet: Node = {
    connection: {
        url: "https://uatnet.usdp.io",
        timeout: 60000
    },

    trace: {
        silent: true,
        silentRpc: true
    },

    chainId: "uatnet",
    name: "mxw",
    airDrop: "roof voyage expire ball image despair soldier token destroy rocket couch drink",
    kyc: {
        provider: "into demand chief rubber raw hospital unit tennis sentence fade flight cluster",
        issuer: "pill maple dutch predict bulk goddess nice left paper heart loan fresh",
        middleware: "avocado trade bright wolf marble penalty mimic curve funny name certain visa"
    },
    alias: {
        provider: "",
        issuer: "",
        middleware: "",
        feeCollector: ""
    },

    fungibleToken: {
        provider: "mother paddle fire dolphin nuclear giggle fatal crop cupboard close abandon truck",
        issuer: "dynamic car culture shell kiwi harsh tilt boost vote reopen arrow moon",
        middleware: "hospital item sad baby mass turn ability exhibit obtain include trip please",
        feeCollector: "mxw1qgwzdxf66tp5mjpkpfe593nvsst7qzfxzqq73d"
    },

    nonFungibleToken: {
        provider: "mother paddle fire dolphin nuclear giggle fatal crop cupboard close abandon truck",
        issuer: "dynamic car culture shell kiwi harsh tilt boost vote reopen arrow moon",
        middleware: "hospital item sad baby mass turn ability exhibit obtain include trip please",
        feeCollector: "mxw1qgwzdxf66tp5mjpkpfe593nvsst7qzfxzqq73d"

    }

};


const testnet: Node = {
    connection: {
        url: "https://alloys-rpc.maxonrow.com",
        timeout: 60000
    },

    trace: {
        silent: true,
        silentRpc: true
    },

    chainId: "alloys",
    name: "mxw",
    airDrop: "roof voyage expire ball image despair soldier token destroy rocket couch drink",
    kyc: {
        provider: "into demand chief rubber raw hospital unit tennis sentence fade flight cluster",
        issuer: "pill maple dutch predict bulk goddess nice left paper heart loan fresh",
        middleware: "avocado trade bright wolf marble penalty mimic curve funny name certain visa"
    },
    alias: {
        provider: "",
        issuer: "",
        middleware: "",
        feeCollector: ""
    },

    fungibleToken: {
        provider: "mother paddle fire dolphin nuclear giggle fatal crop cupboard close abandon truck",
        issuer: "dynamic car culture shell kiwi harsh tilt boost vote reopen arrow moon",
        middleware: "hospital item sad baby mass turn ability exhibit obtain include trip please",
        feeCollector: "mxw1qgwzdxf66tp5mjpkpfe593nvsst7qzfxzqq73d"
    },

    nonFungibleToken: {
        provider: "mother paddle fire dolphin nuclear giggle fatal crop cupboard close abandon truck",
        issuer: "dynamic car culture shell kiwi harsh tilt boost vote reopen arrow moon",
        middleware: "hospital item sad baby mass turn ability exhibit obtain include trip please",
        feeCollector: "mxw1qgwzdxf66tp5mjpkpfe593nvsst7qzfxzqq73d"

    }

};



const nodes: { [name: string]: Node } = { localnet, uatnet, testnet };
 const nodeProvider: Node = localnet;
// const nodeProvider: Node = devnet;
 // const nodeProvider: Node = uatnet;
 //const nodeProvider: Node = testnet;

export {
    nodeProvider, nodes, localnet, uatnet, testnet,
    Node
};


