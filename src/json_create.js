function JsonCreate(stream) {
  if (!(this instanceof JsonCreate))
    return new JsonCreate(stream);

  EventEmitter.call(this);

  this._stream = stream;
}
JsonCreate.prototype.on = EventEmitter.prototype.on;
JsonCreate.prototype.emit = EventEmitter.prototype.emit;

JsonCreate.prototype.parse = function createParse(parser) {
  var self = this;

  var objectStack = [];

  var curObject;

  function objectType(a) {
      var t = typeof a;

      switch(t) {
        case 'object':
          if (Array.isArray(a))
            t = 'array';
          break;
      }

      return t;
  }

  function pushObject(obj, key) {
    if (curObject === undefined) {
      curObject = obj;
      //print('setting initial object', Array.isArray(obj) ? 'array':'object');
    } else if (key !== undefined) {
      objectStack.push(curObject);
      var otypes = objectStack.map(objectType);
      //print('pushing', typeof obj, JSON.stringify(otypes));
      curObject = obj;
    }
  }

  function popObject(key) {
    var oldObject = curObject;

    var otypes = objectStack.map(objectType);
    //print('popping', JSON.stringify(otypes));
    return objectStack.pop();
  }

  parser.on('foundKey', function jpFoundKey(key) {
    //print('foundKey', key);
  });

  parser.on('foundValue', function jpFoundValue(key, value) {
    //print('foundValue', makeKeys(key), '->', value);
    var val;

    //print('foundValue', key, value);

    if (value !== undefined) {
      if (value && value.length > 0 && curObject !== undefined) {
        val = JSON.parse(value);
        curObject[key] = val;
      }
    }
    //print('!!', JSON.stringify(curObject));
  });

  parser.on('startObject', function jpStartObject(key, obj) {
    var newObject = {};
    //print('startObject', key, typeof key);
    pushObject(newObject, key);
  });

  parser.on('endObject', function jpEndObject(key, obj) {
    //print('endObject', key); //, JSON.stringify(curObject));
      var oldObject = curObject;
      if (objectStack.length > 0 && key !== undefined) {
        curObject = popObject();
        if (typeof key !== 'number' && !Array.isArray(curObject))
          curObject[key] = oldObject;
      }
  });

  parser.on('startArray', function jpStartArray(key) {
    var newObject = [];
    //print('startArray', key, typeof key);
    pushObject(newObject, key);
  });

  parser.on('endArray', function jpEndArray(key) {
    //print('endArray', key); //, JSON.stringify(curObject));
      var oldObject = curObject;
      if (objectStack.length > 0 && key !== undefined) {
        curObject = popObject();
        curObject[key] = oldObject;
      }
  });

  parser.parse();

  if (objectStack.length === 1) {
    curObject = objectStack.pop()
  } else if (objectStack.length > 1) {
    print(JSON.stringify(curObject, null, 2));
    print(JSON.stringify(objectStack, null, 2));
    throw new Error('object stack too long');
  }

  return curObject;
};
