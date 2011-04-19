#include "screen_capture_plugin.h"

#include "log.h"
#include "screen_capture_script_object.h"
#include "script_object_factory.h"

extern Log g_logger;

NPError ScreenCapturePlugin::Init(NPP instance, uint16_t mode, int16_t argc,
                                   char* argn[],char* argv[], 
                                   NPSavedData* saved) {
  g_logger.WriteLog("msg", "ScreenCapturePlugin Init");
  script_object_ = NULL;

#ifdef _WINDOWS
  int bWindowed = 1;
#else
  int bWindowed = 0;
#endif
  NPN_SetValue(instance, NPPVpluginWindowBool, (void *)bWindowed);

  instance->pdata = this;
  return PluginBase::Init(instance, mode, argc, argn, argv, saved);
}

NPError ScreenCapturePlugin::UnInit(NPSavedData** save) {
  g_logger.WriteLog("msg", "ScreenCapturePlugin UnInit");
  PluginBase::UnInit(save);
  script_object_ = NULL;
  return NPERR_NO_ERROR;
}

NPError ScreenCapturePlugin::GetValue(NPPVariable variable, void *value) {
  switch(variable) {
    case NPPVpluginScriptableNPObject:
      if (script_object_ == NULL)
        script_object_ = ScriptObjectFactory::CreateObject(
            get_npp(), ScreenCaptureScriptObject::Allocate);
      if (script_object_ != NULL)
        *(NPObject**)value = script_object_;
      else
        return NPERR_OUT_OF_MEMORY_ERROR;
      break;
    case NPPVpluginNeedsXEmbed:
      *(bool*)value = 1;
      break;
    default:
      return NPERR_GENERIC_ERROR;
  }
  return NPERR_NO_ERROR;
}
