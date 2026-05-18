import { Chess } from 'chess.js';
import Game from '../models/Game.js';
import User from '../models/User.js';
import { calculateNewRatings, parseTimeControl } from '../services/eloService.js';

// Active games stored in memory for performance
const activeGames = new Map();

export default function gameHandler(io, socket) {
  // Join a game room
  socket.on('game:join', async ({ gameId }) => {
    try {
      const game = await Game.findById(gameId)
        .populate('whitePlayer', 'username avatar rating')
        .populate('blackPlayer', 'username avatar rating');

      if (!game) {
        return socket.emit('game:error', { message: 'Game not found' });
      }

      socket.join(gameId);
      socket.gameId = gameId;

      // Initialize in-memory game state if not exists
      if (!activeGames.has(gameId)) {
        const chess = new Chess();
        if (game.fen && game.fen !== 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1') {
          chess.load(game.fen);
        }

        const { baseTime, increment } = parseTimeControl(game.timeControl);

        activeGames.set(gameId, {
          chess,
          whiteTime: game.whiteTime || baseTime,
          blackTime: game.blackTime || baseTime,
          increment,
          lastMoveTime: Date.now(),
          timerInterval: null,
          started: game.moves.length > 0
        });
      }

      const gameState = activeGames.get(gameId);

      // Determine this player's color on the server side
      const yourColor = game.whitePlayer._id.toString() === socket.userId ? 'white' : 'black';
      console.log(`🎨 Player ${socket.username} (${socket.userId}) assigned: ${yourColor} | whitePlayer: ${game.whitePlayer._id.toString()}`);

      socket.emit('game:state', {
        game: game.toObject(),
        yourColor,
        whitePlayerId: game.whitePlayer._id.toString(),
        blackPlayerId: game.blackPlayer._id.toString(),
        fen: gameState.chess.fen(),
        whiteTime: gameState.whiteTime,
        blackTime: gameState.blackTime,
        turn: gameState.chess.turn(),
        isCheck: gameState.chess.isCheck(),
        isCheckmate: gameState.chess.isCheckmate(),
        isDraw: gameState.chess.isDraw(),
        isGameOver: gameState.chess.isGameOver(),
        moveHistory: gameState.chess.history({ verbose: true })
      });
    } catch (error) {
      socket.emit('game:error', { message: error.message });
    }
  });

  // Handle a move
  socket.on('game:move', async ({ gameId, move }) => {
    try {
      const gameState = activeGames.get(gameId);
      if (!gameState) {
        return socket.emit('game:error', { message: 'Game not found in active games' });
      }

      const game = await Game.findById(gameId);
      if (!game || game.result !== 'ongoing') {
        return socket.emit('game:error', { message: 'Game is not active' });
      }

      // Verify it's the correct player's turn
      const isWhiteTurn = gameState.chess.turn() === 'w';
      const currentPlayerId = isWhiteTurn ? game.whitePlayer.toString() : game.blackPlayer.toString();
      
      if (socket.userId !== currentPlayerId) {
        return socket.emit('game:error', { message: 'Not your turn' });
      }

      // Attempt the move
      const result = gameState.chess.move(move);
      if (!result) {
        return socket.emit('game:error', { message: 'Invalid move' });
      }

      // Update timers
      const now = Date.now();
      if (gameState.started) {
        const elapsed = now - gameState.lastMoveTime;
        if (isWhiteTurn) {
          gameState.whiteTime -= elapsed;
          gameState.whiteTime += gameState.increment;
        } else {
          gameState.blackTime -= elapsed;
          gameState.blackTime += gameState.increment;
        }
      }
      gameState.lastMoveTime = now;
      gameState.started = true;

      // Save move to database
      game.moves.push({
        from: result.from,
        to: result.to,
        san: result.san,
        promotion: result.promotion || null,
        timestamp: new Date()
      });
      game.fen = gameState.chess.fen();
      game.pgn = gameState.chess.pgn();
      game.whiteTime = gameState.whiteTime;
      game.blackTime = gameState.blackTime;

      // Check for game end
      let gameOver = false;
      if (gameState.chess.isCheckmate()) {
        game.result = isWhiteTurn ? 'black' : 'white'; // The side that just moved wins... wait no
        // The move was already made, so if it's checkmate, the side that moved delivered it
        game.result = gameState.chess.turn() === 'w' ? 'black' : 'white';
        game.resultReason = 'checkmate';
        gameOver = true;
      } else if (gameState.chess.isStalemate()) {
        game.result = 'draw';
        game.resultReason = 'stalemate';
        gameOver = true;
      } else if (gameState.chess.isThreefoldRepetition()) {
        game.result = 'draw';
        game.resultReason = 'threefold_repetition';
        gameOver = true;
      } else if (gameState.chess.isInsufficientMaterial()) {
        game.result = 'draw';
        game.resultReason = 'insufficient_material';
        gameOver = true;
      } else if (gameState.chess.isDraw()) {
        game.result = 'draw';
        game.resultReason = 'fifty_move_rule';
        gameOver = true;
      }

      if (gameOver) {
        game.endedAt = new Date();
        await finishGame(game, gameState);
        activeGames.delete(gameId);
      }

      await game.save();

      // Broadcast updated state to both players
      io.to(gameId).emit('game:moved', {
        move: result,
        fen: gameState.chess.fen(),
        whiteTime: gameState.whiteTime,
        blackTime: gameState.blackTime,
        turn: gameState.chess.turn(),
        isCheck: gameState.chess.isCheck(),
        isCheckmate: gameState.chess.isCheckmate(),
        isDraw: gameState.chess.isDraw(),
        isGameOver: gameState.chess.isGameOver(),
        san: result.san,
        moveHistory: gameState.chess.history({ verbose: true }),
        result: game.result,
        resultReason: game.resultReason
      });
    } catch (error) {
      socket.emit('game:error', { message: error.message });
    }
  });

  // Resign
  socket.on('game:resign', async ({ gameId }) => {
    try {
      const game = await Game.findById(gameId);
      if (!game || game.result !== 'ongoing') return;

      const isWhite = game.whitePlayer.toString() === socket.userId;
      game.result = isWhite ? 'black' : 'white';
      game.resultReason = 'resignation';
      game.endedAt = new Date();

      const gameState = activeGames.get(gameId);
      if (gameState) {
        await finishGame(game, gameState);
        activeGames.delete(gameId);
      }

      await game.save();

      io.to(gameId).emit('game:over', {
        result: game.result,
        resultReason: game.resultReason,
        game: game.toObject()
      });
    } catch (error) {
      socket.emit('game:error', { message: error.message });
    }
  });

  // Offer draw
  socket.on('game:draw-offer', ({ gameId }) => {
    socket.to(gameId).emit('game:draw-offered', {
      from: socket.userId
    });
  });

  // Accept draw
  socket.on('game:draw-accept', async ({ gameId }) => {
    try {
      const game = await Game.findById(gameId);
      if (!game || game.result !== 'ongoing') return;

      game.result = 'draw';
      game.resultReason = 'draw_agreement';
      game.endedAt = new Date();

      const gameState = activeGames.get(gameId);
      if (gameState) {
        await finishGame(game, gameState);
        activeGames.delete(gameId);
      }

      await game.save();

      io.to(gameId).emit('game:over', {
        result: game.result,
        resultReason: game.resultReason,
        game: game.toObject()
      });
    } catch (error) {
      socket.emit('game:error', { message: error.message });
    }
  });

  // Timer timeout
  socket.on('game:timeout', async ({ gameId, loser }) => {
    try {
      const game = await Game.findById(gameId);
      if (!game || game.result !== 'ongoing') return;

      const isWhiteTimeout = game.whitePlayer.toString() === loser;
      game.result = isWhiteTimeout ? 'black' : 'white';
      game.resultReason = 'timeout';
      game.endedAt = new Date();

      const gameState = activeGames.get(gameId);
      if (gameState) {
        await finishGame(game, gameState);
        activeGames.delete(gameId);
      }

      await game.save();

      io.to(gameId).emit('game:over', {
        result: game.result,
        resultReason: game.resultReason,
        game: game.toObject()
      });
    } catch (error) {
      socket.emit('game:error', { message: error.message });
    }
  });

  // Leave game room
  socket.on('game:leave', ({ gameId }) => {
    socket.leave(gameId);
  });
}

