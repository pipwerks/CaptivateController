//For debugging

//*
function debug(text) {
    if(window.console && console.log){
        console.log(text);
    } else if(window.opera && opera.postError){
        opera.postError(text);
    } else {
        alert(text);
    }
}
// */


/* ======================================================

CaptivateController()
Version 0.9.3, works with Adobe Captivate 2, 3, 4 & 5
Copyright (c) 2009-2011 Philip Hutchison
http://pipwerks.com/lab/captivate
MIT-style license. Full license text can be found at
http://www.opensource.org/licenses/mit-license.php

Notes:

* When examining data type (typeof) of variable returned via
  ExternalInterface, Internet Explorer returns proprietary
  "unknown" (objects accessed over a COM+ bridge). Hence
  all the (x !== UNKNOWN) conditions.

* Simple (typeof swf.GetVariable !== "undefined") checks don't
  work in Safari. Same for swf.cpGetValue and swf.cpEIGetValue

* Unfortunately there is no way to differentiate between a
  CP2 and CP3 file, since CP3 reports version as "2.0.0"

========================================================= */

var CaptivateController = function (swfID, usesExternalSkin){

    if(typeof swfID === "undefined"){ return false; } //Error-checking is a good thing.

    //Shortcuts for compression improvement
    var label_skin = "cpSkinLoader_mc.",
        RDCMND = "rdcmnd",
        CPCMND = "cpCmnd",
        prefix,
        UNDEFINED = "undefined",
        UNKNOWN = "unknown",
        NUMBER = "number",
        TRUE = true,
        FALSE = false,
        that = this,
        version = null,
        versionString = "",
        isCaptivate = FALSE,
        skinPath = "",
        getMethod = "GetVariable",
        setMethod = "SetVariable",
        CaptivateVersion = "CaptivateVersion",
        isAS3 = FALSE,
        gotoSlideUsesZeroIndex = FALSE,
        swf = document.getElementById(swfID); //Get SWF as an object so we can use SetVariable

    if(!swf){ return FALSE; } //Error-checking is a good thing.


    //SUPPORT FUNCTIONS
    var init = function (){

        var version_cpGetValue = null,
            version_cpGetValue_skinned = null,
            version_cpEIGetValue = null,
            version_cpEIGetValue_skinned = null,
            version_getvariable = null,
            version_getvariable_skinned = null,
            cpGetValueSupported = FALSE,
            cpGetEIValueSupported = FALSE,
            GetVariableSupported = FALSE,
            type_getvariable,
            type_getvariable_skin,
            type_cpGetValue,
            type_cpGetValue_skin,
            type_cpEIGetValue,
            type_cpEIGetValue_skin;


        /* --- Tests for versions: Captivate version & ActionScript version --- */

        //Test for GetVariable, cpGetValue, and cpEIGetValue support.
        //Captivate 4+ uses cpGetValue
        //Only CP5 uses cpEIGetValue

        //debug("swf.GetVariable('isCPMovie'): " +swf.GetVariable("isCPMovie"));
        //debug("swf.GetVariable('cpHasSkinSWF'): " +swf.GetVariable("cpHasSkinSWF"));
        //debug("swf.cpEIGetValue('isCPMovie'): " +swf.cpEIGetValue("isCPMovie"));
        //debug("swf.cpEIGetValue('cpHasSkinSWF'): " +swf.cpEIGetValue("cpHasSkinSWF"));

        //Check for CP5 first
        if(typeof swf.cpEIGetValue !== UNDEFINED){
            try { version_cpEIGetValue = swf.cpEIGetValue(CaptivateVersion); } catch(e1) { /* do nothing */}
            try { version_cpEIGetValue_skinned = swf.cpEIGetValue(label_skin +CaptivateVersion); } catch(e2) { /* do nothing */}
        }

        //Check for CP4
        if(typeof swf.cpGetValue !== UNDEFINED){
            try { version_cpGetValue = swf.cpGetValue(CaptivateVersion); } catch(e3) { /* do nothing */}
            try { version_cpGetValue_skinned = swf.cpGetValue(label_skin +CaptivateVersion); } catch(e4) { /* do nothing */}
        }

        //Check for CP/CP2/CP3
        if(typeof swf.GetVariable !== UNDEFINED){
            try { version_getvariable = swf.GetVariable(CaptivateVersion); } catch(e5) { /* do nothing */}
            try { version_getvariable_skinned = swf.GetVariable(label_skin +CaptivateVersion);} catch(e6) { /* do nothing */}
        }

        //Get our 'typeof's in order.
        type_getvariable = typeof version_getvariable;
        type_getvariable_skin = typeof version_getvariable_skinned;
        type_cpGetValue = typeof version_cpGetValue;
        type_cpGetValue_skin = typeof version_cpGetValue_skinned;
        type_cpEIGetValue = typeof version_cpEIGetValue;
        type_cpEIGetValue_skin = typeof version_cpEIGetValue_skinned;

        GetVariableSupported = (type_getvariable !== UNDEFINED && type_getvariable !== UNKNOWN && version_getvariable !== null) ||
                               (type_getvariable_skin !== UNDEFINED && type_getvariable_skin !== UNKNOWN && version_getvariable_skinned !== null) || FALSE;

        cpGetValueSupported = ((type_cpGetValue !== UNDEFINED && type_cpGetValue !== UNKNOWN && version_cpGetValue !== null) ||
                               (type_cpGetValue_skin !== UNDEFINED && type_cpGetValue_skin !== UNKNOWN && version_cpGetValue_skinned !== null)) || FALSE;

        //Updated for Captivate 5
        cpGetEIValueSupported = ((type_cpEIGetValue !== UNDEFINED && type_cpEIGetValue !== UNKNOWN && version_cpEIGetValue !== null) ||
                               (type_cpEIGetValue_skin !== UNDEFINED && type_cpEIGetValue_skin !== UNKNOWN && version_cpEIGetValue_skinned !== null)) || FALSE;

        //Get the string value of "CaptivateVersion".
        //Cascade through all the results until we get one that works.
        versionString = (cpGetEIValueSupported) ? version_cpEIGetValue || version_cpEIGetValue_skinned || FALSE :
                          (cpGetValueSupported) ? version_cpGetValue || version_cpGetValue_skinned || FALSE :
                          version_getvariable || version_getvariable_skinned  || FALSE;

        isCaptivate = (versionString !== FALSE);

        //If this isn't a Captivate file, let's stop now.
        if(!isCaptivate){ return FALSE; }

        //Remove "v" prefix, if any
        //We just want the major version, which comes before the first dot
        version = parseInt(versionString.replace(/v/gi, "").split(".")[0], 10);

        //CP4+ AS3 files don't support GetVariable for retrieving variables
        //CP5 is AS3 only. No more AS2!
        isAS3 = (version > 4 || (version > 3 && !GetVariableSupported));

        /*
        debug("versionString: " +versionString +"\n" +
            "version: " +version +"\n" +
            "cpGetValueSupported: " +cpGetValueSupported +"\n" +
            "GetVariableSupported: " +GetVariableSupported +"\n" +
            "cpGetEIValueSupported: " +cpGetEIValueSupported +"\n" +
            "isAS3: " +isAS3 +"\n" +
            "isCaptivate: " +isCaptivate);
        // */


        /* Select appropriate get/set methods. Defaults are GetVariable and SetVariable.
           Not using cpGetValue for AS2-based CP4 files because it doesn't appear to work in all cases (no external skin).
           It throws an error if encountering unknown parameter. AS3 version doesn't throw the error.
           AS2 version returns same set of variables using GetVariable, and with no errors.
           Only shortcoming is all data returned as string, not native data type.
        */
        //if(cpGetValueSupported && isAS3){
        if(cpGetEIValueSupported){
            getMethod = "cpEIGetValue";
            setMethod = "cpEISetValue";
        } else if(cpGetValueSupported){
            getMethod = "cpGetValue";
            setMethod = "cpSetValue";
        }

        //Test for skin
        if(!usesExternalSkin){

            var param = (version > 3) ? "isCPMovie" : "rdIsMainMovie",
                externalSkinDetected = FALSE;

            try {

                var result = swf[getMethod](label_skin +param),
                    type = typeof result;

                externalSkinDetected = (type !== UNDEFINED && type !== UNKNOWN && result !== null);

            } catch (e11){ /* do nothing */ }

            usesExternalSkin = externalSkinDetected;

        }

        skinPath = (usesExternalSkin) ? label_skin : "";
        prefix = (version > 3) ? CPCMND : RDCMND;

    };

    var isCaptivateSWF = function (){

        //Ensure version is populated
        if(version === null){ init(); }

        //If version isn't found, this isnt a Captivate SWF
        return isCaptivate;

    };

    var control = function (command, num){

        if(!isCaptivateSWF()){ return FALSE; }

        /*
            set value of num if num is undefined.
            num is usually only defined when invoking
            gotoSlideAndPlay, gotoSlideAndStop, gotoFrameAndPlay,
            and gotoFrameAndStop
        */

        if(typeof num === UNDEFINED){ num = 1; }

        switch (command) {

            case "pause": command = RDCMND + "Pause"; break;
            case "resume": command = RDCMND + "Resume"; break;
            case "next": command = RDCMND + "NextSlide"; break;
            case "previous": command = RDCMND + "Previous"; break;

            case "rewindAndStop":
                if(version === 5){
                    //Rewind and stop no longer available.
                    //Fake it with cpCmndGoToSlide
                    command = prefix + "GotoSlide";
                    num = 0;
                } else {
                    command = RDCMND + "RewindAndStop";
                }
                break;

            case "rewindAndPlay":
                command = (version === 5) ? FALSE : RDCMND + "RewindAndPlay";
                if(version === 5){
                    //Rewind and play no longer available in CP5
                    //Fake it with GotoFrameAndResume
                    //rdcmndGotoFrameAndResume only works when movie is paused, so let's pause first.
                    swf[setMethod](skinPath + RDCMND + "Pause", 1);
                    command = RDCMND + "GotoFrameAndResume";
                } else {
                    command = RDCMND + "RewindAndPlay";
                }
                break;

            case "gotoSlideAndPlay":
                if(!gotoSlideUsesZeroIndex){ num = num -1; }
                //Go to slide
                swf[setMethod](skinPath + prefix + "GotoSlide", num);
                //cpCmndGotoSlide will pause the movie, so let's resume playing.
                command = prefix + "Resume";
                num = 1;
                break;

            case "gotoSlideAndStop":
                if(!gotoSlideUsesZeroIndex){ num = num -1; }
                command = prefix + "GotoSlide";
                break;

            case "gotoFrameAndPlay":
                //rdcmndGotoFrameAndResume only works when movie is paused, so let's pause first.
                swf[setMethod](skinPath + RDCMND + "Pause", 1);
                command = RDCMND + "GotoFrameAndResume";
                break;

            case "gotoFrameAndStop": command = RDCMND + "GotoFrame"; break;
            case "volume": command = CPCMND + "Volume"; break;
            case "mute": command = prefix + "Mute"; break;
            case "unmute": command = prefix + "Mute"; num = 0; break;

            case "muteAndShowCaptions":
                //Mute first
                swf[setMethod](skinPath + prefix + "Mute", 1);
                //Now show captions
                command = prefix + "CC";
                break;

            case "unmuteAndHideCaptions":
                //Unmute first
                swf[setMethod](skinPath + prefix + "Mute", 0);
                //Hide captions
                command = prefix + "CC"; num = 0;
                break;

            case "showCaptions": command = prefix + "CC"; break;
            case "hideCaptions": command = prefix + "CC"; num = 0; break;

            //rdcmndInfo does not work in CP5
            case "info": command = (version === 5) ? FALSE : RDCMND + "Info"; break;

            case "hidePlaybar": command = (version > 3) ? CPCMND + "ShowPlaybar" : RDCMND + "HidePlaybar";
                                num = (version > 3) ? 0 : 1; break;

            case "showPlaybar": command = (version > 3) ? CPCMND + "ShowPlaybar" : RDCMND + "HidePlaybar";
                                num = (version > 3) ? 1 : 0; break;

            case "lockTOC": command = (version > 3) ? "cpLockTOC" : FALSE; break; //Enables/disables user interaction on TOC. Only works in CP4+.
            case "unlockTOC": command = (version > 3) ? "cpLockTOC" : FALSE; num = 0; break; //Enables/disables user interaction on TOC. Only works in CP4+.
            case "exit": command = RDCMND + "Exit"; break;

            default: command = FALSE; //Explicitly setting fall-through command to false so we can test for validity below

        }

        if(command){ swf[setMethod](skinPath + command, num); }

        return that; //returning 'that' allows chaining

    };

    var getInfo = function (param, query_external_skin){

        if(!isCaptivateSWF()){ return FALSE; }

        //debug("querying " +param);

        var result = null,
            skin = (typeof query_external_skin !== UNDEFINED && query_external_skin) ? "" : skinPath;

        switch(param){

            //"rdinfoHasPlaybar" is handled differently because it targets the skin file
            case "rdinfoHasPlaybar":

                try { result = swf[getMethod](param); } catch(e1){ /* do nothing */ }
                if(typeof result === UNDEFINED || result === null){
                    try { result = swf[getMethod](skin + param); } catch(e2){ /* do nothing */ }
                }
                result = (typeof result !== UNDEFINED) ? result : FALSE;
                break;

            //"playbarHeight" and "playbarPosition" are available in the skin in AS2 files.
            case "playbarHeight":
            case "playbarPosition":

                if(!isAS3){

                    try {
                        result = swf.GetVariable(param);
                    } catch(e3){
                        try { result = swf.GetVariable(skin + param); } catch(e4){ /* do nothing */ }
                    }

                } else {
                    //In CP5 this value is only available in the external skin
                    if(version === 5){ skin = ""; }
                    result = swf[getMethod](skin + param);
                }
                break;

            //CP5 only. These two properties are native XML in AS3, and use the 'cpEIXMLGetValue' ExternalInterface command
            case "movieXML":
            case "PlaybarProperties":

                //Try the main SWF first, then if not found try without skin path
                try { result = swf.cpEIXMLGetValue(skin + param); } catch(e7){ /* do nothing */ }
                if(typeof result === UNDEFINED || result === null){
                    try { result = swf.cpEIXMLGetValue(param); } catch(e8){ /* do nothing */ }
                }
                break;

            default:

                //Try the main SWF first, then if not found try without skin path
                try { result = swf[getMethod](skin + param); } catch(e9){ /* do nothing */ }
                if(typeof result === UNDEFINED || result === null){
                    try { result = swf[getMethod](param); } catch(e10){ /* do nothing */ }
                }

        }

        //Ensure all "undefined" return as null
        return (typeof result !== UNDEFINED) ? result : null;

    };

    var setCPVariableValue = function (param, value){

        if(!isCaptivateSWF()){ return FALSE; }

        var result = null,
            skin = (typeof query_external_skin !== UNDEFINED && query_external_skin) ? "" : skinPath;

        //Try the main SWF first, then if not found try without skin path
        try {
            swf[setMethod](skin + param, value);
        } catch(e9){
            try {
                swf[setMethod](param, value);
            } catch(e10){
                /* do nothing */
            }
        }

    };

    // --- API misc. ---
    this.swf = swf;

    // -- Set options --
    this.useZeroIndex = function(bool){ gotoSlideUsesZeroIndex = (bool) ? TRUE : FALSE; };


    // --- API for controlling Captivate SWF ---
    this.pause = function (){ return control("pause"); };
    this.resume = function (){ return control("resume"); };
    this.next = function (){ return control("next"); };
    this.previous = function (){ return control("previous"); };
    this.rewindAndStop = function (){ return control("rewindAndStop"); };
    this.rewindAndPlay = function (){ return control("rewindAndPlay"); };
    this.gotoSlideAndStop = function (num){ if(typeof num === NUMBER){ return control("gotoSlideAndStop", num); } };
    this.gotoSlideAndPlay = function (num){ if(typeof num === NUMBER){ return control("gotoSlideAndPlay", num); } };
    this.gotoFrameAndStop = function (num){ if(typeof num === NUMBER){ return control("gotoFrameAndStop", num); } };
    this.gotoFrameAndPlay = function (num){ if(typeof num === NUMBER){ return control("gotoFrameAndPlay", num); } };
    this.showInfoBox = function (){ return control("info"); };
    this.exit = function (){ return control("exit"); };
    this.lockTOC = function (){ return control("lockTOC"); };
    this.unlockTOC = function (){ return control("unlockTOC"); };
    this.hidePlaybar = function (){ return control("hidePlaybar"); };
    this.showPlaybar = function (){ return control("showPlaybar"); };
    this.mute = function (){ return control("mute"); };
    this.unmute = function (){ return control("unmute"); };
    this.muteAndShowCaptions = function (){ return control("muteAndShowCaptions"); };
    this.unmuteAndHideCaptions = function (){ return control("unmuteAndHideCaptions"); };
    this.showCaptions = function (){ return control("showCaptions"); };
    this.hideCaptions = function (){ return control("hideCaptions"); };

    this.volume = function(num){
        //Setting/getting volume only works in CP4+.
        if(isCaptivateSWF() && (version > 3)){
            //Set volume
            if(typeof num === NUMBER){ control("volume", num); }
            //return volume level
            return getInfo("cpCmndVolume");
        }
        return null;
    };

    // --- API for querying Captivate SWF ---
    this.query = function (param){ return getInfo(param); };
    this.queryExternalSkin = function (param){ return getInfo(param, TRUE); };
    this.captivateVersion = function (){ return (isCaptivateSWF()) ? version : FALSE; };
    this.asVersion = function (){ return (isCaptivateSWF()) ? (isAS3) ? 3 : 2 : FALSE; };
    this.hasSkinSWF = function (){ return (isCaptivateSWF()) ? usesExternalSkin : FALSE; };
    this.hasTOC = function (){ return (isCaptivateSWF() && getInfo("NoOfTOCEntries") !== null) ? TRUE : FALSE; };
    this.width = function (){ return (isCaptivateSWF() && (version > 3)) ? getInfo("cpMovieWidth") : swf.TGetProperty("/", 8); };
    this.height = function (){ return (isCaptivateSWF() && (version > 3)) ? getInfo("cpMovieHeight") : swf.TGetProperty("/", 9); };
    this.FPS = function (){
        if(!isCaptivateSWF()){ return FALSE; }
        return getInfo("rdinfoFPS") || getInfo("cpInfoFPS") || "";
    };
    this.hasPlaybar = function (){
        if(!isCaptivateSWF()){ return FALSE; }
        if(version > 3){ return (getInfo("cpInfoHasPlaybar")) ? TRUE : FALSE; }
        return (getInfo("rdinfoHasPlaybar")) ? TRUE : FALSE;
    };

    // --- API for setting data ---
    this.set = function(param, value){ setCPVariableValue(param, value); }

    /* --- Flash (not Captivate) properties --- */
    this.percentLoaded = function (){ return swf.PercentLoaded(); };
    this.getname = function (){ return swf.TGetProperty("/", 13); };
    this.geturl = function (){ return swf.TGetProperty("/", 15); };

    return this;

};