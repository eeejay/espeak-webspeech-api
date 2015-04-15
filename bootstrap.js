/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

const CC = Components.Constructor;
const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "Services",
  "resource://gre/modules/Services.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "EspeakSpeechService",
  "chrome://espeak-web-api/content/js/espeak-speech-service.jsm");

var espeakService;

function startup(data, reason) {
  Services.prefs.setBoolPref('media.webspeech.synth.enabled', true);
  espeakService = new EspeakSpeechService();
  espeakService.register();
}

function shutdown(data, reason) {
  Services.prefs.clearUserPref('media.webspeech.synth.enabled');
  espeakService.unregister();
}

function install(data, reason) {
}

function uninstall(data, reason) {
}

