const anchor = require('@project-serum/anchor');
const { SystemProgram, Keypair, Connection, PublicKey } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const idl = require('./idl.json');

// Load the wallet from JSON file
const walletPath = "/home/mubariz/Documents/SolanaDev/PayFees.json";
const wallet = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync(walletPath, 'utf8'))));

// Set up the connection and provider
const endpoint = "http://localhost:8899";//Update to correct network endpoint
const walletProvider = new anchor.Wallet(wallet);
const provider = new anchor.AnchorProvider(new Connection(endpoint, 'confirmed'), walletProvider, {
    preflightCommitment: 'confirmed',
});
anchor.setProvider(provider);

// Load the IDL and program ID
const programId = new PublicKey("J4keZe4ew164YgrqkRNZzb7AJRLZpkFPpoCGu1ZiTEht");
const program = new anchor.Program(JSON.parse(JSON.stringify(idl)), programId, provider);

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const initializeGame = async (player_x, player_o) => {
    const gameKeypair = Keypair.generate();

    await program.rpc.initialize(player_x, player_o, {
        accounts: {
            game: gameKeypair.publicKey,
            user: provider.wallet.publicKey,
            systemProgram: SystemProgram.programId,
        },
        signers: [gameKeypair],
    });

    console.log(`Game initialized with public key: ${gameKeypair.publicKey.toString()}`);
    return gameKeypair;
};

const playMove = async (gamePublicKey, player, row, col) => {
    await program.methods.play(row, col)
        .accounts({
            game: gamePublicKey,
            player: player.publicKey,
        })
        .signers([player])
        .rpc();

    console.log(`Player ${player.publicKey} played move at (${row}, ${col})`);
};

const getGameState = async (gamePublicKey) => {
    const gameAccount = await program.account.game.fetch(gamePublicKey);
    return gameAccount;
};


const prompt = (query) => new Promise(resolve => rl.question(query, resolve));

const main = async () => {
    const action = await prompt('Do you want to start a new game or join an existing one? (new/join): ');

    let gamePublicKey, currentPlayer;

    if (action === 'new') {
        const playerOPath = "/home/mubariz/p2.json";
        playerO = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync(playerOPath, 'utf8'))));

        gameKeypair = await initializeGame(provider.wallet.publicKey, playerO.publicKey);
        gamePublicKey = gameKeypair.publicKey;
        currentPlayer = wallet;
    } else if (action === 'join') {
        const gamePubKey = await prompt('Enter the game public key: ');
        gamePublicKey = new PublicKey(gamePubKey);


        let playerX = wallet

        const playerOPath = "/home/mubariz/p2.json";
        const playerOSecretKey = new Uint8Array(JSON.parse(fs.readFileSync(playerOPath, 'utf8')));
        let playerO = Keypair.fromSecretKey(playerOSecretKey);

        // Determine if the current player is X or O
        const gameState = await getGameState(gamePublicKey);
        if (gameState.turn.toBase58() === playerX.publicKey.toBase58()) {
            currentPlayer = playerX;
        } else if (gameState.turn.toBase58() === playerO.publicKey.toBase58()) {
            currentPlayer = playerO;
        } else {
            console.log('Invalid player.');
            return;
        }
    } else {
        console.log('Invalid action.');
        return;
    }

    while (true) {
        const gameState = await getGameState(gamePublicKey);
        console.log('Current board state:');
        console.log('Board state:', gameState.board.map(row => row.map(tile => tile ? (tile.number === 1 ? 'X' : 'O') : '_')).join('\n'));
        if (gameState.status.won) {
            console.log()
            console.log(`Game over! Player ${gameState.status.won.winner} has won!`);
            break;
        } else if (gameState.status.draw) {
            console.log('Game over! It\'s a draw!');
            break;
        }
        if (currentPlayer.publicKey.toBase58() === gameState.turn.toBase58()) {
            const row = parseInt(await prompt('Enter row (0-2): '), 10);
            const col = parseInt(await prompt('Enter column (0-2): '), 10);
            await playMove(gamePublicKey, currentPlayer, row, col);
        } else {

            console.log('Waiting for the other player to make a move...');
            await new Promise((resolve) => setTimeout(resolve, 3000)); // Wait 3 seconds
        }


    }

    rl.close();
};

main().catch(err => {
    console.error(err);
    rl.close();
});
