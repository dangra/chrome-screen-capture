#include "screen_capture_script_object.h"

#include <stdlib.h>
#include <string.h>
#ifdef _WINDOWS
#include <atlenc.h>
#include <GdiPlus.h>
#include <io.h>
#include <ShlObj.h>
#elif defined GTK
#include <sys/stat.h>
#include <unistd.h>
#elif defined __APPLE__
#include <resolv.h>
#endif

#include <string>

#include "log.h"
#include "screen_capture_plugin.h"

#ifdef _WINDOWS
using namespace Gdiplus;
#define snprintf sprintf_s
struct BrowserParam {
  TCHAR initial_path[MAX_PATH];
  TCHAR title[MAX_PATH];
};
#else
#define MAX_PATH 260
#endif

extern Log g_logger;

NPObject* ScreenCaptureScriptObject::Allocate(NPP npp, NPClass *aClass) {
  g_logger.WriteLog("msg", "ScreenCaptureScriptObject Allocate");
  ScreenCaptureScriptObject* script_object = new ScreenCaptureScriptObject;
  if (script_object != NULL)
    script_object->set_plugin((PluginBase*)npp->pdata);
  return script_object;
}

void ScreenCaptureScriptObject::Deallocate() {
  g_logger.WriteLog("msg", "ScreenCaptureScriptObject Deallocate");
  delete this;
}

void ScreenCaptureScriptObject::InitHandler() {
  FunctionItem item;
  item.function_name = "GetDefaultSavePath";
  item.function_pointer = ON_INVOKEHELPER(
      &ScreenCaptureScriptObject::GetDefaultSavePath);
  AddFunction(item);
  item.function_name = "AutoSave";
  item.function_pointer = ON_INVOKEHELPER(
      &ScreenCaptureScriptObject::AutoSave);
  AddFunction(item);
  item.function_name = "SetSavePath";
  item.function_pointer = ON_INVOKEHELPER(
      &ScreenCaptureScriptObject::SetSavePath);
  AddFunction(item);
  item.function_name = "OpenSavePath";
  item.function_pointer = ON_INVOKEHELPER(
      &ScreenCaptureScriptObject::OpenSavePath);
  AddFunction(item);
  item.function_name = "SaveScreenshot";
  item.function_pointer = ON_INVOKEHELPER(
      &ScreenCaptureScriptObject::SaveScreenshot);
  AddFunction(item);
  item.function_name = "SaveToClipboard";
  item.function_pointer = ON_INVOKEHELPER(
      &ScreenCaptureScriptObject::SaveToClipboard);
  AddFunction(item);
  item.function_name = "PrintImage";
  item.function_pointer = ON_INVOKEHELPER(
      &ScreenCaptureScriptObject::PrintImage);
  AddFunction(item);
}


// static
bool ScreenCaptureScriptObject::SaveFile(
    const char* fileName, const unsigned char* bytes, int byteLength) {
  FILE* out = fopen(fileName, "wb");
  if (out) {
    fwrite(bytes, byteLength, 1, out);
    fclose(out);
    return true;
  }
  return false;
}

