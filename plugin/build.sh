#!/bin/sh
if [ "$1" == "debug" ]; then
  FLAG=-g
else
  FLAG=-O2
fi

gcc $FLAG -m32 -fPIC -DGTK -Wno-write-strings `pkg-config --cflags --libs gtk+-2.0` \
  -shared -o npcapture.so npcapture.cpp save.cpp plugin.cpp np_entry.cpp
