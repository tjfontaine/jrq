function FakeStream(jrq, fd) { 
  this.jrq = jrq;
  this.fd = fd;
  this._events = {};
}

FakeStream.prototype.read = function read(size) {
  var str = this.jrq.read(this.fd, size);

  if (str != null)
    this.emit('data', str);
  else
    this.emit('end');

  return str;
};

FakeStream.prototype.write = function write(str) {
  this.jrq.write(this.fd, str);
};

FakeStream.prototype.writeLine = function writeLine(str) {
  this.write(str + '\n');
};

FakeStream.prototype.flush = function flush() {
  this.jrq.fsync(this.fd);
};

FakeStream.prototype.on = function(handler, cb) {
  var fns = this._events[handler] = this._events[handler] || [];
  fns.push(cb);
  return this;
};

FakeStream.prototype.emit = function(handler, data) {
  var fns = this._events[handler] || [];
  for (var i = 0; i < fns.length; i++) {
    fns[i](data);
  }
};

FakeStream.prototype.resume = function() {
  str = this.read(4096);
  while (str != null) {
    str = this.read(4096);
  }
};

FakeStream.prototype.pause = function() {};
FakeStream.prototype.pipe = function() {};
