'use strict';

var JsonState = {
  UNPARSED: 'UNPARSED',
  IN_OBJECT: 'IN_OBJECT',
  OBJECT_END: 'OBJECT_END',
  ARRAY_END: 'ARRAY_END',
  HAVE_KEY: 'HAVE_KEY',
  SYNTAX_ERROR: 'SYNTAX_ERROR',
  NEED_COLON: 'NEED_COLON',
  NEED_VALUE: 'NEED_VALUE',
  NEED_END: 'NEED_END',
  PARSE_STRING: 'PARSE_STRING',
  PARSE_NUMBER: 'PARSE_NUMBER',
  PARSE_TRUE: 'PARSE_TRUE',
  PARSE_FALSE: 'PARSE_FALSE',
  PARSE_NULL: 'PARSE_NULL',
  PARSE_OBJECT: 'PARSE_OBJECT',
  PARSE_ARRAY: 'PARSE_ARRAY',
};

function JsonParse(stream) {
  if (!(this instanceof JsonParse))
    return new JsonParse(stream);

  EventEmitter.call(this);

  this._stream = stream;
  this._init();
}

JsonParse.prototype.on = EventEmitter.prototype.on;
JsonParse.prototype.emit = EventEmitter.prototype.emit;

JsonParse.prototype._init = function initialState() {
  this._state = JsonState.UNPARSED;
  this._unparsed = '';
  this._to_parse = undefined;
  this._cur_key = undefined;
  this._cur_value = undefined;
  this._escape = false;
  this._cur_position = 0;
  this._line_number = 0;
  this._array_index = -1;
  this._is_array = false;
  this._initialParseType = undefined;
  this._expectedEndState = JsonState.OBJECT_END;
};

JsonParse.prototype._transition = function transition(newState) {
  if (newState === undefined)
    throw new Error("Undefined transition");

  var oldState = this._state;

/*
  if (newState === oldState && newState !== JsonState.IN_OBJECT)
    throw new Error('duplicate transition: ' + newState + ' ' + this._to_parse);
*/

  /*
   * TODO XXX FIXME Validate State Transitions
   */

  this._state = newState;

  this.emit('stateChange', oldState, newState);
};

JsonParse.prototype.parse = function parse() {
  this._init();

  while (this._state === JsonState.UNPARSED ||
         (this._state !== JsonState.SYNTAX_ERROR &&
          !this.completed() &&
          this._stream.isReadable())) {
    var str = this._stream.read(4096);

    if (str === null)
      break;

    if (this._state === JsonState.UNPARSED) {
      for (var i = 0; i < str.length; i++) {
        if (str[i] === '{' || str[i] === '[') {
          if (str[i] === '{') {
            this._transition(JsonState.IN_OBJECT);
            this._startObject(this);
            this._initialParseType = 'object';
            this._expectedEndState = JsonState.OBJECT_END;
          } else {
            this._transition(JsonState.NEED_VALUE);
            this._startArray(this);
            this._is_array = true;
            this._array_index = 0;
            this._initialParseType = 'array';
            this._expectedEndState = JsonState.ARRAY_END;
          }

          this._unparsed += str.slice(0, i);
          i++;
          this._to_parse = str.slice(i);

          break;
        }
      }
    } else {
      this._to_parse = str;
    }

    if (this._to_parse === undefined) {
      this._unparsed = str;
    }

    if (this._unparsed.length) {
      this.emit('unparsed', this._unparsed)
      this._unparsed = '';
    }

    if (this._to_parse !== undefined) {
      this._parse();
    }
  }

  if (this._to_parse !== undefined && this._to_parse.trim().length > 0) {
    this._stream.unshift(this._to_parse);
    this._to_parse = undefined;
  }

  if (this._state !== JsonState.UNPARSED &&
      this._state !== JsonState.SYNTAX_ERROR) {
    switch (this._initialParseType) {
      case 'object':
        if (this._state === JsonState.OBJECT_END)
          return this._endObject(this);
        break;
      case 'array':
        if (this._state === JsonState.ARRAY_END)
          return this._endArray(this);
        break;
      default:
        throw new Error("Unknown initial parsing type: " +
                        this._initialParseType);
        break;
    }
  }

  if (this._stream.isReadable())
    this._syntaxError('Failed to finish parsing: ' + this._initialParseType);
};

JsonParse.prototype._curKey = function curKey() {
  return this._is_array ? this._array_index : this._cur_key ? JSON.parse(this._cur_key) : this._cur_key;
};

