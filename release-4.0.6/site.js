var Site = function(id) {
  this.siteId = id;
};

Site.prototype = {
  /**
   * Get access token by user's authorization.
   * @param {Function} callback call-back function, parameters:
   *   {String} result, success or failure; {User|String} user with access
   *   token, etc. or error message.
   */
  getAccessToken: function(callback) {},

  /**
   * Check if the url is redirect url for retrieving access token of current
   * site.
   * @param {String} url
   * @return {Boolean} result
   */
  isRedirectUrl: function(url) {},

  /**
   * Parse and get access token from redirect url, then call call-back function
   * of passed by calling getAccessToken method with access token.
   * @param {String} url
   */
  parseAccessToken: function(url) {},

  /**
   * Get user information.
   * @param {User} user
   * @param {Function} callback call-back function, parameters:
   *   {String} result, success or failure; {User|String} user with user id,
   *   user name, etc. or error message.
   */
  getUserInfo: function(user, callback) {},

  /**
   * Upload image.
   * @param {User} user user data with access token, etc.
   * @param {String} caption image description
   * @param {String} imageData binary image data
   * @param callback  call-back function, parameters:
   *   {String} result, success or failure; {String} photo id or error message.
   */
  upload: function(user, caption, imageData, callback) {},

  /**
   * Get photo link.
   * @param {User} user user data with id, access token, etc.
   * @param {String} photoId
   * @param {Function} callback call-back function, parameters:
   *   {String} result, success or failure; {String} photo link or error
   *   message.
   */
  getPhotoLink: function(user, photoId, callback) {},

  /**
   * Log out current signed in user.
   * @param callback
   */
  logout: function(callback) {}
};