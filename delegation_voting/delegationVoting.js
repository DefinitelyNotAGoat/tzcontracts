var fi = require("fi-compiler");
var eztz = require("/home/brice/eztz/").eztz
var yaml = require('js-yaml');
var fs = require('fs');
var stdio = require('stdio');
var argv = require('minimist')(process.argv.slice(2));

var conf;
try {
  const config = yaml.safeLoad(fs.readFileSync('conf.yaml', 'utf8'));
  conf = JSON.stringify(config, null, 4);
} catch (e) {
  console.log(e);
}
conf = JSON.parse(conf);

var ficode = `   
struct Proposal (
  string description,
  int votes
);

storage map[address=>bool] voter;
storage map[int=>Proposal] ballot;
storage address manager;
storage string info;


entry addAuthorizedVoter(address addr){
 if (SENDER == storage.manager) {
     storage.voter.push(input.addr, bool false);
 } else {
     throw(string "Not authorized to add a voter.");
 }
}

entry addProposal(int id, Proposal proposal){
 if (SENDER == storage.manager) {
     storage.ballot.push(input.id, input.proposal);
 } else {
      throw(string "Not authorized to add a ballet.");
 }
}

entry addInfo(string desc){
  if (SENDER == storage.manager) {
      storage.info = input.desc;
  } else {
      throw(string "Not authorized to set description.");
  }
}

entry placeVote(int vote){

if (in(storage.voter, SENDER) == bool false) {
     throw(string "You are not authorized to vote.");
 } 
 
 if (in(storage.ballot, input.vote) == bool false) {
     throw(string "No proposal exists for your vote.");
 }

 
 let bool myVote = storage.voter.get(SENDER);
 let Proposal proposal = storage.ballot.get(input.vote);
 
 if (myVote == bool false) {
      myVote = bool true;
      
      proposal.votes.add(int 1);
      storage.ballot.push(input.vote, proposal);
      storage.voter.push(SENDER, myVote);
 } else {
     throw(string "You have already voted. Voters may only vote once.");
 }
}
`;

var compiled = fi.compile(ficode);
fi.abi.load(compiled.abi);


var wallet = eztz.crypto.extractKeys(conf.wallet.sk)

// if (argv.password) {
//  (conf.wallet.sk, argv.password).then(function (res) {
//     wallet = res;
//   }).catch(function (e) {
//     console.log(e)
//   });
// } else {
//   stdio.question('What is the password for your wallet?', function (err, passwd) {
//     eztz.crypto.extractEncryptedKeys(conf.wallet.sk, passwd).then(function (res) {
//       wallet = res;
//     }).catch(function (e) {
//       console.log(e)
//     });
//   });
// }

var gas_limit; 
var fee;
if (argv.gaslimit) {
  gas_limit = argv.gaslimit;
} else {
  console.log("Please specify a gas_limit, denoted --gaslimit=<mutez>");
  process.exit()
}

if (argv.fee) {
  fee = argv.fee;
} else {
  console.log("Please specify a network fee, denoted --fee=<mutez>");
  process.exit();
}

if (argv.alphanet) {
  eztz.node.setProvider("https://alphanet-node.tzscan.io/")
} else if (argv.network) {
  eztz.node.setProvider(argv.network)
} else {
  eztz.node.setProvider("https://mainnet-node.tzscan.io/")
}

if (argv.addvoters) {
  console.log("adding voters")
  addAuthorizedVoters(argv.addvoters, wallet)
}

if (argv.addvoter) {
  console.log("adding voter")
  input = {
    addr: argv.addvoter
  }
  console.log(input)
  addAuthorizedVoter(input, wallet)
}
if (argv.addinfo) {
  console.log("adding info")
  input = {
    desc: argv.addinfo
  }
  addInfo(input, wallet)
}
if (argv.addproposal) {
  console.log("adding proposal")
  if (argv.proposalid) {
    input = {
      id: argv.proposalid,
      proposal: argv.addproposal
    }
    addProposal(argv.addproposal, wallet)
  } else {
    console.log("Must also specify a proposalid (int).")
  }
}

if (argv.placevote) {
  input = {
    vote: argv.placevote
  }
  placeVote(input, wallet)
}



function placeVote(input, keys) {
  vbytes = fi.abi.entry("placeVote", input)
  vbytes = vbytes.substr(2);
  var operation = {
    "kind": "transaction",
    "amount": "0",
    "destination": conf.contract,
    "fee": fee,
    "gas_limit": gas_limit,
    "parameters": {
      "bytes": vbytes
    }
  };

  eztz.rpc.sendOperation(keys.pkh, operation, keys).then(function (res) {
    console.log(res);
  }).catch(function (e) {
    console.log(e)
  });
}

function addInfo(input, keys) {
  ibytes = fi.abi.entry("addInfo", input)
  ibytes = ibytes.substr(2);
  var operation = {
    "kind": "transaction",
    "amount": "0",
    "destination": conf.contract,
    "fee": fee,
    "gas_limit": gas_limit,
    "parameters": {
      "bytes": ibytes
    }
  };

  eztz.rpc.sendOperation(keys.pkh, operation, keys).then(function (res) {
    console.log(res);
  }).catch(function (e) {
    console.log(e)
  });
}

function addProposal(input, keys) {
  pbytes = fi.abi.entry("addProposal", input)
  pbytes = pbytes.substr(2);
  var operation = {
    "kind": "transaction",
    "amount": "0",
    "destination": conf.contract,
    "fee": fee,
    "gas_limit": gas_limit,
    "parameters": {
      "bytes": pbytes
    }
  };

  eztz.rpc.sendOperation(keys.pkh, operation, keys).then(function (res) {
    console.log(res);
  }).catch(function (e) {
    console.log(e)
  });
}

function addAuthorizedVoter(input, keys) {
  vbytes = fi.abi.entry("addAuthorizedVoter", input)
  console.log(vbytes)
  vbytes = vbytes.substr(2);
  var operation = {
    "kind": "transaction",
    "amount": "0", // This is in mutez, i.e. 1000000 = 1.00 tez
    "destination": conf.contract,
    "fee": fee,
    "gas_limit": gas_limit,
    "parameters": {
      "bytes": vbytes
    }
  };

  eztz.rpc.sendOperation(keys.pkh, operation, keys).then(function (res) {
    console.log(res);
  }).catch(function (e) {
    console.log(e)
  });
}

function addAuthorizedVoters(addr, keys) {
  var query = "/chains/main/blocks/head/context/delegates/" + addr + "/delegated_contracts";
  eztz.node.query(query).then(function (res) { //tz1YCABRTa6H8PLKx2EtDWeCGPaKxUhNgv47
    res.forEach(function (contract) {
      var input = {
        addr: contract
      };
     // console.log(input)
      addAuthorizedVoter(input, keys)
    });
  }).catch(function (e) {
    console.log(e)
  });
}