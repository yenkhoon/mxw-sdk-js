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
    multisig: {
        multisig_acc1: string,
        multisig_acc2: string,
        multisig_acc3: string,
        multisig_acc4: string,
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
    },
    multisig: {
        multisig_acc1: "since height latin shiver gallery cage sure face twelve already leisure shop super garden maid else summer search half robot bicycle game life disease",
        multisig_acc2: "youth grief wagon trim fix next hammer differ minimum grit stuff actress swap episode outdoor trophy seat hero floor word wink comfort outer nasty",
        multisig_acc3: "shove when pass black expose blouse dial glue original wonder move glad rice guide trophy dish beach legal animal kitchen maze concert ahead keep",
        multisig_acc4: "invite wrong moment tribe disease sock reflect fold vacuum say forward dutch lottery hotel boss parade salad announce dismiss scrap december dog when seven",
    },
};

const nodes: { [name: string]: Node } = { localnet };
const nodeProvider: Node = localnet;


export {
    nodeProvider, nodes, localnet,
    Node
};
