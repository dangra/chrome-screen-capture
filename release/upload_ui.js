const CURRENT_LOCALE = chrome.i18n.getMessage('@@ui_locale');
const MULTIPART_FORMDATA_BOUNDARY = 'Google_Chrome_Screen_Capture';
const HIDE_ERROR_INFO_DELAY_TIME = 5000;

var UI = {

  show: function(element) {
    if (UI.getStyle(element, 'display') == 'none') {
      // Set display value to be defined by style sheet
      var cssRules = window.getMatchedCSSRules(element, '', true);
      var ruleLength = cssRules.length;
      var display;
      for (var i = ruleLength - 1; i >= 0 ; --i) {
        display = cssRules[i].style.display;
        if (display && display != 'none') {
          element.style.display = display;
          return;
        }
      }

      // Set display value to be UA default value
      var tmpElement = document.createElement(element.nodeName);
      document.body.appendChild(tmpElement);
      display = UI.getStyle(tmpElement, 'display');
      document.body.removeChild(tmpElement);
      element.style.display = display;
    }
  },

  hide: function(element) {
    element.style.display = 'none';
  },

  setStyle: function(element) {
    var argLength = arguments.length;
    var arg1 = arguments[1];
    if (argLength == 2 && arg1.constructor == Object) {
      for (var prop in arg1) {
        var camelCasedProp = prop.replace(/-([a-z])/gi, function(n, letter) {
          return letter.toUpperCase();
        });
        element.style[camelCasedProp] = arg1[prop];
      }
    } else if (argLength == 3)
      element.style[arg1] = arguments[2];
  },

  getStyle: function(element, property) {
    return window.getComputedStyle(element)[property];
  },

  addClass: function(element, className) {
    var classes = element.className.split(' ');
    classes.push(className);
    element.className = classes.join(' ');
  },

  removeClass: function(element, className) {
    var classes = element.className.split(' ');
    var index = classes.indexOf(className);
    if (index >= 0) {
      classes.splice(index, 1);
      element.className = classes.join(' ');
    }
  },

  addStyleSheet: function(path) {
    var link = document.createElement('link');
    link.setAttribute('type', 'text/css');
    link.setAttribute('rel', 'stylesheet');
    link.setAttribute('href', path);
    document.head.appendChild(link);
  }
};

