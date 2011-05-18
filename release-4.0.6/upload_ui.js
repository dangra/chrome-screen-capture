const CURRENT_LOCALE = chrome.i18n.getMessage('@@ui_locale');
const MULTIPART_FORMDATA_BOUNDARY = 'Google_Chrome_Screen_Capture';
const HIDE_ERROR_INFO_DELAY_TIME = 5000;

var UploadUI = {
  currentSite: '',
  uploading: false,
  sites: {},

  registerSite: function(id, siteObject) {
    this.sites[id] = siteObject;
  },

  getSiteObject: function(id) {
    return this.sites[id];
  },
  
  setUploading: function(state) {
    UploadUI.uploading = state;
  },

  init: function() {
    // Register supported site for image sharing.
    UploadUI.registerSite(SinaMicroblog.siteId, SinaMicroblog);
    UploadUI.registerSite(Facebook.siteId, Facebook);
    UploadUI.registerSite(Picasa.siteId, Picasa);
    
    // Import style sheet for current locale
    UI.addStyleSheet('./i18n_styles/' + CURRENT_LOCALE + '_upload_image.css');

    // Get i18n message
    i18nReplace('shareToSinaMicroblogText', SinaMicroblog.siteId +
      '_upload_header');
    i18nReplace('shareToFacebookText', Facebook.siteId + '_upload_header');
    i18nReplace('shareToPicasaText', Picasa.siteId + '_upload_header');
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

    $('picasaBtn').addEventListener('click', function() {
      UploadUI.showUploadContentWrapper(Picasa.siteId);
    });
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
          var site = UploadUI.getSiteObject(currentSite);
          site.logout(callback);
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
    if (accountsNumber == 2) {
      uploadAccountList.removeChild(uploadAccountList.lastElementChild);
    }
    uploadAccountList.innerHTML = template + uploadAccountList.innerHTML;

    UploadUI.updateShareToOtherAccountText(site);
  },

  deleteAccountItem: function(accountId, noConfirm) {
    if (UploadUI.uploading && !noConfirm)
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

  upload: function(siteId, userId) {
    if (UploadUI.uploading)
      return;

    // Initialize UI
    var accountId = siteId + '_' + userId;
    UploadUI.hideErrorInfo();
    UploadUI.hideUploadInfo(accountId);
    UploadUI.hidePhotoLink(accountId);
    if (!UploadUI.validatePhotoDescription(siteId))
      return;
    var caption = $('imageCaption').value;

    // Get ready for upload image.
    photoshop.draw();
    UploadUI.setUploading(true);
    UploadUI.showProgressBar(accountId);

    var site = UploadUI.getSiteObject(siteId);
    var user = Account.getUser(siteId, userId);
    var imageData = UploadUI.getImageData();
    var infoText;

    var callback = function(result, photoIdOrMessage) {
      if (result == 'success') {
        infoText = chrome.i18n.getMessage('get_photo_link');
        UploadUI.showUploadInfo(accountId, infoText);
        site.getPhotoLink(user, photoIdOrMessage, function(photoLinkResult,
                                                           photoLinkOrMessage) {
          if (photoLinkResult == 'success') {
            UploadUI.setUploading(false);
            UploadUI.hideUploadInfo(accountId);
            UploadUI.showPhotoLink(accountId, photoLinkOrMessage);
          } else {
            UploadUI.showErrorInfo(photoLinkOrMessage);
          }
        });
      } else {
        if (photoIdOrMessage == 'bad_access_token' ||
            photoIdOrMessage == 'invalid_album_id') {
          Account.removeUser(site.siteId, site.currentUserId);
          UploadUI.deleteAccountItem(accountId, true);
          UploadUI.getAccessToken(siteId);
        }
        UploadUI.setUploading(false);
        UploadUI.hideProgressBar(accountId);
        UploadUI.showErrorInfo(chrome.i18n.getMessage(photoIdOrMessage));
      }
      UploadUI.hideProgressBar(accountId);
    };
    
    if (user) {
      site.currentUserId = user.id;
      site.upload(user, caption, imageData, callback);
    } else {
      UploadUI.getAccessToken(siteId);
    }
  },

  getAccessToken: function(siteId) {
    var site = UploadUI.getSiteObject(siteId);
    var accessTokenCallback = function(result, userOrMessage) {
      if (result == 'success') {
        UploadUI.getUserInfo(siteId, userOrMessage);
      } else {
        // Show error information according to error reason
        UploadUI.showErrorInfo(chrome.i18n.getMessage(userOrMessage));
        UploadUI.hideAuthenticationProgress();
      }
    };

    site.getAccessToken(accessTokenCallback);
  },

  getUserInfo: function(siteId, user) {
    var site = UploadUI.getSiteObject(siteId);
    site.getUserInfo(user, function(result, userOrMessage) {
      if (result == 'success') {
        var userId = user.id;
        // Check if the authenticated user is added.
        if (!Account.getUser(siteId, userId)) {
          site.currentUserId = userId;
          Account.addUser(siteId, user);
          UploadUI.addAuthenticatedAccount(siteId, userId);
        }
        UploadUI.hideAuthenticationProgress();
        UploadUI.upload(siteId, userId);
      } else {
        var msg = chrome.i18n.getMessage(userOrMessage);
        UploadUI.showErrorInfo(msg);
      }
    });
  },

  getImageData: function() {
    var dataUrl = $('canvas').toDataURL('image/png');
    var imageDataIndex = dataUrl.indexOf('data:image/png;base64,');
    if (imageDataIndex != 0) {
      return;
    }

    // Decode to binary data
    return atob(dataUrl.substr(imageDataIndex + 22));
  }
};

(function() {
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

function parseAccessToken(senderId, url, siteId) {
  var sites = UploadUI.sites;
  for (var id in sites) {
    var site = sites[id];
    if ((siteId && id == siteId) || site.isRedirectUrl(url)) {
      selectTab(tabIdOfEditPage);
      closeTab(senderId);
      site.parseAccessToken(url);
      return true;
    }
  }
  return false;
}

chrome.extension.onRequest.addListener(function(request, sender) {
  switch (request.msg) {
  case 'url_for_access_token':
    parseAccessToken(sender.tab.id, request.url, request.siteId);
    break;
  }
});
})();
