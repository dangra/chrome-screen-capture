var __screenCapturePageContext__ = {
  clone : function(object) {
    function StubObj() { }
    StubObj.prototype = object;
    var newObj = new StubObj();
    newObj.getInternalObject = function() {
      return this.__proto__;
    }
    newObj.toString = function() {
      try {
        return this.__proto__.toString();
      } catch (e) {
        return "object Object";
      }
    }
    return newObj;
  },

  bind : function(newThis, func) {
    var args = [];
    for(var i = 2;i < arguments.length; i++) {
      args.push(arguments[i]);
    }
    return function() {
      func.apply(newThis, args);
    }
  },

  bodyWrapperDelegate_ : null,
  currentHookStatus_ : false,

  scrollValueHooker : function(oldValue, newValue, reason) {
    // When we hook the value of scrollLeft/Top of body, it always returns 0.
    return 0;
  },

  toggleBodyScrollValueHookStatus : function() {
    this.currentHookStatus_ = !this.currentHookStatus_;
    window.console.log("toggle hook staus " + this.currentHookStatus_);
    if (this.currentHookStatus_) {
      var This = this;
      try {
        document.__defineGetter__("body", function() {
          return This.bodyWrapperDelegate_.getWrapper();
        });
      } catch (e) {
        window.console.log("error" + e);
      }
      this.bodyWrapperDelegate_.watch("scrollLeft", this.scrollValueHooker);
      this.bodyWrapperDelegate_.watch("scrollTop", this.scrollValueHooker);
    } else {
      this.bodyWrapperDelegate_.unwatch("scrollLeft", this.scrollValueHooker);
      this.bodyWrapperDelegate_.unwatch("scrollTop", this.scrollValueHooker);
      var This = this;
      try {
        document.__defineGetter__("body", function() {
          return This.bodyWrapperDelegate_.getOriginal();
        });
      } catch (e) {
        window.console.log("error" + e);
      }
    }
  },

  checkHookStatus : function() {
    var needHookScrollValue = document.documentElement.getAttributeNode("__screen_capture_need_hook_scroll_value__");
    needHookScrollValue = !!(needHookScrollValue && needHookScrollValue.nodeValue == "true");
    if (this.currentHookStatus_ != needHookScrollValue)
      this.toggleBodyScrollValueHookStatus();
  },

  init : function() {
    if (!this.bodyWrapperDelegate_) {
      this.bodyWrapperDelegate_ = new __screenCapturePageContext__.ObjectWrapDelegate(document.body, "^(DOCUMENT_[A-Z_]+|[A-Z_]+_NODE)$");
      window.setInterval(__screenCapturePageContext__.bind(this, this.checkHookStatus), 100)
    }
  }
};
// ObjectWrapDelegate class will create a empty object(wrapper), map its
// prototype to the 'originalObject', then search all non-function properties
// (except those properties which match the propertyNameFilter) of the
// 'orginalObject' and set corresponding getter/setter to the wrapper.
// Then you can manipulate the wrapper as 'originalObject' because the wrapper
// use the corresponding getter/setter to access the corresponding properties in
// 'originalObject' and the all function calls can be call through the prototype
// inherit.
// After createing the wrapper object, you can use watch method to monitor any
// property which you want to know when it has been read(get) or change(set).
// Please see the detail comment on method watch.
// Remember the ObjectWrapDelegate returns the wrapDelegateObject intead of
// really wrapper object. You have to use ObjectWrapDelegate.getWrapper to get
// real wrapper object.
// parameter @originalObject, object which you want to wrap
// parameter @propertyNameFilter, string, regular expression pattern string for
//    those properties you don't put in the wrap object.
__screenCapturePageContext__.ObjectWrapDelegate = function(originalObject,
                                        propertyNameFilter) {
  this.window_ = window;
  this.originalObject_ = originalObject;
  // The wrapper is the object we use to wrap the 'originalObject'.
  this.wrapper_ = __screenCapturePageContext__.clone(originalObject);
  // This array saves all properties we set our getter/setter for them.
  this.properties_ = [];
  // This object to save all watch handlers. Each watch handler is bind to one
  // certain property which is in properties_.
  this.watcherTable_ = {};

  // Check the propertyNameFilter parameter.
  if (typeof propertyNameFilter == "undefined") {
    propertyNameFilter = "";
  } else if (typeof propertyNameFilter != "string") {
    try {
      propertyNameFilter = propertyNameFilter.toString();
    } catch (e) {
      propertyNameFilter = "";
    }
  }
  if (propertyNameFilter.length) {
    this.propertyNameFilter_ = new RegExp("");
    this.propertyNameFilter_.compile(propertyNameFilter);
  } else {
    this.propertyNameFilter_ = null;
  }
  // For closure to access the private data of class.
  var This = this;
  // Set the getter object.
  function setGetterAndSetter(wrapper, propertyName) {
    wrapper.__defineGetter__(propertyName, function() {
      var internalObj = this.getInternalObject();
      var originalReturnValue = internalObj[propertyName];
      var returnValue = originalReturnValue;
      // See whether this property has been watched.
      var watchers = This.watcherTable_[propertyName];
      if (watchers) {
        // copy the watcher to a cache in case someone call unwatch inside the
        // watchHandler.
        var watchersCache = watchers.concat();
        for (var i = 0, l = watchersCache.length; i < l; ++i) {
          var watcher = watchersCache[i];
          if (!watcher) {
            window.console.log("wrapper's watch for " + propertyName +
                              " is unavailable!");
            continue;  // should never happend
          }
          originalReturnValue = returnValue;
          try {
            returnValue = watcher(returnValue, returnValue, "get");
          } catch (e) {
            returnValue = originalReturnValue;
          }
        }
      }
      //window.console.log("get " + propertyName + ", value is :" +
      //                  returnValue + ", typeof is :" + typeof returnValue);
      return returnValue;
    });
    // Set the setter object.
    wrapper.__defineSetter__(propertyName, function(value) {
      var internalObj = this.getInternalObject();
      var originalValue = value;
      var userValue = originalValue;
      var oldValue;
      try {
        oldValue = internalObj[propertyName];
      } catch (e) {
        oldValue = null;
      }
      // See whether this property has been watched.
      var watchers = This.watcherTable_[propertyName];
      if (watchers) {
        // copy the watcher to a cache in case someone call unwatch inside the
        // watchHandler.
        var watchersCache = watchers.concat();
        for (var i = 0, l = watchersCache.length; i < l; ++i) {
          var watcher = watchersCache[i];
          if (!watcher) {
            window.console.log("wrapper's watch for " + propertyName +
                              " is unavailable!");
            continue;  // should never happend
          }
          originalValue = userValue;
          try {
            userValue = watcher(oldValue, userValue, "set");
          } catch (e) {
            userValue = originalValue;
          }
        }
      }
      //window.console.log("set " + propertyName + ", value is :" +
      //                  userValue);
      internalObj[propertyName] = userValue;
    });
  };

  this.cleanUp_ = function() {
    This.window_.removeEventListener("unload", This.cleanUp_, false);
    // Delete all properties
    for (var i = 0, l = This.properties_.length; i < l; ++i) {
      delete This.wrapper_[This.properties_[i]];
    }
    This.window_ = null;
    This.wrapper_ = null;
    This.properties_ = null;
    This.watcherTable_ = null;
    This.propertyNameFilter_ = null;
    This = null;
  }

  // We only bridge the non-function properties.
  for (var prop in originalObject) {
    if (this.propertyNameFilter_ && this.propertyNameFilter_.test(prop)) {
      this.propertyNameFilter_.test("");
      continue;
    }
    if (typeof originalObject[prop] != "function") {
      //window.console.log("copy property : " + prop);
      this.properties_.push(prop);
      setGetterAndSetter(this.wrapper_, prop);
    }
  }

  // Listen the unload event.
  this.window_.addEventListener("unload", this.cleanUp_, false);
};

