import api from './api';

export const authService = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout')
};

export const userService = {
  getProfile: (id) => api.get(`/users/${id}`),
  updateProfile: (data) => api.put('/users/profile', data),
  searchUsers: (query) => api.get(`/users/search?q=${query}`),
  sendFriendRequest: (id) => api.post(`/users/${id}/friend-request`),
  acceptFriendRequest: (id) => api.post(`/users/friend-request/${id}/accept`),
  declineFriendRequest: (id) => api.post(`/users/friend-request/${id}/decline`),
  removeFriend: (id) => api.delete(`/users/friends/${id}`),
  getRecommendations: () => api.get('/users/recommendations'),
  getUserFriends: (id) => api.get(`/users/${id}/friends`),
  getConversations: () => api.get('/users/conversations')
};

export const gameService = {
  getHistory: (params) => api.get('/games/history', { params }),
  getGame: (id) => api.get(`/games/${id}`)
};

export const leaderboardService = {
  get: (params) => api.get('/leaderboard', { params })
};
