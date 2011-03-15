// Copyright (c) 2010 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
  chrome.extension.onRequest.addListener(function(request, sender, response) {
    if (request.message == 'continueUpload') {
      localStorage['oauth_verifier'] = request.value;
      if (!uploadImage.is_get_verifier) {
        uploadImage.is_get_verifier = true;
        uploadImage.getAccessToken();
      }
    }
  });

  var uploadImage = {
    access_token : '',
    is_get_verifier: false,

    i18nReplace: function(id, name) {
      return $(id).innerHTML = chrome.i18n.getMessage(name);
    },

    init: function() {
      uploadImage.i18nReplace('uploadFile', 'upload_file');
      uploadImage.i18nReplace('cancelUpload', 'cancel_upload');
      uploadImage.i18nReplace('sina', 'sina');
      uploadImage.i18nReplace('facebook', 'facebook');
      uploadImage.i18nReplace('tUpload', 'upload');
      uploadImage.i18nReplace('selectPrompt', 'select_prompt');
      uploadImage.addEventListener();
    },

    checkTabStatus: function(tabId) {
      chrome.tabs.get(tabId, function(tab) {
        if (tab.status == 'complete' && !uploadImage.is_get_verifier) {
          chrome.tabs.executeScript(tabId, {file: 'get_oauth_verifier.js'});
          setTimeout('uploadImage.checkTabStatus(' + tabId + ')', 2000);
        } else {
          setTimeout('uploadImage.checkTabStatus(' + tabId + ')', 2000);
        }
      });
    },

    authorizeCallback: function(tab) {
      uploadImage.is_get_verifier = false;
      setTimeout('uploadImage.checkTabStatus(' + tab.id + ')', 1000);
    },

    getAccessToken: function() {
      var message = {
        action: 'http://api.t.sina.com.cn/oauth/access_token',
        method: 'POST',
        parameters:{
          'oauth_consumer_key': '1350884563',
          'oauth_token': localStorage['oauth_token'],
          'oauth_token_secret': localStorage['oauth_token_secret'],
          'oauth_signature_method': 'HMAC-SHA1',
          'oauth_verifier': localStorage['oauth_verifier'],
          'oauth_version': '1.0'
        }
      };
      var accessor = {
        consumerKey: '1350884563',
        consumerSecret: 'dd130d4873f31445a51cbb176f9630fe',
        tokenSecret: localStorage['oauth_token_secret']
      };
      OAuth.setTimestampAndNonce(message);
      OAuth.SignatureMethod.sign(message, accessor);
      var xhr = new XMLHttpRequest();
      xhr.onreadystatechange = function() {
        if (xhr.readyState == 4) {
          if (xhr.status == 200) {
            var params = xhr.responseText.split('&');
            localStorage['access_token'] = params[0].split('=')[1];
            localStorage['oauth_token_secret'] = params[1].split('=')[1];
            uploadImage.upload('sina', 'http://api.t.sina.com.cn/statuses/upload.xml');
          } else {
          }
        }
      }
      xhr.open('POST', 'http://api.t.sina.com.cn/oauth/access_token');
      var header = OAuth.getAuthorizationHeader("", message.parameters);
      xhr.setRequestHeader('Authorization', header);
      xhr.send();
    },

    authorizeSina: function(tabId) {
      var message = {
        action: 'http://api.t.sina.com.cn/oauth/request_token',
        method: 'POST',
        parameters:{
          'oauth_callback': document.URL,
          'oauth_consumer_key': '1350884563',
          'oauth_signature_method': 'HMAC-SHA1',
          'oauth_version': '1.0'
        }
      }
      var accessor = {
        consumerKey: '1350884563',
        consumerSecret: 'dd130d4873f31445a51cbb176f9630fe'
      };
      OAuth.setTimestampAndNonce(message);
      OAuth.SignatureMethod.sign(message, accessor);
      var xhr = new XMLHttpRequest();
      xhr.onreadystatechange = function() {
        if (xhr.readyState == 4) {
          if (xhr.status == 200) {
            var url = 'http://api.t.sina.com.cn/oauth/authorize?';
            var retvalue = xhr.responseText.split('&');
            localStorage['oauth_token'] = retvalue[0].split('=')[1];
            localStorage['oauth_token_secret'] = retvalue[1].split('=')[1];
            localStorage['upload_tabId'] = tabId;
            url += retvalue[0];
            url += "&oauth_callback=oob";// + chrome.extension.getURL('sina_authorize.html') + '?tabId=' + tabId;
            chrome.tabs.create({url: url}, uploadImage.authorizeCallback);
          } else {
            alert(decodeURIComponent(xhr.responseText));
          }
        }
      }
      xhr.open('POST', 'http://api.t.sina.com.cn/oauth/request_token');
      var header = OAuth.getAuthorizationHeader("", message.parameters);
      xhr.setRequestHeader('Authorization', header);
      xhr.send();
    },

    addEventListener: function() {
      $('selectSina').addEventListener('click', function(){
        $('selectFacebook').checked = false;
      }, false);
      $('selectFacebook').addEventListener('click', function(){
       $('selectSina').checked = false;
      }, false);
      $('uploadFile').addEventListener('click', function(){
        if($('selectSina').checked) {
          uploadImage.verifyUserIsLogon('sina', function(islogon) {
            if (islogon) {
              uploadImage.createUploadProgress();
              uploadImage.upload('sina',
                'http://api.t.sina.com.cn/statuses/upload.xml', '1350884563');
            } else {
              // photoshop.showTip('tip_failed', 'logon_tip');
              chrome.tabs.create({url: 'http://t.sina.com.cn'});
            }
          });
        } else if ($('selectFacebook').checked) {
          uploadImage.createUploadProgress();
          uploadImage.uploadImageToFacebook();
        } else {
          // photoshop.showTip('tip_failed', 'no_select_upload_position');
          return;
        }
        $('selectuploadposition').style.display = 'none';
      }, false);
      $('cancelUpload').addEventListener('click', function(){
        $('selectuploadposition').style.display = 'none';
      }, false);
    },

    getAppKey: function(app) {
      switch(app) {
        case 'sina' :
          return {AppKey:'1350884563', AppSecret: 'dd130d4873f31445a51cbb176f9630fe'};
          break ;
        case 'facebook' :
          return {AppID : '182294598468746', APIKey: '68ad5de371f63449b5f7b7e55f51cbcb',
              AppSecret: 'f7c253436bd281260073d4e9527a7457'};
          break;
      }
    },

    verifyUserIsLogon: function(app, callback) {
      if (app == 'sina') {
        var xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function() {
          if (xhr.readyState == 4) {
            if (xhr.status == 200) {
              var picNode = xhr.responseXML.documentElement.getElementsByTagName('id')[0];
              if (localStorage['currentSinaUser'] != picNode.textContent) {
                localStorage['access_token'] = '';
                localStorage['currentSinaUser'] = picNode.textContent;
              }
              if (callback)
                callback(true);
            } else if (xhr.status == 401) {
                callback(false);
            } else {
              callback(false);
            }
          }
        }
        xhr.open('GET', 'http://api.t.sina.com.cn/account/verify_credentials.xml?source=1350884563');
        xhr.send();
      }
    },

    upload: function(app, uploadUrl, token) {
      if (app == 'sina' && (!localStorage['access_token'] ||
          localStorage['access_token'] == '')) {
        chrome.tabs.getCurrent(function (tab) {
          uploadImage.authorizeSina(tab.id);
        });
        return;
      }

      var dataUrl = $('canvas').toDataURL('image/png');
      var imgdataIndex = dataUrl.indexOf('data:image/png;base64,');
      if (imgdataIndex != 0) {
        return;
      }
      var imagedata = atob(dataUrl.substr(imgdataIndex+22));
      var xhr = new XMLHttpRequest();
      XMLHttpRequest.prototype.sendAsBinary = function(text) {
        var data = new ArrayBuffer(text.length);
        var ui8a = new Uint8Array(data);
        for (var i = 0; i < text.length; i++) {
          ui8a[i] = (text.charCodeAt(i) & 0xff);
        }
        var bb = new BlobBuilder();
        bb.append(data);
        var blob = bb.getBlob();
        this.send(blob);
      }

      xhr.onreadystatechange = function() {
        if (xhr.readyState == 4) {
          if(app == 'sina') {
            if (xhr.status == 200) {
              var picNode = xhr.responseXML.documentElement.getElementsByTagName('original_pic')[0];
              // photoshop.showLink('tip_succeed', 'upload_succeed', picNode.textContent);
            }  else if (xhr.status == 403) {
              chrome.tabs.create({url: 'http://t.sina.com.cn/login.php'});
            } else {
              $('selectuploadposition').style.display = 'none';
              // photoshop.showTip('tip_failed', 'upload_failed');
            }
          } else if (app == 'facebook') {
            if (xhr.status == 200 && xhr.responseXML != null) {
              var rootname = xhr.responseXML.documentElement.nodeName;
              if (rootname == 'error_response') {
                // photoshop.showTip('tip_failed', 'upload_failed');
              } else if (rootname == 'photos_upload_response') {
                var picNode = xhr.responseXML.documentElement.getElementsByTagName('src_big')[0];
                // photoshop.showLink('tip_succeed', 'upload_succeed', picNode.textContent);
              } else {
                // photoshop.showTip('tip_failed', 'upload_failed');
              }
            }
          }
          document.body.removeChild($('uploadProgress'));
        }
      }

      xhr.upload.addEventListener('progress', function (e) {
        if (e.lengthComputable) {
          var percentage = Math.round((e.loaded * 100) / e.total);
           var uploadProgress = $('uploadProgress');
           uploadProgress.innerText = chrome.i18n.getMessage('uploading_image') + percentage + "%";
        }
      }, false);

      xhr.open('POST', uploadUrl);
      var boundary = 'GOOGLESCREENCAPTURE';
      xhr.setRequestHeader('Content-Type',
          'multipart/form-data, boundary='+boundary);
      var body = '';
      body += "--" + boundary + "\r\n";
      if(app == 'sina') {
        var caption = '你好' + parseInt(Math.random()*100000000000) + "随机数";
        var message = {
          action: uploadUrl,
          method: 'POST',
          parameters:{
            'oauth_consumer_key': '1350884563',
            'oauth_token': localStorage['access_token'],
            'oauth_signature_method': 'HMAC-SHA1',
            'status': encodeURIComponent(caption),
            'oauth_version': '1.0'
          }
        }
        var accessor = {
          consumerSecret: 'dd130d4873f31445a51cbb176f9630fe',
          tokenSecret: localStorage['oauth_token_secret']
        };
        OAuth.setTimestampAndNonce(message);
        OAuth.SignatureMethod.sign(message, accessor);

        var header = OAuth.getAuthorizationHeader("", message.parameters);
        xhr.setRequestHeader('Authorization', header);

        body += 'Content-Disposition: form-data; name=\"status\"\r\n\r\n';
        body += encodeURIComponent(caption)+"\r\n";
        body += '--' + boundary + '\r\n';
        body += 'Content-Disposition: form-data; name=\"pic\"; filename=\"test.png\"\r\n';
      } else {
        body += 'Content-Disposition: form-data; name=\"access_token\"\r\n\r\n';
        body += token+'\r\n';
        body += '--' + boundary + '\r\n';
        body += 'Content-Disposition: form-data; name=\"aid\"\r\n\r\n';
        body += 'Screen Capture Upload Album\r\n';
        body += '--' + boundary + '\r\n';
        body += 'Content-Disposition: form-data; filename=\"test.png\"\r\n';
      }
      body += 'Content-type: image/png\r\n\r\n';
      body += imagedata + '\r\n';
      body += '--' + boundary + '--\r\n';
      xhr.sendAsBinary(body);
    },

    createUploadProgress: function () {
      var div = document.createElement('DIV');
      div.className = 'tip_succeed';
      div.id = 'uploadProgress';
      document.body.appendChild(div);
      div.style.left = (document.body.clientWidth - div.clientWidth) / 2 + 'px';
    },

    uploadImageToFacebook: function() {
      if(''==uploadImage.access_token) {
        var url =' https://graph.facebook.com/oauth/authorize?'+
            'client_id=182294598468746&redirect_uri=http://www'+
            '.facebook.com/connect/login_success.html&scope='+
            'user_photos,user_videos,publish_stream';
        chrome.tabs.create({url: url}, function(tab) {
          chrome.tabs.onUpdated.addListener(function(tabId, changeinfo, tab){
            if (changeinfo.url) {
              var allowUrlIndex = changeinfo.
                  url.indexOf('http://www.facebook.com/connect/login_success.html?code=');
              var denyUrlIndex = changeinfo.url.indexOf
                  ('http://www.facebook.com/connect/login_success.html?error_reason=user_denied');
              if (allowUrlIndex != -1) {
                var codeURL = changeinfo.url.substr(changeinfo.url.indexOf('='), changeinfo.url.length);
                var url = 'https://graph.facebook.com/oauth/access_token?'+
                    'client_id=182294598468746&redirect_uri=http://www.fac'+
                    'ebook.com/connect/login_success.html&client_secret=f7'+
                    'c253436bd281260073d4e9527a7457&code' + codeURL;
                uploadImage.requestFacebook(url);
                var executeCode = 'document.body.innerHTML = "' +
                    "<div style='position:absolute; top:20%; left: 20%;'>"+
                    "<table><tr><td><img src='"+chrome.extension.getURL('images/facebook.gif')+"'></td><td >" +
                    "<a style='color: #547ABC; font-size: 30px;' href='http://www.fac" +
                    "ebook.com'>http://www.facebook.com</a></td></tr></table></div>" +'"';
                chrome.tabs.executeScript(tabId, {code: executeCode});
              } else if (denyUrlIndex != -1) {
                // photoshop.showTip('tip_failed', 'upload_failed');
              }
            }
          });
        });
      } else {
        uploadImage.upload('facebook',
            'https://api.facebook.com/method/photos.upload?caption=你好，这是测试图片',
            uploadImage.access_token);
      }
    },

    requestFacebook: function(url) {
      var xmlHttp=new XMLHttpRequest();
      xmlHttp.onreadystatechange=function() {
        if(xmlHttp.readyState==4) {
          uploadImage.access_token = xmlHttp.responseText.split('=')[1].split('&')[0];
          uploadImage.upload('facebook',
              'https://api.facebook.com/method/photos.upload?caption=你好，这是测试图片',
              uploadImage.access_token);
        }
      }
      xmlHttp.open("GET",url,false);
      xmlHttp.send(null);
    }
  }

