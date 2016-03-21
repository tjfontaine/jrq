'use strict';

// fake out Node.js for oboe
function require() { return {}; }

if (!String.prototype.startsWith) {
    String.prototype.startsWith = function(searchString, position){
      position = position || 0;
      return this.substr(position, searchString.length) === searchString;
  };
}

var VALID_OPTIONS = {
  '0': true,
  '2': true,
  '4': true,
  'j': true,
  'a': true,
  'd': true,
  'g': true,
  'M': true,
  'c': true,
  'e': true,
  'k': true,
  'h': true,
};

function parseArguments(stream, argv) {
  var opts = {
    indent: 2,
    delimiter: ' ',
    args: [],
    format: 'jsony',
  };

  var a = [];

  argv.forEach(function(arg) {
    if (arg.startsWith('--')) {
      a = a.concat(arg.split('='));
    } else if (arg[0] === '-') {
      for (var i = 1; i < arg.length; i++) {
        if (VALID_OPTIONS[arg[i]]) {
          a.push('-' + arg[i])
        } else {
          a.push(arg[i]);
        }
      }
    } else {
      a.push(arg);
    }
  });

  argv = a;

  for (var i = 0; i < argv.length; i++) {
    var arg = argv[i];

    switch (argv[i]) {
      case '-0':
        opts.indent = 0;
        opts.format = 'json';
        break;
      case '-2':
        opts.indent = 2;
        opts.format = 'json';
        break;
      case '-4':
        opts.indent = 4;
        opts.format = 'json';
        break;
      case '-j':
        opts.indent = 2;
        opts.format = 'json';
        break;
      case '-d':
      case '--delimiter':
        opts.delimiter = argv[++i];
        break;
      case '-g':
      case '--group':
        opts.group = true;
        break;
      case '-a':
      case '--array':
        opts.array = true;
        break;
      case '-M':
      case '--items':
        opts.memoize = true;
        break;
      case '-k':
      case '--keys':
        opts.keys = true;
        break;
      case '-c':
        opts.conditional = new Function('return ' + argv[++i] + ';');
        break;
      case '-e':
        opts.evaluate = new Function(argv[++i]);
        break;
      case '-h':
      case '--help':
        opts.help = true;
        break;
      case '--':
        i++;
        while (i < argv.length) {
          opts.args.push(argv[i++]);
        }
        break;
      default:
        opts.args.push(argv[i]);
        break;
    }
  }

  switch(opts.delimiter) {
    case '\\t':
      opts.delimiter = '\t';
      break;
    case '\\v':
      opts.delimiter = '\v';
      break;
    case '\\n':
      opts.delimiter = '\n';
      break;
    case '\\0':
      opts.delimiter = '\0';
      break;
  }

  opts.args = opts.args.map(function (a) {
    var b = a.replace(/^\["(.*)"\]$/, '$1');
    return b;
  });


  return opts;
}

function validateOptions(options) {
  return true;
}

function writeHelp(stream) {
  var msg = [
    '  -h, --help    Print this help info and exit.',
  ].join('\n');
  stream.writeLine(msg);
}

