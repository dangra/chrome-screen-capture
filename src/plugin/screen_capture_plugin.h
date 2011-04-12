#ifndef SCREEN_CAPTURE_PLUGIN_H_
#define SCREEN_CAPTURE_PLUGIN_H_

#include "npapi.h"
#include "npruntime.h"
#include "npfunctions.h"
#include "plugin_base.h"
#include "script_object_base.h"

class ScreenCapturePlugin : public PluginBase {
public:
  ScreenCapturePlugin() {}
  virtual ~ScreenCapturePlugin() {}
    
  NPError Init(NPP instance, uint16_t mode, int16_t argc, char* argn[],
               char* argv[], NPSavedData* saved);
  NPError UnInit(NPSavedData** saved);
  NPError GetValue(NPPVariable variable, void *value);

  static PluginBase* CreateObject() { return new ScreenCapturePlugin; }

private:
  ScriptObjectBase* script_object_;
};

#endif // SCREEN_CAPTURE_PLUGIN_H_