JsonParse.prototype._startArray = function startArray(obj) {
  this.emit('startArray', this._curKey(), obj);
  //this._transition(JsonState.NEED_VALUE);
};

JsonParse.prototype._endArray = function endArray(obj) {
  this._is_array = false;
  this.emit('endArray', this._curKey(), obj);
};

JsonParse.prototype._startObject = function startObject(obj) {
  this.emit("startObject", this._curKey(), obj);
};

JsonParse.prototype._endObject = function endObject(obj) {
  this.emit("endObject", this._curKey(), obj);
};

JsonParse.prototype.completed = function completed() {
  return this._state === this._expectedEndState;
}

JsonParse.prototype._parse = function parseStep() {
  var count = 0;
  while (!this.completed() &&
         this._state !== JsonState.SYNTAX_ERROR &&
         this._to_parse !== undefined &&
         this._to_parse.trim().length > 0) {
    //print('cur parse state', this._state);
    count += 1;
    switch (this._state) {
      case JsonState.IN_OBJECT:
        this._findKey();
        break;
      case JsonState.HAVE_KEY:
        this._findKey();
        break;
      case JsonState.NEED_COLON:
        this._findColon();
        break;
      case JsonState.NEED_VALUE:
        this._findValue();
        break;
      case JsonState.NEED_END:
        this._findEnd();
        break;
      case JsonState.PARSE_STRING:
        this._parseString();
        break;
      case JsonState.PARSE_NUMBER:
        this._parseNumber();
        break;
      case JsonState.PARSE_TRUE:
        this._parseTrue();
        break;
      case JsonState.PARSE_FALSE:
        this._parseFalse();
        break;
      case JsonState.PARSE_NULL:
        this._parseNull();
        break;
      case JsonState.PARSE_OBJECT:
        this._parseObject();
        break;
      case JsonState.PARSE_ARRAY:
        this._parseArray();
        break;
      case JsonState.OBJECT_END:
      case JsonState.ARRAY_END:
        break;
      default:
        throw new Error("unknown state handler: " + this._state);
        break;
    }
  }
};

JsonParse.prototype._findKey = function findKey() {
  if (this._state === JsonState.IN_OBJECT)
    this._skipWhiteSpace();

  if (this._cur_key === undefined)
    this._cur_key = '';

  var len = this._to_parse.length;

  for (var i = 0; i < len; i++) {
    this._incrementPosition();

    var c = this._to_parse[i];

    if (this._escape) {
      this._incrementPosition();
      i++;
      this._escape = false;
      continue;
    }

    switch (c) {
      case '\\':
        if (i < len) {
          this._incrementPosition();
          i++;
        } else {
          this._escape = true;
        }
        break;
      case '"':
        switch (this._state) {
          case JsonState.IN_OBJECT:
            this._transition(JsonState.HAVE_KEY);
            continue;
            break;
          case JsonState.HAVE_KEY:
            i++;
            this._incrementPosition();
            this._cur_key += this._to_parse.slice(0, i);
            this._to_parse = this._to_parse.slice(i);
            this._transition(JsonState.NEED_COLON);
            return;
            break;
        }
        break;
    }
  }

  if (this._to_parse !== undefined) {
    this._cur_key += this._to_parse;
    this._to_parse = undefined;
  }
};

JsonParse.prototype._newLine = function newLine() {
  this._cur_position = 0;
  this._line_number += 1;
};

JsonParse.prototype._incrementPosition = function incrementPosition() {
  this._cur_position += 1;
};

JsonParse.prototype._syntaxError = function syntaxError(errMsg) {
  var fullMessage = [
                      "Syntax Error:", errMsg,
                      "on line:", this._line_number,
                      "position:", this._cur_position,
                     ].join(" ");
  throw new Error(fullMessage);
};

JsonParse.prototype._isWhiteSpace = function isWhiteSpace(i) {
  switch(this._to_parse[i]) {
    case '\n':
    case '\t':
    case ' ':
      return true;
      break;
    default:
      return false;
      break;
  }
}

JsonParse.prototype._skipWhiteSpace = function skipWhiteSpace() {
  //print('skipWhiteSpace');
  for (var i = 0; i < this._to_parse.length; i++) {
    switch (this._to_parse[i]) {
      case '\n':
        this._newLine();
      case ' ':
      case '\t':
        this._incrementPosition();
        break;
      default:
        this._to_parse = this._to_parse.slice(i);
        return;
        break;
    }
  }
};

