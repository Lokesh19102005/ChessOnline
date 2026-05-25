import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { userService } from '../../services/services';
import { getInitials } from '../../utils/constants';
import styles from './Pages.module.css';

export default function Friends() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();

  const [tab, setTab] = useState('friends');
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recLoading, setRecLoading] = useState(false);

  // Chat state
  const [chatFriend, setChatFriend] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [typingUser, setTypingUser] = useState(null);
  const [unreadCounts, setUnreadCounts] = useState({});
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const chatContainerRef = useRef(null);

  // Load initial data
  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [profileRes, convRes] = await Promise.all([
        userService.getProfile(user._id),
        userService.getConversations()
      ]);
      setFriends(profileRes.data.user.friends || []);
      setRequests(profileRes.data.user.friendRequests || []);

      // Build unread counts map
      const counts = {};
      for (const conv of convRes.data.conversations) {
        if (conv.unreadCount > 0) {
          counts[conv.friend._id] = conv.unreadCount;
        }
      }
      setUnreadCounts(counts);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  // Load recommendations when tab switches
  useEffect(() => {
    if (tab === 'recommendations' && recommendations.length === 0) {
      loadRecommendations();
    }
  }, [tab]);

  const loadRecommendations = async () => {
    setRecLoading(true);
    try {
      const res = await userService.getRecommendations();
      setRecommendations(res.data.recommendations);
    } catch (err) { console.error(err); }
    finally { setRecLoading(false); }
  };

  // Search with debounce
  const searchTimeoutRef = useRef(null);
  const handleSearchChange = (val) => {
    setSearchQuery(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (val.length >= 2) {
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const res = await userService.searchUsers(val);
          setSearchResults(res.data.users);
        } catch (err) { console.error(err); }
      }, 300);
    } else {
      setSearchResults([]);
    }
  };

  // Socket listeners for chat
  useEffect(() => {
    if (!socket) return;

    const handleMessage = (msg) => {
      setMessages(prev => [...prev, msg]);
      scrollToBottom();
    };

    const handleHistory = ({ messages: hist, conversationKey }) => {
      setMessages(hist);
      setTimeout(scrollToBottom, 50);
    };

    const handleTyping = ({ userId, username, conversationKey }) => {
      setTypingUser(username);
    };

    const handleStopTyping = () => {
      setTypingUser(null);
    };

    const handleNewNotification = ({ conversationKey, message }) => {
      // Update unread count if not in the conversation
      const senderId = message.sender._id || message.sender;
      if (!chatFriend || chatFriend._id !== senderId) {
        setUnreadCounts(prev => ({
          ...prev,
          [senderId]: (prev[senderId] || 0) + 1
        }));
      }
    };

    const handleMessagesRead = ({ conversationKey }) => {
      // messages were read by the other user
    };

    socket.on('chat:message', handleMessage);
    socket.on('chat:history', handleHistory);
    socket.on('chat:typing', handleTyping);
    socket.on('chat:stop-typing', handleStopTyping);
    socket.on('chat:new-message-notification', handleNewNotification);
    socket.on('chat:messages-read', handleMessagesRead);

    return () => {
      socket.off('chat:message', handleMessage);
      socket.off('chat:history', handleHistory);
      socket.off('chat:typing', handleTyping);
      socket.off('chat:stop-typing', handleStopTyping);
      socket.off('chat:new-message-notification', handleNewNotification);
      socket.off('chat:messages-read', handleMessagesRead);
    };
  }, [socket, chatFriend]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Open chat with a friend
  const openChat = useCallback((friend) => {
    if (!socket) return;

    // Leave previous conversation
    if (chatFriend) {
      const prevIds = [user._id, chatFriend._id].sort();
      const prevKey = `dm_${prevIds[0]}_${prevIds[1]}`;
      socket.emit('chat:leave-conversation', { conversationKey: prevKey });
    }

    setChatFriend(friend);
    setMessages([]);
    setTypingUser(null);

    // Generate conversation key
    const ids = [user._id, friend._id].sort();
    const conversationKey = `dm_${ids[0]}_${ids[1]}`;

    // Join conversation room and fetch history
    socket.emit('chat:join-conversation', { conversationKey });
    socket.emit('chat:history', { conversationKey });
    socket.emit('chat:mark-read', { conversationKey });

    // Clear unread count for this friend
    setUnreadCounts(prev => {
      const next = { ...prev };
      delete next[friend._id];
      return next;
    });
  }, [socket, chatFriend, user]);

  const closeChat = () => {
    if (socket && chatFriend) {
      const ids = [user._id, chatFriend._id].sort();
      const conversationKey = `dm_${ids[0]}_${ids[1]}`;
      socket.emit('chat:leave-conversation', { conversationKey });
    }
    setChatFriend(null);
    setMessages([]);
    setTypingUser(null);
  };

  const sendMessage = () => {
    if (!messageInput.trim() || !socket || !chatFriend) return;

    const ids = [user._id, chatFriend._id].sort();
    const conversationKey = `dm_${ids[0]}_${ids[1]}`;

    socket.emit('chat:direct', {
      to: chatFriend._id,
      content: messageInput.trim(),
      conversationKey
    });

    setMessageInput('');
    socket.emit('chat:stop-typing', { conversationKey });
  };

  const handleInputChange = (val) => {
    setMessageInput(val);
    if (!socket || !chatFriend) return;

    const ids = [user._id, chatFriend._id].sort();
    const conversationKey = `dm_${ids[0]}_${ids[1]}`;

    socket.emit('chat:typing', { conversationKey });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('chat:stop-typing', { conversationKey });
    }, 2000);
  };

  const acceptReq = async (fromId) => {
    try {
      await userService.acceptFriendRequest(fromId);
      loadData();
    } catch (err) { alert(err.response?.data?.message || 'Error'); }
  };

  const declineReq = async (fromId) => {
    try {
      await userService.declineFriendRequest(fromId);
      loadData();
    } catch (err) { console.error(err); }
  };

  const removeFriend = async (id) => {
    if (!window.confirm('Remove this friend?')) return;
    try {
      await userService.removeFriend(id);
      if (chatFriend && chatFriend._id === id) closeChat();
      loadData();
    } catch (err) { console.error(err); }
  };

  const sendReq = async (id) => {
    try {
      await userService.sendFriendRequest(id);
      alert('Friend request sent!');
    } catch (err) { alert(err.response?.data?.message || 'Error'); }
  };

  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className={styles.pageContainer}>
      <div className={styles.pageHeader}>
        <h1>👥 Social Hub</h1>
        <p>Connect, chat, and discover players</p>
      </div>

      <div className={styles.socialLayout}>
        {/* Left Panel — Friends & Discovery */}
        <div className={styles.socialLeftPanel}>
          <div className={styles.tabBar}>
            {[
              { key: 'friends', label: `Friends (${friends.length})` },
              { key: 'requests', label: `Requests${requests.length > 0 ? ` (${requests.length})` : ''}` },
              { key: 'search', label: '🔍 Search' },
              { key: 'recommendations', label: '✨ Discover' }
            ].map(t => (
              <button key={t.key}
                className={`${styles.tab} ${tab === t.key ? styles.active : ''}`}
                onClick={() => setTab(t.key)}>
                {t.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <div className="spinner spinner-lg" />
            </div>
          ) : (
            <div className={styles.friendsListScroll}>
              {/* Friends Tab */}
              {tab === 'friends' && (
                <div className={styles.friendsList}>
                  {friends.length === 0 ? (
                    <div className={styles.emptyState}>
                      <div className={styles.emptyIcon}>👥</div>
                      <p>No friends yet</p>
                      <span>Search for players or check out recommendations!</span>
                    </div>
                  ) : friends.map(f => (
                    <div key={f._id} className={`${styles.friendCard} ${chatFriend?._id === f._id ? styles.friendCardActive : ''}`}>
                      <div className={styles.friendAvatarWrap}>
                        <div className="avatar avatar-sm">{getInitials(f.username)}</div>
                        {f.isOnline && <span className={styles.onlineBadge} />}
                      </div>
                      <div className={styles.friendInfo}>
                        <div className={styles.friendName}>{f.username}</div>
                        <div className={styles.friendRating}>⭐ {f.rating}</div>
                      </div>
                      {unreadCounts[f._id] > 0 && (
                        <span className={styles.unreadBadge}>{unreadCounts[f._id]}</span>
                      )}
                      <div className={styles.friendActions}>
                        <button className={`${styles.actionBtn} ${styles.chatBtn}`}
                          onClick={() => openChat(f)} title="Chat">
                          💬
                        </button>
                        <button className={`${styles.actionBtn} ${styles.viewBtn}`}
                          onClick={() => navigate(`/profile/${f._id}`)} title="Profile">
                          👤
                        </button>
                        <button className={`${styles.actionBtn} ${styles.removeBtn}`}
                          onClick={() => removeFriend(f._id)} title="Remove">
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Requests Tab */}
              {tab === 'requests' && (
                <div className={styles.friendsList}>
                  {requests.length === 0 ? (
                    <div className={styles.emptyState}>
                      <div className={styles.emptyIcon}>📬</div>
                      <p>No pending requests</p>
                      <span>Friend requests will appear here</span>
                    </div>
                  ) : requests.map(r => {
                    const fromUser = r.from || {};
                    const fromId = fromUser._id || r.from;
                    return (
                      <div key={fromId} className={styles.requestCard}>
                        <div className={styles.friendAvatarWrap}>
                          <div className="avatar avatar-sm">{getInitials(fromUser.username || '??')}</div>
                          {fromUser.isOnline && <span className={styles.onlineBadge} />}
                        </div>
                        <div className={styles.friendInfo}>
                          <div className={styles.friendName}>{fromUser.username || 'Unknown'}</div>
                          {fromUser.rating && <div className={styles.friendRating}>⭐ {fromUser.rating}</div>}
                        </div>
                        <div className={styles.requestActions}>
                          <button className="btn btn-success btn-sm" onClick={() => acceptReq(fromId)}>
                            ✓ Accept
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => declineReq(fromId)}>
                            ✕
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Search Tab */}
              {tab === 'search' && (
                <>
                  <div className={styles.searchBar}>
                    <input className="input-field" placeholder="Search by username..."
                      value={searchQuery}
                      onChange={e => handleSearchChange(e.target.value)}
                    />
                  </div>
                  <div className={styles.friendsList}>
                    {searchQuery.length < 2 ? (
                      <div className={styles.emptyState}>
                        <div className={styles.emptyIcon}>🔍</div>
                        <p>Search for players</p>
                        <span>Type at least 2 characters to search</span>
                      </div>
                    ) : searchResults.length === 0 ? (
                      <div className={styles.emptyState}>
                        <div className={styles.emptyIcon}>😕</div>
                        <p>No players found</p>
                        <span>Try a different search term</span>
                      </div>
                    ) : searchResults.map(u => (
                      <div key={u._id} className={styles.friendCard}>
                        <div className={styles.friendAvatarWrap}>
                          <div className="avatar avatar-sm">{getInitials(u.username)}</div>
                          {u.isOnline && <span className={styles.onlineBadge} />}
                        </div>
                        <div className={styles.friendInfo}>
                          <div className={styles.friendName}>{u.username}</div>
                          <div className={styles.friendRating}>⭐ {u.rating}</div>
                        </div>
                        <div className={styles.friendActions}>
                          <button className="btn btn-primary btn-sm" onClick={() => sendReq(u._id)}>
                            + Add
                          </button>
                          <button className={`${styles.actionBtn} ${styles.viewBtn}`}
                            onClick={() => navigate(`/profile/${u._id}`)} title="Profile">
                            👤
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Recommendations Tab */}
              {tab === 'recommendations' && (
                <div className={styles.friendsList}>
                  {recLoading ? (
                    <div style={{ textAlign: 'center', padding: 60 }}>
                      <div className="spinner spinner-lg" />
                    </div>
                  ) : recommendations.length === 0 ? (
                    <div className={styles.emptyState}>
                      <div className={styles.emptyIcon}>✨</div>
                      <p>No recommendations yet</p>
                      <span>Play more games to get friend suggestions!</span>
                    </div>
                  ) : recommendations.map(rec => (
                    <div key={rec._id} className={styles.recCard}>
                      <div className={styles.friendAvatarWrap}>
                        <div className="avatar avatar-sm">{getInitials(rec.username)}</div>
                        {rec.isOnline && <span className={styles.onlineBadge} />}
                      </div>
                      <div className={styles.friendInfo}>
                        <div className={styles.friendName}>{rec.username}</div>
                        <div className={styles.friendRating}>⭐ {rec.rating}</div>
                        <div className={styles.recReasons}>
                          {rec.reasons.map((reason, i) => (
                            <span key={i} className={styles.reasonBadge}>
                              {reason.includes('mutual') ? '👥' : reason.includes('rating') ? '📊' : '⚔️'} {reason}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className={styles.friendActions}>
                        <button className="btn btn-primary btn-sm" onClick={() => sendReq(rec._id)}>
                          + Add
                        </button>
                        <button className={`${styles.actionBtn} ${styles.viewBtn}`}
                          onClick={() => navigate(`/profile/${rec._id}`)} title="Profile">
                          👤
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Panel — Chat */}
        <div className={`${styles.socialRightPanel} ${chatFriend ? styles.chatOpen : ''}`}>
          {chatFriend ? (
            <>
              {/* Chat Header */}
              <div className={styles.chatHeader}>
                <button className={styles.chatBackBtn} onClick={closeChat}>←</button>
                <div className={styles.friendAvatarWrap}>
                  <div className="avatar avatar-sm">{getInitials(chatFriend.username)}</div>
                  {chatFriend.isOnline && <span className={styles.onlineBadge} />}
                </div>
                <div className={styles.chatHeaderInfo}>
                  <div className={styles.chatHeaderName}>{chatFriend.username}</div>
                  <div className={styles.chatHeaderStatus}>
                    {typingUser ? (
                      <span className={styles.typingIndicator}>
                        typing<span className={styles.typingDots}><span>.</span><span>.</span><span>.</span></span>
                      </span>
                    ) : chatFriend.isOnline ? 'Online' : 'Offline'}
                  </div>
                </div>
                <button className={`${styles.actionBtn} ${styles.viewBtn}`}
                  onClick={() => navigate(`/profile/${chatFriend._id}`)}>
                  👤
                </button>
              </div>

              {/* Chat Messages */}
              <div className={styles.chatMessages} ref={chatContainerRef}>
                {messages.length === 0 ? (
                  <div className={styles.chatEmpty}>
                    <div className={styles.emptyIcon}>💬</div>
                    <p>Start a conversation!</p>
                    <span>Say hello to {chatFriend.username}</span>
                  </div>
                ) : messages.map((msg, i) => {
                  const isMine = (msg.sender._id || msg.sender) === user._id;
                  return (
                    <div key={msg._id || i}
                      className={`${styles.messageBubble} ${isMine ? styles.messageSent : styles.messageReceived}`}>
                      <div className={styles.messageContent}>{msg.content}</div>
                      <div className={styles.messageTime}>{formatTime(msg.createdAt)}</div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input */}
              <div className={styles.chatInputBar}>
                <input
                  className={`input-field ${styles.chatInput}`}
                  placeholder={`Message ${chatFriend.username}...`}
                  value={messageInput}
                  onChange={e => handleInputChange(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendMessage()}
                  autoFocus
                />
                <button className={`btn btn-primary ${styles.sendBtn}`}
                  onClick={sendMessage}
                  disabled={!messageInput.trim()}>
                  ➤
                </button>
              </div>
            </>
          ) : (
            <div className={styles.chatPlaceholder}>
              <div className={styles.chatPlaceholderIcon}>💬</div>
              <h3>Select a friend to chat</h3>
              <p>Choose someone from your friends list to start messaging</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
