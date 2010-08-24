#!/bin/sh
mkdir -p npcapture.plugin/Contents/MacOS
cp -f Info.plist npcapture.plugin/Contents
g++ -framework Cocoa -DMAC \
  -DWEBKIT_DARWIN_SDK -Wno-write-strings -lresolv -arch i386 -bundle \
  -isysroot /Developer/SDKs/MacOSX10.5.sdk -mmacosx-version-min=10.5 \
  -o npcapture.plugin/Contents/MacOS/npcapture \
  npcapture.cpp np_entry.cpp plugin.cpp save.cpp savepanel.mm
