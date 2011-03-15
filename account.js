var User = function(id, name, accessToken, accessTokenSecret) {
  this.id = id;
  this.name = name;
  this.accessToken = accessToken;
  this.accessTokenSecret = accessTokenSecret;
};

var Account = {

  getUsers: function(siteId) {
    var userInfo = localStorage.getItem(siteId + '_userInfo');
    if (userInfo) {
      return JSON.parse(userInfo);
    }
    return {};
  },

  getUser: function(siteId, userId) {
    var users = Account.getUsers(siteId);
    return users[userId];
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

  removeUser: function(siteId, userId) {
    var users = Account.getUsers(siteId);
    delete users[userId];
    users = JSON.stringify(users);
    localStorage.setItem(siteId + '_userInfo', users);
  }
};