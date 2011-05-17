/**
 * Create a user.
 * @param {Object} user
 *   properties: id, name, accessToken, expires, accessTokenSecret, albumId
 */
var User = function(user) {
  for (var prop in user) {
    this[prop] = user[prop];
  }
};

var Account = {

  getUsers: function(siteId) {
    var users = localStorage.getItem(siteId + '_userInfo');
    if (users) {
      users = JSON.parse(users);
      for (var id in users) {
        // Remove expired user.
        if (Account.isExpires(users[id])) {
          delete users[id];
        }
      }
      localStorage.setItem(siteId + '_userInfo', JSON.stringify(users));
      return users;
    }
    return {};
  },

  getUser: function(siteId, userId) {
    var users = Account.getUsers(siteId);
    var user = users[userId];
    if (user && Account.isExpires(user)) {
      Account.removeUser(siteId, userId);
      return null;
    } else {
      return user;
    }
  },

  addUser: function(siteId, user) {
    var users = Account.getUsers(siteId);
    var userId = user.id;
    if (!users[userId]) {
      users[userId] = user;
      users = JSON.stringify(users);
      localStorage.setItem(siteId + '_userInfo', users);
    }
  },

  updateUser: function(siteId, user) {
    var users = Account.getUsers(siteId);
    var userId = user.id;
    if (users && users[userId]) {
      users[userId] = user;
      users = JSON.stringify(users);
      localStorage.setItem(siteId + '_userInfo', users);
    }
  },
  
  removeUser: function(siteId, userId) {
    var users = Account.getUsers(siteId);
    delete users[userId];
    users = JSON.stringify(users);
    localStorage.setItem(siteId + '_userInfo', users);
  },

  isExpires: function(user) {
    var expires = user.expires;
    if (expires) {
      return new Date().getTime() >= expires;
    }
    return false;
  }
};