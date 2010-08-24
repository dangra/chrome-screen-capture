#!/bin/sh
if [ "$1" == "debug" ]; then
  FLAG=-g
else
  FLAG="-O2 -Xlinker --strip-all"
fi

gcc $FLAG -m64 -fPIC -DGTK -Wno-write-strings `pkg-config --cflags --libs gtk+-2.0` \
  -shared -o npcapture64.so npcapture.cpp save.cpp plugin.cpp np_entry.cpp

