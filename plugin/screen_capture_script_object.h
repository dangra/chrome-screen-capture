#ifndef SCREEN_CAPTURE_SCRIPT_OBJECT_H_
#define SCREEN_CAPTURE_SCRIPT_OBJECT_H_

#ifdef GTK
#include <gtk/gtk.h>
#include <sys/types.h>
#endif

#include "npfunctions.h"
#include "script_object_base.h"

class ScreenCaptureScriptObject: public ScriptObjectBase {
public:
  ScreenCaptureScriptObject() {}
  virtual ~ScreenCaptureScriptObject() {}

  static NPObject* Allocate(NPP npp, NPClass* aClass);

  void Deallocate();
  void Invalidate() {}
  bool Construct(const NPVariant* args, uint32_t argCount,
                 NPVariant* result) { return true; }

  bool GetDefaultSavePath(const NPVariant* args, uint32_t argCount,
                          NPVariant* result);
  bool AutoSave(const NPVariant* args, uint32_t argCount,
                NPVariant* result);
  bool SetSavePath(const NPVariant* args, uint32_t argCount,
                   NPVariant* result);
  bool OpenSavePath(const NPVariant* args, uint32_t argCount,
                    NPVariant* result);
  bool SaveScreenshot(const NPVariant* args, uint32_t argCount,
                      NPVariant* result);
  bool SaveToClipboard(const NPVariant* args, uint32_t argCount,
                       NPVariant* result);

  void InitHandler();

private:
  static bool SaveFile(const char* fileName, const unsigned char* bytes,
                       int byteLength);
  static bool SaveFileBase64(const char* fileName, const char* base64,
                             int base64size);
  bool GenerateUniqueFileName(const std::string& srcFile, std::string* destFile);
  static void InvokeCallback(NPP npp, NPObject* callback, const char* param);
  static void InvokeCallback(NPP npp, NPObject* callback, bool param);
#ifdef _WINDOWS

  std::string GetPicturePath();
#elif defined GTK

  static void FreeSaveData();
  static void ReleaseSaveCallback();
  static void ReleaseFolderCallback();
  static void OnDialogResponse(GtkDialog* dialog, gint response,
                               gpointer userData);
  static void OnDialogDestroy(GtkObject* object, gpointer userData);

  static guchar* save_data_;
  static int save_data_length_;
  static GtkWidget* save_dialog_;
  static NPObject* save_callback_;
  static GtkWidget* folder_dialog_;
  static NPObject* folder_callback_;
#endif

  NPP npp;
};

#endif  // SCREEN_CAPTURE_SCRIPT_OBJECT_H_
