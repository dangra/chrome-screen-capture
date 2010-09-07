function checkScriptLoad() {
  chrome.extension.onRequest.addListener(function(request, sender, response) {
    if (request && request.msg == 'content_script_is_load') {
      try {
        if (isThisScriptLoad()) {
          response({msg: 'isLoadCanCapture'});
        } else {
          response({msg: 'isLoadCanNotCapture'});
        }
      } catch(e) {
        response({msg: 'noLoad'});
        console.log(e);
      }
    }
  });
}
checkScriptLoad();


