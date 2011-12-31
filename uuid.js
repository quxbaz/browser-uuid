/*
 * Generate RFC4122 (v1 and v4) UUIDs
 *
 * Documentation at https://github.com/broofa/node-uuid
 */
(function() {
  var _global = this;

  // Random number generator (feature-detected below)
  var _rng;

  // node.js 'crypto' API
  // http://nodejs.org/docs/v0.6.2/api/crypto.html#randomBytes
  try {
    _rng = require('crypto').randomBytes;
  } catch (e) {}

  // WHATWG crypto api, available in Chrome
  // http://wiki.whatwg.org/wiki/Crypto
  if (!_rng && _global.crypto && crypto.getRandomValues) {
    var _rnds = new Uint32Array(4), _rndBytes = new Array(16);
    var _rng = function() {
      // Get 32-bit rnds
      crypto.getRandomValues(_rnds);

      // Unpack into byte array
      for (var c = 0 ; c < 16; c++) {
        _rndBytes[c] = _rnds[c >> 2] >>> ((c & 0x03) * 8) & 0xff;
      }
      return _rndBytes;
    };
  }

  // Math.random - least desirable option since it does not guarantee
  // cryptographic quality.
  if (!_rng) {
    var _rndBytes = new Array(16);
    _rng = function() {
      var r, b = _rndBytes, i = 0;

      for (var i = 0, r; i < 16; i++) {
        if ((i & 0x03) == 0) r = Math.random() * 0x100000000;
        b[i] = r >>> ((i & 0x03) << 3) & 0xff;
      }

      return b;
    };
  }

  // Buffer class to use
  var BufferClass = typeof(Buffer) == 'function' ? Buffer : Array;

  // Maps for number <-> hex string conversion
  var _byteToHex = [];
  var _hexToByte = {};
  for (var i = 0; i < 256; i++) {
    _byteToHex[i] = (i + 0x100).toString(16).substr(1);
    _hexToByte[_byteToHex[i]] = i;
  }

  /** See docs at https://github.com/broofa/node-uuid */
  function parse(s, buf, offset) {
    var i = (buf && offset) || 0, ii = 0;

    buf = buf || [];
    s.toLowerCase().replace(/[0-9a-f]{2}/g, function(byte) {
      if (ii < 16) { // Don't overflow!
        buf[i + ii++] = _hexToByte[byte];
      }
    });

    // Zero out remaining bytes if string was short
    while (ii < 16) {
      buf[i + ii++] = 0;
    }

    return buf;
  }

  /** See docs at https://github.com/broofa/node-uuid */
  function unparse(buf, offset) {
    var i = offset || 0, bth = _byteToHex;
    return  bth[buf[i++]] + bth[buf[i++]] +
            bth[buf[i++]] + bth[buf[i++]] + '-' +
            bth[buf[i++]] + bth[buf[i++]] + '-' +
            bth[buf[i++]] + bth[buf[i++]] + '-' +
            bth[buf[i++]] + bth[buf[i++]] + '-' +
            bth[buf[i++]] + bth[buf[i++]] +
            bth[buf[i++]] + bth[buf[i++]] +
            bth[buf[i++]] + bth[buf[i++]];
  }

  // Pre allocate array for constructing uuids
  var _buffer = new BufferClass(16);

  //
  // v1 UUID support
  //
  // Inspired by https://github.com/LiosK/UUID.js
  // and http://docs.python.org/library/uuid.html
  //

  // random #'s we need to init node and clockseq
  var _seedBytes = _rng(10);

  // Per 4.5, create and 48-bit node id, (47 random bits + multicast bit = 1)
  var _nodeId = [
    _seedBytes[0] | 0x01,
    _seedBytes[1], _seedBytes[2], _seedBytes[3], _seedBytes[4], _seedBytes[5]
  ];

  // Per 4.2.2, randomize (14 bit) clockseq
  var _clockseq = (_seedBytes[6] << 8 | _seedBytes[7]) & 0x3fff;

  // Previous uuid creation time
  var _lastMSecs = 0, _lastNSecs = 0;

  /** See docs at https://github.com/broofa/node-uuid */
  function v1(options, buf, offset) {
    var i = buf && offset || 0;
    var b = buf || _buffer;

    options = options || {};

    var clockseq = options.clockseq != null ? options.clockseq : _clockseq;

    // UUID timestamps are 100 nano-second units since the Gregorian epoch,
    // 1582-10-15 00:00.  JSNumbers aren't precise enough for this, so time is
    // represented here as 'msecs' (integer milliseconds) and 'nsecs'
    // (100-nanoseconds offset from msecs) since unix epoch, 1970-01-01 00:00.
    var msecs = options.msecs != null ? options.msecs : new Date().getTime();

    // Per 4.2.1.2, use count of uuid's generated during the current clock
    // cycle to simulate higher resolution clock
    var nsecs = options.nsecs != null ? options.nsecs : _lastNSecs + 1;

    // Per 4.2.1.2 If generator creates more than one uuid per 100-ns
    // interval, throw an error
    if (nsecs >= 10000) {
      throw new Error('uuid.v1(): Can\'t create more than 10M uuids/sec');
    }

    // Time since last uuid creation (in msecs)
    var dt = (msecs - _lastMSecs) + (nsecs - _lastNSecs)/10000;

    // Per 4.2.1.2, Bump clockseq on clock regression (but only if clockseq
    // isn't specified as an option)
    if (dt < 0 && options.clockseq == null) {
      clockseq = clockseq + 1 & 0x3fff;
    }

    // Reset nsecs if clock regresses (new clockseq) or we've moved onto a new
    // time interval (but only if nsecs isn't specified as an option)
    if ((dt < 0 || msecs > _lastMSecs) && options.nsecs == null) {
      nsecs = 0;
    }

    _lastMSecs = msecs;
    _lastNSecs = nsecs;
    _clockseq = clockseq;

    // Per 4.1.4 - Convert from unix epoch to Gregorian epoch
    msecs += 12219292800000;

    // time_low
    var tl = ((msecs & 0xfffffff) * 10000 + nsecs) % 0x100000000;
    b[i++] = tl >>> 24 & 0xff;
    b[i++] = tl >>> 16 & 0xff;
    b[i++] = tl >>> 8 & 0xff;
    b[i++] = tl & 0xff;

    // time_mid
    var tmh = (msecs / 0x100000000 * 10000) & 0xfffffff;
    b[i++] = tmh >>> 8 & 0xff;
    b[i++] = tmh & 0xff;

    // time_high_and_version
    b[i++] = tmh >>> 24 & 0xf | 0x10; // include version
    b[i++] = tmh >>> 16 & 0xff;

    // clock_seq_hi_and_reserved (Per 4.2.2 - include variant)
    b[i++] = clockseq >>> 8 | 0x80;

    // clock_seq_low
    b[i++] = clockseq & 0xff;

    // node
    var node = options.node || _nodeId;
    for (var n = 0; n < 6; n++) {
      b[i + n] = node[n];
    }

    return buf ? buf : unparse(b);
  }

  //
  // v4 UUID support
  //

  /** See docs at https://github.com/broofa/node-uuid */
  function v4(options, buf, offset) {
    // Deprecated - 'format' argument, as supported in v1.2
    var i = buf && offset || 0;
    if (typeof(options) == 'string') {
      buf = options == 'binary' ? new BufferClass(16) : null;
      options = null;
    }

    var rnds = options && options.random || _rng(16);
    // Per 4.4, set bits for version and clock_seq_hi_and_reserved
    rnds[6] = (rnds[6] & 0x0f) | 0x40;
    rnds[8] = (rnds[8] & 0x3f) | 0x80;

    // Copy bytes to buffer, if provided
    if (buf) {
      for (var ii = 0; ii < 16; ii++) {
        buf[i + ii] = rnds[ii];
      }
    }

    return buf || unparse(rnds);
  }

  //
  // Export API
  //

  var uuid = v4;
  uuid.v1 = v1;
  uuid.v4 = v4;
  uuid.parse = parse;
  uuid.unparse = unparse;
  uuid.BufferClass = BufferClass;

  if (typeof(module) != 'undefined') {
    module.exports = uuid;
  } else {
    var _previousRoot = _global.uuid;
    uuid.noConflict = function() {
      _global.uuid = _previousRoot;
      return uuid;
    }
    _global.uuid = uuid;
  }
}());
