function FakeStream(jrq, fd) { 
  if (!(this instanceof FakeStream))
    return new FakeStream(jrq, fd);

  EventEmitter.call(this);

  this._eof = false;
  this.jrq = jrq;
  this.fd = fd;
  this._internalBuffer = [];
}

FakeStream.prototype.on = EventEmitter.prototype.on;
FakeStream.prototype.emit = EventEmitter.prototype.emit;

FakeStream.prototype.read = function read(size) {
  var str;

  if (this._internalBuffer.length) {
    str = this._internalBuffer.shift();
  } else {
    str = this.jrq.read(this.fd, size);
  }

  if (str != null)
    this.emit('data', str);
  else {
    this._eof = true;
    this.emit('end');
  }

  return str;
};

FakeStream.prototype.unshift = function unshift(str) {
  this._internalBuffer.push(str);
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

FakeStream.prototype.resume = function() {
  str = this.read(4096);
  while (str != null) {
    str = this.read(4096);
  }
};

FakeStream.prototype.pause = function() {};
FakeStream.prototype.pipe = function() {};

FakeStream.prototype.isReadable = function() {
  return this._internalBuffer.length > 0 || !this._eof;
};