__screenCapturePageContext__.ObjectWrapDelegate.prototype.getOriginal = function() {
  return this.originalObject_;
}

__screenCapturePageContext__.ObjectWrapDelegate.prototype.getWrapper = function() {
  return this.wrapper_;
}

// Check whether a property is in the wrapper or not. If yes, return true.
// Otherwise return false.
__screenCapturePageContext__.ObjectWrapDelegate.prototype.hasProperty = function(propertyName) {
  for (var i = 0, l = this.properties_.length; i < l; ++i) {
    if (propertyName == this.properties_[i])
      return true;
  }
  return false;
}

// Watches for a property to be accessed or be assigned a value and runs a
// function when that occurs.
// Watches for accessing a property or assignment to a property named prop in
// this object, calling handler(oldval, newval, reason) whenever prop is
// get/set and storing the return value in that property.
// A watchpoint can filter (or nullify) the value assignment, by returning a
// modified newval (or by returning oldval).
// When watchpoint is trigering by get opeartor, the oldval is equal with
// newval. The reason will be "get".
// When watchpoint is trigering by set opeartor, The reason will be "set".
// If you delete a property for which a watchpoint has been set,
// that watchpoint does not disappear. If you later recreate the property,
// the watchpoint is still in effect.
// To remove a watchpoint, use the unwatch method.
// If register the watchpoint successfully, return true. Otherwise return false.
__screenCapturePageContext__.ObjectWrapDelegate.prototype.watch = function(
    propertyName, watchHandler) {
  if (!this.hasProperty(propertyName))
    return false;
  var watchers = this.watcherTable_[propertyName];
  if (watchers) {
    for (var i = 0, l = watchers.length; i < l; ++i) {
      if (watchHandler == watchers[i])
        return true;
    }
  } else {
    watchers = new Array();
    this.watcherTable_[propertyName] = watchers;
    window.console.log("watch : " + propertyName);
  }
  watchers.push(watchHandler);
  return true;
}

// Removes a watchpoint set with the watch method.
__screenCapturePageContext__.ObjectWrapDelegate.prototype.unwatch = function(
    propertyName, watchHandler) {
  if (!this.hasProperty(propertyName))
    return false;
  var watchers = this.watcherTable_[propertyName];
  if (watchers) {
    for (var i = 0, l = watchers.length; i < l; ++i) {
      if (watchHandler == watchers[i]) {
        watchers.splice(i, 1);
        window.console.log("unwatch : " + propertyName);
        return true;
      }
    }
  }
  return false;
}
__screenCapturePageContext__.init();
