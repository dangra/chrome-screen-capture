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
*   Jing Zhao <jingzhao@google.com>
*   Xianzhu Wang <wangxianzhu@google.com>
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

#include "npcapture.h"
#include "save.h"

NPNetscapeFuncs* npnfuncs = NULL;

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
  bool ret_val = false;
  if (!name) {
    return ret_val;
  }
  if (!strncmp((const char*)name, kSaveScreenshot,
               strlen(kSaveScreenshot))) {
    ret_val = SaveScreenshot(obj, args, argCount, result);
  } else {
    // Exception handling. 
    npnfuncs->setexception(obj, "exception during invocation");
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

static NPError NPP_GetValue(NPP instance, NPPVariable variable, void* value) {
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
    if (!instance->pdata) {
      instance->pdata = (void*)npnfuncs->createobject(instance, &plugin_ref_obj);
      ((CPlugin*)instance->pdata)->hWnd = instance->ndata;
    }

    // Retain the object since we keep it in plugin code
    // so that it won't be freed by browser.
    npnfuncs->retainobject((NPObject*)instance->pdata);
    *(NPObject **)value = (NPObject*)instance->pdata;
    break;
  case NPPVpluginNeedsXEmbed:
    *((char *)value) = 1;
    break;
  }
  return NPERR_NO_ERROR;
}

static NPError NPP_New(NPMIMEType pluginType, NPP instance,
                             uint16_t mode, int16_t argc, char* argn[],
                             char* argv[], NPSavedData* saved) {
  int bWindowed = 1;
  npnfuncs->setvalue(instance, NPPVpluginWindowBool, (void *)bWindowed);
  instance->pdata = NULL;
  instance->ndata = NULL;
  return NPERR_NO_ERROR;
}

static NPError NPP_Destroy(NPP instance, NPSavedData** save) {
  if (instance->pdata) {
    npnfuncs->releaseobject((NPObject*)instance->pdata);
  }
  instance->pdata = NULL;
  instance->ndata = NULL;
  return NPERR_NO_ERROR;
}

NPError NPP_SetWindow(NPP instance, NPWindow* window) {
  instance->ndata = window->window;
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
    nppfuncs->newp = NPP_New;
    nppfuncs->destroy = NPP_Destroy;
    nppfuncs->getvalue = NPP_GetValue;
    nppfuncs->setwindow = NPP_SetWindow;
    nppfuncs->event = NPP_HandleEvent;
    nppfuncs->newstream = NPP_NewStream;
    nppfuncs->destroystream = NPP_DestroyStream;
    return NPERR_NO_ERROR;
  }

#ifndef HIBYTE
#define HIBYTE(x) ((((unsigned short)(x)) & 0xff00) >> 8)
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
  return "application/x-screencapture::Screen Capture Plugin";
}

// Needs to be present for WebKit based browsers.
NPError OSCALL NP_GetValue(void* npp, NPPVariable variable, void* value) {
  return NPP_GetValue((NPP)npp, variable, value);
}
#ifdef __cplusplus
}
#endif
