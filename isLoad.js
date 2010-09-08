function checkScriptLoad() {
  chrome.extension.onRequest.addListener(function(request, sender, response) {
    if (request.msg == 'is_page_capturable') {
      try {
        if (isPageCapturable()) {
          response({msg: 'capturable'});
        } else {
          response({msg: 'uncapturable'});
        }
      } catch(e) {
        response({msg: 'loading'});
        console.log(e);
      }
    }
  });
}

checkScriptLoad();
