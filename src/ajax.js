(function(){
  /**
   * ajax is a encapsulated function that used to send data to server
   * asynchronously. It uses XMLHttpRequest object to send textual or binary
   * data through HTTP method GET, POST etc. It can custom request method,
   * request header. Response can be parsed automatically by MIME type of
   * response's Content-type, and it can handle success, error or progress event
   * in course of sending request and retrieving response.
   * @param {Object} option
   */
  function ajax(option) {
    if (arguments.length < 1 || option.constructor != Object)
      throw new Error('Bad parameter.');
    var url = option.url;
    var success = option.success;
    var complete = option.complete;
    if (!url || !(success || complete))
      throw new Error('Parameter url and success or complete are required.');

    var parameters = option.parameters || {};
    var method = option.method || 'GET';
    var status = option.status;
    var headers = option.headers || {};
    var multipartFormData = option.multipartFormData;

    var data = constructQueryString(parameters);

    if (multipartFormData) {
      var boundary = multipartFormData.boundary || 'XMLHttpRequest2';
      method = 'POST';
      headers['Content-Type'] = 'multipart/form-data; boundary=' + boundary;
      var formData = constructMultipartFormData(multipartFormData, boundary,
        parameters);
      data = constructBlobData(formData);
    }
    
    // Attach parameters on url if it's a Get request
    if (method.toUpperCase() == 'GET') {
      url += '?' + data;
      data = null;
    }

    var xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    xhr.onreadystatechange = function() {
      if (xhr.readyState == 4 ) {
        var statusCode = xhr.status;
        var parsedResponse = parseResponse(xhr);
        if (complete)
          complete(statusCode, parsedResponse);
        if (success && (statusCode == 200 || statusCode == 304)) {
          success(parsedResponse);
        } else if (status) {
          if (status[statusCode]) {

            // Call specified status code handler
            status[statusCode](parsedResponse);
          } else if (status['others']) {

            // Call others status code handler
            status['others'](parsedResponse);
          }
        }
      }
    };

    // Handle request progress
    var progress = option.progress;
    if (progress) {
      xhr.upload.addEventListener('progress', function(e) {
        // lengthComputable return true when the length of the progress is known
        if (e.lengthComputable) {
          progress(e.loaded, e.total);
        }
      }, false);
    }
    // Set request header
    for (var headerKey in headers) {
      xhr.setRequestHeader(headerKey, headers[headerKey]);
    }

    xhr.send(data);
  }

  function constructQueryString(parameters) {
    var tmpParameter = [];
    for(var name in parameters) {
      var value = parameters[name];
      if (value.constructor == Array) {
        value.forEach(function(val) {
          tmpParameter.push(name + '=' + val);
        });
      } else {
        tmpParameter.push(name + '=' + value);
      }
    }
    return tmpParameter.join('&');
  }

  // Parse response data according to content type of response
  function parseResponse(xhr) {
    var ct = xhr.getResponseHeader("content-type");
    if (typeof ct == 'string') {
      if (ct.indexOf('xml') >= 0)
        return xhr.responseXML;
      else if (ct.indexOf('json') >= 0)
        return JSON.parse(xhr.responseText);
    }
    return xhr.responseText;
  }

  function constructBlobData(dataString, contentType) {
    // Create a BlobBuilder instance to constrct a Blob object
    var bb;
    if (window.BlobBuilder) {
      bb = new BlobBuilder();
    } else if (window.WebKitBlobBuilder) {
      bb = new WebKitBlobBuilder();
    }
    var len = dataString.length;

    // Create a 8-bit unsigned integer ArrayBuffer view
    var data = new Uint8Array(len);
    for (var i = 0; i < len; i++) {
      data[i] = dataString.charCodeAt(i);
    }

    // Convert to ArrayBuffer and appended to BlobBuilder
    bb.append(data.buffer);

    // Return a Blob object from builder
    return bb.getBlob(contentType);
  }

  /**
   * Construct multipart/form-data formatted data string.
   * @param {Object} binaryData binary data
   * @param {String} boundary boundary of parts
   * @param {Object} otherParameters other text parameters
   */
  function constructMultipartFormData(binaryData, boundary, otherParameters) {
    var commonHeader = 'Content-Disposition: form-data; ';
    var data = [];
    for (var key in otherParameters) {

      // Add boundary of one header part
      data.push('--' + boundary + '\r\n');

      // Add same Content-Disposition information
      data.push(commonHeader);
      data.push('name="' + key + '"\r\n\r\n' + otherParameters[key] + '\r\n');
    }

    // Construct file data header
    data.push('--' + boundary + '\r\n');
    data.push(commonHeader);

    data.push('name="' + (binaryData.name || 'binaryfilename') + '"; ');
    data.push('filename=\"' + binaryData.value + '\"\r\n');
    data.push('Content-type: ' + binaryData.type + '\r\n\r\n');
    data.push(binaryData.data + '\r\n');

    data.push('--' + boundary + '--\r\n');
    return data.join('');
  }

  ajax.encodeForBinary = function(string) {
    string = encodeURI(string).replace(/%([A-Z0-9]{2})/g, '%u00$1');
    return unescape(string);
  };

  window.ajax = ajax;
})();