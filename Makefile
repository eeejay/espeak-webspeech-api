RDF = install.rdf

SOURCES = \
	bootstrap.js \
	chrome.manifest \
	content/js/espeak.jsm \
	content/js/espeak.worker.js \
	content/js/espeak.worker.data \
	content/js/espeak-speech-service.jsm \
	$(RDF)

EXT_NAME := \
	${shell sed -n 's/.*<em:id>\([^<]*\)@monotonous.org<\/em:id>.*/\1/p' < $(RDF)}
EXT_VERSION := \
	${shell sed -n 's/.*<em:version>\([^<]*\)<\/em:version>.*/\1/p' < $(RDF)}

XPI_FILE := $(EXT_NAME)-$(EXT_VERSION).xpi

TIMESTAMP = ${shell date -u +"%Y%m%d%H%M"}
SNAPSHOT = $(EXT_NAME)-snapshot-$(TIMESTAMP).xpi

all: $(SOURCES)

dist: $(XPI_FILE)

content/js/espeak.jsm: espeak/emscripten/js/espeak.js
	@echo Generating espeak.jsm ...
	@echo "EXPORTED_SYMBOLS = ['Espeak', 'PushAudioNode'];" > $@
	@cat $^ >> $@

espeak/emscripten/Makefile:
	git submodule init
	git submodule update

espeak/emscripten/js/espeak.js: espeak/emscripten/Makefile

espeak/emscripten/js/espeak.worker.js: espeak/emscripten/Makefile
	emmake make -C espeak/emscripten

espeak/emscripten/js/espeak.worker.data: espeak/emscripten/js/espeak.worker.js

content/js/espeak.worker.js: espeak/emscripten/js/espeak.worker.js
	cp $^ $@

content/js/espeak.worker.data: espeak/emscripten/js/espeak.worker.data
	cp $^ $@

$(XPI_FILE): $(SOURCES)
	zip $@ $^

clean:
	rm -f *.xpi content/js/espeak.jsm content/js/espeak.worker.js
	make -C espeak/emscripten clean

snapshot: $(XPI_FILE)
	@echo Creating snapshot: $(SNAPSHOT)
	@cp $(XPI_FILE) $(SNAPSHOT)
