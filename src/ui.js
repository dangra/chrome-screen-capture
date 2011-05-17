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