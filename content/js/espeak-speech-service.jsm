const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;


EXPORTED_SYMBOLS = ['EspeakSpeechService'];

const VOICE_URI_BASE = 'urn:moz-tts:espeak-addon:';

const ESPEAK_RATE_NORMAL = 175;
const ESPEAK_RATE_MAXIMUM = 450;
const ESPEAK_RATE_MINIMUM = 80;

const ESPEAK_PITCH_NORMAL = 50;

const URI_REGEX = /espeak-addon:(.*)\?lang=(.*)?/;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "Espeak",
  "chrome://espeak-web-api/content/js/espeak.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "PushAudioNode",
  "chrome://espeak-web-api/content/js/espeak.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "Services",
  "resource://gre/modules/Services.jsm");


function SpeechTaskCallback(aPusher, aTask) {
  this.pusher = aPusher;
  this.task = aTask;
}

SpeechTaskCallback.prototype = {
  QueryInterface: XPCOMUtils.generateQI([Ci.nsISpeechTaskCallback]),

  getInterfaces: function(c) {},

  onPause: function onPause() {
    this.pusher.disconnect();
    this.task.dispatchPause(this.pusher.context.currentTime - this.pusher.startTime, 0);
  },

  onResume: function onResume() {
    this.pusher.connect(this.pusher.context.destination);
    this.task.dispatchResume(this.pusher.context.currentTime - this.pusher.startTime, 0);
  },

  onCancel: function onCancel() {
    this.pusher.disconnect();
    this.task.dispatchEnd(this.pusher.context.currentTime - this.pusher.startTime, 0);
  }
};

function EspeakSpeechService() {
  this.audioContextRefs = new WeakMap();
  this.espeak = null;
  this.voices = [];
}

EspeakSpeechService.prototype = {
  serviceType: Ci.nsISpeechService.SERVICETYPE_INDIRECT_AUDIO,

  speak: function speak(aText, aUri) {
    let aRate = 1.0, aPitch = 0.5, aVolume = 1.0, aTask;
    if (arguments.length == 6) {
      // Recently changed interface passes volume argument.
      [aVolume, aRate, aPitch, aTask] = Array.prototype.slice.call(arguments, 2);
    } else {
      [aRate, aPitch, aTask] = Array.prototype.slice.call(arguments, 2);
    }
    let window = Services.wm.getMostRecentWindow('navigator:browser');
    let audioDestination = this.audioContextRefs.get(window);
    if (!audioDestination) {
      let ctx = new window.AudioContext();
      audioDestination = ctx.createGain();
      audioDestination.connect(ctx.destination);
      this.audioContextRefs.set(window, audioDestination);
    }

    let rate = Math.round(
      Math.max(
        Math.min(aRate * ESPEAK_RATE_NORMAL, ESPEAK_RATE_MAXIMUM),
        ESPEAK_RATE_MINIMUM));
    this.espeak.set_rate(rate);
    let pitch = Math.round(aPitch * ESPEAK_PITCH_NORMAL);
    this.espeak.set_pitch(pitch);
    let [_, vname, vlang] = URI_REGEX.exec(aUri);
    this.espeak.setVoice(decodeURI(vname), decodeURI(vlang));

    let pusher = new PushAudioNode(audioDestination.context,
      function() {
        aTask.dispatchStart();
      },
      function(elapsedTime) {
        aTask.dispatchEnd(elapsedTime, aText.length);
      });
    pusher.connect(audioDestination);

    audioDestination.gain.value = aVolume;

    aTask.setup(new SpeechTaskCallback(pusher, aTask));

    function boundaryEvent(name, charOffset, timestamp) {
      return function () {
        aTask.dispatchBoundary(name, timestamp, charOffset);
      };
    }

    this.espeak.synth(aText,
      function(samples, events) {
        if (!samples) {
          pusher.close();
          return;
        }

        for (var event of events) {
          let timestamp = event.audio_position / 1000
          switch(event.type) {
            case 'word': {
              let offset = event.text_position - 1;
              offset += aText.substr(offset).search(/[\s.$]/);
              pusher.addTrackCallback(timestamp,
                boundaryEvent('word', offset, timestamp));
              break;
            }
            case 'end':
            {
              if (event.text_position > aText.length) break;
              pusher.addTrackCallback(timestamp,
                boundaryEvent('sentence', event.text_position - 1, timestamp));
              break;
            }
            default:
              break;
          }
        }

        pusher.push(new Float32Array(samples));
    })
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsISpeechService]),

  getInterfaces: function(c) {},

  register: function() {
    var self = this;
    this.espeak = new Espeak(
      "chrome://espeak-web-api/content/js/espeak.worker.js",
      function() {
        self.espeak.listVoices(function(result) {
          var registry = Cc["@mozilla.org/synth-voice-registry;1"].getService(
            Ci.nsISynthVoiceRegistry);
          self.voices = [];
          for (var voice of result) {
            for (var language of voice.languages) {
              var uri = VOICE_URI_BASE +
                encodeURI(voice.name) + "?lang=" + encodeURI(language.name);
              registry.addVoice(self, uri, voice.name, language.name, true);
              self.voices.push(uri);
              if (voice.name == 'default') {
                registry.setDefaultVoice(uri, true);
              }
            }
          }
        });
      });
  },

  unregister: function() {
    this.espeak.worker.terminate();
    this.espeak = null;
    var registry = Cc["@mozilla.org/synth-voice-registry;1"].getService(
      Ci.nsISynthVoiceRegistry);
    for (var uri of this.voices) {
      registry.removeVoice(this, uri);
    }
  }
};
