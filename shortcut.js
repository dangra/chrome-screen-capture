var toshortcut = { 

  init: function() {      
    if (document.body.hasAttribute('screen_capture_injected')) {
      return;
    }
    document.body.setAttribute('screen_capture_injected', true);
    document.body.addEventListener('keydown', toshortcut.doshortcut, false);
  },

  doshortcut: function (event) {
    if (event.ctrlKey && event.altKey) {
      if(window.event.keyCode == 86) {
        toshortcut.sendMessage({msg: 'capture_area'});
      } else if(window.event.keyCode == 67) {
        toshortcut.sendMessage({msg: 'capture_window'});       
      } else if(window.event.keyCode == 66) {
        toshortcut.sendMessage({msg: 'capture_webpage'});
      }     
    }
  },

  sendMessage: function(message) {
    chrome.extension.sendRequest(message);
  } 
};

toshortcut.init();
