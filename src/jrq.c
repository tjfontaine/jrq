#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <errno.h>

#ifdef __APPLE__
#include <mach-o/getsect.h>
#include <mach-o/dyld.h>
#else
extern const unsigned char _binary_main_js_start[];
extern const unsigned char _binary_main_js_end[];
#endif

#include "duktape.h"

#define ARG_START 1

static
duk_ret_t
jrq_read(duk_context *ctx)
{
  static char readBuffer[4096];
  int fd = duk_require_int(ctx, 0);
  size_t readSize = duk_require_int(ctx, 1);
  ssize_t bytesRead = 0;

  bytesRead = read(fd, readBuffer, MIN(sizeof(readBuffer) - 1, readSize));

  if (bytesRead == 0) {
    duk_push_null(ctx);
  } else if (bytesRead > 0) {
    readBuffer[bytesRead] = '\0';
    duk_push_string(ctx, readBuffer);
  } else {
    fprintf(stderr, "Failed to read: %s\n", strerror(errno));
    fflush(stderr);
    exit(2);
  }

  return 1;
}

static
duk_ret_t
jrq_write(duk_context *ctx)
{
  int fd = duk_require_int(ctx, 0);
  const char* str = duk_require_string(ctx, 1);
  size_t len = strlen(str);
  ssize_t bytesWritten = 0; 

  bytesWritten = write(fd, str, len);

  if (bytesWritten < 0) {
    fprintf(stderr,
      "Failed to write to %d of len %zu: %s\n", fd, len, strerror(errno));
    fflush(stderr);
    exit(3);
  }

  duk_push_int(ctx, bytesWritten);

  return 1;
}

static
duk_ret_t
jrq_fsync(duk_context *ctx)
{
  int fd = duk_require_int(ctx, 0);
  int ret = fsync(fd);

  duk_push_int(ctx, ret);

  return 1;
}

int
main(int argc, char** argv)
{
  duk_context *ctx = NULL;
  duk_idx_t argArray;
  int ret = 0, i;
  const char* alternate_file = getenv("JRQ_ALTERNATE_FILE");

  ctx = duk_create_heap_default();

  if (ctx == NULL)
  {
    fprintf(stderr, "Failed to create a Duktape heap.\n");
    fflush(stderr);
    exit(1);
  }

  if (alternate_file != NULL)
  {
    if (duk_peval_file(ctx, argv[1]) != 0)
    {
      fprintf(stderr, "Error: %s\n", duk_safe_to_string(ctx, -1));
      goto error;
    }
  }
  else
  {
    size_t jrqLen;
    char* jrqJs;

#ifdef __APPLE__
    const struct mach_header *hdr = _dyld_get_image_header(0);
    jrqJs = (char*)getsectiondata((struct mach_header_64*)hdr, "binary",
        "jrqjs", &jrqLen);
#else
    size_t jrqLen = _binary_main_js_end - _binary_main_js_start;
    jrqJs = _binary_main_js_start;
#endif

    if (duk_peval_lstring(ctx, jrqJs, jrqLen) != 0)
    {
      fprintf(stderr, "Error: %s\n", duk_safe_to_string(ctx, -1));
      goto error;
    }
  }

  duk_pop(ctx);

  duk_push_global_object(ctx);
  duk_get_prop_string(ctx, -1, "jrqMain");

  duk_push_object(ctx);

  duk_push_c_function(ctx, jrq_read, 2);
  duk_put_prop_string(ctx, -2, "read");

  duk_push_c_function(ctx, jrq_write, 2);
  duk_put_prop_string(ctx, -2, "write");

  duk_push_c_function(ctx, jrq_fsync, 1);
  duk_put_prop_string(ctx, -2, "fsync");

  duk_push_int(ctx, STDIN_FILENO);
  duk_put_prop_string(ctx, -2, "stdinFd");
  duk_push_int(ctx, STDOUT_FILENO);
  duk_put_prop_string(ctx, -2, "stdoutFd");
  duk_push_int(ctx, STDERR_FILENO);
  duk_put_prop_string(ctx, -2, "stderrFd");

  argArray = duk_push_array(ctx);

  for (i = ARG_START; i < argc; i++)
  {
    duk_push_string(ctx, argv[i]);
    duk_put_prop_index(ctx, argArray, i - ARG_START);
  } 

  if (duk_pcall(ctx, 2) != 0) {
    fprintf(stderr, "Error: %s\n", duk_safe_to_string(ctx, -1));
    goto error;
  } else {
    goto finished;
  }

error:
  ret = -1;
  fflush(stderr);

finished:
  duk_destroy_heap(ctx);

  return ret;
}
