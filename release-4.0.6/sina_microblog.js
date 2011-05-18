const SINA_APP_KEY = '1350884563';
const SINA_APP_SECRET = 'dd130d4873f31445a51cbb176f9630fe';
const SINA_REQUEST_TOKEN_URL = 'http://api.t.sina.com.cn/oauth/request_token';
const SINA_USER_AUTHENTICATION_URL = 'http://api.t.sina.com.cn/oauth/authorize';
const SINA_ACCESS_TOKEN_URL = 'http://api.t.sina.com.cn/oauth/access_token';
const SINA_USER_INFO_URL = 'http://api.t.sina.com.cn/users/show.json';
const SINA_PHOTO_UPLOAD_URL = 'http://api.t.sina.com.cn/statuses/upload.json';
const SINA_LOGOUT_URL = 'http://api.t.sina.com.cn/account/end_session.json';
const OAUTH_SIGNATURE_METHOD = 'HMAC-SHA1';
const OAUTH_VERSION = '1.0';

var SinaMicroblog = {
  siteId: 'sina',
  currentUserId: null,
  currentUserOauthToken: '',
  currentUserOauthTokenSecret: '',
  accessTokenCallback: null,
  
  isRedirectUrl: function() {},
  
  getAuthorizationHeader: function(message, accessor) {
    OAuth.setTimestampAndNonce(message);
    OAuth.SignatureMethod.sign(message, accessor);
    return OAuth.getAuthorizationHeader("", message.parameters);
  },

  getRequestToken: function(callback) {
    SinaMicroblog.accessTokenCallback = callback;
    var message = {
      action: SINA_REQUEST_TOKEN_URL,
      method: 'POST',
      parameters: {
        'oauth_consumer_key': SINA_APP_KEY,
        'oauth_signature_method': OAUTH_SIGNATURE_METHOD,
        'oauth_version': OAUTH_VERSION
      }
    };
    var accessor = {
      consumerKey: SINA_APP_KEY,
      consumerSecret: SINA_APP_SECRET
    };

    // Get oauth signature header
    var header = SinaMicroblog.getAuthorizationHeader(message, accessor);
    ajax({
      url: SINA_REQUEST_TOKEN_URL,
      method: 'POST',
      headers: {
        'Authorization': header
      },
      success: function(response) {
        response = response.split('&');
        var oauth_token = response[0].split('=')[1];
        var oauth_token_secret = response[1].split('=')[1];
        SinaMicroblog.currentUserOauthToken = oauth_token;
        SinaMicroblog.currentUserOauthTokenSecret = oauth_token_secret;
        SinaMicroblog.getUserAuthentication(oauth_token);
      },
      status: {
        others: function() {
          callback('failure', 'sina_failed_to_get_request_token');
        }
      }
    });
  },

  getUserAuthentication: function(oauth_token) {
    var url = SINA_USER_AUTHENTICATION_URL;
    var hubUrl = chrome.extension.getURL('hub.html');

    url += '?oauth_token=' + oauth_token + '&oauth_callback=' + hubUrl;
    chrome.tabs.create({url: url});
  },

  parseAccessToken: function(url) {
    var queryString = url.split('?')[1];
    var oauthVerifier = queryString.split('&')[1].split('=')[1];
    SinaMicroblog.getAccessToken(SinaMicroblog.accessTokenCallback,
      oauthVerifier);
    SinaMicroblog.accessTokenCallback = null;
  },

  getAccessToken: function(callback, oauth_verifier) {
    if (!oauth_verifier) {
      SinaMicroblog.getRequestToken(callback);
      return;
    }
    var message = {
      action: SINA_ACCESS_TOKEN_URL,
      method: 'POST',
      parameters: {
        'oauth_consumer_key': SINA_APP_KEY,
        'oauth_token': SinaMicroblog.currentUserOauthToken,
        'oauth_token_secret': SinaMicroblog.currentUserOauthTokenSecret,
        'oauth_signature_method': OAUTH_SIGNATURE_METHOD,
        'oauth_verifier': oauth_verifier,
        'oauth_version': OAUTH_VERSION
      }
    };
    var accessor = {
      consumerKey: SINA_APP_KEY,
      consumerSecret: SINA_APP_SECRET,
      tokenSecret: SinaMicroblog.currentUserOauthTokenSecret
    };
    var header = SinaMicroblog.getAuthorizationHeader(message, accessor);

    ajax({
      url: SINA_ACCESS_TOKEN_URL,
      method: 'POST',
      headers: {
        'Authorization': header
      },
      success: function(response) {
        var responseMap = {};
        response.split('&').forEach(function(parameter) {
          responseMap[parameter.split('=')[0]] = parameter.split('=')[1];
        });

        var userId = responseMap.user_id;
        var accessToken = responseMap.oauth_token;
        var accessTokenSecret = responseMap.oauth_token_secret;
        var user = new User({
          id: userId,
          accessToken: accessToken,
          accessTokenSecret: accessTokenSecret
        });

        callback('success', user);
      },
      status: {
        others: function(data) {
          callback('failure', 'sina_failed_to_get_access_token');
        }
      }
    });
  },

  getUserInfo: function(user, callback) {
    var url = SINA_USER_INFO_URL + '?user_id=' + user.id;
    var message = {
      action: url,
      method: 'POST',
      parameters: {
        'oauth_consumer_key': SINA_APP_KEY,
        'oauth_token': user.accessToken,
        'oauth_signature_method': OAUTH_SIGNATURE_METHOD,
        'oauth_version': OAUTH_VERSION
      }
    };

    var accessor = {
      consumerSecret: SINA_APP_SECRET,
      tokenSecret: user.accessTokenSecret
    };

    var header = SinaMicroblog.getAuthorizationHeader(message, accessor);
    ajax({
      url: url,
      method: 'POST',
      headers: {
        'Authorization': header
      },
      success: function(data) {
        if (callback) {
          user.name = data.name;
          callback('success', user);
        }
      },
      status: {
        others: function(data) {
          callback('failure', 'failed_to_get_user_info');
        }
      }
    });
  },

  upload: function(user, caption, imageData, callback) {
    caption = encodeURIComponent(caption);
    var message = {
      action: SINA_PHOTO_UPLOAD_URL,
      method: 'POST',
      parameters: {
        'oauth_consumer_key': SINA_APP_KEY,
        'oauth_token': user.accessToken,
        'oauth_signature_method': OAUTH_SIGNATURE_METHOD,
        'status': caption,
        'oauth_version': OAUTH_VERSION
      }
    };

    var accessor = {
      consumerSecret: SINA_APP_SECRET,
      tokenSecret: user.accessTokenSecret
    };

    var header = SinaMicroblog.getAuthorizationHeader(message, accessor);
    var params = {
      status: caption
    };
    var binaryData = {
      boundary: MULTIPART_FORMDATA_BOUNDARY,
      name: 'pic',
      value: 'test.png',
      data: imageData,
      type: 'image/png'
    };
    
    ajax({
      url: SINA_PHOTO_UPLOAD_URL,
      parameters: params,
      multipartData: binaryData,
      headers: {
        'Authorization': header
      },
      success: function(microblog) {
        callback('success', microblog.id);
      },
      status: {
        others: function(err, statusCode) {
          var message = 'failed_to_upload_image';
          if (statusCode == 400 &&
              message == '40072:Error: accessor was revoked!') {
            message = 'bad_access_token';
          }
          callback('failure', message);
        }
      }
    });
  },

  getPhotoLink: function(user, microblogId, callback) {
    var photoLink = 'http://api.t.sina.com.cn/' + user.id + '/statuses/' +
      microblogId;
    callback('success', photoLink);
  },
  
  logout: function(callback) {
    var params = {source: SINA_APP_KEY};
    ajax({
      url: SINA_LOGOUT_URL,
      parameters: params,
      complete: function(statusCode, data) {
        // Response status 403 means no user signed in
        if ((statusCode == 200 || statusCode == 403) && callback)
          callback(data);
      }
    });
  }
};