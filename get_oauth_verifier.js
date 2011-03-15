function get_oauth_verifier() {
  var oauth_verifier = document.getElementsByTagName('b');
  if (oauth_verifier && oauth_verifier.length == 1) {
    oauth_verifier = oauth_verifier[0].innerText.split('：')[1];
  } else
    return;
    
  chrome.extension.sendRequest({message:'continueUpload', value:oauth_verifier})
  document.writeln('<a href="http://t.sina.com.cn">新浪微博</a>');
}

get_oauth_verifier();