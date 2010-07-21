#import <Cocoa/Cocoa.h>

const char* GetSaveFileName() {
  NSSavePanel *sp;
  int runResult;
 
  /* create or get the shared instance of NSSavePanel */
  sp = [NSSavePanel savePanel];
 
  /* set up new attributes */
  // [sp setAccessoryView:newView];
  // [sp setRequiredFileType:@"txt"];
 
  /* display the NSSavePanel */
  // runResult = [sp runModalForDirectory:NSHomeDirectory() file:@""];
  runResult = [sp runModal];

  /* if successful, save file under designated name */
  if (runResult == NSOKButton) {
  //    if (![textData writeToFile:[sp filename] atomically:YES])
    NSBeep();
    NSURL *file = [sp URL];
    return [[file path] UTF8String];
  } else {
    return nil;
  }
}
