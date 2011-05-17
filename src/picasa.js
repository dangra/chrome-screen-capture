(function() {
  const ALBUM_NAME = 'Screen Capture';
  const CLIENT_ID = '368358534491.apps.googleusercontent.com';
  const AUTH_URL = 'https://accounts.google.com/o/oauth2/auth';
  const REDIRECT_URI = 'https://picasaweb.google.com';
  const SCOPE = 'https://picasaweb.google.com/data/';
  const RESPONSE_TYPE = 'token';
  const ALBUM_URL = 'https://picasaweb.google.com/data/feed/api/user/' +
    'default';
  const CREATE_ALBUM_URL = 'https://picasaweb.google.com/data/feed/api/user/' +
    'default';
  const UPLOAD_BASE_URL = 'https://picasaweb.google.com/data/feed/api/user/' +
    'default/albumid/';
  const LOGOUT_URL = 'https://picasaweb.google.com/bye?continue=' +
    'https://www.google.com/accounts/Logout?continue=' +
    'https://picasaweb.google.com';

  // var picasa = window.Picasa = new Site('picasa');
  var picasa = window.Picasa = {
    siteId: 'picasa',
    currentUserId: null,
    redirectUrl: REDIRECT_URI,
    accessTokenCallback: null,
    
    getAccessToken: function(callback) {
      picasa.accessTokenCallback = callback;
      var url = AUTH_URL + '?client_id=' + CLIENT_ID + '&redirect_uri=' +
        REDIRECT_URI + '&scope=' + SCOPE + '&response_type=' + RESPONSE_TYPE;
      chrome.tabs.create({ url: url});
    },

    parseRedirectUrl: function(url) {
      var result = false;
      if (url.indexOf(REDIRECT_URI) == 0) {
        var accessTokenRegexp = /^access_token=(.+)&expires_in=(\d+)$/;
        var hash = url.split('#')[1];
        if (hash) {
          var match = accessTokenRegexp.exec(hash);
          if (match) {
            result = {
              accessToken: match[1],
              expires: match[2]
            };
          }
        } else {
          var search = url.split('?')[1];
          if (search == 'error=access_denied')
            result = 'access_denied';
        }
      }
      return result;
    },
    
    isRedirectUrl: function(url) {
      return picasa.parseRedirectUrl(url) != false;
    },
    
    parseAccessToken: function(redirectUrl) {
      var parsedResult = picasa.parseRedirectUrl(redirectUrl);
      if (parsedResult && typeof parsedResult == 'object') {
        var user = new User({
          accessToken: parsedResult.accessToken,
          expires: new Date().getTime() + parsedResult.expires * 1000
        });
        picasa.accessTokenCallback('success', user);
      } else {
        picasa.accessTokenCallback('failure', 'user_denied');
      }
      picasa.accessTokenCallback = null;
    },
    
    getUserInfo: function(user, callback) {
      ajax({
        url: ALBUM_URL,
        parameters: {
          fields: 'title,gphoto:nickname,entry/title,entry/gphoto:id',
          alt: 'json'
        },
        success: function(res) {
          var userId = res.feed.title.$t;
          var userName = res.feed.gphoto$nickname.$t;
          user.id = userId;
          user.name = userName;
          
          var albums = res.feed.entry;
          var length = albums.length;

          // Check if user has created album "Screen Capture".
          for (var i = 0; i < length; i++) {
            var albumName = albums[i].title.$t;
            if (albumName == ALBUM_NAME) {
              user.albumId = albums[i].gphoto$id.$t;
              break;
            }
          }

          // Create album "Screen Capture" and retrieve album id.
          if (!user.albumId) {
            picasa.createAlbum(user.accessToken, function(result,
                                                          albumIdOrMessage) {
              if (result == 'success') {
                user.albumId = albumIdOrMessage;
                callback('success', user);
              } else {
                callback('failure', albumIdOrMessage);
              }
            });
          } else {
            callback('success', user);
          }
        },
        status: {
          404: function() {
            callback('failure', 'failed_to_get_user_info');
          }
        }
      });
    },

    createAlbum: function(accessToken, callback) {
      var data = '<entry xmlns="http://www.w3.org/2005/Atom" ' +
        'xmlns:media="http://search.yahoo.com/mrss/" ' +
        'xmlns:gphoto="http://schemas.google.com/photos/2007">' +
        '<title type="text">' + ALBUM_NAME +
        '</title><category scheme="http://schemas.google.com/g/2005#kind" ' +
        'term="http://schemas.google.com/photos/2007#album"></category>' +
        '</entry>';

      ajax({
        method: 'POST',
        url: CREATE_ALBUM_URL,
        parameters: {
          alt: 'json'
        },
        data: data,
        headers: {
          'GData-Version': 2,
          'Content-Type': 'application/atom+xml',
          'Authorization': 'OAuth ' + accessToken
        },
        complete: function(statusCode, album) {
          if (statusCode == 201) {
            var albumId = album.entry.gphoto$id.$t;
            callback('success', albumId);
          } else {
            callback('failure', 'failure_to_create_album')
          }
        }
      });
    },

    upload: function(user, caption, imageData, callback) {
      caption = ajax.convertEntityString(caption);
      caption = ajax.encodeForBinary(caption);

      var imageFile = new Date().getTime() + '.png';
      var headers = {
        'GData-Version': 2,
        'Content-Type': 'multipart/related; boundary=' +
          MULTIPART_FORMDATA_BOUNDARY,
        'Authorization': 'OAuth ' + user.accessToken
      };

      var captionData = '<entry xmlns="http://www.w3.org/2005/Atom">' +
        '<title>' + imageFile + '</title>' +
        '<summary>' + caption + '</summary>' +
        '<category scheme="http://schemas.google.com/g/2005#kind" ' +
        'term="http://schemas.google.com/photos/2007#photo"/></entry>';

      var dataPart1 = {
        contentType: 'application/atom+xml',
        data: captionData
      };
      var dataPart2 = {
        contentType: 'image/png',
        data: imageData
      };
      var multipartData = {
        boundary: MULTIPART_FORMDATA_BOUNDARY,
        dataList: [dataPart1, dataPart2]
      };

      ajax({
        url: UPLOAD_BASE_URL + user.albumId + '?alt=json',
        headers: headers,
        multipartData: multipartData,
        complete: function(statusCode, res) {
          if (statusCode == 201) {
            var link = res.entry.link;
            callback('success', link);
          } else {
            var message = 'failed_to_upload_image';
            if (statusCode == 403) {
              // bad access token
              message = 'bad_access_token';
            } else if (statusCode == 404 && res == 'No album found.') {
              // Invalid album id.
              message = 'invalid_album_id'
            }
            callback('failure', message);
          }
        }
      });
    },

    getPhotoLink: function(user, photolinks, callback) {
      for (var i = 0; i < photolinks.length; i++) {
        var link = photolinks[i];
        if (link.type == 'text/html' &&
            link.rel == 'http://schemas.google.com/photos/2007#canonical') {
          callback('success', link.href);
          break;
        }
      }
    },

    logout: function(callback) {
      ajax({
        url: LOGOUT_URL,
        success: function() {
          callback();
        }
      });
    }
  };
})();