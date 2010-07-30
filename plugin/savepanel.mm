#import <Cocoa/Cocoa.h>

const char* GetSaveFileName() {
  NSSavePanel *sp;
  int runResult;
 
  /* create or get the shared instance of NSSavePanel */
  sp = [NSSavePanel savePanel];
 
  /* set up new attributes */
  [sp setRequiredFileType:@"png"];
 
  /* display the NSSavePanel */
  runResult = [sp runModal];

  /* if successful, save file under designated name */
  if (runResult == NSOKButton) {
    NSURL *file = [sp URL];
    return [[file path] UTF8String];
  } else {
    return nil;
  }
}