JsonParse.prototype._findColon = function findColon() {
  //print('findColon');
  this._skipWhiteSpace();
  for (var i = 0; i < this._to_parse.length; i++) {
    this._incrementPosition();
    switch(this._to_parse[i]) {
      case ':':
        i++;
        this._incrementPosition();
        this._to_parse = this._to_parse.slice(i);
        this.emit('foundKey', this._curKey());
        this._transition(JsonState.NEED_VALUE);
        return;
        break;
      default:
        this._syntaxError("Expected Colon, got: " + this._to_parse[i]);
        return;
        break;
    }
  }
};

JsonParse.prototype._findValue = function findValue() {
  this._skipWhiteSpace();

  if (this._cur_value === undefined)
    this._cur_value = '';

  //print('findValue');
  for (var i = 0; i < this._to_parse.length; i++) {
    switch(this._to_parse[i]) {
      case '"':
        this._cur_value = '"';
        this._incrementPosition();
        i++;
        this._to_parse = this._to_parse.slice(i);
        this._transition(JsonState.PARSE_STRING);
        return;
        break;
      case '-':
      case '0':
      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
      case '7':
      case '8':
      case '9':
        this._transition(JsonState.PARSE_NUMBER);
        return;
        break;
      case 't':
        this._transition(JsonState.PARSE_TRUE);
        return;
        break;
      case 'f':
        this._transition(JsonState.PARSE_FALSE);
        return;
        break;
      case 'n':
        this._transition(JsonState.PARSE_NULL);
        return;
        break;
      case '{':
        this._transition(JsonState.PARSE_OBJECT);
        return;
        break;
      case '[':
        this._transition(JsonState.PARSE_ARRAY);
        return;
        break;
      /* hypothetical empty array */
      case ']':
        if (this._is_array) {
          i++;
          this._to_parse = this._to_parse.slice(i);
          this._transition(JsonState.ARRAY_END);
          return;
        }
      default:
        this._syntaxError("Unexpected value character: " + this._to_parse[i]);
        break;
    }
  }
};

JsonParse.prototype._isEnd = function isEnd(i) {
  var v = this._to_parse[i];

  switch (v) {
    case ',':
      if (this._is_array)
        return JsonState.NEED_VALUE;
      else
        return JsonState.IN_OBJECT;
      break;
    case '}':
      return JsonState.OBJECT_END;
      break;
    case ']':
      if (this._is_array)
        return JsonState.ARRAY_END;
      break;
    default:
      return undefined;
      break;
  }
}

JsonParse.prototype._findEnd = function findEnd() {
  this._skipWhiteSpace();
  for (var i = 0; i < this._to_parse.length; i++) {
    this._incrementPosition();
    if (!this._maybeEnd(i))
      return this._syntaxError("Didn't find end marker: " + this._to_parse[i]);
    else
      return;
  }
};

JsonParse.prototype._foundValue = function foundValue() {
  var key = this._curKey();

  if (this._is_array) {
    this._array_index += 1;
  }

  this.emit('foundValue', key, this._cur_value);
  this._cur_value = undefined;

  if (this._is_array) {
    this._transition(JsonState.NEED_VALUE);
  } else {
    this._cur_key = undefined;
    this._transition(JsonState.IN_OBJECT);
  }
};

JsonParse.prototype._curValueAppend = function curValueAppend(start, end, shift) {
  var toAppend = this._to_parse.slice(start, end);
  this._to_parse = this._to_parse.slice(shift || end);

  if (toAppend && toAppend.trim().length > 0) {
    if (this._cur_value === undefined)
      this._cur_value = '';
    this._cur_value += toAppend;
  }
};

JsonParse.prototype._maybeEnd = function maybeEnd(i) {
  var nextState = this._isEnd(i);

  if (nextState !== undefined) {
    this._incrementPosition();
    i++;
    this._curValueAppend(0, i-1, i);
    this._foundValue();
    this._transition(nextState);
    return true;
  }

  var c = this._to_parse[i];

  switch (c) {
    case ' ':
    case '\n':
    case '\t':
      this._curValueAppend(0, i);
      this._skipWhiteSpace();
      this._transition(JsonState.NEED_END);
      return true;
      break;
  }

  return false;
}

