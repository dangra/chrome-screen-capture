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
#include <plbase64.h>

#ifdef _WINDOWS
#include <atlenc.h>
#include <atlstr.h>
#include <comutil.h>
#endif

#ifdef GTK
#include <gtk/gtk.h>
#endif

#include <vector>
#include "npcapture.h"

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

static bool SaveFile(char* fileName, char* bytes, int byteLength) {
  FILE* out = fopen(fileName, "wb");
  if (out) {
    fwrite(bytes, byteLength, 1, out);
    fclose(out);
    return true;
  }
  return false;
}

#ifdef GTK
static char* gLastData = NULL;
static int gLastDataLength = 0;

static void FreeLastData() {
  if (gLastData)
    free(gLastData);
  gLastData = NULL;
  gLastDataLength = 0;
}

GtkWidget *gLastDialog = NULL;

static void OnDialogResponse(GtkDialog* dialog, gint response,
                             gpointer userData) {
  if (response == GTK_RESPONSE_OK) {
    char *file = gtk_file_chooser_get_filename(GTK_FILE_CHOOSER(dialog));
    if (file && gLastData) {
      SaveFile(file, gLastData, gLastDataLength);
      g_free(file);
    }
  }
  gtk_widget_destroy(GTK_WIDGET(dialog));
}

static void OnDialogDestroy(GtkObject* object, gpointer userData) {
  FreeLastData();
  gLastDialog = NULL;
}
#endif

bool CPlugin::SaveScreenshot(NPObject* obj, const NPVariant* args,
                             uint32_t argCount, NPVariant* result) {
  result->type = NPVariantType_Bool;
  result->value.boolValue = TRUE;

  if (argCount < 1 || !NPVARIANT_IS_STRING(args[0]))
    return false;

  char* url = (char*)NPVARIANT_TO_STRING(args[0]).UTF8Characters;
  if (!url)
    return false;

  char* title = NULL;
  if (argCount == 2 && NPVARIANT_IS_STRING(args[1]))
    title = (char*)NPVARIANT_TO_STRING(args[0]).UTF8Characters;

  char* base64 = strstr(url, "base64,");
  if (!base64)
    return false;
  base64 += 7;
  
#ifdef _WINDOWS
  char szFile[1024] = "";
  OPENFILENAMEA Ofn = {0};
  Ofn.lStructSize = sizeof(OPENFILENAMEA);
  Ofn.hwndOwner = (HWND)((CPlugin*)obj)->hWnd;
  Ofn.lpstrFilter = "PNG Image\0*.png\0All Files\0*.*\0\0";
  Ofn.lpstrFile = szFile;
  Ofn.nMaxFile = sizeof(szFile);
  Ofn.lpstrFileTitle = NULL;
  Ofn.nMaxFileTitle = 0;
  Ofn.lpstrInitialDir = NULL;
  Ofn.Flags = OFN_SHOWHELP | OFN_OVERWRITEPROMPT;
  Ofn.lpstrTitle = NULL;
  Ofn.lpstrDefExt = "png";
 
  GetSaveFileNameA(&Ofn);

  if (szFile[0] != '\0') {
    char* url = (char*)NPVARIANT_TO_STRING(args[0]).UTF8Characters;
    char* base64 = strstr(url, "base64,") + 7;
    int startpos =  base64 - url;
    int base64size = NPVARIANT_TO_STRING(args[0]).UTF8Length - startpos;
    int byteLength = Base64DecodeGetRequiredLength(base64size);
    BYTE* bytes = new BYTE[byteLength];
    if (!SaveFile(szFile, (char*)bytes, byteLength)) {
      result->value.boolValue = FALSE;
    }
  }
#endif

#ifdef GTK
  FreeLastData();
  int startpos =  base64 - url;
  int base64size = NPVARIANT_TO_STRING(args[0]).UTF8Length - startpos;
  int byteLength =  (base64size * 3) / 4;
  char* bytes = PL_Base64Decode(base64, base64size, NULL);
  if (!bytes)
    return false;
  gLastData = bytes;
  gLastDataLength = byteLength;

  if (!gLastDialog) {
    GtkWidget *dialog = gtk_file_chooser_dialog_new(
        title, NULL,
        GTK_FILE_CHOOSER_ACTION_SAVE,
        GTK_STOCK_CANCEL, GTK_RESPONSE_CANCEL,
        GTK_STOCK_OK, GTK_RESPONSE_OK, NULL);
    gtk_window_set_position(GTK_WINDOW(dialog), GTK_WIN_POS_CENTER);
    gtk_file_chooser_set_do_overwrite_confirmation(GTK_FILE_CHOOSER(dialog),
                                                   TRUE);

    GtkFileFilter *file_filter = gtk_file_filter_new();
    gtk_file_filter_set_name(file_filter, "PNG Image");
    gtk_file_filter_add_pattern(file_filter, "*.png");
    gtk_file_chooser_add_filter(GTK_FILE_CHOOSER(dialog), file_filter);

    file_filter = gtk_file_filter_new();
    gtk_file_filter_set_name(file_filter, "All Files");
    gtk_file_filter_add_pattern(file_filter, "*.*");
    gtk_file_chooser_add_filter(GTK_FILE_CHOOSER(dialog), file_filter);
    g_signal_connect(dialog, "response", G_CALLBACK(OnDialogResponse), NULL);
    g_signal_connect(dialog, "destroy", G_CALLBACK(OnDialogDestroy), NULL);
    gtk_widget_show_all(dialog);
    gtk_window_set_keep_above(GTK_WINDOW(dialog), TRUE);
    gLastDialog = dialog;
  }
  gtk_window_present(GTK_WINDOW(gLastDialog));
#endif

  return true;
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

static NPError NewNPInstance(NPMIMEType pluginType, NPP instance,
                             uint16_t mode, int16_t argc, char* argn[],
                             char* argv[], NPSavedData* saved) {
  int bWindowed = 1;
  npnfuncs->setvalue(instance, NPPVpluginWindowBool, (void *)bWindowed);
  instance->pdata = NULL;
  instance->ndata = NULL;
  return NPERR_NO_ERROR;
}

static NPError DestroyNPInstance(NPP instance, NPSavedData** save) {
  if (instance->pdata) {
    npnfuncs->releaseobject((NPObject*)instance->pdata);
  }
  instance->pdata = NULL;
  instance->ndata = NULL;
  return NPERR_NO_ERROR;
}

NPError SetWindow(NPP instance, NPWindow* window) {
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
  return "application/x-screencapture::Screen Capture Plugin";
}

// Needs to be present for WebKit based browsers.
NPError OSCALL NP_GetValue(void* npp, NPPVariable variable, void* value) {
  return GetValue((NPP)npp, variable, value);
}
#ifdef __cplusplus
}
#endif
