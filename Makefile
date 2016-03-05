BUILDDIR := $(PWD)/build

SRCS = src/duktape.c src/jrq.c

SRCS = $(wildcard src/*.c)
OBJS = $(addprefix obj/,$(notdir $(SRCS:.c=.o)))

OBJS += obj/jrq_bundle.o

CFLAGS := -fno-omit-frame-pointer

all: jrq

clean:
	rm -rf obj/*
	rm -rf build/*

jrq: $(OBJS)
	mkdir -p $(BUILDDIR)
	$(CC) -o $(BUILDDIR)/$@ $^

obj/main.js:
	cat src/*.js > obj/main.js

UNAME := $(shell uname -s)

ifeq ($(UNAME), Darwin)
obj/jrq_bundle.o: obj/main.js
	touch obj/stub.c
	$(CC) -o obj/stub.o -c obj/stub.c
	cd obj && $(LD) -r -o jrq_bundle.o -sectcreate binary jrqjs main.js stub.o
else
obj/jrq_bundle.o: obj/main.js
	cd obj && $(LD) -r -b binary -o jrq_bundle.o main.js
endif

obj/%.o: src/%.c
	mkdir -p obj
	$(CC) $(CFLAGS) -c -o $@ $<

run: clean jrq
	echo '{"foobar": {"baz": "bat" }}' | $(BUILDDIR)/jrq foobar