/* Order of the characters matters, we can do better here */
JsonParse.prototype._parseNumber = function parseNumber() {
  this._skipWhiteSpace();
  for (var i = 0; i < this._to_parse.length; i++) {
    this._incrementPosition();

    if (this._isWhiteSpace(i)) {
      this._curValueAppend(0, i);
      this._transition(JsonState.NEED_END);
      return;
    }

    if (this._maybeEnd(i))
      return;

    switch (this._to_parse[i]) {
      case '-':
      case '+':
      case '0':
      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
      case '7':
      case '8':
      case '9':
      case '.':
      case 'e':
      case 'E':
        break;
      default:
        this._syntaxError("Failed to parse number, character: " +
          this._to_parse[i]);
        break;
    }
  }
};

JsonParse.prototype._parseTrue = function parseTrue() {
  this._skipWhiteSpace();
  for (var i = 0; i < this._to_parse.length; i++) {
    this._incrementPosition();

    if (this._isWhiteSpace(i)) {
      this._curValueAppend(0, i);
      this._transition(JsonState.NEED_END);
      return;
    }

    if (this._maybeEnd(i))
      return;

    switch (this._to_parse[i]) {
      case 't':
      case 'r':
      case 'u':
      case 'e':
        break;
      default:
        this._syntaxError("Failed to parse true, character: " +
          this._to_parse[i]);
        break;
    }
  }
};

JsonParse.prototype._parseFalse = function parseFalse() {
  this._skipWhiteSpace();
  for (var i = 0; i < this._to_parse.length; i++) {
    this._incrementPosition();

    if (this._isWhiteSpace(i)) {
      this._curValueAppend(0, i);
      this._transition(JsonState.NEED_END);
      return;
    }

    if (this._maybeEnd(i))
      return;

    switch (this._to_parse[i]) {
      case 'f':
      case 'a':
      case 'l':
      case 's':
      case 'e':
        break;
      default:
        this._syntaxError("Failed to parse false, character: " +
          this._to_parse[i]);
        break;
    }
  }
};

JsonParse.prototype._parseNull = function parseTrue() {
  this._skipWhiteSpace();
  for (var i = 0; i < this._to_parse.length; i++) {
    this._incrementPosition();

    if (this._isWhiteSpace(i)) {
      this._curValueAppend(0, i);
      this._transition(JsonState.NEED_END);
      return;
    }

    if (this._maybeEnd(i))
      return;

    switch (this._to_parse[i]) {
      case 'n':
      case 'u':
      case 'l':
      case 'l':
        break;
      default:
        this._syntaxError("Failed to parse null, character: " +
          this._to_parse[i]);
        break;
    }
  }
};

JsonParse.prototype._parseString = function parseString() {
  this._skipWhiteSpace();
  for (var i = 0; i < this._to_parse.length; i++) {
    this._incrementPosition();

    var c = this._to_parse[i];

    if (this._escape) {
      this._incrementPosition();
      i++;
      this._escape = false;
      continue;
    }

    switch (c) {
      case '\\':
        if (i < this._to_parse.length) {
          this._incrementPosition();
          i++;
        } else {
          this._escape = true;
        }
        break;
      case '"':
        i++;
        this._incrementPosition();
        this._curValueAppend(0, i);
        this._transition(JsonState.NEED_END);
        return;
        break;
    }
  }

  if (this._to_parse !== undefined) {
    this._cur_value += this._to_parse;
    this._to_parse = undefined;
  }
};

/*
 * Really, we don't need to create a new parser, but just restart the state
 * machine, but in practice the new object is just a new state machine -- so use
 * the call stack directly.
 */
JsonParse.prototype._parseObject = function parseObject() {
  this._skipWhiteSpace();
  this._stream.unshift(this._to_parse);
  this._to_parse = undefined;

  var subobject = new JsonParse(this._stream);
  subobject._events = this._events;

  this._startObject(subobject);

  if (!subobject.completed()) {
    subobject.parse();
  }

  this._cur_value = undefined;

  this._endObject(subobject);

  this._transition(JsonState.NEED_END);
};

JsonParse.prototype._parseArray = function parseArray() {
  //print('parseArray');
  this._skipWhiteSpace();
  this._stream.unshift(this._to_parse);
  this._to_parse = undefined;

  var subarray = new JsonParse(this._stream);
  subarray._events = this._events;

  this._startArray(subarray);

  if (!subarray.completed()) {
    subarray.parse();
  }

  this._cur_value = undefined;

  this._endArray(subarray);

  this._transition(JsonState.NEED_END);
};
