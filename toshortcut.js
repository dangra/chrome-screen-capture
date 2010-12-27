var toshortcut = { 

    init: function() {
      document.body.onkeydown = toshortcut.doshortcut;
    },

    doshortcut: function (event) {        
      if (event.ctrlKey && event.altKey) {
        if(window.event.keyCode == 82) {
          toshortcut.sendMessage({msg: 'capture_area'});
        } else if(window.event.keyCode==86) {
          toshortcut.sendMessage({msg: 'capture_window'});       
        } else if(window.event.keyCode ==72) {
          toshortcut.sendMessage({msg: 'capture_webpage'});
        }     
      }
    },

    sendMessage: function(message) {
      chrome.extension.sendRequest(message);
    } 
};

toshortcut.init();
