const FB_APP_ID = CURRENT_LOCALE == 'zh_CN' ? 170328509685996 : 118170701590738;
const FB_REDIRECT_URI = 'http://www.facebook.com/connect/login_success.html';
const FB_PERMISSION = 'offline_access,user_photos,publish_stream';
const FB_ACCESS_TOKEN_URL = 'https://www.facebook.com/dialog/oauth';
const FB_PHOTO_UPLOAD_URL = 'https://graph.facebook.com/me/photos';
const FB_USER_INFO_URL = 'https://graph.facebook.com/me';
const FB_LOGOUT_URL = 'http://m.facebook.com/logout.php?confirm=1';

var Facebook = {
  siteId: 'facebook',
  currentUserId: null,

  getAccessToken: function() {
    var url = FB_ACCESS_TOKEN_URL + '?client_id=' + FB_APP_ID +
      '&redirect_uri=' + FB_REDIRECT_URI + '&scope=' + FB_PERMISSION +
      '&response_type=token';
    chrome.tabs.create({url: url});
  },

  parseAccessTokenResult: function(url) {
    var queryString = url.split('#')[1] || url.split('?')[1];
    var queries = queryString.split('&');
    var queryMap = {};
    queries.forEach(function(pair) {
      queryMap[pair.split('=')[0]] = pair.split('=')[1];
    });
    var access_token = queryMap['access_token'];
    if (access_token) {
      Facebook.getUserInfo(access_token, function(data) {
        var userId = data.id;
        var siteId = Facebook.siteId;
        if (!Account.getUser(siteId, userId)) {
          var userName = data.name;
          Facebook.currentUserId = userId;
          var user = new User(userId, userName, access_token);
          Account.addUser(siteId, user);
          UploadUI.addAuthenticatedAccount(siteId, userId);
        }
        UploadUI.hideAuthenticationProgress();
        UploadUI.upload(siteId, userId);
      });
    } else if (queryMap['error']) {
      // Show error information according to error reason
      UploadUI.showErrorInfo(chrome.i18n.getMessage('facebook_user_denied'));
      UploadUI.hideAuthenticationProgress();
    }
  },

  setAccessToken: function(fb_access_token) {
    localStorage['fb_access_token'] = fb_access_token;
  },

  upload: function(access_token, caption, photoData, successCallback,
                   progressCallback, failureCallback) {
    var params = {
      'access_token': access_token,
      message: caption
    };
    
    var binaryData = {
      boundary: MULTIPART_FORMDATA_BOUNDARY,
      data: photoData,
      value: 'test.png',
      type: 'image/png'
    };
    
    ajax({
      url: FB_PHOTO_UPLOAD_URL,
      parameters: params,
      multipartFormData: binaryData,
      success: function(data) {
        if (successCallback)
          successCallback(JSON.parse(data).id);
      },
      status: {
        others: function(data) {
          console.log('Bad access_token');
          failureCallback(data);
        }
      },
      progress: progressCallback
    });
  },

  getUserInfo: function(access_token, callback) {
    ajax({
      url: FB_USER_INFO_URL,
      parameters: {
        'access_token': access_token
      },
      success: function(userInfo) {
        var user = JSON.parse(userInfo);
        if (callback && callback.constructor == Function)
          callback(user);
      }
    });
  },

  getPhotoLink: function(access_token, photoId, callback) {
    ajax({
      url: 'https://graph.facebook.com/' + photoId,
      parameters: {
        'access_token': access_token
      },
      success: function(data) {
        if (callback && callback.constructor == Function)
          callback(JSON.parse(data));
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