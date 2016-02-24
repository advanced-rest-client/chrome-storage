'use strict';
/* global _ */
Polymer({
  is: 'chrome-storage',
  /**
   * Fired when data was read from the storage.
   * It is accessible via `value` property.
   *
   * @event read
   */
  /**
   * Fired when error occurred.
   *
   * @event error
   * @param {String} message Error message.
   */
  /**
   * Fired when store data usage has been read.
   *
   * @event bytes-used
   * @param {Number} bytes Number of bytes used by the given key or whole storage.
   */
  /**
   * Fired when data has been stored into the store.
   *
   * @event saved
   */
  /**
   * Fired when data has been removed from the store.
   *
   * @event removed
   */
  /**
   * Fired when the store has been cleared.
   *
   * @event clear
   */
  properties: {
    /**
     * A storage area to use.
     * It can be either `sync`, `local` or `managed`.
     *
     * @type {String}
     */
    storage: {
      type: String,
      value: 'local'
    },
    /**
     * A property name to observe.
     * A name can be either key name or a path to the key.
     *
     * @type {String}
     */
    name: {
      type: String,
      value: '',
      observer: '_nameChanged'
    },
    /**
     * Value read from the store or to be set in store.
     * Chrome storage can store any serializable object.
     *
     * @type {String|Object|Number|Boolean}
     */
    value: {
      type: String,
      notify: true
    },
    /**
     * True when value change should save data automatically.
     *
     * @type {Boolean}
     */
    auto: {
      type: Boolean,
      value: false
    },
    /**
     * A default value for a read operation.
     * It must be the same type as `value`.
     *
     * @type {String|Object|Number|Boolean}
     */
    defaultValue: {
      type: Object,
      value: null //undefined returns empty object
    },
    /**
     * If set, it must be a valid function name. It will be called to wrap the object with.
     *
     * @example
     * this.valueAs = 'String';
     * this.read();
     * // result would be "2".
     */
    valueAs: {
      type: String
    },

    debug: {
      type: Boolean,
      value: false
    }
  },
  observers: [
    '_valueChanged(value.*)'
  ],
  _nameChanged: function() {
    if (this.auto && this.name) {
      if (this.debug) {
        console.log('Auto read invoced.');
      }
      this.read();
    }
  },
  _valueChanged: function() {
    if (this.auto) {
      if (this.debug) {
        console.log('Auto save invoced.');
      }
      this.store();
    }
  },
  /**
   * Gets one or more items from storage.
   * This function will set a `this.value` property and fire `on-value-changed` event.
   */
  read: function() {
    var obj;
    var name = this.name;
    if (typeof name === 'string') {
      obj = this._getDataObject(this.defaultValue);
    } else {
      obj = name;
    }
    if (this.debug) {
      console.log('Attempting to read an object.', obj);
    }
    chrome.storage[this.storage].get(obj, function(value) {
      if (chrome.runtime.lastError) {
        if (this.debug) {
          console.error('Read error.', chrome.runtime.lastError);
        }
        this.fire('error', chrome.runtime.lastError);
        return;
      }
      if (this.debug) {
        console.log('Read response (raw):', Object.assign({}, value));
      }
      if (typeof name === 'string') {
        let _arr = _.toPath(name);
        let tmp;
        _arr.forEach((item) => {
          if (!tmp) {
            tmp = value[item];
          } else {
            tmp = tmp[item];
          }
        });
        value = tmp;
      }
      if (this.debug) {
        console.log('Read response (parsed):', Object.assign({}, value));
      }
      value = this._wrapValue(value);
      if (this.debug) {
        console.log('Read response (wrapped):', Object.assign({}, value));
      }
      // preventing auto save on read;
      var auto = this.auto;
      this.auto = false;
      this.set('value', value);
      this.auto = auto;
      this.fire('read');
    }.bind(this));
  },
  /**
   * Gets the amount of space (in bytes) being used by one or more items.
   * In order to work properly this function require a single key or list of keys to get
   * the total usage for. An empty list will return 0. Pass in null to get the
   * total usage of all of storage.
   */
  getBytesInUse: function() {
    if (this.debug) {
      console.error('Running  get bytes in use');
    }
    chrome.storage[this.storage].getBytesInUse(this.name, (bytesInUse) => {
      if (chrome.runtime.lastError) {
        this.fire('error', chrome.runtime.lastError);
        return;
      }
      this.fire('bytes-used', {
        'bytes': bytesInUse
      });
    });
  },

  /**
   * Sets multiple items.
   * If `this.name` is an object then each key/value pair will be used to update storage with.
   * Any other key/value pairs in storage will not be affected.
   * Primitive values such as numbers will serialize as expected. Values with a typeof "object"
   * and "function" will typically serialize to {}, with the exception of Array
   * (serializes as expected), Date, and Regex (serialize using their String representation).
   * `this.value` must be an object until `this.name` is a string. If name is a string then
   * the value will be transformed to object where path is a `this.name`.
   */
  store: function() {
    if (this.debug) {
      console.log('Running store function.');
    }
    var value = {};
    if (typeof this.name === 'string') {
      value = this._getDataObject(this.value);
    } else {
      value = this.value;
    }
    if (this.debug) {
      console.log('Value to store ready', Object.assign({}, value));
    }
    chrome.storage[this.storage].set(value, () => {
      if (chrome.runtime.lastError) {
        if (this.debug) {
          console.error('Store error.', chrome.runtime.lastError);
        }
        this.fire('error', chrome.runtime.lastError);
        return;
      }
      if (this.debug) {
        console.log('Store successful');
      }
      this.fire('saved');
    });
  },
  /**
   * Removes one or more items from storage.
   * Note that this function will fail if the `this.name` if not either a string or array.
   */
  remove: function() {
    var name = this.name;
    if (!(typeof name === 'string' || (name instanceof Array))) {
      this.fire('error', {
        'message': 'A "name" must be either a string or an array.'
      });
      return;
    }
    if (this.debug) {
      console.log('Removing the object');
    }
    chrome.storage[this.storage].remove(name, () => {
      if (this.debug) {
        console.log('Remove successful');
      }
      this.fire('removed');
    });
  },
  /**
   * Removes all items from storage.
   */
  clear: function() {
    if (this.debug) {
      console.log('Clearing storage');
    }
    chrome.storage[this.storage].clear(() => {
      if (this.debug) {
        console.log('Storage cleared');
      }
      this.fire('clear');
    });
  },
  // /**
  //  * Register an alarm listener.
  //  * TODO: it isin't working well....
  //  */
  // created: function() {
  //   var context = this;
  //   this._eventFn = (changes, areaName) => {
  //     if (this.storage !== areaName) {
  //       return;
  //     }
  //     let name = this.name;
  //     if (!changes.value && !(name in changes)) {
  //       this.set('value', changes);
  //       return;
  //     }
  //     if (typeof name === 'string') {
  //       this.set('value', this._getPathValue(changes.value.newValue));
  //     } else if (name in changes) {
  //       this.read('value', changes[name]);
  //     }
  //   };
  //   chrome.storage.onChanged.addListener(this._eventFn);
  // },
  //
  // detached: function() {
  //   chrome.storage.onChanged.removeListener(this._eventFn);
  // },
  /**
   * Transform a path from `this.name` to an object with predefined value.
   *
   * @example
   * this.name = 'my.key.value.is';
   * this._getDataObject('so crazy');
   * //will be transformed to:
   * {my: {key: {value: {is: 'so crazy'}}}}
   *
   * @param {Any} value Any value that can be stored in the Chrome storage.
   * @return {Object} An object created from path in `this.name` and predefined value.
   */
  _getDataObject: function(value) {
    return this._setPathValue({}, this.name, value);
  },
  /**
   * See http://stackoverflow.com/a/13719956
   */
  _setPathValue: function(initObj, propString, value) {
    var obj = Object.assign({}, initObj);
    var propNames = _.toPath(propString);
    var propLength = propNames.length - 1;
    var tmpObj = obj;
    for (var i = 0; i <= propLength; i++) {
      tmpObj = tmpObj[propNames[i]] = i !== propLength ? {} : value;
    }
    return obj;
  },
  /**
   * Get a value from the path.
   *
   * @param {Object} obj An object to get a value from.
   * @return {Any|Undefined} An object value for given path in `this.name` or undefined if
   * path not found in the object.
   */
  _getPathValue: function(obj) {
    var _arr = _.toPath(this.name);
    for (let i = 0, len = _arr.length; i < len; i++) {
      if (obj === undefined) {
        return;
      }
      let path = _arr[i];
      obj = obj[path];
      if (i + 1 < len) {
        return obj;
      }
    }
  },
  /**
   * Wrap a value into an object.
   * Set a valueAs parameter to make it works.
   */
  _wrapValue: function(value) {
    var fnName = this.valueAs;
    if (!fnName || value === null || value === undefined) {
      return value;
    }

    var inst;
    if (window[fnName].constructor) {
      try {
        inst = new window[fnName](value);
      } catch (e) {}
    } else {
      inst = window[fnName](value);
    }
    if (!inst) {
      return value;
    }
    var _keys = Object.getOwnPropertyNames(value);
    _keys.forEach((item) => {
      if (!(item in inst)) {
        inst[item] = value[item];
      }
    });
    return inst;
  }
});
