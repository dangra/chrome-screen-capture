#import <Cocoa/Cocoa.h>

const char* GetSaveFileName(const char* path) {
  int runResult;

  /* create or get the shared instance of NSSavePanel */
  NSSavePanel *sp = [NSSavePanel savePanel];
 
  /* set up new attributes */
  [sp setRequiredFileType:@"png"];
  [sp setDirectoryURL:[NSURL URLWithString:[NSString stringWithUTF8String:path]]];
 
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

const char* GetPictureFolder() {
  NSArray *paths;
  paths = NSSearchPathForDirectoriesInDomains(NSPicturesDirectory, NSUserDomainMask, YES);
  return [[paths lastObject] UTF8String];
}

const char* SetSaveFolder(const char* path) {
  int runResult;

  NSOpenPanel *op = [NSOpenPanel openPanel];

  [op setCanChooseDirectories:YES];
  [op setCanChooseFiles:NO];
  [op setAllowsMultipleSelection:NO];
  [op setDirectoryURL:[NSURL URLWithString:[NSString stringWithUTF8String:path]]];

  runResult = [op runModal];
  
  if (runResult == NSOKButton) {
    NSArray *paths = [op URLs];
    return [[[paths lastObject] path] UTF8String];
  } else {
    return [[NSString stringWithUTF8String:path] UTF8String];
  }
}

bool OpenSaveFolder(const char* path) {
  NSWorkspace *workspace = [NSWorkspace sharedWorkspace];
  return [workspace openFile:[NSString stringWithUTF8String:path]];
}

bool IsFolder(const char* path) {
  NSFileManager *fm = [NSFileManager defaultManager];
  return [fm fileExistsAtPath:[NSString stringWithUTF8String:path]];
}
