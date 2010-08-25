#!/bin/sh
mkdir -p screen_capture.plugin/Contents/MacOS
cp -f Info.plist screen_capture.plugin/Contents
g++ -framework Cocoa -DMAC \
  -DWEBKIT_DARWIN_SDK -Wno-write-strings -lresolv -arch i386 -bundle \
  -isysroot /Developer/SDKs/MacOSX10.5.sdk -mmacosx-version-min=10.5 \
  -o screen_capture.plugin/Contents/MacOS/screen_capture \
   np_entry.cc npp_entry.cc plugin.cc screen_capture.cc screen_capture.mm
