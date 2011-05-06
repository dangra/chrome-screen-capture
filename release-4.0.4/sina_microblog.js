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
  currentUserOauthToken: '',
  currentUserOauthTokenSecret: '',

  getAuthorizationHeader: function(message, accessor) {
    OAuth.setTimestampAndNonce(message);
    OAuth.SignatureMethod.sign(message, accessor);
    return OAuth.getAuthorizationHeader("", message.parameters);
  },

  getRequestToken: function() {
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
        others: function(data) {
          var msg = chrome.i18n.getMessage('sina_failed_to_get_request_token');
          UploadUI.showErrorInfo(msg);
          console.log(data);
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

  parseAccessTokenResult: function(url) {
    var queryString = url.split('?')[1];
    var oauthVerifier = queryString.split('&')[1].split('=')[1];
    SinaMicroblog.getAccessToken(oauthVerifier);
  },

  getAccessToken: function(oauth_verifier) {
    if (!oauth_verifier) {
      SinaMicroblog.getRequestToken();
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
        if (Account.getUser(SinaMicroblog.siteId, userId)) {
          UploadUI.hideAuthenticationProgress();
          UploadUI.upload(SinaMicroblog.siteId, userId);
        } else {
          var access_token = responseMap.oauth_token;
          var access_token_secret = responseMap.oauth_token_secret;

          // Get user screen name
          SinaMicroblog.getUserInfo(access_token, access_token_secret, userId,
            function(data) {
              var siteId = SinaMicroblog.siteId;
              var userName = data.name;
              var user = new User(userId, userName, access_token,
                access_token_secret);
              Account.addUser(siteId, user);
              UploadUI.addAuthenticatedAccount(siteId, userId);
              UploadUI.hideAuthenticationProgress();
              UploadUI.upload(siteId, userId);
          });
        }
      },
      status: {
        others: function(data) {
          var msg = chrome.i18n.getMessage('sina_failed_to_get_access_token');
          UploadUI.showErrorInfo(msg);
          console.log(data);
        }
      }
    });
  },

  getUserInfo: function(access_token, access_token_secret, userId, callback) {
    var url = SINA_USER_INFO_URL + '?user_id=' + userId;
    var message = {
      action: url,
      method: 'POST',
      parameters: {
        'oauth_consumer_key': SINA_APP_KEY,
        'oauth_token': access_token,
        'oauth_signature_method': OAUTH_SIGNATURE_METHOD,
        'oauth_version': OAUTH_VERSION
      }
    };

    var accessor = {
      consumerSecret: SINA_APP_SECRET,
      tokenSecret: access_token_secret
    };

    var header = SinaMicroblog.getAuthorizationHeader(message, accessor);
    ajax({
      url: url,
      method: 'POST',
      headers: {
        'Authorization': header
      },
      success: function(data) {
        if (callback)
          callback(data);
      },
      status: {
        others: function(data) {
          var msg = chrome.i18n.getMessage('sina_failed_to_get_user_info');
          UploadUI.showErrorInfo(msg);
          console.log(data);
        }
      }
    });
  },

  upload: function(access_token, access_token_secret, caption, successCallback,
                   progressCallback, failureCallback) {
    caption = encodeURIComponent(caption);
    
    // Get photo binary data
    var photoData = UploadUI.getPhotoData();
    var message = {
      action: SINA_PHOTO_UPLOAD_URL,
      method: 'POST',
      parameters: {
        'oauth_consumer_key': SINA_APP_KEY,
        'oauth_token': access_token,
        'oauth_signature_method': OAUTH_SIGNATURE_METHOD,
        'status': caption,
        'oauth_version': OAUTH_VERSION
      }
    };

    var accessor = {
      consumerSecret: SINA_APP_SECRET,
      tokenSecret: access_token_secret
    };

    var header = SinaMicroblog.getAuthorizationHeader(message, accessor);
    var params = {
      status: caption
    };
    var binaryData = {
      boundary: MULTIPART_FORMDATA_BOUNDARY,
      name: 'pic',
      value: 'test.png',
      data: photoData,
      type: 'image/png'
    };
    ajax({
      url: SINA_PHOTO_UPLOAD_URL,
      parameters: params,
      multipartFormData: binaryData,
      headers: {
        'Authorization': header
      },
      success: successCallback,
      progress: progressCallback,
      status: {
        others: function(err) {
          console.log(err);
          failureCallback(err);
        }
      }
    });
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