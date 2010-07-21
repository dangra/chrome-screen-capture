#!/bin/sh
mkdir -p npcapture.plugin/Contents/MacOS
cp -f Info.plist npcapture.plugin/Contents
g++ -dynamiclib -framework WebKit -framework Cocoa -DMAC -DWEBKIT_DARWIN_SDK -Wno-write-strings -lresolv -o npcapture.plugin/Contents/MacOS/npcapture npcapture.cpp save.cpp savepanel.mm
