/* ***** BEGIN LICENSE BLOCK *****
* Version: MPL 1.1/GPL 2.0/LGPL 2.1
* This code was based on the npsimple.c sample code in Gecko-sdk.
*
* The contents of this file are subject to the Mozilla Public License Version
* 1.1 (the "License"); you may not use this file except in compliance with
* the License. You may obtain a copy of the License at
* http://www.mozilla.org/MPL/
*
* Software distributed under the License is distributed on an "AS IS" basis,
* WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
* for the specific language governing rights and limitations under the
* License.
*
* Contributor(s):
*   Bo Chen   <chen_bo-bj@vanceinfo.com>
*   Jing Zhao <jingzhao@google.com>
*
* Alternatively, the contents of this file may be used under the terms of
* either the GNU General Public License Version 2 or later (the "GPL"), or 
* the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
* in which case the provisions of the GPL or the LGPL are applicable instead
* of those above. If you wish to allow use of your version of this file only
* under the terms of either the GPL or the LGPL, and not to allow others to
* use your version of this file under the terms of the NPL, indicate your
* decision by deleting the provisions above and replace them with the notice
* and other provisions required by the GPL or the LGPL. If you do not delete
* the provisions above, a recipient may use your version of this file under
* the terms of any one of the NPL, the GPL or the LGPL.
* ***** END LICENSE BLOCK ***** */

#include <stdio.h>
#include <prtypes.h>
#include <atlenc.h>
#include <atlstr.h>
#include <comutil.h>
#include <vector>
#include "npcapture.h"

NPNetscapeFuncs* npnfuncs = NULL;
static NPObject* so = NULL;
static HWND hWnd = NULL;

const char* kSaveScreenshot = "SaveScreenshot";

NPObject* CPlugin::Allocate(NPP instance, NPClass* npclass) {
  return (NPObject*)(new CPlugin);
}

void CPlugin::Deallocate(NPObject* obj) {
  delete (CPlugin*)obj;
}

bool CPlugin::HasMethod(NPObject* obj, NPIdentifier methodName) {
  return true;
}

bool CPlugin::InvokeDefault(NPObject* obj, const NPVariant* args,
                            uint32_t argCount, NPVariant* result) {
  return true;
}

bool CPlugin::Invoke(NPObject* obj, NPIdentifier methodName,
                     const NPVariant* args, uint32_t argCount,
                     NPVariant* result) {
  char* name = npnfuncs->utf8fromidentifier(methodName);
  if (!name) {
    return false;
  }
  bool ret_val = true;
  if (!strncmp((const char*)name, kSaveScreenshot,
               strlen(kSaveScreenshot))) {
    SaveScreenshot(obj, args, argCount, result);
  } else {
    // Exception handling. 
    npnfuncs->setexception(obj, "exception during invocation");
    ret_val = false;
  }
  if (name) {
    npnfuncs->memfree(name);
  }
  return ret_val;
}

bool CPlugin::HasProperty(NPObject* obj, NPIdentifier propertyName) {
  return false;
}

bool CPlugin::GetProperty(NPObject* obj, NPIdentifier propertyName,
                          NPVariant* result) {
  return false;
}

void CPlugin::SaveScreenshot(NPObject* obj, const NPVariant* args,
                             uint32_t argCount, NPVariant* result) {
  if (argCount != 1 || !NPVARIANT_IS_STRING(args[0])) {
    return;
  }

  char szFile[1024] = "";

  OPENFILENAMEA Ofn = {0};
  Ofn.lStructSize = sizeof(OPENFILENAMEA);
  Ofn.hwndOwner = hWnd;
  Ofn.lpstrFilter = "PNG Image\0*.png\0All Files\0*.*\0\0";
  Ofn.lpstrFile = szFile;
  Ofn.nMaxFile = sizeof(szFile);
  Ofn.lpstrFileTitle = NULL;
  Ofn.nMaxFileTitle = 0;
  Ofn.lpstrInitialDir = NULL;
  Ofn.Flags = OFN_SHOWHELP | OFN_OVERWRITEPROMPT;
  Ofn.lpstrTitle = NULL;
 
  GetSaveFileNameA(&Ofn);

  if (szFile[0] != '\0') {
    char* url = (char *)NPVARIANT_TO_STRING(args[0]).UTF8Characters;
    char* base64 = strstr(url, "base64,") + 7;
    int startpos =  base64 - url;
    int base64size = NPVARIANT_TO_STRING(args[0]).UTF8Length - startpos;
    int byteLength = Base64DecodeGetRequiredLength(base64size);
    BYTE* bytes = new BYTE[byteLength];
    Base64Decode(base64, base64size, bytes, &byteLength);

    FILE* out = fopen(szFile, "wb");
    fwrite(bytes, byteLength, 1, out);
    fclose(out);

    delete [] bytes;
  }

  return;
}

