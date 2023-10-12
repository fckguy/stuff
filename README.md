Smallet Repository

Solana Account Abstraction / Timelock Wallet Implementation

---------------------FEATURES---------------------

- Multisig for the Account
- Build up “sessions” for stay up login in a specific period
- Anti-Replay Functionality
- Account freezing
- Sponsored tx paying fee
- Account recovery

------------------------TODO---------------------

- Provide batch operation - sign all feature for contracts
- Rate-limiting
- Sponsor Limitation / Throttling
- Shared Wallets / Team Wallets
- Modularize the smallet
- Auto-create wallets for users via factory (set up recurring payments and subscriptions)
- Token Swapping Functionality
- Finalize which Oracle to implement
- Multi-factor authentication / Third Party Auth
- Select three oracle sources and average the three to provide fee estimation
- Auto-pay transactions / subscriptions
- Automated Yield Farming
- Dynamic Fee Calculation
- Soulbound Token Gating / Decentralized Governance
- Smart Notifications

-------------------Prerequisiites------------------

```script
- $ solana --version
solana-cli 1.14.17 (src:b29a37cf; feat:3488713414)
```

<br/>

```script
- $ anchor --version
anchor-cli 0.27.0
```

use avm to install and use desired version: <br/>

`cargo install --git https://github.com/project-serum/anchor avm --locked --force` see [here](https://book.anchor-lang.com/getting_started/installation.html?highlight=avm#installing-using-anchor-version-manager-avm-recommended)

You might need to run this first <br/>
`sudo apt install pkg-config libssl-dev`
<br/><br/>

```script
- $ node --version
v18.13.0
```

<br/>

```script
- $ yarn --version
1.22.19
```

use `npm install --global yarn@1.22.19`
<br/><br/>

```script
- $ cargo --version
cargo 1.70.0 (ec8a8a0ca 2023-04-25)
```

`rustup install 1.70.0` and then if needed `rustup override set 1.70.0`
<br/><br/>

-----------------------BUILD----------------------

To build follow these instructions:

First run:

```
yarn install
```

Then run:

```
cargo check && cargo build
```

Next run:

```
./scripts/parse-idls.sh && ./scripts/generate-idl-types.sh
```

Then run:

```
rm -fr dist/ && node_modules/.bin/tsc -P tsconfig.build.json && node_modules/.bin/tsc -P tsconfig.esm.json
```

-----------------------TEST-------------------------

To run tests, run this command in your terminal:

```
anchor test --skip-build tests/**/*.spec.ts
```

or using mocha, run:

```
yarn mocha -b
```
