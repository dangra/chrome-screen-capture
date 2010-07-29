#!/bin/sh
mkdir -p npcapture.plugin/Contents/MacOS
cp -f Info.plist npcapture.plugin/Contents
g++ -framework WebKit -framework Cocoa -DMAC \
  -DWEBKIT_DARWIN_SDK -Wno-write-strings -lresolv \
  -o npcapture.plugin/Contents/MacOS/npcapture \
  -arch i386 -bundle \
  npcapture.cpp np_entry.cpp plugin.cpp save.cpp savepanel.mm
