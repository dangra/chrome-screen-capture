#!/bin/sh
gcc -O2 -fPIC -DGTK -Wno-write-strings `pkg-config --cflags --libs gtk+-2.0` \
  -shared -o npcapture64.so npcapture.cpp save.cpp plugin.cpp np_entry.cpp