// static
bool ScreenCaptureScriptObject::SaveFileBase64(
    const char* fileName, const char* base64, int base64size) {
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

bool ScreenCaptureScriptObject::GenerateUniqueFileName(
    const std::string& srcFile, std::string* destFile) {
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

// static
void ScreenCaptureScriptObject::InvokeCallback(
    NPP npp, NPObject* callback, const char* param) {
  NPVariant npParam;
  STRINGZ_TO_NPVARIANT(param, npParam);
  NPVariant result;
  VOID_TO_NPVARIANT(result);
  NPN_InvokeDefault(npp, callback, &npParam, 1, &result);
}

// static
void ScreenCaptureScriptObject::InvokeCallback(
    NPP npp, NPObject* callback, bool param) {
  NPVariant npParam;
  BOOLEAN_TO_NPVARIANT(param, npParam);
  NPVariant result;
  VOID_TO_NPVARIANT(result);
  NPN_InvokeDefault(npp, callback, &npParam, 1, &result);
}

#ifdef _WINDOWS

std::string ScreenCaptureScriptObject::GetPicturePath() {
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

namespace {

int WINAPI BrowserCallback(
    NativeWindow nw, UINT uMsg, LPARAM lParam, LPARAM lpData) {
  switch (uMsg) {
  case BFFM_INITIALIZED:
    BrowserParam* param = (BrowserParam*)lpData;
    SendMessage(nw, BFFM_SETSELECTION, TRUE, (LPARAM)param->initial_path);
    SetWindowText(nw, param->title);
    NativeWindow treeview = FindWindowEx(nw, NULL, L"SysTreeView32", NULL);
    NativeWindow ok_button = FindWindowEx(nw, NULL, L"Button", NULL);
    if (treeview && ok_button) {
      RECT rect_treeview,rect_ok_button;
      GetWindowRect(treeview, &rect_treeview);
      POINT pt_treeview,pt_button;
      pt_treeview.x = rect_treeview.left;
      pt_treeview.y = 0;
      ScreenToClient(nw, &pt_treeview);
      GetWindowRect(ok_button, &rect_ok_button);
      pt_button.x = rect_ok_button.left;
      pt_button.y = rect_ok_button.top;
      ScreenToClient(nw, &pt_button);
      MoveWindow(treeview, pt_treeview.x, pt_treeview.x,
                 rect_treeview.right-rect_treeview.left,
                 pt_button.y-2*pt_treeview.x, TRUE);
    }
    break;
  }
  return 0;
}

}
#elif defined GTK

// static
guchar* ScreenCaptureScriptObject::save_data_ = NULL;
int ScreenCaptureScriptObject::save_data_length_ = 0;
GtkWidget* ScreenCaptureScriptObject::save_dialog_ = NULL;
NPObject* ScreenCaptureScriptObject::save_callback_ = NULL;
GtkWidget* ScreenCaptureScriptObject::folder_dialog_ = NULL;
NPObject* ScreenCaptureScriptObject::folder_callback_ = NULL;

// static
void ScreenCaptureScriptObject::FreeSaveData() {
  if (save_data_)
    free(save_data_);
  save_data_ = NULL;
  save_data_length_ = 0;
}

// static
void ScreenCaptureScriptObject::ReleaseSaveCallback() {
  if (save_callback_) {
    NPN_ReleaseObject(save_callback_);
    save_callback_ = NULL;
  }
}

// static
void ScreenCaptureScriptObject::ReleaseFolderCallback() {
  if (folder_callback_) {
    NPN_ReleaseObject(folder_callback_);
    folder_callback_ = NULL;
  }
}

// static
void ScreenCaptureScriptObject::OnDialogResponse(
    GtkDialog* dialog, gint response, gpointer userData) {
  // Hide the dialog to prevent it from covering any alert dialog opened by
  // the JavaScript callback.
  gtk_widget_hide(GTK_WIDGET(dialog));
  if (response == GTK_RESPONSE_ACCEPT) {
    char* file = gtk_file_chooser_get_filename(GTK_FILE_CHOOSER(dialog));
    if (dialog == GTK_DIALOG(save_dialog_)) {
      if (file && save_data_) {
        std::string filename = file;
        int postfix_index = filename.rfind(".png");
        if (postfix_index == std::string::npos ||
            postfix_index != (filename.length() - 4))
          filename += ".png";
        InvokeCallback((NPP)userData, save_callback_,
                       SaveFile(filename.c_str(), save_data_, save_data_length_));
        // To indicate the callback has already been invoked.
        ReleaseSaveCallback();
      }
    } else {
      InvokeCallback((NPP)userData, folder_callback_, file);
    }
    g_free(file);
  }
  gtk_widget_destroy(GTK_WIDGET(dialog));
}

// static
void ScreenCaptureScriptObject::OnDialogDestroy(
    GtkObject* object, gpointer userData) {
  if (GTK_WIDGET(object) == save_dialog_) {
    FreeSaveData();
    // The callback has not been invoked, meaning that the dialog has been
    // canceled.
    if (save_callback_)
      InvokeCallback((NPP)userData, save_callback_, true);
    ReleaseSaveCallback();
    save_dialog_ = NULL;
  } else {
    ReleaseFolderCallback();
    folder_dialog_ = NULL;
  }
}
#elif defined __APPLE__

std::string GetSaveFileName(const char* title, const char* path, const char* dialog_title);
std::string GetDocumentFolder();
std::string SetSaveFolder(const char* path, const char* dialog_title);
bool OpenSaveFolder(const char* path);
bool IsFolder(const char* path);
#endif

bool ScreenCaptureScriptObject::GetDefaultSavePath(
    const NPVariant* args, uint32_t argCount, NPVariant* result) {
#ifdef _WINDOWS
  std::string pathStr = GetPicturePath();
  const char* path = pathStr.c_str();
  size_t length = pathStr.length();
#elif defined GTK
  const char* path = g_get_user_special_dir(G_USER_DIRECTORY_PICTURES);
  if (path == NULL)
    path = g_get_home_dir();
  size_t length = strlen(path);
#elif defined __APPLE__
  std::string pathStr = GetDocumentFolder();
  const char* path = pathStr.c_str();
  size_t length = pathStr.length();
#endif
  char* copy = (char *)NPN_MemAlloc(length + 1);
  memcpy(copy, path, length);
  copy[length] = 0;
  STRINGN_TO_NPVARIANT(copy, length, *result);
  return true;
}

bool ScreenCaptureScriptObject::SaveToClipboard(
    const NPVariant* args, uint32_t argCount, NPVariant* result) {
  BOOLEAN_TO_NPVARIANT(false, *result);
  if (argCount != 1 || !NPVARIANT_IS_STRING(args[0]))
    return false;

  char* base64 = strstr((char*)NPVARIANT_TO_STRING(args[0]).UTF8Characters,
                        "base64,");
  if (!base64)
   return false;
  base64 += 7;
  int base64size = NPVARIANT_TO_STRING(args[0]).UTF8Length - 7;

#ifdef _WINDOWS
  int byteLength = Base64DecodeGetRequiredLength(base64size);
  HGLOBAL handle = GlobalAlloc(GMEM_MOVEABLE, byteLength);
  if (!handle)
   return false;

  LPVOID bytes = GlobalLock(handle);
  if (!bytes)
   return false;

  Base64Decode(base64, base64size, (BYTE*)bytes, &byteLength);
  IStream* stream;
  CreateStreamOnHGlobal(handle, FALSE, &stream);
  Image* image = new Image(stream);
  if (!image) {
    if (stream)
      stream->Release();
    GlobalUnlock(handle);
    GlobalFree(handle);
    return false;
  }

  HDC dc = GetDC(NULL);
  HDC hmemdc = CreateCompatibleDC(dc);
  HBITMAP hbitmap = CreateCompatibleBitmap(dc, image->GetWidth(),
                                           image->GetHeight());
  SelectObject(hmemdc, hbitmap);
  SolidBrush brush(Color::White);
  Graphics g(hmemdc);
  g.FillRectangle(&brush, 0, 0, image->GetWidth(), image->GetHeight());
  g.DrawImage(image, 0, 0);

  delete image;
  stream->Release();
  GlobalUnlock(handle);
  GlobalFree(handle);

  if (!OpenClipboard(get_plugin()->get_native_window()))
    return false;

  EmptyClipboard();
  SetClipboardData(CF_BITMAP, hbitmap);
  CloseClipboard();
  DeleteDC(hmemdc);
  ReleaseDC(NULL, dc);
#elif defined GTK
  const gchar* curr_dir = g_get_current_dir();
  char temp_path[256];
  sprintf(temp_path, "%s/temp.png", curr_dir);
  if (SaveFileBase64(temp_path, base64, base64size)) {
    GtkClipboard* clipboard = gtk_clipboard_get(GDK_SELECTION_CLIPBOARD);
    if (clipboard == NULL)
      return false;
    GError *err = NULL;
    GdkPixbuf* buff = gdk_pixbuf_new_from_file(temp_path, &err);
    if (buff != NULL) {
      gtk_clipboard_set_image(clipboard, buff);
      gdk_pixbuf_unref(buff);
    } else {
      g_error_free(err);
      return false;
    }
  } else {
    return false;
  }
#endif
  BOOLEAN_TO_NPVARIANT(true, *result);
  return true;
}

#ifdef _WINDOWS
bool ScreenCaptureScriptObject::PrintImageWin(
    HDC printer_dc, ImageType imagetype, byte* imagedata, 
    int imagelen, int width, int height) {
  DOCINFO di = {sizeof(DOCINFO)};
  di.lpszDocName = _T("Image Print"); 
  di.lpszOutput = NULL; 
  di.lpszDatatype = NULL;
  di.fwType = 0; 

  int error = StartDoc(printer_dc, &di); 
  if (error == SP_ERROR) { 
    return false; 
  } 

  float scale_x, scale_y;
  int left, top, printer_width, printer_height, print_width, print_height;

  HDC screen_dc = GetDC(NULL);
  float screen_log_pixel_x = (float)GetDeviceCaps(screen_dc, LOGPIXELSX); 
  float screen_log_pixel_y = (float)GetDeviceCaps(screen_dc, LOGPIXELSY); 

  float printer_log_pixel_x = (float)GetDeviceCaps(printer_dc, LOGPIXELSX); 
  float printer_log_pixel_y = (float)GetDeviceCaps(printer_dc, LOGPIXELSY); 

  scale_x = printer_log_pixel_x / screen_log_pixel_x;

  scale_y = printer_log_pixel_y / screen_log_pixel_y;

  printer_width = GetDeviceCaps(printer_dc, HORZRES); 
  printer_height = GetDeviceCaps(printer_dc, VERTRES); 
  printer_width -= printer_log_pixel_x;
  printer_height -= printer_log_pixel_y;

  if (width * scale_x < printer_width) {
    print_width = width * scale_x;
  } else {
    print_width = printer_width;
  }
  if (height * scale_y < printer_height) {
    print_height = height * scale_y; 
  } else {
    print_height = printer_height;
  }

  int page_height = print_height / scale_y;
  int totoal_page_count = height / page_height + 
      ((height % page_height) ? 1 : 0);

  DWORD support_format = 0;
  BITMAPINFO bmi;
  memset(&bmi, 0, sizeof(bmi));
  bmi.bmiHeader.biSize        = sizeof(BITMAPINFOHEADER);
  bmi.bmiHeader.biWidth       = width;
  bmi.bmiHeader.biHeight      = height;
  bmi.bmiHeader.biPlanes      = 1;
  bmi.bmiHeader.biBitCount    = 0;
  bmi.bmiHeader.biSizeImage   = imagelen;

  if (imagetype == kImageTypePNG && 
      ExtEscape(printer_dc, CHECKPNGFORMAT, 
                imagelen, (LPCSTR)imagedata, 
                sizeof(support_format), (LPSTR)&support_format) && 
      support_format == 1) {
    bmi.bmiHeader.biCompression = BI_PNG;
  } else if (imagetype == kImageTypeJPEG &&
    ExtEscape(printer_dc, CHECKJPEGFORMAT, 
              imagelen, (LPCSTR)imagedata, 
              sizeof(support_format), (LPSTR)&support_format) && 
    support_format == 1) {
    bmi.bmiHeader.biCompression = BI_JPEG;
  } else {
    FILE* f = fopen("tempprint.png", "wb");
    if (f) {
      fwrite(imagedata, imagelen, 1, f);
      fflush(f);
      fclose(f);
    } else {
      return false;
    }
    Image* image = Image::FromFile(_T("tempprint.png"));
    HDC memdc = CreateCompatibleDC(screen_dc);
    HBITMAP hbitmap = CreateCompatibleBitmap(screen_dc, image->GetWidth(),
                                             image->GetHeight());
    SelectObject(memdc, hbitmap);
    SolidBrush brush(Color::White);
    Graphics g(memdc);
    g.FillRectangle(&brush, 0, 0, image->GetWidth(), image->GetHeight());
    g.DrawImage(image, 0, 0);
    delete image;
    HDC source_dc = g.GetHDC();
    for (int page_index = 0; page_index < totoal_page_count; page_index++) {
      error = StartPage(printer_dc); 
      left = 0;
      top = page_index * page_height;
      if ((page_index == totoal_page_count - 1) && 
        (height % page_height) != 0) {
          page_height = height % page_height;
      }
      print_height = page_height * scale_y;
      StretchBlt(printer_dc, printer_log_pixel_x/2, printer_log_pixel_y/2,
                 print_width, print_height, source_dc, left, top, width, 
                 page_height, SRCCOPY);

      error = EndPage(printer_dc);
    }
    DeleteObject(hbitmap);
    DeleteDC(memdc);
    g.ReleaseHDC(source_dc);
  }
  
  // If printer supports the image format, we send DIB data directly.
  if (support_format) {
    for (int page_index = 0; page_index < totoal_page_count; page_index++) {
      error = StartPage(printer_dc); 
      left = 0;
      top = height - page_index * page_height;
      if ((page_index == totoal_page_count - 1) && 
        (height % page_height) != 0) {
          page_height = height % page_height;
      }
      print_height = page_height * scale_y;
      top -= page_height;

      if (StretchDIBits(
          printer_dc, printer_log_pixel_x/2, printer_log_pixel_y/2,
          print_width, print_height, left, top, 
          width, page_height, imagedata, &bmi, 
          DIB_RGB_COLORS, SRCCOPY) == GDI_ERROR) {
        g_logger.WriteLog("Error", "StretchDIBits");
      }

      error = EndPage(printer_dc);
    }
  }
  ReleaseDC(NULL, screen_dc);

  error = EndDoc(printer_dc);
  return true;
}
#endif

bool ScreenCaptureScriptObject::PrintImage(const NPVariant* args, 
                                           uint32_t argCount, 
                                           NPVariant* result) {
  bool ret_value = false;
  BOOLEAN_TO_NPVARIANT(ret_value, *result);
  if (argCount != 4)
    return false;
  if (!NPVARIANT_IS_STRING(args[0]) || !NPVARIANT_IS_STRING(args[1]))
    return false;
  if (!NPVARIANT_IS_DOUBLE(args[2]) && !NPVARIANT_IS_INT32(args[2]))
    return false;
  if (!NPVARIANT_IS_DOUBLE(args[3]) && !NPVARIANT_IS_INT32(args[3]))
    return false;

  const char* url = (const char*)NPVARIANT_TO_STRING(args[0]).UTF8Characters;
  const char* title = (const char*)NPVARIANT_TO_STRING(args[1]).UTF8Characters;
  int image_width = NPVARIANT_IS_DOUBLE(args[2]) ? 
      NPVARIANT_TO_DOUBLE(args[2]) : NPVARIANT_TO_INT32(args[2]);
  int image_height = NPVARIANT_IS_DOUBLE(args[3]) ?
      NPVARIANT_TO_DOUBLE(args[3]) : NPVARIANT_TO_INT32(args[3]);

  const char* base64 = strstr(url, "base64,");
  if (!base64)
    return false;
  ImageType image_type = kImageTypePNG;
  if (strncmp(url, "data:image/jpeg", 15) == 0)
    image_type = kImageTypeJPEG;

  base64 += 7;
  int base64size = NPVARIANT_TO_STRING(args[0]).UTF8Length - 7;

#ifdef _WINDOWS
  int image_data_len = Base64DecodeGetRequiredLength(base64size);
  byte* image_data = new byte[image_data_len];
  Base64Decode(base64, base64size, image_data, &image_data_len);

  PRINTDLGEX option = {sizeof(PRINTDLGEX)};

  option.hwndOwner = get_plugin()->get_native_window();
  option.hDevMode = NULL;
  option.hDevNames = NULL;
  option.hDC = NULL;
  option.Flags = PD_RETURNDC | PD_HIDEPRINTTOFILE | PD_NOSELECTION | 
      PD_NOCURRENTPAGE | PD_USEDEVMODECOPIESANDCOLLATE | PD_NOPAGENUMS;
  option.Flags2 = 0;
  option.ExclusionFlags = 0;
  option.nPageRanges = 0;
  option.nMaxPageRanges = 0;
  option.lpPageRanges = NULL;
  option.nMinPage = 0;
  option.nMaxPage = 0;
  option.nCopies = 1;
  option.hInstance = NULL;
  option.lpPrintTemplateName = NULL;
  option.lpCallback = NULL;
  option.nPropertyPages = 0;
  option.lphPropertyPages = NULL;
  option.nStartPage = START_PAGE_GENERAL;
  option.dwResultAction = 0;
  HRESULT ret = PrintDlgEx(&option);

  if ((ret == S_OK)) {
    if (option.dwResultAction == PD_RESULT_PRINT) {
      DEVMODE* devmode = (DEVMODE*)GlobalLock(option.hDevMode);
      DEVNAMES* devnames = (DEVNAMES*)GlobalLock(option.hDevNames);
      ret_value = PrintImageWin(
          option.hDC, image_type, image_data, image_data_len, 
          image_width, image_height);
      GlobalUnlock(option.hDevMode);
      GlobalUnlock(option.hDevNames);
    }
    DeleteDC(option.hDC);
    GlobalFree(option.hDevMode);
    GlobalFree(option.hDevNames);
  }
#endif

  BOOLEAN_TO_NPVARIANT(ret_value, *result);
  return true;
}

bool ScreenCaptureScriptObject::AutoSave(
    const NPVariant* args, uint32_t argCount, NPVariant* result) {
  if (argCount < 3 || !NPVARIANT_IS_STRING(args[0]) ||
      !NPVARIANT_IS_STRING(args[1]) || !NPVARIANT_IS_STRING(args[2]))
    return false;

  const char* url = (const char*)NPVARIANT_TO_STRING(args[0]).UTF8Characters;
  const char* title = (const char*)NPVARIANT_TO_STRING(args[1]).UTF8Characters;
  const char* path = (const char*)NPVARIANT_TO_STRING(args[2]).UTF8Characters;

  const char* base64 = strstr(url, "base64,");
  if (!base64)
    return false;
  std::string postfix = ".png";
  if (strncmp(url, "data:image/jpeg", 15) == 0)
    postfix = ".jpeg";

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
  filename += postfix;
  std::string unique_filename;
  if (!GenerateUniqueFileName(filename, &unique_filename) ||
      !SaveFileBase64(unique_filename.c_str(), base64, base64size))
    result->value.boolValue = 0;

  return true;
}

bool ScreenCaptureScriptObject::SetSavePath(
    const NPVariant* args, uint32_t argCount, NPVariant* result) {
  if (argCount < 3 || !NPVARIANT_IS_STRING(args[0]) ||
      !NPVARIANT_IS_OBJECT(args[1]) || !NPVARIANT_TO_OBJECT(args[1]) ||
      !NPVARIANT_IS_STRING(args[2]))
    return false;

  const char* path = NPVARIANT_TO_STRING(args[0]).UTF8Characters;
  NPObject* callback = NPVARIANT_TO_OBJECT(args[1]);
  const char* dialog_title = NPVARIANT_TO_STRING(args[2]).UTF8Characters;

#ifdef _WINDOWS
  TCHAR display_name[MAX_PATH] = {0};
  BrowserParam param = {0};

  if (NPVARIANT_TO_STRING(args[0]).UTF8Length > 0)
    MultiByteToWideChar(CP_UTF8, 0, path, -1, param.initial_path, MAX_PATH);
  if (NPVARIANT_TO_STRING(args[2]).UTF8Length > 0)
    MultiByteToWideChar(CP_UTF8, 0, dialog_title, -1, param.title, MAX_PATH);

  BROWSEINFO info={0};
  info.hwndOwner = get_plugin()->get_native_window();
  info.lpszTitle = NULL;
  info.pszDisplayName = display_name;
  info.lpfn = BrowserCallback;
  info.ulFlags = BIF_RETURNONLYFSDIRS;
  info.lParam = (LPARAM)&param;
  BOOL bRet = SHGetPathFromIDList(SHBrowseForFolder(&info), display_name);

  char utf8[MAX_PATH];
  WideCharToMultiByte(CP_UTF8, 0,
                      bRet ? display_name : param.initial_path,
                      -1, utf8, MAX_PATH, 0, 0);
  InvokeCallback(get_plugin()->get_npp(), callback, utf8);
#elif defined GTK
  ReleaseFolderCallback();
  folder_callback_ = callback;
  NPN_RetainObject(callback);
  if (!folder_dialog_) {
    GtkWidget *dialog = gtk_file_chooser_dialog_new(
        dialog_title, NULL,
        GTK_FILE_CHOOSER_ACTION_SELECT_FOLDER,
        GTK_STOCK_CANCEL, GTK_RESPONSE_CANCEL,
        GTK_STOCK_OPEN, GTK_RESPONSE_ACCEPT, NULL);
    gtk_window_set_position(GTK_WINDOW(dialog), GTK_WIN_POS_CENTER);
    gtk_file_chooser_set_current_folder(GTK_FILE_CHOOSER(dialog), path);

    g_signal_connect(dialog, "response", G_CALLBACK(OnDialogResponse),
                     get_plugin()->get_npp());
    g_signal_connect(dialog, "destroy", G_CALLBACK(OnDialogDestroy),
                     get_plugin()->get_npp());
    gtk_widget_show_all(dialog);
    gtk_window_set_keep_above(GTK_WINDOW(dialog), TRUE);
    folder_dialog_ = dialog;
  }
  gtk_window_present(GTK_WINDOW(folder_dialog_));
#elif defined __APPLE__
  InvokeCallback(get_plugin()->get_npp(), callback,
                 SetSaveFolder(path, dialog_title).c_str());
#endif

  return true;
}

bool ScreenCaptureScriptObject::OpenSavePath(
    const NPVariant* args, uint32_t argCount, NPVariant* result) {
  if (argCount < 1 || !NPVARIANT_IS_STRING(args[0]))
    return false;

  const char* path = NPVARIANT_TO_STRING(args[0]).UTF8Characters;

#ifdef _WINDOWS
  TCHAR save_path[MAX_PATH] = L"";
  MultiByteToWideChar(CP_UTF8, 0, path, -1, save_path, MAX_PATH);
  ShellExecute(NULL, L"open", save_path, NULL, NULL, SW_SHOWNORMAL);
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

bool ScreenCaptureScriptObject::SaveScreenshot(
    const NPVariant* args, uint32_t argCount, NPVariant* result) {

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

  std::string postfix = ".png";
  if (strncmp(url, "data:image/jpeg", 15) == 0)
    postfix = ".jpeg";

  base64 += 7;
  int base64size = NPVARIANT_TO_STRING(args[0]).UTF8Length - 7;

#ifdef _WINDOWS
  TCHAR temp_value[MAX_PATH] = L"";
  char initial_path[MAX_PATH];
  char sz_dialog_title[MAX_PATH];

  MultiByteToWideChar(CP_UTF8, 0, dialog_title, -1, temp_value, MAX_PATH);
  WideCharToMultiByte(CP_ACP, 0, temp_value, -1, sz_dialog_title, MAX_PATH, 0, 0);

  MultiByteToWideChar(CP_UTF8, 0, path, -1, temp_value, MAX_PATH);
  WideCharToMultiByte(CP_ACP, 0, temp_value, -1, initial_path, MAX_PATH, 0, 0);

  char sz_file[MAX_PATH] = "";
  MultiByteToWideChar(CP_UTF8, 0, title, -1, temp_value, MAX_PATH);
  WideCharToMultiByte(CP_ACP, 0, temp_value, -1, sz_file, MAX_PATH, 0, 0);

  static const char* kReplacedChars = "\\/:*?\"<>|";
  int len = strlen(sz_file);
  for (int i = 0; i < len; i++) {
    if (sz_file[i] > ' ' && strchr(kReplacedChars, sz_file[i]) != NULL)
      sz_file[i] = '-';
  }
  strcat(sz_file, postfix.c_str());

  OPENFILENAMEA Ofn = {0};
  Ofn.lStructSize = sizeof(OPENFILENAMEA);
  Ofn.hwndOwner = get_plugin()->get_native_window();
  if (postfix == ".jpeg") {
    Ofn.lpstrFilter = "JPEG Image\0*.jpeg\0All Files\0*.*\0\0";
    Ofn.lpstrDefExt = "jpeg";
  } else {
    Ofn.lpstrFilter = "PNG Image\0*.png\0All Files\0*.*\0\0";
    Ofn.lpstrDefExt = "png";
  }
  Ofn.lpstrFile = sz_file;
  Ofn.nMaxFile = sizeof(sz_file);
  Ofn.lpstrFileTitle = NULL;
  Ofn.nMaxFileTitle = 0;
  Ofn.lpstrInitialDir = initial_path;
  Ofn.Flags = OFN_SHOWHELP | OFN_OVERWRITEPROMPT;
  Ofn.lpstrTitle = sz_dialog_title;

  InvokeCallback(
      get_plugin()->get_npp(), callback,
      !GetSaveFileNameA(&Ofn) || SaveFileBase64(sz_file, base64, base64size));

#elif defined GTK
  ReleaseSaveCallback();
  save_callback_ = callback;
  NPN_RetainObject(callback);

  FreeSaveData();
  gsize byteLength = (base64size * 3) / 4;
  save_data_ = (guchar*)malloc(byteLength);
  gint state = 0;
  guint save = 0;
  save_data_length_ = g_base64_decode_step(base64, base64size, save_data_,
                                         &state, &save);

  if (!save_dialog_) {
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
                     get_plugin()->get_npp());
    g_signal_connect(dialog, "destroy", G_CALLBACK(OnDialogDestroy),
                     get_plugin()->get_npp());
    gtk_widget_show_all(dialog);
    gtk_window_set_keep_above(GTK_WINDOW(dialog), TRUE);
    save_dialog_ = dialog;
  }
  gtk_window_present(GTK_WINDOW(save_dialog_));
#elif defined __APPLE__
  std::string file = GetSaveFileName(title, path, dialog_title);
  InvokeCallback(
      get_plugin()->get_npp(), callback,
      file.empty() || SaveFileBase64(file.c_str(), base64, base64size));
#endif

  return true;
}
