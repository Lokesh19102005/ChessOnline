import { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { formatTime, getInitials } from '../../utils/constants';
import styles from './Board.module.css';

// Memoized video panel — isolates video from timer-driven re-renders
const VideoPanel = memo(function VideoPanel({
  callActive, remoteStream, localStream, videoEnabled, audioEnabled,
  opponentName, startCall, toggleVideo, toggleAudio, endCall
}) {
  // Use callback refs to guarantee srcObject is set when the element mounts
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  // Callback ref for remote video — sets srcObject reliably on mount
  const setRemoteVideoRef = useCallback((el) => {
    remoteVideoRef.current = el;
    if (el && remoteStream) {
      el.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Callback ref for local video — sets srcObject reliably on mount
  const setLocalVideoRef = useCallback((el) => {
    localVideoRef.current = el;
    if (el && localStream) {
      el.srcObject = localStream;
    }
  }, [localStream]);

  if (!callActive) {
    return (
      <div className={`${styles.videoPanel} glass-card`}>
        <div style={{ padding: '24px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', marginBottom: '12px', fontSize: '0.9rem' }}>
            Connect with your opponent
          </p>
          <button className="btn btn-primary btn-sm" onClick={startCall}>
            📹 Start Video Call
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.videoPanel} glass-card`}>
      <div className={styles.videoContainer}>
        <div className={`${styles.videoBox} ${!remoteStream ? styles.videoOff : ''}`}>
          {remoteStream ? (
            <video ref={setRemoteVideoRef} autoPlay playsInline />
          ) : '📹'}
          <span className={styles.videoLabel}>{opponentName}</span>
        </div>
        <div className={`${styles.videoBox} ${!localStream ? styles.videoOff : ''}`}>
          {localStream ? (
            <video
              ref={setLocalVideoRef}
              autoPlay
              playsInline
              muted
              style={!videoEnabled ? { opacity: 0, position: 'absolute' } : undefined}
            />
          ) : null}
          {!localStream && '🙂'}
          {localStream && !videoEnabled && <span style={{ fontSize: '2rem' }}>📷</span>}
          <span className={styles.videoLabel}>You</span>
        </div>
      </div>
      <div className={styles.videoControls}>
        <button
          className={`${styles.mediaBtn} ${!videoEnabled ? styles.off : ''}`}
          onClick={toggleVideo}
          title={videoEnabled ? 'Turn off camera' : 'Turn on camera'}
        >
          {videoEnabled ? '📹' : '🚫'}
        </button>
        <button
          className={`${styles.mediaBtn} ${!audioEnabled ? styles.off : ''}`}
          onClick={toggleAudio}
          title={audioEnabled ? 'Mute' : 'Unmute'}
        >
          {audioEnabled ? '🎤' : '🔇'}
        </button>
        <button
          className={`${styles.mediaBtn} ${styles.endCall}`}
          onClick={endCall}
          title="End call"
        >
          📞
        </button>
      </div>
    </div>
  );
});

export default function ChessBoard() {
  const { gameId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const { socket } = useSocket();

  // Game state
  const [game, setGame] = useState(null);
  const [fen, setFen] = useState('start');
  const [playerColor, setPlayerColor] = useState(location.state?.color || 'white');
  const [whiteTime, setWhiteTime] = useState(600000);
  const [blackTime, setBlackTime] = useState(600000);
  const [turn, setTurn] = useState('w');
  const [isCheck, setIsCheck] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [result, setResult] = useState(null);
  const [resultReason, setResultReason] = useState(null);
  const [moveHistory, setMoveHistory] = useState([]);
  const [drawOffered, setDrawOffered] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);

  // Chat state
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef(null);

  // Video call state
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [callActive, setCallActive] = useState(false);
  // Video refs are now inside the memoized VideoPanel component
  const peerConnectionRef = useRef(null);
  const iceServersRef = useRef([]);

  // Timer interval
  const timerRef = useRef(null);

  // Chess.js instance for local validation
  const chessRef = useRef(new Chess());


  // Join game and setup listeners
  useEffect(() => {
    if (!socket || !gameId || !user) return;

    console.log('Setting up game listeners for', gameId);
    socket.emit('game:join', { gameId });
    socket.emit('chat:history', { gameId });
    socket.emit('webrtc:get-ice-servers');

    const myId = user._id.toString();

    const handleState = (data) => {
      console.log('game:state received — yourColor:', data.yourColor);
      setGame(data.game);
      setFen(data.fen);
      setWhiteTime(data.whiteTime);
      setBlackTime(data.blackTime);
      setTurn(data.turn);
      setIsCheck(data.isCheck);
      setMoveHistory(data.moveHistory || []);
      chessRef.current.load(data.fen);

      // Normalize color to 'white'/'black' (server might send 'w'/'b')
      if (data.yourColor) {
        const normalizedColor = data.yourColor.startsWith('w') ? 'white' : 'black';
        setPlayerColor(normalizedColor);
      }

      if (data.moveHistory && data.moveHistory.length > 0) {
        setGameStarted(true);
      }
      if (data.isGameOver) {
        setGameOver(true);
        setResult(data.game.result);
        setResultReason(data.game.resultReason);
      }
    };

    const handleMoved = (data) => {
      setFen(data.fen);
      setWhiteTime(data.whiteTime);
      setBlackTime(data.blackTime);
      setTurn(data.turn);
      setIsCheck(data.isCheck);
      setMoveHistory(data.moveHistory || []);
      chessRef.current.load(data.fen);
      setGameStarted(true);
      if (data.isGameOver || data.isCheckmate || data.isDraw) {
        setGameOver(true);
        setResult(data.result);
        setResultReason(data.resultReason);
      }
    };

    const handleGameOver = (data) => {
      setGameOver(true);
      setResult(data.result);
      setResultReason(data.resultReason);
      if (data.game) setGame(data.game);
      if (data.game) {
        const wpId = (data.game.whitePlayer._id || data.game.whitePlayer).toString();
        const isWhite = wpId === myId;
        const newRating = isWhite ? data.game.whiteRatingAfter : data.game.blackRatingAfter;
        if (newRating) updateUser({ rating: newRating });
      }
    };

    const handleDrawOffered = () => setDrawOffered(true);
    const handleChatMessage = (msg) => setMessages(prev => [...prev, msg]);
    const handleChatHistory = ({ messages: history }) => setMessages(history || []);
    const handleIceServers = ({ iceServers }) => { iceServersRef.current = iceServers; };
    const handleError = (data) => console.error('Game error:', data.message);

    socket.on('game:state', handleState);
    socket.on('game:moved', handleMoved);
    socket.on('game:over', handleGameOver);
    socket.on('game:draw-offered', handleDrawOffered);
    socket.on('game:error', handleError);
    socket.on('chat:message', handleChatMessage);
    socket.on('chat:history', handleChatHistory);
    socket.on('webrtc:ice-servers', handleIceServers);

    return () => {
      socket.off('game:state', handleState);
      socket.off('game:moved', handleMoved);
      socket.off('game:over', handleGameOver);
      socket.off('game:draw-offered', handleDrawOffered);
      socket.off('game:error', handleError);
      socket.off('chat:message', handleChatMessage);
      socket.off('chat:history', handleChatHistory);
      socket.off('webrtc:ice-servers', handleIceServers);
      socket.emit('game:leave', { gameId });
    };
  }, [socket, gameId, user]);

  // Timer countdown — only starts after the first move
  useEffect(() => {
    if (gameOver || !game || !gameStarted || !socket) return;

    timerRef.current = setInterval(() => {
      if (turn === 'w') {
        setWhiteTime(prev => {
          if (prev <= 0) {
            socket.emit('game:timeout', { gameId, loser: (game.whitePlayer._id || game.whitePlayer).toString() });
            return 0;
          }
          return prev - 100;
        });
      } else {
        setBlackTime(prev => {
          if (prev <= 0) {
            socket.emit('game:timeout', { gameId, loser: (game.blackPlayer._id || game.blackPlayer).toString() });
            return 0;
          }
          return prev - 100;
        });
      }
    }, 100);

    return () => clearInterval(timerRef.current);
  }, [turn, gameOver, game, gameStarted, socket]);

  // Auto scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // WebRTC setup
  useEffect(() => {
    if (!socket || !gameId) return;

    const handleOffer = async ({ offer }) => {
      try {
        await setupPeerConnection();
        const pc = peerConnectionRef.current;
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc:answer', { gameId, answer });
      } catch (err) {
        console.error('Error handling offer:', err);
      }
    };

    const handleAnswer = async ({ answer }) => {
      try {
        const pc = peerConnectionRef.current;
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (err) {
        console.error('Error handling answer:', err);
      }
    };

    const handleIceCandidate = async ({ candidate }) => {
      try {
        const pc = peerConnectionRef.current;
        if (pc && candidate) await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error('Error adding ICE candidate:', err);
      }
    };

    const handleCallEnded = () => cleanupCall();

    socket.on('webrtc:offer', handleOffer);
    socket.on('webrtc:answer', handleAnswer);
    socket.on('webrtc:ice-candidate', handleIceCandidate);
    socket.on('webrtc:call-ended', handleCallEnded);

    return () => {
      socket.off('webrtc:offer', handleOffer);
      socket.off('webrtc:answer', handleAnswer);
      socket.off('webrtc:ice-candidate', handleIceCandidate);
      socket.off('webrtc:call-ended', handleCallEnded);
      cleanupCall();
    };
  }, [socket, gameId]);

  // Stream attachment is now handled inside the memoized VideoPanel component

  const setupPeerConnection = async () => {
    if (peerConnectionRef.current) return;

    const pc = new RTCPeerConnection({
      iceServers: iceServersRef.current.length > 0
        ? iceServersRef.current
        : [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('webrtc:ice-candidate', { gameId, candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
      setCallActive(true);
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        cleanupCall();
      }
    };

    // Get local media
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      setLocalStream(stream);
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
      setVideoEnabled(true);
      setAudioEnabled(true);
    } catch (err) {
      console.warn('Could not access media devices:', err);
      // Try audio only
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setLocalStream(stream);
        stream.getTracks().forEach(track => pc.addTrack(track, stream));
        setAudioEnabled(true);
        setVideoEnabled(false);
      } catch (err2) {
        console.warn('Could not access any media devices');
      }
    }

    peerConnectionRef.current = pc;
  };

  const startCall = useCallback(async () => {
    if (!socket) return;
    try {
      await setupPeerConnection();
      const pc = peerConnectionRef.current;
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('webrtc:offer', { gameId, offer });
      setCallActive(true);
    } catch (err) {
      console.error('Error starting call:', err);
    }
  }, [socket, gameId]);

  const cleanupCall = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    setRemoteStream(null);
    setCallActive(false);
    setVideoEnabled(false);
    setAudioEnabled(false);
  };

  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoEnabled(videoTrack.enabled);
        if (socket) socket.emit('webrtc:toggle-media', { gameId, type: 'video', enabled: videoTrack.enabled });
      }
    }
  }, [localStream, socket, gameId]);

  const toggleAudio = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setAudioEnabled(audioTrack.enabled);
        if (socket) socket.emit('webrtc:toggle-media', { gameId, type: 'audio', enabled: audioTrack.enabled });
      }
    }
  }, [localStream, socket, gameId]);

  const endCall = useCallback(() => {
    if (socket) socket.emit('webrtc:end-call', { gameId });
    cleanupCall();
  }, [socket, gameId]);

  // Chess move handler — v5 API passes single object { piece, sourceSquare, targetSquare }
  const onDrop = useCallback(({ piece, sourceSquare, targetSquare }) => {
    console.log('>>> onDrop called:', { sourceSquare, targetSquare, piece: piece?.pieceType, turn, playerColor, gameOver, socketExists: !!socket });

    if (!socket) { console.log('BLOCKED: no socket'); return false; }
    if (!targetSquare) return false;

    const isMyTurn = (turn === 'w' && playerColor.startsWith('w')) ||
      (turn === 'b' && playerColor.startsWith('b'));
    console.log('isMyTurn:', isMyTurn, 'turn:', turn, 'playerColor:', playerColor);
    if (!isMyTurn || gameOver) { console.log('BLOCKED: not my turn or game over'); return false; }

    // Get the piece type string (v5 passes object with pieceType)
    const pieceStr = typeof piece === 'string' ? piece : (piece?.pieceType || '');
    const isPromotion = (pieceStr === 'P' || pieceStr === 'wP' || pieceStr === 'p' || pieceStr === 'bP') &&
      (targetSquare[1] === '8' || targetSquare[1] === '1');

    const move = {
      from: sourceSquare,
      to: targetSquare,
      promotion: isPromotion ? 'q' : undefined
    };

    console.log('Attempting chess.js move:', move, 'current FEN:', chessRef.current.fen());

    // Validate locally
    try {
      const result = chessRef.current.move(move);
      console.log('chess.js move result:', result);
      if (!result) { console.log('BLOCKED: chess.js returned null'); return false; }
    } catch (error) {
      console.log('BLOCKED: chess.js threw error:', error.message);
      return false;
    }

    // Undo local move (server will update via socket)
    chessRef.current.undo();

    // Send to server
    console.log('Emitting game:move to server');
    socket.emit('game:move', { gameId, move });
    return true;
  }, [turn, playerColor, gameOver, gameId, socket]);

  // TEST: Manual move function for debugging
  const testMove = () => {
    console.log('=== TEST MOVE ===');
    console.log('socket:', !!socket, 'turn:', turn, 'playerColor:', playerColor, 'gameOver:', gameOver);
    console.log('chessRef FEN:', chessRef.current.fen());
    console.log('chessRef turn:', chessRef.current.turn());

    // Try e2-e4
    try {
      const result = chessRef.current.move({ from: 'e2', to: 'e4' });
      console.log('Test move result:', result);
      if (result) {
        chessRef.current.undo();
        if (socket) {
          socket.emit('game:move', { gameId, move: { from: 'e2', to: 'e4' } });
          console.log('Test move sent to server!');
        }
      }
    } catch (e) {
      console.log('Test move error:', e.message);
    }
  };

  // Chat
  const sendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    if (socket) socket.emit('chat:message', { gameId, content: chatInput.trim() });
    setChatInput('');
  };

  // Game actions
  const resign = () => {
    if (window.confirm('Are you sure you want to resign?')) {
      if (socket) socket.emit('game:resign', { gameId });
    }
  };

  const offerDraw = () => {
    if (socket) socket.emit('game:draw-offer', { gameId });
  };

  const acceptDraw = () => {
    if (socket) socket.emit('game:draw-accept', { gameId });
    setDrawOffered(false);
  };

  const declineDraw = () => {
    setDrawOffered(false);
  };

  if (!game) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  const whitePlayer = game.whitePlayer;
  const blackPlayer = game.blackPlayer;
  const opponent = playerColor === 'white' ? blackPlayer : whitePlayer;
  const self = playerColor === 'white' ? whitePlayer : blackPlayer;

  // Determine game over result for current user
  const getGameOverText = () => {
    if (!result) return '';
    if (result === 'draw') return '🤝 Draw';
    const isWhite = playerColor === 'white';
    if ((isWhite && result === 'white') || (!isWhite && result === 'black')) return '🏆 You Won!';
    return '😔 You Lost';
  };

  const getResultClass = () => {
    if (result === 'draw') return styles.draw;
    const isWhite = playerColor === 'white';
    if ((isWhite && result === 'white') || (!isWhite && result === 'black')) return styles.win;
    return styles.lose;
  };

  // Format move history into pairs
  const movePairs = [];
  for (let i = 0; i < moveHistory.length; i += 2) {
    movePairs.push({
      number: Math.floor(i / 2) + 1,
      white: moveHistory[i]?.san,
      black: moveHistory[i + 1]?.san
    });
  }

  return (
    <div className={styles.gameContainer}>
      {/* Left Panel - Move History */}
      <div className={styles.leftPanel}>
        <div className={`${styles.moveHistory} glass-card`}>
          <h3 className={styles.chatHeader}>📝 Moves</h3>
          <div className={styles.moveList}>
            {movePairs.map((pair, i) => (
              <div key={i} style={{ display: 'contents' }}>
                <span className={styles.moveNumber}>{pair.number}.</span>
                <span className={`${styles.move} ${i * 2 === moveHistory.length - 1 ? styles.current : ''}`}>
                  {pair.white}
                </span>
                <span className={`${styles.move} ${i * 2 + 1 === moveHistory.length - 1 ? styles.current : ''}`}>
                  {pair.black || ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Center - Chess Board */}
      <div className={styles.boardSection}>
        {/* Opponent bar (top) */}
        <div className={`${styles.playerBar} ${turn === (playerColor === 'white' ? 'b' : 'w') ? styles.active : ''}`}>
          <div className="avatar avatar-sm">{getInitials(opponent.username)}</div>
          <div className={styles.playerDetails}>
            <div className={styles.playerName}>{opponent.username}</div>
            <div className={styles.playerRating}>{opponent.rating}</div>
          </div>
          <div className={`${styles.timer} ${(playerColor === 'white' ? blackTime : whiteTime) < 30000 ? styles.low : ''}`}>
            {formatTime(playerColor === 'white' ? blackTime : whiteTime)}
          </div>
        </div>

        {/* DEBUG BAR - shows game state for debugging */}
        <div style={{ background: '#1a1a2e', color: '#0f0', fontFamily: 'monospace', fontSize: '12px', padding: '6px 10px', borderRadius: '4px', marginBottom: '4px', display: 'flex', gap: '16px', alignItems: 'center' }}>
          <span>Color: <b>{playerColor}</b></span>
          <span>Turn: <b>{turn === 'w' ? 'White' : 'Black'}</b></span>
          <span>Socket: <b style={{ color: socket ? '#0f0' : '#f00' }}>{socket ? 'Connected' : 'NULL'}</b></span>
          <span>Started: <b>{gameStarted ? 'Yes' : 'No'}</b></span>
          <button onClick={testMove} style={{ background: '#7c3aed', color: '#fff', border: 'none', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
            Test e2→e4
          </button>
        </div>

        {/* Board */}
        <div className={styles.boardWrapper}>
          <Chessboard
            options={{
              id: 'game-board',
              position: fen,
              onPieceDrop: onDrop,
              boardOrientation: playerColor,
              boardStyle: { borderRadius: '0' },
              darkSquareStyle: { backgroundColor: '#7b6b5a' },
              lightSquareStyle: { backgroundColor: '#e8dcc8' },
              dropSquareStyle: { boxShadow: 'inset 0 0 1px 6px rgba(124, 58, 237, 0.5)' },
              animationDurationInMs: 200,
              allowDragging: true,
            }}
          />
        </div>

        {/* Self bar (bottom) */}
        <div className={`${styles.playerBar} ${turn === (playerColor === 'white' ? 'w' : 'b') ? styles.active : ''}`}
          style={{ marginTop: '8px', marginBottom: 0 }}>
          <div className="avatar avatar-sm">{getInitials(self.username)}</div>
          <div className={styles.playerDetails}>
            <div className={styles.playerName}>{self.username} (You)</div>
            <div className={styles.playerRating}>{self.rating}</div>
          </div>
          <div className={`${styles.timer} ${(playerColor === 'white' ? whiteTime : blackTime) < 30000 ? styles.low : ''}`}>
            {formatTime(playerColor === 'white' ? whiteTime : blackTime)}
          </div>
        </div>

        {/* Game Controls */}
        {!gameOver && (
          <div className={styles.gameControls}>
            <button className={`${styles.controlBtn} ${styles.danger}`} onClick={resign}>
              🏳️ Resign
            </button>
            <button className={styles.controlBtn} onClick={offerDraw}>
              🤝 Offer Draw
            </button>
          </div>
        )}
      </div>

      {/* Right Sidebar */}
      <div className={styles.sidebar}>
        {/* Video Panel — memoized to prevent timer-driven re-renders */}
        <VideoPanel
          callActive={callActive}
          remoteStream={remoteStream}
          localStream={localStream}
          videoEnabled={videoEnabled}
          audioEnabled={audioEnabled}
          opponentName={opponent.username}
          startCall={startCall}
          toggleVideo={toggleVideo}
          toggleAudio={toggleAudio}
          endCall={endCall}
        />

        {/* Chat */}
        <div className={`${styles.chatPanel} glass-card`}>
          <div className={styles.chatHeader}>💬 Chat</div>
          <div className={styles.chatMessages}>
            {messages.map((msg, i) => (
              msg.type === 'system' ? (
                <div key={i} className={styles.systemMessage}>{msg.content}</div>
              ) : (
                <div key={i} className={styles.chatMessage}>
                  <span className={styles.chatSender}>
                    {msg.sender?.username || 'Unknown'}:
                  </span>
                  <span className={styles.chatContent}>{msg.content}</span>
                </div>
              )
            ))}
            <div ref={chatEndRef} />
          </div>
          <form className={styles.chatInputArea} onSubmit={sendMessage}>
            <input
              type="text"
              className={styles.chatInput}
              placeholder="Type a message..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              maxLength={500}
            />
            <button type="submit" className={styles.chatSendBtn}>Send</button>
          </form>
        </div>
      </div>

      {/* Draw Offer Banner */}
      {drawOffered && !gameOver && (
        <div className={`${styles.drawOffer} glass-card`}>
          <span>🤝 Your opponent offers a draw</span>
          <button className="btn btn-success btn-sm" onClick={acceptDraw}>Accept</button>
          <button className="btn btn-danger btn-sm" onClick={declineDraw}>Decline</button>
        </div>
      )}

      {/* Game Over Overlay */}
      {gameOver && (
        <div className={styles.gameOverOverlay}>
          <div className={`${styles.gameOverCard} glass-card`}>
            <div className={`${styles.gameOverResult} ${getResultClass()}`}>
              {getGameOverText()}
            </div>
            <div className={styles.gameOverReason}>
              {resultReason?.replace(/_/g, ' ')}
            </div>
            {game.whiteRatingAfter && (
              <div className={styles.ratingUpdate}>
                <span className={styles.ratingOld}>
                  {playerColor === 'white' ? game.whiteRatingBefore : game.blackRatingBefore}
                </span>
                <span className={styles.ratingArrow}>→</span>
                <span className={styles.ratingNew}>
                  {playerColor === 'white' ? game.whiteRatingAfter : game.blackRatingAfter}
                </span>
                {(() => {
                  const before = playerColor === 'white' ? game.whiteRatingBefore : game.blackRatingBefore;
                  const after = playerColor === 'white' ? game.whiteRatingAfter : game.blackRatingAfter;
                  const delta = after - before;
                  return (
                    <span className={styles.ratingDelta} style={{ color: delta >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                      ({delta >= 0 ? '+' : ''}{delta})
                    </span>
                  );
                })()}
              </div>
            )}
            <div className={styles.gameOverActions}>
              <button className="btn btn-primary" onClick={() => navigate('/')}>
                🏠 Back to Home
              </button>
              <button className="btn btn-secondary" onClick={() => navigate(`/game/${gameId}/review`)}>
                📋 Review Game
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
