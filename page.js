// Copyright (c) 2010 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
var page = {
  startX: 150,
  startY: 150,
  endX: 400,
  endY: 300,
  moveX: 0,
  moveY: 0,
  scrollbar: 17,
  pageWidth: 0,
  pageHeight: 0,
  visibleWidth: 0,
  visibleHeight: 0,
  dragging: false,
  moving: false,
  resizing: false,
  isMouseDown: false,
  scrollXCount: 0,
  scrollYCount: 0,
  docHeight: 0,
  docWeight: 0,
  winHeight: 0,
  winWidth: 0,
  fixedElements_ : [],
  
  hookBodyScrollValue: function(needHook) {
    document.documentElement.setAttribute("__screen_capture_need_hook_scroll_value__", needHook);
  },
  
  enableFixedPosition: function(enableFlag) {
    if (enableFlag) {
      for (var i = 0, l = this.fixedElements_.length; i < l; ++i) {
        this.fixedElements_[i].style.position = "fixed";
      }
    } else {
      this.fixedElements_ = [];
      var nodeIterator = document.createNodeIterator(
          document.documentElement,
          NodeFilter.SHOW_ELEMENT,
          null,
          false
      );
      var currentNode;
      while (currentNode = nodeIterator.nextNode()) {
        var nodeComputedStyle = document.defaultView.getComputedStyle(currentNode, "");
        // Skip nodes which don't have computeStyle or are invisible.
        if (!nodeComputedStyle)
          return;
        var nodePosition = nodeComputedStyle.getPropertyValue("position");
        if (nodePosition == "fixed") {
          this.fixedElements_.push(currentNode);
          currentNode.style.position = "absolute";
        }
      }
    }
  },

  checkPageIsOnlyEmbedElement: function() {
    var bodyNode = document.body.children;
    var isOnlyEmbed = false;
    for (var i = 0; i < bodyNode.length; i++) {
      var tagName = bodyNode[i].tagName;
      if (tagName == 'OBJECT' || tagName == 'EMBED' || tagName == 'VIDEO' ||
          tagName == 'SCRIPT') {
        isOnlyEmbed = true;
      } else if (bodyNode[i].style.display != 'none'){
        isOnlyEmbed = false;
        break;
      }
    }
    return isOnlyEmbed;
  },
  
  /**
  * Receive messages from background page, and then decide what to do next
  */
  messageListener: function() {
    chrome.extension.onRequest.addListener(function(request, sender, response) {
      switch (request.msg) {
        case 'content_script_is_load':
          response(page.checkPageIsOnlyEmbedElement());
          break;
        case 'capture_window': response(page.getWindowSize()); break;
        case 'show_selection_area': page.showSelectionArea(); break;
        case 'scroll_init': response(page.scrollInit()); break;
        case 'scroll_next': response(page.scrollNext()); break;

      }
    });
  },

  /**
  * Send Message to background page
  */
  sendMessage: function(message) {
    chrome.extension.connect().postMessage(message);
  },

  /**
  * Initialize scrollbar position, and get the data browser
  */
  scrollInit: function() {
    this.enableFixedPosition(false);
    this.hookBodyScrollValue(true);
    page.docHeight = document.body.scrollHeight;
    page.docWidth = document.body.scrollWidth;
    page.winHeight = window.innerHeight;
    page.winWidth = window.innerWidth;
    page.visibleWidth = (window.innerHeight < document.body.scrollHeight) ?
        (window.innerWidth - page.scrollbar) : window.innerWidth;
    page.visibleHeight = (window.innerWidth < document.body.scrollWidth) ?
        (window.innerHeight - page.scrollbar) : window.innerHeight;
    page.startY = window.scrollY;
    page.startX = window.scrollX;
    window.scrollTo(0,0);
    page.scrollXCount = 0;
    page.scrollYCount = 1;
    return {
        'msg': 'scroll_init_done',
        'height': page.docHeight,
        'width': page.docWidth,
        'visibleHeight': page.visibleHeight,
        'visibleWidth': page.visibleWidth,
        'scrollXCount': 0,
        'scrollYCount': 0};
  },

  /**
  * Calculate the next position of the scrollbar
  */
  scrollNext: function() {
    if (page.scrollYCount * page.visibleWidth >= page.docWidth) {
      page.scrollXCount++;
      page.scrollYCount = 0;
    }
    if (page.scrollXCount * page.visibleHeight < page.docHeight) {
      window.scrollTo(page.scrollYCount * page.visibleWidth,
                      page.scrollXCount * page.visibleHeight);
      var x = page.scrollXCount;
      var y = page.scrollYCount;
      page.scrollYCount++;
      return { msg: 'scroll_next_done',scrollXCount: x, scrollYCount:y };
    }
    else {
      window.scrollTo(page.startX, page.startY);
      this.enableFixedPosition(true);
      this.hookBodyScrollValue(false);
      return {'msg': 'scroll_finished'};
    }
  },

  /**
  * Show the selection Area
  */
  showSelectionArea: function() {
    page.createFloatLayer();
    setTimeout(page.createSelectionArea, 100);
  },

  getWindowSize: function() {
    page.visibleWidth = (window.innerHeight < document.body.scrollHeight) ?
        (window.innerWidth - page.scrollbar) : window.innerWidth;
    page.visibleHeight = (window.innerWidth < document.body.scrollWidth) ?
        (window.innerHeight - page.scrollbar) : window.innerHeight;
    return {'msg':'capture_window',
            'width': page.visibleWidth,
            'height':page.visibleHeight};
  },

  getSelectionSize: function() {
    page.removeSelectionArea();
    setTimeout(function() {
      page.sendMessage({
        'msg': 'capture_selected',
        'x': page.startX,
        'y': page.startY,
        'width': page.endX - page.startX,
        'height': page.endY - page.startY})}, 100);
  },

  /**
  * Create a float layer on the webpage
  */
  createFloatLayer: function() {
    page.createDiv(document.body, 'drag_area_protector');
  },

  /**
  * Load the screenshot area interface
  */
  createSelectionArea: function() {
    var areaProtector = $('drag_area_protector');

    page.createDiv(areaProtector, 'drag_shadow_top');
    page.createDiv(areaProtector, 'drag_shadow_bottom');
    page.createDiv(areaProtector, 'drag_shadow_left');
    page.createDiv(areaProtector, 'drag_shadow_right');

    var areaElement = page.createDiv(areaProtector, 'drag_area');
    page.createDiv(areaElement, 'drag_container');
    page.createDiv(areaElement, 'drag_size');

    var cancel = page.createDiv(areaElement, 'drag_cancel');
    cancel.addEventListener('mousedown', function (){
        page.removeSelectionArea();}, true);
    cancel.innerHTML = chrome.i18n.getMessage("cancel");

    var crop = page.createDiv(areaElement, 'drag_crop');
    crop.addEventListener('mousedown', page.getSelectionSize, true);
    crop.innerHTML = chrome.i18n.getMessage('crop');

    page.createDiv(areaElement, 'drag_north_west');
    page.createDiv(areaElement, 'drag_north_east');
    page.createDiv(areaElement, 'drag_south_east');
    page.createDiv(areaElement, 'drag_south_west');

    document.addEventListener('mousedown', page.onMouseDown, false);
    document.addEventListener('mousemove', page.onMouseMove, false);
    document.addEventListener('mouseup', page.onMouseUp, false);
    document.addEventListener('dblclick', page.getSelectionSize, false);
    
    page.pageHeight = $('drag_area_protector').clientHeight;
    page.pageWidth = $('drag_area_protector').clientWidth;

    var areaElement = $('drag_area');
    areaElement.style.left = page.startX + 'px';
    areaElement.style.top = page.startY + 'px';
    areaElement.style.width = (page.endX - page.startX) + 'px';
    areaElement.style.height = (page.endY - page.startY) + 'px';

    page.updateShadow(areaElement);
    page.updateSize();
  },

  /**
  * init selection area due to the position of the mouse when mouse down
  */
  onMouseDown: function() {
    if (event.button != 2) {
      var element = event.target;

      if (element) {
        var elementName = element.tagName;
        if (elementName && elementName == 'HTML') {
          page.removeSelectionArea();
        } else if (elementName && document) {
          page.isMouseDown = true;

          var areaElement = $('drag_area');
          var xPosition = event.pageX - window.scrollX;
          var yPosition = event.pageY - window.scrollY;

          if (areaElement) {
            if (element == $('drag_container')) {
              page.moving = true;
              page.moveX = xPosition - areaElement.offsetLeft;
              page.moveY = yPosition - areaElement.offsetTop;
            } else if (element == $('drag_north_east')) {
              page.resizing = true;
              page.startX = areaElement.offsetLeft;
              page.startY = areaElement.offsetTop + areaElement.clientHeight;
            } else if (element == $('drag_north_west')) {
              page.resizing = true;
              page.startX = areaElement.offsetLeft + areaElement.clientWidth;
              page.startY = areaElement.offsetTop + areaElement.clientHeight;
            } else if (element == $('drag_south_east')) {
              page.resizing = true;
              page.startX = areaElement.offsetLeft;
              page.startY = areaElement.offsetTop;
            } else if (element == $('drag_south_west')) {
              page.resizing = true;
              page.startX = areaElement.offsetLeft + areaElement.clientWidth;
              page.startY = areaElement.offsetTop;
            } else {
              page.dragging = true;
              page.endX = 0;
              page.endY = 0;
              page.startX = xPosition;
              page.startY = yPosition;
            }
          }
        }
      }

    }
  },

  /**
  * Change selection area position when mouse moved
  */
  onMouseMove: function() {
    var element = event.target;
    if (element && page.isMouseDown) {
      var areaElement = $('drag_area');
      if (areaElement) {
        var xPosition = event.pageX - window.scrollX;
        var yPosition = event.pageY - window.scrollY;
        if (page.dragging || page.resizing) {
          var width = 0;
          var height = 0;
          page.endX = xPosition;
          page.endY = yPosition;
          if (page.startX > page.endX) {
            width = page.startX - page.endX;
            areaElement.style.left = xPosition + 'px';
          } else {
            width = page.endX - page.startX;
            areaElement.style.left = page.startX + 'px';
          }
          if (page.startY > page.endY) {
            height = page.startY - page.endY;
            areaElement.style.top = page.endY + 'px';
          } else {
            height = page.endY - page.startY;
            areaElement.style.top = page.startY + 'px';
          }
          areaElement.style.height = height + 'px';
          areaElement.style.width  = width + 'px';
        } else if (page.moving) {
          var newXPosition = xPosition - page.moveX;
          var newYPosition = yPosition - page.moveY;
          if (newXPosition < 0) {
            newXPosition = 0;
          } else if (newXPosition + areaElement.clientWidth > page.pageWidth) {
            newXPosition = page.pageWidth - areaElement.clientWidth;
          }
          if (newYPosition < 0) {
            newYPosition = 0;
          } else if (newYPosition + areaElement.clientHeight >
                     page.pageHeight) {
            newYPosition = page.pageHeight - areaElement.clientHeight;
          }

          areaElement.style.left = newXPosition + 'px';
          areaElement.style.top = newYPosition + 'px';
          page.endX = newXPosition + areaElement.clientWidth;
          page.startX = newXPosition;
          page.endY = newYPosition + areaElement.clientHeight;
          page.startY = newYPosition;
        }
        page.updateShadow(areaElement);
        page.updateSize();
      }
    }
  },

 /**
  * fix the selection area position when mouse up
  */
  onMouseUp: function()
  {
    page.isMouseDown = false;
    if (event.button != 2) {
      page.resizing = false;
      page.dragging = false;
      page.moving = false;
      page.moveX = 0;
      page.moveY = 0;
      var temp;
      if (page.endX < page.startX) {
        temp = page.endX;
        page.endX = page.startX;
        page.startX = temp;
      }
      if (page.endY < page.startY) {
        temp = page.endY;
        page.endY = page.startY;
        page.startY = temp;
      }
    }
  },

  /**
  * Update the location of the shadow layer
  */
  updateShadow: function(areaElement) {
    $('drag_shadow_top').style.height = parseInt(areaElement.style.top) + 'px';
    $('drag_shadow_top').style.width = (parseInt(areaElement.style.left) +
        parseInt(areaElement.style.width) + 1) +'px';
    $('drag_shadow_left').style.height = (page.pageHeight -
        parseInt(areaElement.style.top)) + 'px';
    $('drag_shadow_left').style.width = parseInt(areaElement.style.left) + 'px';

    var height = (parseInt(areaElement.style.top) +
        parseInt(areaElement.style.height) + 1);
    height = (height < 0) ? 0 : height;
    var width = (page.pageWidth) - 1 - (parseInt(areaElement.style.left) +
        parseInt(areaElement.style.width));
    width = (width < 0) ? 0 : width;
    $('drag_shadow_right').style.height = height + 'px';
    $('drag_shadow_right').style.width =  width + 'px';

    height = (page.pageHeight - 1 - (parseInt(areaElement.style.top) +
        parseInt(areaElement.style.height)));
    height = (height < 0) ? 0 : height;
    width = (page.pageWidth) - parseInt(areaElement.style.left);
    width = (width < 0) ? 0 : width;
    $('drag_shadow_bottom').style.height = height + 'px';
    $('drag_shadow_bottom').style.width = width + 'px';
  },

  /**
  * Remove selection area
  */
  removeSelectionArea: function() {
    page.removeElement('drag_area_protector');
    page.removeElement('drag_area');

    document.removeEventListener('mousedown', page.onMouseDown, false);
    document.removeEventListener('mousemove', page.onMouseMove, false);
    document.removeEventListener('mouseup', page.onMouseUp, false);
    document.removeEventListener('dblclick', page.getSelectionSize, false);
  },

  /**
  * Refresh the size info
  */
  updateSize: function() {
    var width = (page.endX > page.startX) ? (page.endX - page.startX) :
        (page.startX - page.endX);
    var height = (page.endY > page.startY) ? (page.endY - page.startY) :
        (page.startY - page.endY);
    $('drag_size').innerText = width + ' x ' + height;
  },

  /**
  * create div
  */
  createDiv: function(parent, id) {
    var divElement = document.createElement('div');
    divElement.id = id;
    parent.appendChild(divElement);
    return divElement;
  },

  /**
  * Remove an element
  */
  removeElement: function(id) {
    if($(id)) {
      $(id).parentNode.removeChild($(id));
    }
  },
  
  injectJavaScriptResource: function(scriptResource) {
    var hasError = true;
    var request = new XMLHttpRequest();
    // open the request
    request.open("get", chrome.extension.getURL(scriptResource), false);
    // send the request
    try {
      request.send(null);
    } catch (e) {
      hasError = true;
      window.console.log(e);
    }
    var contents = request.responseText;
    request = null;
  
    var script = document.createElement("script");
    script.type = "text/javascript";
    script.charset = "utf-8";
    if (hasError) {
      script.src = chrome.extension.getURL(scriptResource);
      window.console.log("inject script tag: " + script.src);      
    } else {
      var scriptContents = document.createTextNode(contents);
      script.appendChild(scriptContents);
      window.console.log("inject script contents: " + script.src);            
    }
    (document.head || document.body || document.documentElement).appendChild(script);
  },
  
  /**
  * Remove an element
  */
  init: function() {
    this.messageListener();  
    this.injectJavaScriptResource("page_context.js");  
  }
};

function $(id) {
  return document.getElementById(id);
}

page.init();