function innerMain(jrq, args) {
  var stdin  = new FakeStream(jrq, jrq.stdinFd);
  var stdout = new FakeStream(jrq, jrq.stdoutFd);
  var stderr = new FakeStream(jrq, jrq.stderrFd);

  var options = parseArguments(stderr, args);

  if (!validateOptions(options) || options.help) {
    return writeHelp(stderr);
  }

  var parser = new JsonParse(stdin);

  var keyStack = [];
  var objectStack = [];
  var curKeyPath = undefined;
  var initialObject = undefined;

  function keyInPath(key) {
    var i = 0;

    if (options.array && initialObject === 'array')
      i = 1;

    var k = keyStack.slice(i);

    k.push(key)
    k = k.join('.');

    return keyPaths[k];
  }

  function updateCurKeyPath() {
    curKeyPath = keyStack.join('.');
  }

  function pushKey(key) {
    if (key !== undefined)
      keyStack.push(key);
    updateCurKeyPath();
  }

  function popKey(key) {
    if (key !== undefined)
      keyStack.pop();
    updateCurKeyPath();
  }

  var argOutput;
  var keyPaths = {};

  var objectDepth = -1;

  var foundKeys = [];

  options.args.forEach(function (arg, index) {
    var path = keyPaths[arg] = keyPaths[arg] || [];
    path.push(index);
  });

  var desired = 0;

  function addSelected(key, value) {
    var paths = keyInPath(key);

    if (value !== undefined && paths !== undefined) {
      switch (typeof value) {
        case 'object':
          break;
        case 'string':
          if (value.trim().length === 0)
            return;
          /* intentional fall through */
        default:
          value = JSON.parse(value);
          break;
      }

      for (var i = 0; i < paths.length; i++) {
        if (argOutput === undefined)
          argOutput = new Array(options.args.length);

        argOutput[paths[i]] = value;
      }
    }
 }

  parser.on('stateChange', function jrqStateChange(oldState, newState) {
    //stdout.writeLine([oldState, newState].join(' -> '));
  });

  parser.on('foundKey', function jrqFoundKey(key) {
    if (options.keys && objectDepth === 0) {
      foundKeys.push(key);
      return;
    }

    if (keyInPath(key) !== undefined)
      desired += 1;
  });

  parser.on('foundValue', function jrqFoundValue(key, value) {
    if (options.keys)
      return;

    addSelected(key, value);

    if (desired > 0)
      desired -= 1;

    if (options.array === true && objectDepth === 0 && initialObject === 'array')
      writeFoundKeys();
  });

  parser.on('unparsed', function jrqUnparsed(data) {
    stdout.write(data);
  });

  var hydrater = new JsonCreate();

  parser.on('startObject', function jrqStartObject(key, obj) {
    objectDepth += 1;

    if (initialObject === undefined)
      initialObject = 'object';

    if (key === undefined)
      return;

    if (options.keys)
      return;

    var paths = keyInPath(key)

    if (paths && paths.length > 0) {
      var newObj = hydrater.parse(obj);
      addSelected(key, newObj);
    }

    pushKey(key);

    if (options.array && options.args.length === 0 && objectDepth === 1) {
      argOutput = [hydrater.parse(obj)];
    }
  });

  parser.on('endObject', function jrqEndObject(key, obj) {
    objectDepth -= 1;

    popKey(key);

    if (options.keys)
      return;
  });

  parser.on('startArray', function jrqStartArray(key, obj) {
    objectDepth += 1;

    if (initialObject === undefined)
      initialObject = 'array';

    pushKey(key);

    if (options.keys)
      return;

    if (options.array && options.args.length === 0 && objectDepth === 1) {
      argOutput = [hydrater.parse(obj)];
    }
  });

  parser.on('endArray', function jrqEndArray(key, obj) {
    objectDepth -= 1;

    popKey(key);

    if (options.keys)
      return;
  });

  function writeFoundKeys() {
    if (argOutput === undefined)
      return;

    for (var a = 0; a < argOutput.length; a++) {
      switch (typeof argOutput[a]) {
        case 'string':
          if (options.format === 'json')
            argOutput[a] = JSON.stringify(argOutput[a],
                                          null,
                                          options.indent);
          break;
        case 'object':
          if (a-1 > 0 && typeof argOutput[a-1] !== 'object')
            stdout.writeLine('');

          stdout.writeLine(JSON.stringify(argOutput[a],
                                          null,
                                          options.indent));
          continue;
          break;
        case 'undefined':
          if (a+1 < argOutput.length)
            stdout.write(options.delimiter);
          continue;
          break;
      }

      stdout.write(argOutput[a].toString());
      if (argOutput.length > a+1 && typeof argOutput[a+1] !== 'object') {
        stdout.write(options.array ? options.delimiter : '\n');
      }
    }

    /*
     * Whether to add new lines or delimiters could/should be controlled by
     * "position" in the stdout stream
     */
    if (typeof argOutput[argOutput.length - 1] !== 'object')
      stdout.writeLine('');

    argOutput = undefined;
  }

  var count = 0;
  do {
    argOutput = undefined;
    foundKeys = [];

    if (!options.keys && !options.array && options.args.length === 0) {
      /*
       * In the fullness of time we would have a streaming JSON formatter as
       * well, but that's only useful when there are no selectors, since the
       * streaming formatter has less utility when we can't predict the order of
       * the keys in the stream as they relate to the selectors.
       */
      argOutput = [hydrater.parse(parser)];
    } else {
      parser.parse();
    }

    if (options.keys === true) {
      if (options.array === true)
        foundKeys.map(stdout.writeLine.bind(stdout));
      else
        stdout.writeLine(JSON.stringify(foundKeys, null, options.indent));
    } else {
      writeFoundKeys();
    }

    stdout.flush();
    count++;
  } while ((options.array || options.group) && stdin.isReadable());
}

function jrqMain(jrq, args) {
  try {
    innerMain(jrq, args);
  } catch (e) {
    print('we failed.');
    print(e.stack);
  }
}
