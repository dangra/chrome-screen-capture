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

#include <vector>
#include "save.h"

#ifdef _WINDOWS
#include <atlenc.h>
#include "plugin.h"
#endif

#ifdef GTK
#include <gtk/gtk.h>
#endif

#ifdef __APPLE__
#include <resolv.h>
#endif

class CPlugin;

static bool SaveFile(const char* fileName, const unsigned char* bytes,
                     int byteLength) {
  FILE* out = fopen(fileName, "wb");
  if (out) {
    fwrite(bytes, byteLength, 1, out);
    fclose(out);
    return true;
  }
  return false;
}

#ifdef GTK
static guchar* gLastData = NULL;
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

#ifdef __APPLE__
const char* GetSaveFileName();
#endif

bool SaveScreenshot(NPObject* obj, const NPVariant* args,
                    uint32_t argCount, NPVariant* result) {
  if (argCount < 1 || !NPVARIANT_IS_STRING(args[0]))
    return false;

  char* url = (char*)NPVARIANT_TO_STRING(args[0]).UTF8Characters;
  if (!url)
    return false;

  char* title = NULL;
  if (argCount == 2 && NPVARIANT_IS_STRING(args[1]))
    title = (char*)NPVARIANT_TO_STRING(args[1]).UTF8Characters;

  char* base64 = strstr(url, "base64,");
  if (!base64)
    return false;
  base64 += 7;
  int base64size = NPVARIANT_TO_STRING(args[0]).UTF8Length - 7;

  result->type = NPVariantType_Bool;
  result->value.boolValue = 1;

#ifdef _WINDOWS
  char szFile[1024] = "";
  OPENFILENAMEA Ofn = {0};
  Ofn.lStructSize = sizeof(OPENFILENAMEA);
  Ofn.hwndOwner = (HWND)((ScriptablePluginObject*)obj)->hWnd;
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
    int byteLength = Base64DecodeGetRequiredLength(base64size);
    BYTE* bytes = new BYTE[byteLength];
    Base64Decode(base64, base64size, bytes, &byteLength);
    if (!SaveFile(szFile, bytes, byteLength))
      result->value.boolValue = 0;
  }
#endif

#ifdef GTK
  FreeLastData();
  gsize byteLength = (base64size * 3) / 4;
  gLastData = (guchar*)malloc(byteLength);
  gint state = 0;
  guint save = 0;
  gLastDataLength = g_base64_decode_step(base64, base64size, gLastData,
                                         &state, &save);

  if (!gLastDialog) {
    GtkWidget *dialog = gtk_file_chooser_dialog_new(
        title, NULL,
        GTK_FILE_CHOOSER_ACTION_SAVE,
        GTK_STOCK_CANCEL, GTK_RESPONSE_CANCEL,
        GTK_STOCK_OK, GTK_RESPONSE_OK, NULL);
    gtk_window_set_position(GTK_WINDOW(dialog), GTK_WIN_POS_CENTER);
    gtk_file_chooser_set_do_overwrite_confirmation(GTK_FILE_CHOOSER(dialog),
                                                   TRUE);
    const gchar *dir = g_get_user_special_dir(G_USER_DIRECTORY_PICTURES);
    if (dir)
      gtk_file_chooser_set_current_folder(GTK_FILE_CHOOSER(dialog), dir);

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

#ifdef __APPLE__
  const char* file = GetSaveFileName();
  if (file) {
    size_t byteLength = (base64size * 3) / 4;
    u_char* data = (u_char*)malloc(byteLength); 
    int dataLength = b64_pton(base64, data, byteLength);

    if (!SaveFile(file, data, dataLength))
      result->value.boolValue = 0;
  }
#endif

  return true;
}