var UploadUI = {
  currentSite: '',
  uploading: false,

  setUploadState: function(state) {
    UploadUI.uploading = state;
  },

  init: function() {
    // Import style sheet for current locale
    UI.addStyleSheet('./i18n_styles/' + CURRENT_LOCALE + '_upload_image.css');

    // Get i18n message
    i18nReplace('shareToSinaMicroblogText', SinaMicroblog.siteId +
      '_upload_header');
    i18nReplace('shareToFacebookText', Facebook.siteId + '_upload_header');
    i18nReplace('lastStep', 'return_to_site_selection');
    i18nReplace('closeUploadWrapper', 'close_upload_wrapper');
    i18nReplace('imageCaptionText', 'image_caption');
    i18nReplace('photoSizeTip', 'photo_size_tip');
    $('requiredFlag').setAttribute('title',
      chrome.i18n.getMessage('invalid_caption'));

    // Add event listeners
    $('btnUpload').addEventListener('click', UploadUI.showUploadWrapper,
      false);
    $('closeUploadWrapper').addEventListener('click',
      UploadUI.hideUploadWrapper, false);
    $('facebookBtn').addEventListener('click', function() {
      UploadUI.showUploadContentWrapper(Facebook.siteId);
    }, false);
    $('sinaMicroblogBtn').addEventListener('click', function() {
      UploadUI.showUploadContentWrapper(SinaMicroblog.siteId);
    }, false);
    $('shareToOtherAccount').addEventListener('click', function() {
      var currentSite = UploadUI.currentSite;

      // Validate image description first
      if (UploadUI.validatePhotoDescription(currentSite)) {
        var callback = function() {
          var authenticationTip =
            chrome.i18n.getMessage('user_authentication_tip');
          UploadUI.showAuthenticationProgress(authenticationTip);
          UploadUI.getAccessToken(currentSite);
        };
        var users = Account.getUsers(currentSite);
        var numberOfUsers = Object.keys(users).length;

        // Logout when user has authenticated app
        if (numberOfUsers) {
          var logoutTip = chrome.i18n.getMessage('user_logout_tip');
          UploadUI.showAuthenticationProgress(logoutTip);
          if (currentSite == Facebook.siteId)
            Facebook.logout(callback);
          else if (currentSite == SinaMicroblog.siteId)
            SinaMicroblog.logout(callback);
        } else {
          callback();
        }
      }
    }, false);
    $('lastStep').addEventListener('click', UploadUI.showUploadSitesWrapper,
      false);
  },

  showUploadWrapper: function() {
    var uploadWrapper = $('uploadWrapper');
    UI.show(uploadWrapper);

    // Reset upload wrapper position
    var viewportWidth = window.innerWidth;
    var viewportHeight = window.innerHeight;
    var wrapperWidth = uploadWrapper.offsetWidth;
    var wrapperHeight = uploadWrapper.offsetHeight;

    var left = (viewportWidth - wrapperWidth) / 2;
    var top = (viewportHeight - wrapperHeight) / 3;
    left = left < 0 ? 0 : left;
    top = top < 0 ? 0 : top;

    var scrollTop = document.body.scrollTop;
    var scrollLeft = document.body.scrollLeft;

    UI.setStyle(uploadWrapper, {
      top: top + scrollTop + 'px',
      left: left + scrollLeft + 'px'
    });
    UploadUI.showUploadSitesWrapper();
    UploadUI.showOverlay();
  },

  hideUploadWrapper: function() {
    UI.hide($('uploadWrapper'));
    UploadUI.hideOverlay();
  },

  showOverlay: function() {
    var overlay = $('overlay');
    UI.setStyle(overlay, {
      width: document.body.scrollWidth + 'px',
      height: document.body.scrollHeight + 'px'
    });
    UI.show($('overlay'));
  },

  hideOverlay: function() {
    UI.hide($('overlay'));
  },

  updateUploadHeader: function(title) {
    $('uploadHeader').firstElementChild.firstElementChild.innerText = title;
  },

  showUploadSitesWrapper: function() {
    var uploadHeader = chrome.i18n.getMessage('upload_sites_header');
    UploadUI.updateUploadHeader(uploadHeader);
    UI.show($('uploadSitesWrapper'));
    UploadUI.hideUploadContentWrapper();
    UI.hide($('lastStep'));
  },

  hideUploadSitesWrapper: function() {
    UI.hide($('uploadSitesWrapper'));
  },

  showUploadContentWrapper: function(site) {
    UploadUI.currentSite = site;

    // Update upload wrapper UI
    var uploadHeader = chrome.i18n.getMessage(site + '_upload_header');
    UploadUI.updateUploadHeader(uploadHeader);
    UploadUI.hideUploadSitesWrapper();
    UploadUI.hideErrorInfo();
    UploadUI.hideAuthenticationProgress();
    UploadUI.clearPhotoDescription();
    UI.show($('uploadContentWrapper'));
    UI.show($('lastStep'));
    UploadUI.updateShareToOtherAccountText(site);
    UploadUI.togglePhotoDescriptionRequiredFlag(site);

    // Show authenticated accounts of current site
    UploadUI.clearAccounts();
    var users = Account.getUsers(site);
    for (var userId in users) {
      UploadUI.addAuthenticatedAccount(site, userId);
    }
  },

  hideUploadContentWrapper: function() {
    UI.hide($('uploadContentWrapper'));
  },

  clearPhotoDescription: function() {
    $('imageCaption').value = '';
  },

  validatePhotoDescription: function(site) {
    var caption = $('imageCaption');
    var invalidCaptionMsg = chrome.i18n.getMessage('invalid_caption');

    // Validate photo description
    if (site == SinaMicroblog.siteId && caption.value == '') {
      UploadUI.showErrorInfo(invalidCaptionMsg);
      caption.focus();
      return false;
    }
    return true;
  },

  togglePhotoDescriptionRequiredFlag: function(siteId) {
    if (siteId == SinaMicroblog.siteId)
      UI.show($('requiredFlag'));
    else
      UI.hide($('requiredFlag'));
  },

  updateShareToOtherAccountText: function(siteId) {
    var users = Account.getUsers(siteId);
    var userLength = Object.keys(users).length;
    if (userLength)
      i18nReplace('shareToOtherAccount', 'share_to_other_account');
    else
      i18nReplace('shareToOtherAccount', 'share_to_' + siteId + '_account');
  },

  showErrorInfo: function(text) {
    UI.show($('errorWrapper'));
    $('errorInfo').innerHTML = text;
    setTimeout(function() {
      UploadUI.hideErrorInfo();
    }, HIDE_ERROR_INFO_DELAY_TIME);
  },

  hideErrorInfo: function() {
    UI.hide($('errorWrapper'));
  },

  showProgressBar: function(accountId) {
    var progress = document.querySelector('#' + accountId +
      ' .progressBar');
    UI.show(progress);
  },

  hideProgressBar: function(accountId) {
    var progress = document.querySelector('#' + accountId +
      ' .progressBar');
    UI.hide(progress);
  },

  showAuthenticationProgress: function(title) {
    var progress = $('authenticationProgress');
    progress.setAttribute('title', title);
    UI.show(progress);
  },

  hideAuthenticationProgress: function() {
    UI.hide($('authenticationProgress'));
  },

  setProgress: function(accountId, loaded, total) {
    console.log('In setProgress, loaded: ' + loaded + ', total: ' + total);
    var progress = document.querySelector('#' + accountId + ' .progressBar');

    // One progress bar has 4 parts to represent progress
    var level = parseInt(loaded / total / 0.25);
    UI.setStyle(progress, 'background-position-y', '-' + (12 * level) + 'px');
  },

  showPhotoLink: function(accountId, link) {
    var photoLink = document.querySelector('#' + accountId + ' .photoLink');
    photoLink.setAttribute('href', link);
    UI.setStyle(photoLink, 'display', 'inline');
  },

  hidePhotoLink: function(accountId) {
    var photoLink = document.querySelector('#' + accountId + ' .photoLink');
    UI.hide(photoLink);
  },

  showUploadInfo: function(accountId, text) {
    var uploadInfo = document.querySelector('#' + accountId + ' .uploadInfo');
    uploadInfo.innerHTML = text;
    UI.show(uploadInfo);
  },

  hideUploadInfo: function(accountId) {
    var uploadInfo = document.querySelector('#' + accountId + ' .uploadInfo');
    UI.hide(uploadInfo);
  },

  clearAccounts: function() {
    $('uploadAccountList').innerHTML = '';
  },

  addAuthenticatedAccount: function(site, userId) {
    var template = $('accountItemTemplate').innerHTML;

    // Replace i18n message
    template = template.replace(/\$\{accountId\}/gi, site + '_' + userId);
    var shareToText = chrome.i18n.getMessage('share_to');
    template = template.replace(/\$\{accountName\}/gi,
      shareToText + ' ' + Account.getUser(site, userId)['name']);
    template = template.replace('${site}', site);
    template = template.replace('${userId}', userId);
    template = template.replace(/\$\{deletionTitle\}/gi,
      chrome.i18n.getMessage('deletion_title'));
    template = template.replace(/\$\{photoLinkText\}/gi,
      chrome.i18n.getMessage('photo_link_text'));
    template = template.replace(/\$\{progressInfo\}/gi,
      chrome.i18n.getMessage('progress_info'));

    // At most show 3 authenticated users
    var uploadAccountList = $('uploadAccountList');
    var accountsNumber = uploadAccountList.childElementCount;
    if (accountsNumber == 3) {
      uploadAccountList.removeChild(uploadAccountList.lastElementChild);
    }
    uploadAccountList.innerHTML = template + uploadAccountList.innerHTML;

    UploadUI.updateShareToOtherAccountText(site);
  },

  deleteAccountItem: function(accountId, noConfirm) {
    if (UploadUI.uploading)
      return;
    var confirmText = chrome.i18n.getMessage('account_deletion_confirm');
    if (noConfirm || confirm(confirmText)) {
      $('uploadAccountList').removeChild($(accountId));

      // Clear localStorage
      var site = accountId.split('_')[0];
      var userId = accountId.split('_')[1];
      Account.removeUser(site, userId);
      UploadUI.updateShareToOtherAccountText(site);
    }
  },

  upload: function(site, userId) {
    if (UploadUI.uploading)
      return;

    // Initialize UI
    var accountId = site + '_' + userId;
    UploadUI.hideErrorInfo();
    UploadUI.hideUploadInfo(accountId);
    UploadUI.hidePhotoLink(accountId);
    if (!UploadUI.validatePhotoDescription(site))
      return;
    var caption = $('imageCaption');

    UploadUI.setUploadState(true);
    photoshop.draw();
    var access_token = Account.getUser(site, userId)['accessToken'];
    var infoText;
    var successCallback;
    var failureCallback;

    UploadUI.showProgressBar(accountId);
    if (site == Facebook.siteId) {
      Facebook.currentUserId = userId;
      if (access_token) {
        successCallback = function(photoId) {
          console.log('Upload success.');
          UploadUI.hideProgressBar(accountId);
          infoText = chrome.i18n.getMessage('facebook_get_photo_link');
          UploadUI.showUploadInfo(accountId, infoText);
          Facebook.getPhotoLink(access_token, photoId, function(data) {
            UploadUI.setUploadState(false);
            UploadUI.hideUploadInfo(accountId);
            UploadUI.showPhotoLink(accountId, data.link);
          });
        };
        failureCallback = function(data) {
          console.log('Upload failed.');
          UploadUI.setUploadState(false);
          UploadUI.hideProgressBar(accountId);
          if (data) {
            data = JSON.parse(data);
            if (data.error.message.indexOf('access token') >= 0) {
              infoText = chrome.i18n.getMessage('facebook_bad_access_token');
              // User removed application permission
              // {"error":{"type":"OAuthException",
              // "message":"Error validating access token."}}
              Account.removeUser(Facebook.siteId, Facebook.currentUserId);
              UploadUI.deleteAccountItem(accountId, true);
              Facebook.getAccessToken();
            } else {
              // {"error":{"type":"OAuthException",
              // "message":"(#1) An unknown error occurred"}}
              infoText = chrome.i18n.getMessage('facebook_unknown_error');
            }
          } else {
            infoText = chrome.i18n.getMessage('failed_to_connect_to_server');
          }

          UploadUI.showErrorInfo(infoText);
        };

        var captionValue = ajax.encodeForBinary(caption.value);
        var photoData = UploadUI.getPhotoData();
        Facebook.upload(access_token, captionValue, photoData, successCallback,
          null, failureCallback);
      } else {
        Facebook.getAccessToken();
      }
    } else if (site == SinaMicroblog.siteId) {
      if (access_token) {
        var access_token_secret =
          Account.getUser(site, userId)['accessTokenSecret'];
        successCallback = function(data) {
          UploadUI.setUploadState(false);
          UploadUI.hideProgressBar(accountId);
          var microblogId = data.id;
          var url = 'http://api.t.sina.com.cn/' + userId + '/statuses/' +
            microblogId; // + '?source=' + SINA_APP_KEY;
          UploadUI.showPhotoLink(accountId, url);
        };
        failureCallback = function(errorData) {
          UploadUI.hideProgressBar(accountId);
          UploadUI.setUploadState(false);
          infoText = errorData.error;
          UploadUI.showErrorInfo(infoText);
        };
        SinaMicroblog.upload(access_token, access_token_secret, caption.value,
          successCallback, null, failureCallback);
      } else {
        SinaMicroblog.getAccessToken();
      }
    }
  },

  getAccessToken: function(site) {
    if (site == Facebook.siteId) {
      Facebook.getAccessToken();
    } else if (site == SinaMicroblog.siteId) {
      SinaMicroblog.getAccessToken();
    }
  },

  getPhotoData: function() {
    var dataUrl = $('canvas').toDataURL('image/png');
    var photoDataIndex = dataUrl.indexOf('data:image/png;base64,');
    if (photoDataIndex != 0) {
      return;
    }

    // Decode to binary data
    return atob(dataUrl.substr(photoDataIndex + 22));
  }
};

// Cache tab id of edit page, so that we can get tab focus after getting access
// token
var tabIdOfEditPage;
chrome.tabs.getSelected(null, function(tab) {
  tabIdOfEditPage = tab.id;
});

function selectTab(tabId) {
  chrome.tabs.update(tabId, {
    selected: true
  });
}

function closeTab(tabId) {
  chrome.tabs.remove(tabId);
}

chrome.extension.onRequest.addListener(function(request, sender, response) {
  switch (request.msg) {
  case 'access_token_result':
    selectTab(tabIdOfEditPage);
    closeTab(sender.tab.id);
    Facebook.parseAccessTokenResult(request.url);
    console.log('Received get_access_token_success message');
    break;
  case 'user_authentication_result':
    selectTab(tabIdOfEditPage);
    closeTab(sender.tab.id);
    SinaMicroblog.parseAccessTokenResult(request.url);
    console.log('Received sina microblog user authentication:' + request.url);
    break;
  }
});