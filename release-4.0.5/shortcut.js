var toshortcut = {

  init: function() {
    if (document.body.hasAttribute('screen_capture_injected')) {
      return;
    }
    document.body.setAttribute('screen_capture_injected', true);
    document.body.addEventListener('keydown', toshortcut.doshortcut, false);
  },

  isThisPlatform: function(operationSystem) {
    return navigator.userAgent.toLowerCase().indexOf(operationSystem) > -1;
  },

  doshortcut: function (event) {
    var isMac = toshortcut.isThisPlatform('mac');
    if (event.ctrlKey && event.altKey && !isMac||
        event.metaKey && event.altKey && isMac) {
      if(window.event.keyCode == 82) {         // 'R'
        toshortcut.sendMessage({msg: 'capture_area'});
      } else if(window.event.keyCode == 86) {  // 'V'
        toshortcut.sendMessage({msg: 'capture_window'});
      } else if(window.event.keyCode == 72) {  // 'H'
        toshortcut.sendMessage({msg: 'capture_webpage'});
      }
    }
  },

  sendMessage: function(message) {
    chrome.extension.sendRequest(message);
  }
};

toshortcut.init();
