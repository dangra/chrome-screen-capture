#!/bin/sh
SDK=~/npn/xulrunner-sdk

gcc -O2 -fPIC -DGTK -Wno-write-strings -I$SDK/include `pkg-config --cflags --libs gtk+-2.0` -DXPCOM_GLUE -DMOZILLA_STRICT_API -shared -L$SDK/lib -lnspr4 -lplds4 -lxpcomglue -o npcapture.so npcapture.cpp