static NPClass plugin_ref_obj = {
  NP_CLASS_STRUCT_VERSION,
  CPlugin::Allocate,
  CPlugin::Deallocate,
  NULL,
  CPlugin::HasMethod,
  CPlugin::Invoke,
  CPlugin::InvokeDefault,
  CPlugin::HasProperty,
  CPlugin::GetProperty,
  NULL,
  NULL,
};

static NPError GetValue(NPP instance, NPPVariable variable, void* value) {
  switch(variable) {
  default:
    return NPERR_GENERIC_ERROR;
  case NPPVpluginNameString:
    *((char **)value) = "ScreenCapturePlugin";
    break;
  case NPPVpluginDescriptionString:
    *((char **)value) = "ScreenCapturePlugin plugin.";
    break;
  case NPPVpluginScriptableNPObject:
    if(!so) {
      so = npnfuncs->createobject(instance, &plugin_ref_obj);
    }
    // Retain the object since we keep it in plugin code
    // so that it won't be freed by browser.
    npnfuncs->retainobject(so);
    *(NPObject **)value = so;
    break;
#if defined(XULRUNNER_SDK)
  case NPPVpluginNeedsXEmbed:
    *((PRBool *)value) = PR_FALSE;
    break;
#endif
  }
  return NPERR_NO_ERROR;
}

static NPError NewNPInstance(NPMIMEType pluginType, NPP instance,
                             uint16_t mode, int16_t argc, char* argn[],
                             char* argv[], NPSavedData* saved) {
  BOOL bWindowed = TRUE;
  npnfuncs->setvalue(instance, NPPVpluginWindowBool, (void *)bWindowed);
  return NPERR_NO_ERROR;
}

static NPError DestroyNPInstance(NPP instance, NPSavedData** save) {
  if(so) {
    npnfuncs->releaseobject(so);
  }
  so = NULL;
  return NPERR_NO_ERROR;
}

NPError SetWindow(NPP instance, NPWindow* window) {
  hWnd = (HWND)window->window;
  return NPERR_NO_ERROR;
}

NPError NPP_NewStream(NPP instance, NPMIMEType type, NPStream* stream,
                      NPBool seekable, uint16_t* stype) {

  return NPERR_GENERIC_ERROR;
}

NPError NPP_DestroyStream(NPP instance, NPStream* stream, NPReason reason) {
  return NPERR_GENERIC_ERROR;
}

int16_t NPP_HandleEvent(NPP instance, void* event) {
  return 0;
}

#ifdef __cplusplus
extern "C" {
#endif
  NPError OSCALL NP_GetEntryPoints(NPPluginFuncs* nppfuncs) {
    nppfuncs->version = (NP_VERSION_MAJOR << 8) | NP_VERSION_MINOR;
    nppfuncs->newp = NewNPInstance;
    nppfuncs->destroy = DestroyNPInstance;
    nppfuncs->getvalue = GetValue;
    nppfuncs->setwindow = SetWindow;
    nppfuncs->event = NPP_HandleEvent;
    nppfuncs->newstream = NPP_NewStream;
    nppfuncs->destroystream = NPP_DestroyStream;
    return NPERR_NO_ERROR;
  }

#ifndef HIBYTE
#define HIBYTE(x) ((((uint32)(x)) & 0xff00) >> 8)
#endif

NPError OSCALL NP_Initialize(NPNetscapeFuncs* npnf
#if !defined(_WINDOWS) && !defined(WEBKIT_DARWIN_SDK)
               , NPPluginFuncs *nppfuncs) {
#else
               ) {
#endif
                 if(npnf == NULL) {
                   return NPERR_INVALID_FUNCTABLE_ERROR;
                 }
                 if(HIBYTE(npnf->version) > NP_VERSION_MAJOR) {
                   return NPERR_INCOMPATIBLE_VERSION_ERROR;
                 }
                 npnfuncs = npnf;
#if !defined(_WINDOWS) && !defined(WEBKIT_DARWIN_SDK)
                 NP_GetEntryPoints(nppfuncs);
#endif
                 return NPERR_NO_ERROR;
}

NPError  OSCALL NP_Shutdown() {
  return NPERR_NO_ERROR;
}

char* NP_GetMIMEDescription(void) {
  return "application/x-screencapture";
}

// Needs to be present for WebKit based browsers.
NPError OSCALL NP_GetValue(void* npp, NPPVariable variable, void* value) {
  return GetValue((NPP)npp, variable, value);
}
#ifdef __cplusplus
}
#endif