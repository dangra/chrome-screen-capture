#!/bin/sh
mkdir -p screen_capture.plugin/Contents/MacOS
cp -f Info.plist screen_capture.plugin/Contents
g++ -framework Cocoa -DMAC \
  -DWEBKIT_DARWIN_SDK -Wno-write-strings -lresolv -arch i386 -bundle \
  -isysroot /Developer/SDKs/MacOSX10.5.sdk -mmacosx-version-min=10.5 \
  -o screen_capture.plugin/Contents/MacOS/screen_capture \
  log.cc np_entry.cc npn_entry.cc npp_entry.cc plugin_base.cc \
  plugin_factory.cc screen_capture.mm screen_capture_plugin.cc \
  screen_capture_script_object.cc script_object_base.cc script_object_factory.cc