// Update Elo ratings and stats after game ends
async function finishGame(game, gameState) {
  try {
    const whitePlayer = await User.findById(game.whitePlayer);
    const blackPlayer = await User.findById(game.blackPlayer);

    if (!whitePlayer || !blackPlayer) return;

    // Determine score for white
    let whiteScore;
    if (game.result === 'white') whiteScore = 1;
    else if (game.result === 'black') whiteScore = 0;
    else whiteScore = 0.5;

    const { newRatingA, newRatingB, changeA, changeB } = calculateNewRatings(
      whitePlayer.rating,
      blackPlayer.rating,
      whiteScore,
      whitePlayer.gamesPlayed,
      blackPlayer.gamesPlayed
    );

    // Save rating snapshots to game
    game.whiteRatingBefore = whitePlayer.rating;
    game.blackRatingBefore = blackPlayer.rating;
    game.whiteRatingAfter = newRatingA;
    game.blackRatingAfter = newRatingB;

    // Update white player
    whitePlayer.rating = newRatingA;
    whitePlayer.peakRating = Math.max(whitePlayer.peakRating, newRatingA);
    whitePlayer.gamesPlayed += 1;
    if (game.result === 'white') whitePlayer.wins += 1;
    else if (game.result === 'black') whitePlayer.losses += 1;
    else whitePlayer.draws += 1;

    // Update black player
    blackPlayer.rating = newRatingB;
    blackPlayer.peakRating = Math.max(blackPlayer.peakRating, newRatingB);
    blackPlayer.gamesPlayed += 1;
    if (game.result === 'black') blackPlayer.wins += 1;
    else if (game.result === 'white') blackPlayer.losses += 1;
    else blackPlayer.draws += 1;

    await Promise.all([whitePlayer.save(), blackPlayer.save()]);
  } catch (error) {
    console.error('Error finishing game:', error);
  }
}

export { activeGames };
