function EventEmitter() {
  this._events = {};
}

EventEmitter.prototype.on = function eeOn(handler, cb) {
  var fns = this._events[handler] = this._events[handler] || [];
  fns.push(cb);
  return this;
};

EventEmitter.prototype.emit = function eeEmit(handler, a,b,c,d,e,f,g,h,i) {
  var fns = this._events[handler] || [];
  for (var i = 0; i < fns.length; i++) {
    fns[i](a,b,c,d,e,f,g,h,i);
  }
};
