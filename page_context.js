var __screenCapturePageContext__ = {
  bind: function(newThis, func) {
    var args = [];
    for(var i = 2;i < arguments.length; i++) {
      args.push(arguments[i]);
    }
    return function() {
      return func.apply(newThis, args);
    }
  },

  currentHookStatus_: false,

  scrollLeftHooker: function() {
    return this.currentHookStatus_ ? 0 : window.pageXOffset;
  },

  scrollTopHooker: function() {
    return this.currentHookStatus_ ? 0 : window.pageYOffset;
  },

  checkHookStatus: function() {
    var needHookScrollValue = document.documentElement.getAttributeNode(
        '__screen_capture_need_hook_scroll_value__');
    this.currentHookStatus_ =
        !!(needHookScrollValue && needHookScrollValue.nodeValue == 'true');
  },

  init: function() {
    try {
      document.body.__defineGetter__('scrollLeft',
          __screenCapturePageContext__.bind(this, this.scrollLeftHooker));
      document.body.__defineSetter__('scrollLeft',
        function(value) {
          window.scrollTo(window.scrollY, value);
        }
      document.body.__defineGetter__('scrollTop',
          __screenCapturePageContext__.bind(this, this.scrollTopHooker));
      document.body.__defineSetter__('scrollTop',
        function(value) {
          window.scrollTo(window.scrollX, value);
        }
      );
      document.documentElement.addEventListener(
          '__screen_capture_check_hook_status_event__',
          __screenCapturePageContext__.bind(this, this.checkHookStatus));
    } catch(e) {
      window.console.log('Error: ' + e);
    }
  }
};
__screenCapturePageContext__.init();
