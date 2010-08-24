/* ***** BEGIN LICENSE BLOCK *****
* Version: MPL 1.1/GPL 2.0/LGPL 2.1
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

#include <string>
#include <stdlib.h>
#include <string.h>
#include "plugin.h"
#include "save.h"

#ifdef _WINDOWS
#include <atlenc.h>
#include <ShlObj.h>
#include <io.h>
#define snprintf sprintf_s
#elif defined GTK
#include <sys/types.h>
#include <sys/stat.h>
#include <gtk/gtk.h>
#include <unistd.h>
#elif defined __APPLE__
#include <resolv.h>
#define MAX_PATH 260
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

static bool SaveFileBase64(const char* fileName, const char* base64,
                           int base64size) {
#ifdef _WINDOWS
  int byteLength = Base64DecodeGetRequiredLength(base64size);
  unsigned char* data = new unsigned char[byteLength];
  Base64Decode(base64, base64size, data, &byteLength);
#elif defined GTK
  int byteLength = (base64size * 3) / 4;
  unsigned char* data = new unsigned char[byteLength];
  gint state = 0;
  guint save = 0;
  byteLength = g_base64_decode_step(base64, base64size, data,
                                    &state, &save);
#elif defined __APPLE__
  int byteLength = (base64size * 3) / 4;
  unsigned char* data = new unsigned char[byteLength];
  byteLength = b64_pton(base64, data, byteLength);
#endif

  bool result = SaveFile(fileName, data, byteLength);
  delete [] data;
  return result;
}

bool GenerateUniqueFileName(const std::string& srcFile, std::string* destFile) {
  *destFile = srcFile;
  size_t pPostfix = srcFile.rfind('.');
  char buf[8];
  for (int i=1; i < 1000; i++) {
    if (access(destFile->c_str(), 0)) {
      return true;
    } else {
      snprintf(buf, sizeof(buf), "(%d)", i);
      *destFile = pPostfix != std::string::npos ?
          srcFile.substr(0, pPostfix) + buf + srcFile.substr(pPostfix) :
          srcFile + buf;
    }
  }
  return false;
}

static void InvokeCallback(NPP npp, NPObject* callback, const char* param) {
  NPVariant npParam;
  STRINGZ_TO_NPVARIANT(param, npParam);
  NPVariant result;
  VOID_TO_NPVARIANT(result);
  npnfuncs->invokeDefault(npp, callback, &npParam, 1, &result);
}

static void InvokeCallback(NPP npp, NPObject* callback, bool param) {
  NPVariant npParam;
  BOOLEAN_TO_NPVARIANT(param, npParam);
  NPVariant result;
  VOID_TO_NPVARIANT(result);
  npnfuncs->invokeDefault(npp, callback, &npParam, 1, &result);
}

#ifdef _WINDOWS
std::string GetPicturePath() {
  TCHAR szDisplayName[MAX_PATH];
  PIDLIST_ABSOLUTE pIdList;
  SHGetSpecialFolderLocation(NULL, CSIDL_MYPICTURES, &pIdList);
  if (SHGetPathFromIDList(pIdList, szDisplayName)) {
    char utf8[MAX_PATH];
    WideCharToMultiByte(CP_UTF8, 0, szDisplayName, -1, utf8, MAX_PATH, 0, 0);
    return utf8;
  }
  return std::string();
}

int WINAPI BrowserCallBack(HWND hwnd, UINT uMsg, LPARAM lParam, LPARAM lpData) {
  switch (uMsg) {
  case BFFM_INITIALIZED:
    SendMessage(hwnd, BFFM_SETSELECTION, TRUE, lpData);
    break;
  }
  return 0;
}
#elif defined GTK
static guchar* gSaveData = NULL;
static int gSaveDataLength = 0;
static GtkWidget* gSaveDialog = NULL;
static NPObject* gSaveCallback = NULL;
static GtkWidget* gFolderDialog = NULL;
static NPObject* gFolderCallback = NULL;

static void FreeSaveData() {
  if (gSaveData)
    free(gSaveData);
  gSaveData = NULL;
  gSaveDataLength = 0;
}

static void ReleaseSaveCallback() {
  if (gSaveCallback) {
    npnfuncs->releaseobject(gSaveCallback);
    gSaveCallback = NULL;
  }
}

static void ReleaseFolderCallback() {
  if (gFolderCallback) {
    npnfuncs->releaseobject(gFolderCallback);
    gFolderCallback = NULL;
  }
}

static void OnDialogResponse(GtkDialog* dialog, gint response,
                             gpointer userData) {
  // Hide the dialog to prevent it from covering any alert dialog opened by
  // the JavaScript callback.
  gtk_widget_hide(GTK_WIDGET(dialog));
  if (response == GTK_RESPONSE_ACCEPT) {
    char* file = gtk_file_chooser_get_filename(GTK_FILE_CHOOSER(dialog));
    if (dialog == GTK_DIALOG(gSaveDialog)) {
      if (file && gSaveData) {
        InvokeCallback((NPP)userData, gSaveCallback,
                       SaveFile(file, gSaveData, gSaveDataLength));
        // To indicate the callback has already been invoked.
        ReleaseSaveCallback();
      }
    } else {
      InvokeCallback((NPP)userData, gFolderCallback, file);
    }
    g_free(file);
  }
  gtk_widget_destroy(GTK_WIDGET(dialog));
}

static void OnDialogDestroy(GtkObject* object, gpointer userData) {
  if (GTK_WIDGET(object) == gSaveDialog) {
    FreeSaveData();
    // The callback has not been invoked, meaning that the dialog has been
    // canceled.
    if (gSaveCallback)
      InvokeCallback((NPP)userData, gSaveCallback, true);
    ReleaseSaveCallback();
    gSaveDialog = NULL;
  } else {
    ReleaseFolderCallback();
    gFolderDialog = NULL;
  }
}

#elif defined __APPLE__
std::string GetSaveFileName(const char* title, const char* path, const char* dialog_title);
std::string GetDocumentFolder();
std::string SetSaveFolder(const char* path, const char* dialog_title);
bool OpenSaveFolder(const char* path);
bool IsFolder(const char* path);
#endif

bool GetDefaultSavePath(ScriptablePluginObject* obj, const NPVariant* args,
                        unsigned int argCount, NPVariant* result) {
#ifdef _WINDOWS
  std::string pathStr = GetPicturePath();
  const char* path = pathStr.c_str();
  size_t length = pathStr.length();
#elif defined GTK
  const char* path = g_get_user_special_dir(G_USER_DIRECTORY_PICTURES);
  size_t length = strlen(path);
#elif defined __APPLE__
  std::string pathStr = GetDocumentFolder();
  const char* path = pathStr.c_str();
  size_t length = pathStr.length();
#endif
  char* copy = (char *)npnfuncs->memalloc(length + 1);
  memcpy(copy, path, length);
  copy[length] = 0;
  STRINGN_TO_NPVARIANT(copy, length, *result);
  return true;
}

bool AutoSave(ScriptablePluginObject* obj, const NPVariant* args,
              unsigned int argCount, NPVariant* result) {
  if (argCount < 3 || !NPVARIANT_IS_STRING(args[0]) ||
      !NPVARIANT_IS_STRING(args[1]) || !NPVARIANT_IS_STRING(args[2]))
    return false;

  const char* url = (const char*)NPVARIANT_TO_STRING(args[0]).UTF8Characters;
  const char* title = (const char*)NPVARIANT_TO_STRING(args[1]).UTF8Characters;
  const char* path = (const char*)NPVARIANT_TO_STRING(args[2]).UTF8Characters;

  const char* base64 = strstr(url, "base64,");
  if (!base64)
    return false;

  base64 += 7;
  int base64size = NPVARIANT_TO_STRING(args[0]).UTF8Length - 7;

  result->type = NPVariantType_Bool;
  result->value.boolValue = 1;

#ifdef _WINDOWS
  TCHAR szWideBuf[MAX_PATH] = { 0 };
  MultiByteToWideChar(CP_UTF8, 0, path, -1, szWideBuf, MAX_PATH);
  if (!PathIsDirectory(szWideBuf)) {
    result->value.boolValue = 0;
    return true;
  }
  char szPath[MAX_PATH] = { 0 };
  WideCharToMultiByte(CP_ACP, 0, szWideBuf, -1, szPath, MAX_PATH, 0, 0);
  path = szPath;

  memset(szWideBuf, 0, sizeof(szWideBuf));
  MultiByteToWideChar(CP_UTF8, 0, title, -1, szWideBuf, MAX_PATH);
  char szTitle[MAX_PATH] = { 0 };
  WideCharToMultiByte(CP_ACP, 0, szWideBuf, -1, szTitle, MAX_PATH, 0, 0);
  title = szTitle;
#elif defined GTK
  struct stat st;
  if (stat(path, &st) != 0 || !S_ISDIR(st.st_mode)) {
    result->value.boolValue = 0;
    return true;
  }
#elif defined __APPLE__
  if (!IsFolder(path)) {
    result->value.boolValue = 0;
    return true;
  }
#endif

  static const char* kReplacedChars = "\\/:*?\"<>|";
  std::string filename(path);
  filename += '/';
  int len = strlen(title);
  for (int i = 0; i < len; i++) {
    filename += (title[i] < ' ' || strchr(kReplacedChars, title[i]) == NULL) ?
        title[i] : '-';
  }
  filename += ".png";
  std::string unique_filename;
  if (!GenerateUniqueFileName(filename, &unique_filename) ||
      !SaveFileBase64(unique_filename.c_str(), base64, base64size))
    result->value.boolValue = 0;

  return true;
}

bool SetSavePath(ScriptablePluginObject* obj, const NPVariant* args,
                 uint32_t argCount, NPVariant* result) {
  if (argCount < 3 || !NPVARIANT_IS_STRING(args[0]) ||
      !NPVARIANT_IS_OBJECT(args[1]) || !NPVARIANT_TO_OBJECT(args[1]) ||
      !NPVARIANT_IS_STRING(args[2]))
    return false;

  const char* path = NPVARIANT_TO_STRING(args[0]).UTF8Characters;
  NPObject* callback = NPVARIANT_TO_OBJECT(args[1]);
  const char* dialog_title = NPVARIANT_TO_STRING(args[2]).UTF8Characters;

#ifdef _WINDOWS
  TCHAR szDisplayName[MAX_PATH] = {0};
  TCHAR szSavePath[MAX_PATH] = {0};
  TCHAR szTitle[MAX_PATH] = {0};

  if (NPVARIANT_TO_STRING(args[0]).UTF8Length > 0)
    MultiByteToWideChar(CP_UTF8, 0, path, -1, szSavePath, MAX_PATH);
  if (NPVARIANT_TO_STRING(args[2]).UTF8Length > 0)
    MultiByteToWideChar(CP_UTF8, 0, dialog_title, -1, szTitle, MAX_PATH);

  BROWSEINFO info={0};
  info.hwndOwner = ((CPlugin*)obj->npp->pdata)->GetHWnd();
  info.lpszTitle = szTitle;
  info.pszDisplayName = szDisplayName;
  info.lpfn = BrowserCallBack;
  info.ulFlags = BIF_RETURNONLYFSDIRS;
  info.lParam = (LPARAM)szSavePath;
  BOOL bRet = SHGetPathFromIDList(SHBrowseForFolder(&info), szDisplayName);

  char utf8[MAX_PATH];
  WideCharToMultiByte(CP_UTF8, 0,
                      bRet ? szDisplayName : szSavePath,
                      -1, utf8, MAX_PATH, 0, 0);
  InvokeCallback(obj->npp, callback, utf8);
#elif defined GTK
  ReleaseFolderCallback();
  gFolderCallback = callback;
  npnfuncs->retainobject(callback);
  if (!gFolderDialog) {
    GtkWidget *dialog = gtk_file_chooser_dialog_new(
        dialog_title, NULL,
        GTK_FILE_CHOOSER_ACTION_SELECT_FOLDER,
        GTK_STOCK_CANCEL, GTK_RESPONSE_CANCEL,
        GTK_STOCK_OPEN, GTK_RESPONSE_ACCEPT, NULL);
    gtk_window_set_position(GTK_WINDOW(dialog), GTK_WIN_POS_CENTER);
    gtk_file_chooser_set_current_folder(GTK_FILE_CHOOSER(dialog), path);

    g_signal_connect(dialog, "response", G_CALLBACK(OnDialogResponse),
                     obj->npp);
    g_signal_connect(dialog, "destroy", G_CALLBACK(OnDialogDestroy), obj->npp);
    gtk_widget_show_all(dialog);
    gtk_window_set_keep_above(GTK_WINDOW(dialog), TRUE);
    gFolderDialog = dialog;
  }
  gtk_window_present(GTK_WINDOW(gFolderDialog));
#elif defined __APPLE__
  InvokeCallback(obj->npp, callback, SetSaveFolder(path, dialog_title).c_str());
#endif

  return true;
}

bool OpenSavePath(ScriptablePluginObject* obj, const NPVariant* args,
                  unsigned int argCount, NPVariant* result) {
  if (argCount < 1 || !NPVARIANT_IS_STRING(args[0]))
    return false;

  const char* path = NPVARIANT_TO_STRING(args[0]).UTF8Characters;

#ifdef _WINDOWS
  TCHAR szSavePath[MAX_PATH] = L"";
  MultiByteToWideChar(CP_UTF8, 0, path, -1, szSavePath, MAX_PATH);
  ShellExecute(NULL, L"open", szSavePath, NULL, NULL, SW_SHOWNORMAL);
#elif defined GTK
  if (fork() == 0) {
    execlp("xdg-open", "xdg-open", path, NULL);
    execlp("gnome-open", "gnome-open", path, NULL);
    exit(1);
  }
#elif defined __APPLE__
  OpenSaveFolder(path);
#endif

  return true;
}

bool SaveScreenshot(ScriptablePluginObject* obj, const NPVariant* args,
                    uint32_t argCount, NPVariant* result) {
  if (argCount < 5 || !NPVARIANT_IS_STRING(args[0]) ||
      !NPVARIANT_IS_STRING(args[1]) || !NPVARIANT_IS_STRING(args[2]) ||
      !NPVARIANT_IS_OBJECT(args[3]) || !NPVARIANT_IS_STRING(args[4]))
    return false;

  char* url = (char*)NPVARIANT_TO_STRING(args[0]).UTF8Characters;
  char* title = (char*)NPVARIANT_TO_STRING(args[1]).UTF8Characters;
  char* path = (char*)NPVARIANT_TO_STRING(args[2]).UTF8Characters;
  NPObject* callback = NPVARIANT_TO_OBJECT(args[3]);
  char* dialog_title = (char*)NPVARIANT_TO_STRING(args[4]).UTF8Characters;

  char* base64 = strstr(url, "base64,");
  if (!base64)
    return false;

  base64 += 7;
  int base64size = NPVARIANT_TO_STRING(args[0]).UTF8Length - 7;

#ifdef _WINDOWS
  TCHAR szSavePath[MAX_PATH] = L"";
  char szInitPath[MAX_PATH];

  MultiByteToWideChar(CP_UTF8, 0, path, -1, szSavePath, MAX_PATH);
  WideCharToMultiByte(CP_ACP, 0, szSavePath, -1, szInitPath, MAX_PATH, 0, 0);

  char szFile[MAX_PATH] = "";
  TCHAR szTitle[MAX_PATH];
  MultiByteToWideChar(CP_UTF8, 0, title, -1, szTitle, MAX_PATH);
  WideCharToMultiByte(CP_ACP, 0, szTitle, -1, szFile, MAX_PATH, 0, 0);

  OPENFILENAMEA Ofn = {0};
  Ofn.lStructSize = sizeof(OPENFILENAMEA);
  Ofn.hwndOwner = ((CPlugin*)obj->npp->pdata)->GetHWnd();
  Ofn.lpstrFilter = "PNG Image\0*.png\0All Files\0*.*\0\0";
  Ofn.lpstrFile = szFile;
  Ofn.nMaxFile = sizeof(szFile);
  Ofn.lpstrFileTitle = NULL;
  Ofn.nMaxFileTitle = 0;
  Ofn.lpstrInitialDir = szInitPath;
  Ofn.Flags = OFN_SHOWHELP | OFN_OVERWRITEPROMPT;
  Ofn.lpstrTitle = NULL;
  Ofn.lpstrDefExt = "png";

  InvokeCallback(obj->npp, callback,
      !GetSaveFileNameA(&Ofn) || SaveFileBase64(szFile, base64, base64size));

#elif defined GTK
  ReleaseSaveCallback();
  gSaveCallback = callback;
  npnfuncs->retainobject(callback);

  FreeSaveData();
  gsize byteLength = (base64size * 3) / 4;
  gSaveData = (guchar*)malloc(byteLength);
  gint state = 0;
  guint save = 0;
  gSaveDataLength = g_base64_decode_step(base64, base64size, gSaveData,
                                         &state, &save);

  if (!gSaveDialog) {
    GtkWidget *dialog = gtk_file_chooser_dialog_new(
        dialog_title, NULL,
        GTK_FILE_CHOOSER_ACTION_SAVE,
        GTK_STOCK_CANCEL, GTK_RESPONSE_CANCEL,
        GTK_STOCK_SAVE, GTK_RESPONSE_ACCEPT, NULL);
    gtk_window_set_position(GTK_WINDOW(dialog), GTK_WIN_POS_CENTER);
    gtk_file_chooser_set_do_overwrite_confirmation(GTK_FILE_CHOOSER(dialog),
                                                   TRUE);
    gtk_file_chooser_set_current_folder(GTK_FILE_CHOOSER(dialog), path);

    GtkFileFilter *file_filter = gtk_file_filter_new();
    gtk_file_filter_set_name(file_filter, "PNG Image");
    gtk_file_filter_add_pattern(file_filter, "*.png");
    gtk_file_chooser_add_filter(GTK_FILE_CHOOSER(dialog), file_filter);

    file_filter = gtk_file_filter_new();
    gtk_file_filter_set_name(file_filter, "All Files");
    gtk_file_filter_add_pattern(file_filter, "*.*");
    gtk_file_chooser_add_filter(GTK_FILE_CHOOSER(dialog), file_filter);
    g_signal_connect(dialog, "response", G_CALLBACK(OnDialogResponse),
                     obj->npp);
    g_signal_connect(dialog, "destroy", G_CALLBACK(OnDialogDestroy), obj->npp);
    gtk_widget_show_all(dialog);
    gtk_window_set_keep_above(GTK_WINDOW(dialog), TRUE);
    gSaveDialog = dialog;
  }
  gtk_window_present(GTK_WINDOW(gSaveDialog));
#elif defined __APPLE__
  std::string file = GetSaveFileName(title, path, dialog_title);
  InvokeCallback(obj->npp, callback,
      file.empty() || SaveFileBase64(file.c_str(), base64, base64size));
#endif

  return true;
}
