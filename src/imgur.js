(function() {
    const IMGUR_APP_KEY = '205e476089ae311c23fc7566f3d4471204dd89261';
    const IMGUR_APP_SECRET = '2d609b8757905272cdc7311bd6198db9';
    const IMGUR_REQUEST_TOKEN_URL = 'https://api.imgur.com/oauth/request_token';
    const IMGUR_USER_AUTHENTICATION_URL = 'https://api.imgur.com/oauth/authorize';
    const IMGUR_ACCESS_TOKEN_URL = 'https://api.imgur.com/oauth/access_token';
    const IMGUR_USER_INFO_URL = 'http://api.imgur.com/2/account.json';
    const IMGUR_PHOTO_UPLOAD_URL = 'http://api.imgur.com/2/account/images.json';
    const IMGUR_LOGOUT_URL = 'http://imgur.com/logout';
    const OAUTH_SIGNATURE_METHOD = 'HMAC-SHA1';
    const OAUTH_VERSION = '1.0';

    var Imgur = window.Imgur = {
      siteId: 'imgur',
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
        Imgur.accessTokenCallback = callback;
        var message = {
          action: IMGUR_REQUEST_TOKEN_URL,
          method: 'POST',
          parameters: {
            'oauth_consumer_key': IMGUR_APP_KEY,
            'oauth_signature_method': OAUTH_SIGNATURE_METHOD,
            'oauth_version': OAUTH_VERSION
          }
        };
        var accessor = {
          consumerKey: IMGUR_APP_KEY,
          consumerSecret: IMGUR_APP_SECRET
        };

        // Get oauth signature header
        var header = Imgur.getAuthorizationHeader(message, accessor);

        ajax({
            url: IMGUR_REQUEST_TOKEN_URL,
            method: 'POST',
            headers: {
              'Authorization': header
            },
            success: function(response) {
              console.debug(response);
              parameters = OAuth.getParameterMap(response);
              console.debug(parameters);
              var oauth_token = parameters['oauth_token'];
              var oauth_token_secret = parameters['oauth_token_secret'];
              Imgur.currentUserOauthToken = oauth_token;
              Imgur.currentUserOauthTokenSecret = oauth_token_secret;
              Imgur.getUserAuthentication(oauth_token);
            },
            status: {
              others: function() {
                callback('failure', 'imgur_failed_to_get_request_token');
              }
            }
          });
      },

      getUserAuthentication: function(oauth_token) {
        var url = IMGUR_USER_AUTHENTICATION_URL + '?oauth_token=' + oauth_token + '&oauth_callback=ready';
        chrome.tabs.create({url: url}, function(tab) {
            chrome.tabs.onUpdated.addListener(
              function(tabId, changeInfo, _tab) {
                if (tabId == tab.id && changeInfo.url
                    && changeInfo.url.indexOf('oauth_verifier=') > 0) {
                  chrome.tabs.remove(tabId);
                  Imgur.parseAccessToken(changeInfo.url);
                };
              });
          });
      },

      parseAccessToken: function(url) {
        var oauth_verifier = OAuth.getParameter(url, 'oauth_verifier');
        Imgur.getAccessToken(Imgur.accessTokenCallback, oauth_verifier);
        Imgur.accessTokenCallback = null;
      },

      getAccessToken: function(callback, oauth_verifier) {
        if (!oauth_verifier) {
          Imgur.getRequestToken(callback);
          return;
        }
        var message = {
          action: IMGUR_ACCESS_TOKEN_URL,
          method: 'POST',
          parameters: {
            'oauth_consumer_key': IMGUR_APP_KEY,
            'oauth_token': Imgur.currentUserOauthToken,
            'oauth_token_secret': Imgur.currentUserOauthTokenSecret,
            'oauth_signature_method': OAUTH_SIGNATURE_METHOD,
            'oauth_verifier': oauth_verifier,
            'oauth_version': OAUTH_VERSION
          }
        };
        var accessor = {
          consumerKey: IMGUR_APP_KEY,
          consumerSecret: IMGUR_APP_SECRET,
          tokenSecret: Imgur.currentUserOauthTokenSecret
        };
        var header = Imgur.getAuthorizationHeader(message, accessor);

        ajax({
            url: IMGUR_ACCESS_TOKEN_URL,
            method: 'POST',
            headers: {
              'Authorization': header
            },
            success: function(response) {
              responseMap = OAuth.getParameterMap(response);
              var accessToken = responseMap.oauth_token;
              var accessTokenSecret = responseMap.oauth_token_secret;
              var user = new User({
                  id: null,
                  accessToken: accessToken,
                  accessTokenSecret: accessTokenSecret
                });

              callback('success', user);
            },
            status: {
              others: function(data) {
                callback('failure', 'imgur_failed_to_get_access_token');
              }
            }
          });
      },

      getUserInfo: function(user, callback) {
        var url = IMGUR_USER_INFO_URL;
        var message = {
          action: url,
          method: 'GET',
          parameters: {
            'oauth_consumer_key': IMGUR_APP_KEY,
            'oauth_token': user.accessToken,
            'oauth_signature_method': OAUTH_SIGNATURE_METHOD,
            'oauth_version': OAUTH_VERSION
          }
        };

        var accessor = {
          consumerSecret: IMGUR_APP_SECRET,
          tokenSecret: user.accessTokenSecret
        };

        var header = Imgur.getAuthorizationHeader(message, accessor);
        ajax({
            url: url,
            method: 'GET',
            headers: {
              'Authorization': header
            },
            success: function(data) {
              if (callback) {
                user.id = data.account.url;
                user.name = data.account.url;
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
          action: IMGUR_PHOTO_UPLOAD_URL,
          method: 'POST',
          parameters: {
            'oauth_consumer_key': IMGUR_APP_KEY,
            'oauth_token': user.accessToken,
            'oauth_signature_method': OAUTH_SIGNATURE_METHOD,
            'oauth_version': OAUTH_VERSION
          }
        };
        var accessor = {
          consumerSecret: IMGUR_APP_SECRET,
          tokenSecret: user.accessTokenSecret
        };
        var header = Imgur.getAuthorizationHeader(message, accessor);

        var binaryData = {
          boundary: MULTIPART_FORMDATA_BOUNDARY,
          name: 'image',
          value: 'screencapture.png',
          data: imageData,
          type: 'image/png'
        };

        ajax({
            url: IMGUR_PHOTO_UPLOAD_URL,
            method: 'POST',
            multipartData: binaryData,
            headers: {
              'Authorization': header,
            },
            success: function(response) {
              console.debug('upload', response);
              callback('success', response.images.links.original);
            },
            status: {
              others: function(err, statusCode) {
                console.debug('upload error', err, statusCode);
                if (statusCode == 401) {
                  callback('failure', 'bad_access_token');
                } else {
                  callback('failure', 'failed_to_upload_image');
                };
              }
            }
          });
      },

      getPhotoLink: function(user, photoLink, callback) {
        callback('success', photoLink);
      },

      logout: function(callback) {
        ajax({
          url: IMGUR_LOGOUT_URL,
          success: function() {
            callback();
          }
        });
      }
    };
  })();
