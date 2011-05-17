const FB_APP_ID = CURRENT_LOCALE == 'zh_CN' ? 170328509685996 : 118170701590738;
const FB_REDIRECT_URI = 'http://www.facebook.com/connect/login_success.html';
const FB_PERMISSION = 'offline_access,user_photos,publish_stream';
const FB_ACCESS_TOKEN_URL = 'https://www.facebook.com/dialog/oauth';
const FB_PHOTO_UPLOAD_URL = 'https://graph.facebook.com/me/photos';
const FB_USER_INFO_URL = 'https://graph.facebook.com/me';
const FB_LOGOUT_URL = 'http://m.facebook.com/logout.php?confirm=1';

var Facebook = {
  siteId: 'facebook',
  redirectUrl: FB_REDIRECT_URI,
  currentUserId: null,
  accessTokenCallback: null,

  isRedirectUrl: function(url) {
    return url.indexOf(FB_REDIRECT_URI) == 0;
  },
  
  getAccessToken: function(callback) {
    Facebook.accessTokenCallback = callback;
    var url = FB_ACCESS_TOKEN_URL + '?client_id=' + FB_APP_ID +
      '&redirect_uri=' + FB_REDIRECT_URI + '&scope=' + FB_PERMISSION +
      '&response_type=token';
    chrome.tabs.create({url: url});
  },

  parseAccessToken: function(url) {
    var queryString = url.split('#')[1] || url.split('?')[1];
    var queries = queryString.split('&');
    var queryMap = {};
    queries.forEach(function(pair) {
      queryMap[pair.split('=')[0]] = pair.split('=')[1];
    });
    var accessToken = queryMap['access_token'];
    if (accessToken) {
      var user = new User({
        accessToken: accessToken
      });
      Facebook.accessTokenCallback('success', user);
    } else if (queryMap['error']) {
      Facebook.accessTokenCallback('failure', 'user_denied');
    }
    Facebook.accessTokenCallback = null;
  },

  getUserInfo: function(user, callback) {
    ajax({
      url: FB_USER_INFO_URL,
      parameters: {
        'access_token': user.accessToken
      },
      success: function(userInfo) {
        userInfo = JSON.parse(userInfo);
        if (callback) {
          user.id = userInfo.id;
          user.name = userInfo.name;
          callback('success', user);
        }
      },
      status: {
        others: function() {
          if (callback)
            callback('failure', 'failed_to_get_user_info');
        }
      }
    });
  },
  
  upload: function(user, caption, imageData, callback) {
    caption = ajax.encodeForBinary(caption);
    var params = {
      'access_token': user.accessToken,
      message: caption
    };
    
    var binaryData = {
      boundary: MULTIPART_FORMDATA_BOUNDARY,
      data: imageData,
      value: 'test.png',
      type: 'image/png'
    };
    
    ajax({
      url: FB_PHOTO_UPLOAD_URL,
      parameters: params,
      multipartData: binaryData,
      success: function(data) {
        callback('success', JSON.parse(data).id);
      },
      status: {
        others: function(data) {
          var message;
          if (data) {
            data = JSON.parse(data);
            if (data.error.message.indexOf('access token') >= 0) {
              // User removed application permission
              // {"error":{"type":"OAuthException",
              // "message":"Error validating access token."}}
              message = 'bad_access_token';
            } else {
              // {"error":{"type":"OAuthException",
              // "message":"(#1) An unknown error occurred"}}
              message = 'unknown_error';
            }
          } else {
            message = 'failed_to_connect_to_server';
          }
          callback('failure', message);
        }
      }
    });
  },

  getPhotoLink: function(user, photoId, callback) {
    ajax({
      url: 'https://graph.facebook.com/' + photoId,
      parameters: {
        'access_token': user.accessToken
      },
      complete: function(statusCode, data) {
        if (statusCode == 200) {
          callback('success', JSON.parse(data).link);
        } else {
          callback('failure', 'failed_to_get_photo_link');
        }
      }
    });
  },

  logout: function(callback) {
    ajax({
      url: FB_LOGOUT_URL,
      success: function(data) {
        if (callback)
          callback(data);
      }
    });
  }
};