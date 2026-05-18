/**
 * WebRTC Signaling Handler
 * Relays SDP offers/answers and ICE candidates between peers.
 * The actual media streams are P2P — server only facilitates the handshake.
 */
export default function signalingHandler(io, socket) {
  // Player sends an SDP offer
  socket.on('webrtc:offer', ({ gameId, offer }) => {
    socket.to(gameId).emit('webrtc:offer', {
      offer,
      from: socket.userId
    });
  });

  // Player sends an SDP answer
  socket.on('webrtc:answer', ({ gameId, answer }) => {
    socket.to(gameId).emit('webrtc:answer', {
      answer,
      from: socket.userId
    });
  });

  // Player sends an ICE candidate
  socket.on('webrtc:ice-candidate', ({ gameId, candidate }) => {
    socket.to(gameId).emit('webrtc:ice-candidate', {
      candidate,
      from: socket.userId
    });
  });

  // Player toggles video/audio
  socket.on('webrtc:toggle-media', ({ gameId, type, enabled }) => {
    socket.to(gameId).emit('webrtc:toggle-media', {
      from: socket.userId,
      type, // 'video' or 'audio'
      enabled
    });
  });

  // Player ends call
  socket.on('webrtc:end-call', ({ gameId }) => {
    socket.to(gameId).emit('webrtc:call-ended', {
      from: socket.userId
    });
  });
}
