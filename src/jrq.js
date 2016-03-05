// fake out Node.js for oboe
function require() { return {}; }

function parseArguments(argv) {
  var opts = {
    indent: 2,
    delimiter: ' ',
    args: [],
  };

  for (var i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '-2':
        opts.indent = 2;
        break;
      case '-4':
        opts.indent = 4;
        break;
      case '-a':
        opts.array = true;
        break;
      case '-g':
        opts.global = true;
        break;
      case '-M':
        opts.memoize = true;
        break;
      case '-c':
        opts.conditional = new Function('return ' + argv[++i] + ';');
        break;
      case '-e':
        opts.evaluate = new Function(argv[++i]);
        break;
      case '--':
        while (i < argv.length) {
          opts.args.push(argv[i]);
          i++;
        }
        break;
      default:
        opts.args.push(argv[i]);
        break;
    }
  }

  return opts;
}

function innerMain(jrq, args) {
  var stdin  = new FakeStream(jrq, jrq.stdinFd);
  var stdout = new FakeStream(jrq, jrq.stdoutFd);
  var stderr = new FakeStream(jrq, jrq.stderrFd);

  var options = parseArguments(args);

  var o = oboe(stdin);

  o.done(function(obj) {
    //print('done', JSON.stringify(obj));
  });

  options.args.forEach(function(arg) {
    o.node(arg, function (val) {
      switch (typeof val) {
        case 'object':
          val = JSON.stringify(val, null, options.indent);
          break;
      }
      stdout.writeLine(val);
    });
  });

  stdin.resume();
}

function jrqMain(jrq, args) {
  try {
    innerMain(jrq, args);
  } catch (e) {
    print('we failed.');
    print(e.stack);
  }
}
