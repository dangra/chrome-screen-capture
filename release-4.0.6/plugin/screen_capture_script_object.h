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

  // Get system default save path for pictures.
  bool GetDefaultSavePath(const NPVariant* args, uint32_t argCount,
                          NPVariant* result);

  // Save the picture to the preset save location without prompting
  // a save dialog.
  bool AutoSave(const NPVariant* args, uint32_t argCount,
                NPVariant* result);

  // Set save location.
  bool SetSavePath(const NPVariant* args, uint32_t argCount,
                   NPVariant* result);

  // Open save location.
  bool OpenSavePath(const NPVariant* args, uint32_t argCount,
                    NPVariant* result);

  // Prompt a save dialog to save the picture.
  bool SaveScreenshot(const NPVariant* args, uint32_t argCount,
                      NPVariant* result);

  // Save the picture to clipboard.
  bool SaveToClipboard(const NPVariant* args, uint32_t argCount,
                       NPVariant* result);
  bool PrintImage(const NPVariant* args, uint32_t argCount, NPVariant* result);

  void InitHandler();

private:
  enum ImageType {
    kImageTypePNG = 0,
    kImageTypeJPEG
  };
  static bool SaveFile(const char* fileName, const unsigned char* bytes,
                       int byteLength);
  static bool SaveFileBase64(const char* fileName, const char* base64,
                             int base64size);
  bool GenerateUniqueFileName(const std::string& srcFile, 
                              std::string* destFile);
  static void InvokeCallback(NPP npp, NPObject* callback, const char* param);
  static void InvokeCallback(NPP npp, NPObject* callback, bool param0, 
                             const char* param1 = NULL);
#ifdef _WINDOWS
  bool PrintImageWin(HDC printer_dc, ImageType imagetype, 
                     unsigned char* imagedata, int imagelen, 
                     int width, int height);
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
